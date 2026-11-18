import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fork} from 'node:child_process';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {createToolHost} from '../src/tools.mjs';

const calls = (...items) => ({kind:'calls', calls:items});
const page = (id, page) => ({id, name:'read_page', arguments:{documentId:'atlas-a', page}});
const reread = (id, resultRef, selection) => ({id, name:'read_result',
  arguments:{resultRef, ...(selection === undefined ? {} : {selection})}});
const extraSelection = {offset:0, limit:1400};
const bindings = {gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'read-correction',version:'1'},plugins:[],adapters:[]};
const tool = (messages, id) => messages.find(m => m.callId === id)?.result;
async function directory(t) {
  const parent = resolve('test-output');
  await mkdir(parent, {recursive:true});
  const dir = await mkdtemp(join(parent,'read-correction-'));
  t.after(() => rm(dir,{recursive:true,force:true}));
  return dir;
}

for (const mode of ['correct', 'changed-ref', 'repeated', 'grouped', 'second-correction']) {
  test('original read correction ' + mode, async t => {
    const dir = await directory(t);
    const store = await openSession({directory:dir});
    let modelCalls = 0;
    try {
      const outcome = await run({
        question:'Use the original source.',
        outputRoot:join(dir,'outputs'),
        hostProjection:'host-results@3',
        allowedTools:['read_page','read_result','save_report'],
        allowedDocuments:['atlas-a'],
        requireReport:true,
        limits:{maxRounds:7,maxTools:6,timeoutMs:30000},
        durable:{store,grantId:'original-read-grant',bindings},
        gateway:{mode:'fixture', next({messages}) {
          modelCalls++;
          if (modelCalls === 1) return calls(page('one',1),page('two',2));
          const first = tool(messages,'one').value;
          if (modelCalls === 2) {
            const invalid = reread('bad',first.resultRef,extraSelection);
            return mode === 'grouped' ? calls(invalid,reread('other',first.resultRef)) : calls(invalid);
          }
          if (modelCalls === 3) {
            const rejected = tool(messages,'bad');
            assert.equal(rejected.dispatched,false);
            assert.equal(rejected.error,'READ_RESULT_ORIGINAL_SELECTION');
            assert.match(rejected.repairAdvice,/same resultRef/);
            assert.deepEqual(Object.keys(rejected.validation).sort(),['code','repairable','requestHash','schemaVersion']);
            return calls(reread('corrected',mode === 'changed-ref' ? tool(messages,'two').value.resultRef : first.resultRef,
              mode === 'repeated' ? extraSelection : undefined));
          }
          assert.equal(tool(messages,'corrected').value.text,first.text);
          if (modelCalls === 4) {
            assert.equal(tool(messages,'bad').repairAdvice,undefined);
            if (mode === 'second-correction') return calls(reread('again',first.resultRef,extraSelection));
            return calls({id:'report',name:'save_report',arguments:{text:'Original [1].',sourceIds:[first.sourceId]}});
          }
          return {kind:'final',text:'Saved.'};
        }}
      });
      const saved = store.inspect(outcome.runId);
      assert.equal(outcome.status,mode === 'correct' ? 'completed' : 'failed');
      const expected = {
        correct:[null,5,4],
        grouped:['TOOL_REJECTED',2,2],
        'changed-ref':['READ_RESULT_CORRECTION_REQUIRED',3,2],
        repeated:['READ_RESULT_CORRECTION_REQUIRED',3,2],
        'second-correction':['CORRECTION_LIMIT',4,3]
      }[mode];
      assert.deepEqual([outcome.code,modelCalls,outcome.rootUsage.tool],expected);
      assert.equal(saved.snapshot.corrections ?? 0,mode === 'grouped' ? 0 : 1);
      if (mode !== 'grouped') {
        const proof = tool(saved.snapshot.messages,'bad').validation;
        assert.equal(proof.grantId,'original-read-grant');
        assert.equal(proof.resultRef,tool(saved.snapshot.messages,'one').value.resultRef);
      }
    } finally {
      store.close();
    }
  });
}

test('foreign refs and other argument shapes get no correction; restored proofs bind original bytes', async t => {
  const dir = await directory(t);
  const owner = {runId:'sample',rootId:'sample'};
  const options = {directory:dir,allowedTools:['read_page','read_result'],allowedDocuments:['atlas-a'],
    runIdentity:{runId:owner.runId,grantId:'grant'},hostProjection:'host-results@3',
    projectionOwner:owner,confirmDerivedConsumption:async()=>false};
  const host = await createToolHost({...options,canOfferReferenceCorrection:()=>true});
  const {value} = await host.execute(page('page',1));
  const original = reread('original',value.resultRef,extraSelection);
  for (const call of [
    reread('foreign','result:sha256:'+'a'.repeat(64),extraSelection),
    reread('wrong-shape',value.resultRef,{offset:0}),
    {...original,arguments:{...original.arguments,extra:true}}
  ]) {
    const result = await host.execute(call);
    assert.equal(result.status,'rejected');
    assert.equal(result.dispatched,false);
    assert.equal(result.validation,undefined);
  }
  const blocked = await createToolHost({...options,restore:host.snapshot(),canOfferReferenceCorrection:()=>false});
  const blockedResult = await blocked.execute(original);
  assert.equal(blockedResult.dispatched,false);
  assert.equal(blockedResult.validation,undefined);
  const result = await host.execute(original);
  assert.equal(result.dispatched,false);
  assert.equal(host.correctionEligible(original,result),true);
  const reopened = await createToolHost({...options,restore:host.snapshot(),readOnly:true});
  await reopened.verifyResult(original,result);
  for (const mutate of [
    proof => {proof.resultRef = 'result:sha256:'+'a'.repeat(64);},
    proof => {proof.sourceRecordSha256 = 'b'.repeat(64);},
    proof => {proof.grantId = 'other';}
  ]) {
    const forged = structuredClone(result);
    mutate(forged.validation);
    await assert.rejects(reopened.verifyResult(original,forged),{code:'RECOVERY_CHECKPOINT_MISMATCH'});
  }
});

function startRecovery(args) {
  const child = fork(new URL('./fixtures/original-read-correction-child.mjs', import.meta.url),args,
    {stdio:['ignore','ignore','pipe','ipc']});
  let stderr = '';
  child.stderr.on('data', chunk => {stderr = (stderr + chunk).slice(-4096);});
  const message = new Promise(resolve => child.once('message',resolve));
  const closed = new Promise(resolve => child.once('close',(code,signal)=>resolve({code,signal})));
  return {
    child, closed,
    message: () => Promise.race([message,closed.then(() => {throw Error('Fixture exited without a checkpoint: '+stderr);})]),
    async stop() {if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); return closed;}
  };
}

for (const phase of ['result-committed','result-consumed','model-reserved']) {
  test('original read correction survives process death at ' + phase,{timeout:12000},async t => {
    const dir = await directory(t);
    const first = startRecovery([dir,phase]);
    let second;
    try {
      const point = await first.message();
      assert.equal(point.kind,'stop');
      assert.equal((await first.stop()).signal,'SIGKILL');
      const read = async () => {
        const session = await openSession({directory:dir,readOnly:true});
        try {return session.inspect(point.runId);} finally {session.close();}
      };
      const before = await read();
      assert.equal(before.snapshot.phase,phase);
      assert.equal(before.rootUsage.tool,1);
      const rejected = before.snapshot.result ?? tool(before.snapshot.messages,'rejected');
      assert.equal(rejected.dispatched,false);
      second = startRecovery([dir,'',point.runId,String(before.leaseUntil+1)]);
      const outcome = await second.message();
      assert.equal((await second.closed).code,0);
      assert.equal(outcome.runId,point.runId);
      assert.notEqual(first.child.pid,second.child.pid);
      const unknown = phase === 'model-reserved';
      assert.deepEqual([outcome.status,outcome.code,outcome.calls,outcome.usage],
        unknown ? ['failed','MODEL_OUTCOME_UNKNOWN',0,{model:3,tool:1}] : ['completed',null,2,{model:4,tool:2}]);
      const after = await read();
      assert.equal(after.snapshot.corrections,1);
      assert.deepEqual(after.definition,before.definition);
      assert.deepEqual(tool(after.snapshot.messages,'rejected'),rejected);
      if (!unknown) assert.equal(tool(after.snapshot.messages,'corrected').value.text,tool(after.snapshot.messages,'original').value.text);
    } finally {
      await first.stop();
      await second?.stop();
    }
  });
}
