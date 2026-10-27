import { mkdtemp, open } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createToolHost, ensureSafeDirectory } from './tools.mjs';
import { createRootBudget } from './cooperation.mjs';
import { compactWorkingView } from './compaction.mjs';
import { projectMemory } from './memory-projection.mjs';
import { projectContext } from './context.mjs';
import { activateTrustedPlugins } from './plugins.mjs';
import { sha256 } from './source.mjs';
import { PUBLICATION_BINDING, preparePublication } from './publication.mjs';

const failure = code => Object.assign(new Error(code), { code });
const canonical = value => JSON.stringify(value, (_,v) => v && typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function validateProposal(p) {
  if (p?.kind === 'final' && typeof p.text === 'string' && p.text.length <= 64000) return;
  if (p?.kind !== 'calls' || !Array.isArray(p.calls) || !p.calls.length || p.calls.length > 16) throw failure('INVALID_PROPOSAL');
  for (const c of p.calls) if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 200 || typeof c.name !== 'string' || !c.arguments || typeof c.arguments !== 'object' || Array.isArray(c.arguments)) throw failure('INVALID_CALL');
}
async function bounded(promise, signal) {
  signal.throwIfAborted(); let cancel;
  const stopped = new Promise((_,reject)=>{cancel=()=>reject(signal.reason);signal.addEventListener('abort',cancel,{once:true});});
  try{return await Promise.race([promise,stopped]);}finally{signal.removeEventListener('abort',cancel);}
}
export function validateRuntimeCheckpoint(state, definition) {
  if(state?.schemaVersion!=='runtime-checkpoint@1'||!Array.isArray(state.messages)||state.messages[0]?.role!=='user'||state.messages[0]?.content!==definition.question||!Array.isArray(state.usedIds)||new Set(state.usedIds).size!==state.usedIds.length||state.usedIds.some(id=>typeof id!=='string')||!Number.isSafeInteger(state.rounds)||state.rounds<0||state.rounds>definition.limits.maxRounds||!Number.isSafeInteger(state.toolsDispatched)||state.toolsDispatched<0||state.toolsDispatched>definition.limits.maxTools||!Number.isSafeInteger(state.cursor)||state.cursor<0||!Array.isArray(state.partialEffects)||!Array.isArray(state.unknownEffects)||!Array.isArray(state.hookErrors))throw failure('INVALID_RUNTIME_CHECKPOINT');
  if(['proposal-sealed','tool-dispatched','result-committed','result-consumed'].includes(state.phase)){validateProposal(state.proposal);if(state.proposal.kind==='calls'&&state.cursor>state.proposal.calls.length)throw failure('INVALID_RUNTIME_CHECKPOINT');}
  if(state.phase==='result-committed'&&state.result?.callId!==state.proposal.calls[state.cursor]?.id)throw failure('INVALID_RUNTIME_CHECKPOINT');
  if(state.working&&state.working.hash!==sha256(JSON.stringify(state.working.messages)))throw failure('INVALID_WORKING_CHECKPOINT');
  const allCalls=new Set();let lastGroup=null;
  for(let i=1;i<state.messages.length;){
    const group=state.messages[i++];if(group.role!=='assistant')throw failure('INVALID_PAIRED_CHECKPOINT');validateProposal({kind:'calls',calls:group.calls});
    for(const call of group.calls){if(allCalls.has(call.id))throw failure('INVALID_PAIRED_CHECKPOINT');allCalls.add(call.id);}
    let settled=0;
    for(const call of group.calls){const message=state.messages[i];if(message?.role!=='tool')break;if(message.callId!==call.id||message.result?.callId!==call.id||!state.usedIds.includes(call.id))throw failure('INVALID_PAIRED_CHECKPOINT');settled++;i++;}
    if(settled<group.calls.length&&i!==state.messages.length)throw failure('INVALID_PAIRED_CHECKPOINT');
    lastGroup={group,settled};
  }
  if(state.usedIds.some(id=>!allCalls.has(id)))throw failure('INVALID_PAIRED_CHECKPOINT');
  if(state.proposal?.kind==='calls'&&(!lastGroup||canonical(lastGroup.group.calls)!==canonical(state.proposal.calls)||state.cursor!==lastGroup.settled))throw failure('INVALID_PAIRED_CHECKPOINT');
  if(lastGroup&&lastGroup.settled<lastGroup.group.calls.length&&state.proposal?.kind!=='calls')throw failure('INVALID_PAIRED_CHECKPOINT');
  if(state.phase==='terminal'&&state.outcome){for(const key of ['answer','status','code','rounds','toolsDispatched','unknownEffects','partialEffects','hookErrors'])if(canonical(state.outcome[key])!==canonical(state[key]))throw failure('INVALID_TERMINAL_OUTCOME');if(canonical(state.outcome.receipt)!==canonical(state.host?.receipt))throw failure('INVALID_TERMINAL_OUTCOME');}

}

export function run(options) { return drive(options, false); }
export function submitRun(options) { return drive(options, true); }
async function drive({ question, gateway, outputRoot='runs', requireReport=true, signal, hostSignal, limits={}, extensions=[], hooks, plugins, rootBudget, allowedTools, allowedDocuments, taskId=null, contextBytes, workingInput, durable, publication = false }, submitting) {
  if(typeof question!=='string'||!question.trim()||Buffer.byteLength(question)>16000||typeof gateway?.next!=='function')throw failure('INVALID_INPUT');
  const budget={maxRounds:12,maxTools:12,timeoutMs:30000,...limits};
  for(const [key,value] of Object.entries(budget))if(!['maxRounds','maxTools','timeoutMs'].includes(key)||!Number.isSafeInteger(value)||value<1||value>(key==='timeoutMs'?300000:1000))throw failure('INVALID_LIMIT');
  if(contextBytes!==undefined&&(!Number.isSafeInteger(contextBytes)||contextBytes<1||contextBytes>1048576))throw failure('INVALID_CONTEXT_LIMIT');
  if(workingInput!==undefined&&(!workingInput||typeof workingInput!=='object'||Object.keys(workingInput).some(key=>!['memoryLibrary','compaction'].includes(key))))throw failure('INVALID_WORKING_INPUT');
  if(workingInput?.memoryLibrary&&(typeof workingInput.memoryLibrary.libraryId!=='string'||typeof workingInput.memoryLibrary.state!=='function'))throw failure('INVALID_MEMORY_LIBRARY');
  if(workingInput?.compaction&&(typeof workingInput.compaction.summarize!=='function'||!Number.isSafeInteger(workingInput.compaction.thresholdBytes)||workingInput.compaction.thresholdBytes<1||workingInput.compaction.thresholdBytes>1048576))throw failure('INVALID_COMPACTION');
  if(durable&&(typeof durable.store?.create!=='function'||rootBudget||!durable.bindings||durable.bindings.gateway.mode!==gateway.mode))throw failure('INVALID_DURABLE_CONFIGURATION');
  const publicationBinding = durable?.bindings?.adapters?.find(item => item.id === PUBLICATION_BINDING.id);
  if(typeof publication !== 'boolean' || (publication ? !durable || canonical(publicationBinding) !== canonical(PUBLICATION_BINDING) : publicationBinding !== undefined))throw failure('PUBLICATION_BINDING_MISMATCH');
  if(publication && durable.parentRunId)throw failure('PUBLICATION_SCOPE_MISMATCH');
  // The first independently driven slice has no plugin/Child/working-input lifecycle.
  if((submitting||hostSignal!==undefined)&&(!durable||durable.parentRunId||plugins||hooks||extensions.length||workingInput))throw failure('UNSUPPORTED_WORKER_CONFIGURATION');
  if(hostSignal!==undefined&&(typeof hostSignal?.aborted!=='boolean'||typeof hostSignal.addEventListener!=='function'||typeof hostSignal.removeEventListener!=='function'))throw failure('INVALID_HOST_SIGNAL');
  if(submitting&&typeof durable.runId!=='string')throw failure('SUBMISSION_ID_REQUIRED');
  if(submitting&&durable.rootId!==undefined&&durable.rootId!==durable.runId)throw failure('ROOT_SCOPE_MISMATCH');
  let selected, outcome;
  try {
    if(!submitting&&plugins){selected=await activateTrustedPlugins({plugins,expectedBindings:durable?.bindings.plugins,signal});if(hooks&&selected.hooks)throw failure('AMBIGUOUS_HOOK_CONFIGURATION');extensions=[...extensions,...selected.extensions];hooks??=selected.hooks;}
    else if(durable?.bindings.plugins.length)throw failure('PLUGIN_BINDINGS_MISMATCH');
    outcome=await execute();return outcome;
  } finally { if(selected){const release=await selected.release();if(outcome)outcome.pluginRelease=release;} }

  async function execute(){
    const config={requireReport,...(publication?{publication:PUBLICATION_BINDING.version}:{}),...(allowedTools?{allowedTools}:{}),...(allowedDocuments?{allowedDocuments}:{}),...(contextBytes===undefined?{}:{contextBytes}),taskId,...(workingInput?{workingInput:{...(workingInput.memoryLibrary?{memoryLibraryId:workingInput.memoryLibrary.libraryId}:{}),...(workingInput.compaction?{compaction:{thresholdBytes:workingInput.compaction.thresholdBytes,summaryTimeoutMs:workingInput.compaction.summaryTimeoutMs??2000,version:'working-input@1'}}:{})}}:{})};
    let stored,claim,directory,runId,deadlineAt=Date.now()+budget.timeoutMs;
    let state={schemaVersion:'runtime-checkpoint@1',phase:'ready',messages:[{role:'user',content:question}],usedIds:[],rounds:0,toolsDispatched:0,proposal:null,cursor:0,result:null,host:null,working:null,answer:'',status:'failed',code:null,unknownEffects:[],partialEffects:[],hookErrors:[]};
    function boundToOriginal(saved) {
      validateRuntimeCheckpoint(saved.snapshot,saved.definition);
      if(canonical(saved.definition.bindings)!==canonical(durable.bindings)||saved.definition.grantId!==durable.grantId||saved.definition.question!==question||canonical(saved.definition.limits)!==canonical(budget)||canonical(saved.definition.config)!==canonical(config))throw failure('RUN_BINDINGS_MISMATCH');
    }
    if(submitting){
      const original=()=>{
        const saved=durable.store.inspect(durable.runId);boundToOriginal(saved);
        if(saved.parentRunId!==null||saved.rootId!==saved.runId||canonical(saved.definition.rootLimits)!==canonical(durable.rootLimits??{model:budget.maxRounds,tool:budget.maxTools})||(durable.deadlineAt!==undefined&&durable.deadlineAt!==saved.definition.deadlineAt))throw failure('RUN_BINDINGS_MISMATCH');
        return saved;
      };
      if(signal?.aborted)throw failure('CANCELLED');
      try{return original();}catch(error){if(error.code!=='UNKNOWN_RUN')throw error;}
      const root=await ensureSafeDirectory(outputRoot);directory=await mkdtemp(join(root,'run-'));runId=durable.runId;
      if(signal?.aborted)throw failure('CANCELLED');
      try{return durable.store.create({runId,directory,definition:{question,grantId:durable.grantId,bindings:durable.bindings,limits:budget,rootLimits:durable.rootLimits??{model:budget.maxRounds,tool:budget.maxTools},deadlineAt:durable.deadlineAt??deadlineAt,config},snapshot:state});}
      catch(error){if(error.code==='RUN_EXISTS')return original();throw error;}
    }
    if(durable?.runId){
      stored=durable.store.inspect(durable.runId);boundToOriginal(stored);
      directory=stored.directory;runId=stored.runId;deadlineAt=stored.definition.deadlineAt;state=structuredClone(stored.snapshot);
      if(['completed','failed','cancelled'].includes(stored.status)){
        if(publication){
          const saved=durable.store.publication(runId);
          if(state.outcome&&canonical(state.outcome.publication??null)!==canonical(saved?.receipt??null))throw failure('PUBLICATION_IDENTITY_UNAVAILABLE');
          if(state.publication&&canonical(state.publication)!==canonical(saved?.receipt??null))throw failure('PUBLICATION_IDENTITY_UNAVAILABLE');
          if(saved)durable.store.confirmPublication(saved.receipt);
          state.publication=saved?.receipt;
        }

        const restored=state.host?await createToolHost({directory,extensions,hooks,allowedTools,allowedDocuments,enableNotes:!!workingInput?.compaction,restore:state.host}):null;
        for(const message of state.messages)if(message.role==='tool'){const call=state.messages.flatMap(m=>m.calls||[]).find(c=>c.id===message.callId);if(call)await restored.verifyResult(call,message.result);}
        if(state.result){const call=state.proposal?.calls?.[state.cursor];if(call)await restored.verifyResult(call,state.result);}
        if(stored.status!=='cancelled'){
          if(state.outcome?.runId!==runId||state.outcome.rootId!==stored.rootId||state.outcome.directory!==directory)throw failure('INVALID_TERMINAL_OUTCOME');
          return structuredClone({...state.outcome,rootUsage:stored.rootUsage});
        }
        return{runId,rootId:stored.rootId,directory,...(state.publication?{publication:state.publication}:{}),status:'cancelled',code:'CANCELLED',answer:state.answer,receipt:restored?.receipt??null,toolsDispatched:state.toolsDispatched,rounds:state.rounds,logErrors:[],unknownEffects:state.unknownEffects,partialEffects:state.partialEffects,hookErrors:state.hookErrors,rootUsage:stored.rootUsage,taskId,...(allowedTools&&restored?{sources:await restored.getSources(),resultRefs:await restored.getResultRefs()}:{}),semanticStatus:'unreviewed'};
      }
      claim=durable.store.claim(runId,durable.owner??randomUUID());
    }else{
      const root=await ensureSafeDirectory(outputRoot);directory=await mkdtemp(join(root,'run-'));runId=basename(directory);
      if(durable){const created=durable.store.create({runId,directory,rootId:durable.rootId,parentRunId:durable.parentRunId,parentClaim:durable.parentClaim,definition:{question,grantId:durable.grantId,bindings:durable.bindings,limits:budget,rootLimits:durable.rootLimits??{model:budget.maxRounds,tool:budget.maxTools},deadlineAt:durable.deadlineAt??deadlineAt,config},snapshot:state});deadlineAt=created.definition.deadlineAt;claim=durable.store.claim(runId,durable.owner??randomUUID());}
    }
    rootBudget=claim?.rootBudget??rootBudget??createRootBudget({model:budget.maxRounds,tool:budget.maxTools});
    const controller=new AbortController();const cancel=()=>{if(claim){try{durable.store.cancel(runId);}catch{}}controller.abort(failure('CANCELLED'));};
    let interrupted=false,effectsStopped=true,pendingEffect;
    const stop=()=>{if(!controller.signal.aborted){interrupted=true;controller.abort(failure('HOST_STOPPED'));}};
    signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
    hostSignal?.addEventListener('abort',stop,{once:true});if(hostSignal?.aborted)stop();
    const timer=setTimeout(()=>controller.abort(failure('TIMEOUT')),Math.max(1,deadlineAt-Date.now()));
    let heartbeat;if(claim)heartbeat=setInterval(()=>{try{claim.renew();}catch(error){controller.abort(failure(error.code==='RUN_CANCELLED'?'CANCELLED':error.code||'LEASE_LOST'));}},Math.max(10,Math.floor(durable.store.leaseMs/3)));
    let host,log,inFlight=state.phase==='tool-dispatched'?state.inFlight:null;
    const logErrors=[];let sourceSnapshots=[],resultRefs=[];
    async function effect(promise){
      // Sequential execution has at most one unsettled owned operation.
      const settled=Promise.resolve(promise).then(()=>true,()=>true);pendingEffect=settled;
      void settled.then(()=>{if(pendingEffect===settled)pendingEffect=null;});
      return bounded(promise,controller.signal);
    }
    async function drainStoppedEffect(){
      if(!pendingEffect)return true;let timeout;
      try{return await Promise.race([pendingEffect,new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),500);})]);}
      finally{clearTimeout(timeout);}
    }
    async function record(type,data={}){try{await log.write(JSON.stringify({runId,rootId:rootBudget.rootId,taskId,sequence:++record.sequence,type,...data})+'\n');}catch{logErrors.push('LOG_WRITE_FAILED');throw failure('LOG_WRITE_FAILED');}}
    record.sequence=0;
    async function checkpoint(phase,{reserve}={}){
      state.phase=phase;state.host=host.snapshot();state.inFlight=inFlight;state.logSequence=record.sequence;
      if(claim){if(reserve)claim.reserve(reserve,state);else claim.checkpoint(state);if(durable.onCheckpoint)await bounded(Promise.resolve().then(()=>durable.onCheckpoint({phase,runId,directory,cursor:state.cursor,callId:state.proposal?.calls?.[state.cursor]?.id,noteRef:state.working?.noteRef,workingHash:state.working?.hash,fence:claim.fence})),controller.signal);}
    }
    try{
      controller.signal.throwIfAborted();
      if(claim&&durable.onClaim)await bounded(Promise.resolve().then(()=>durable.onClaim({runId,rootId:claim.rootId,owner:claim.owner,fence:claim.fence})),controller.signal);
      host=await effect(createToolHost({directory,extensions,hooks,allowedTools,allowedDocuments,enableNotes:!!workingInput?.compaction,restore:state.host??undefined}));
      if(durable?.runId)for(const message of state.messages)if(message.role==='tool'){const call=state.messages.flatMap(m=>m.calls||[]).find(c=>c.id===message.callId);await host.verifyResult(call,message.result);}
      if(state.working)await host.verifyWorkingInput(state.working);
      record.sequence=state.logSequence??0;log=await open(join(directory,'run.jsonl'),durable?.runId?'a':'wx',0o600);
      await record(durable?.runId?'run_resumed':'run_started',{mode:gateway.mode||'test',question,limits:budget,...(claim?{fence:claim.fence,deadlineAt}: {})});
      if(state.phase==='model-reserved')throw failure('MODEL_OUTCOME_UNKNOWN');
      if(state.phase==='tool-dispatched'){
        const recovered=await host.reconcile(state.proposal.calls[state.cursor],{...inFlight,signal:controller.signal});
        if(!recovered)throw failure('TOOL_OUTCOME_UNKNOWN');
        state.result=recovered;await checkpoint('result-committed');inFlight=null;
      }
      while(true){
        if(state.failureCode)throw failure(state.failureCode);
        controller.signal.throwIfAborted();if(Date.now()>=deadlineAt)throw failure('TIMEOUT');
        if(['ready','working-input'].includes(state.phase)){
          if(state.rounds>=budget.maxRounds)throw failure('ROUND_LIMIT');
          if(!state.working){
            const lookupMemory=ref=>{if(ref.libraryId!==workingInput.memoryLibrary.libraryId)throw failure('MEMORY_SCOPE_MISMATCH');return workingInput.memoryLibrary.state(ref.id);};
            const workingMessages=workingInput?.memoryLibrary?await projectMemory({messages:state.messages,lookupState:lookupMemory}):structuredClone(state.messages);
            let requestMessages=contextBytes===undefined?workingMessages:await projectContext({messages:workingMessages,maxBytes:contextBytes,lookupSource:host.resolveSource});let noteRef=null;
            if(workingInput?.compaction&&Buffer.byteLength(JSON.stringify(requestMessages))>=workingInput.compaction.thresholdBytes){
              // A crash during summary generation keeps its consumed root reservation; no adoption is implied.
              const compacted=await compactWorkingView({messages:workingMessages,maxBytes:contextBytes??262144,lookupSource:host.resolveSource,lookupMemoryState:workingInput.memoryLibrary?lookupMemory:undefined,rootBudget:claim?{claim(kind){state.phase='model-reserved';state.purpose='compaction';state.host=host.snapshot();claim.reserve(kind,state);}}:rootBudget,summarize:workingInput.compaction.summarize,saveNote:host.persistWorkingNote,signal:controller.signal,summaryTimeoutMs:workingInput.compaction.summaryTimeoutMs});requestMessages=compacted.messages;noteRef=compacted.noteRef;delete state.purpose;await record('working_note',{...compacted.observation,noteRef});
            }
            state.working={schemaVersion:'working-input@1',messages:requestMessages,noteRef,hash:sha256(JSON.stringify(requestMessages))};await checkpoint('working-input');
          }
          // Forgetting after adoption but before dispatch removes old typed Memory from the next actual input.
          if(workingInput?.memoryLibrary){state.working.messages=await projectMemory({messages:state.working.messages,lookupState:ref=>workingInput.memoryLibrary.state(ref.id)});state.working.hash=sha256(JSON.stringify(state.working.messages));}
          state.rounds++;if(claim)await checkpoint('model-reserved',{reserve:'model'});else rootBudget.claim('model');
          const start=performance.now();const proposal=await effect(Promise.resolve().then(()=>{controller.signal.throwIfAborted();return gateway.next({messages:structuredClone(state.working.messages),tools:structuredClone(host.definitions),signal:controller.signal});}));
          controller.signal.throwIfAborted();validateProposal(proposal);
          if(proposal.kind==='calls'){const ids=new Set();for(const c of proposal.calls){if(state.usedIds.includes(c.id)||ids.has(c.id))throw failure('DUPLICATE_CALL_ID');ids.add(c.id);}if(state.toolsDispatched+proposal.calls.length>budget.maxTools)throw failure('TOOL_LIMIT');}
          state.proposal=structuredClone(proposal);state.cursor=0;state.result=null;state.working=null;
          if(proposal.kind==='calls')state.messages.push({role:'assistant',calls:structuredClone(proposal.calls)});
          await checkpoint('proposal-sealed');await record('model_proposal',{kind:proposal.kind,callIds:proposal.calls?.map(c=>c.id)||[],usage:proposal.usage??null,cost:null,durationMs:performance.now()-start});
        }
        if(state.proposal.kind==='final'){
          state.answer=state.proposal.text;
          if(publication){
            const committed=claim.publish(preparePublication({runId,rootId:claim.rootId,text:state.answer}));
            state.publication=committed.receipt;
            if(durable.onPublication)await bounded(Promise.resolve().then(()=>durable.onPublication({runId,receipt:structuredClone(committed.receipt),idempotent:committed.idempotent})),controller.signal);
            controller.signal.throwIfAborted();
          }
          if(requireReport&&!host.receipt)throw failure('REPORT_REQUIRED');state.status='completed';state.code=null;break;
        }
        if(state.phase==='result-consumed')state.phase='proposal-sealed';
        if(state.cursor>=state.proposal.calls.length){state.proposal=null;state.cursor=0;state.result=null;await checkpoint('ready');continue;}
        const call=state.proposal.calls[state.cursor];
        if(state.phase!=='result-committed'){
          await record('tool_proposal',{callId:call.id,name:call.name});controller.signal.throwIfAborted();
          if(!state.usedIds.includes(call.id))state.usedIds.push(call.id);
          const result=await effect(host.execute(call,{signal:controller.signal,onDispatch:({original,effective})=>{
            controller.signal.throwIfAborted();const dispatch={callId:effective.id,name:effective.name,effective,...(effective.name!==original.name?{originalName:original.name}:{})};
            if(claim)claim.reserve('tool',{...state,phase:'tool-dispatched',toolsDispatched:state.toolsDispatched+1,host:host.snapshot(),inFlight:dispatch});else rootBudget.claim('tool');
            state.toolsDispatched++;inFlight=dispatch;state.phase='tool-dispatched';

          }}));
          if(result.callId!==call.id)throw failure('CALL_PAIR_MISMATCH');state.result=result;
          // The external effect has settled; retain inFlight until its receipt is actually committed.
          await checkpoint('result-committed');inFlight=null;
        }
        const result=state.result;await host.verifyResult(call,result);
        const effectiveName=result.effective?.name||call.name;state.hookErrors.push(...(result.hookErrors||[]));
        const partialPaths=(result.partialPaths||[]).filter(path=>['report.md','manifest.json'].includes(path));
        if(partialPaths.length)state.partialEffects.push({callId:call.id,name:effectiveName,...(effectiveName!==call.name?{originalName:call.name}:{}),partialPaths});
        if(result.artifactEffects)state.partialEffects.push({callId:call.id,name:effectiveName,artifactEffects:structuredClone(result.artifactEffects)});
        if(result.memoryEffect)state.partialEffects.push({callId:call.id,name:effectiveName,memoryEffect:structuredClone(result.memoryEffect)});
        state.messages.push({role:'tool',callId:call.id,result:structuredClone(result)});state.cursor++;state.result=null;state.failureCode=result.status==='succeeded'?null:(result.dispatched?'TOOL_FAILED':'TOOL_REJECTED');
        await checkpoint('result-consumed');
        await record('tool_result',{callId:call.id,name:effectiveName,status:result.status,dispatched:result.dispatched,partialPaths,memoryEffect:result.memoryEffect,artifactEffects:result.artifactEffects,artifactId:result.value?.artifactId,durationMs:result.durationMs,resultRef:result.value?.resultRef,sourceAcquisition:result.value?.mcp?{serverName:result.value.mcp.serverName,protocolVersion:result.value.mcp.protocolVersion,protocolRequestId:result.value.mcp.protocolRequestId,modelCallId:result.value.mcp.modelCallId}:undefined,original:result.original,effective:result.effective,hookErrors:result.hookErrors||[]});
        if(effectiveName==='save_report'&&result.status==='succeeded')await record('file_saved',{receipt:result.value});
        if(result.status!=='succeeded')throw failure(result.dispatched?'TOOL_FAILED':'TOOL_REJECTED');
      }
    }catch(error){
      state.code=error.code||'EXECUTION_FAILED';state.status=state.code==='CANCELLED'||state.code==='RUN_CANCELLED'?'cancelled':'failed';
      if(inFlight)state.unknownEffects.push({...inFlight,status:'unknown',dispatched:true});
    }finally{
      clearTimeout(timer);clearInterval(heartbeat);
      if(interrupted)effectsStopped=await drainStoppedEffect();
      signal?.removeEventListener('abort',cancel);hostSignal?.removeEventListener('abort',stop);
      if(allowedTools&&host){try{sourceSnapshots=await host.getSources();resultRefs=await host.getResultRefs();}catch{state.status='failed';state.code='RESULT_READBACK_FAILED';}}
      if(log){try{await record(interrupted?'worker_interrupted':'run_finished',{status:interrupted?'interrupted':state.status,code:state.code,toolsDispatched:state.toolsDispatched,receipt:host?.receipt,unknownEffects:state.unknownEffects,partialEffects:state.partialEffects});}catch{if(state.status==='completed'){state.status='failed';state.code='LOG_WRITE_FAILED';}}await log.close().catch(()=>logErrors.push('LOG_CLOSE_FAILED'));}
      if(hooks)state.hookErrors.push(...await hooks.observe('release',{runId,rootId:rootBudget.rootId,taskId,status:state.status,code:state.code,logErrors:[...logErrors],receipt:host?.receipt}));
    }
    const outcome={runId,rootId:rootBudget.rootId,directory:resolve(directory),status:state.status,code:state.code,answer:state.answer,...(state.publication?{publication:structuredClone(state.publication)}:{}),receipt:host?.receipt??null,toolsDispatched:state.toolsDispatched,rounds:state.rounds,logErrors,unknownEffects:state.unknownEffects,partialEffects:state.partialEffects,hookErrors:state.hookErrors,rootUsage:rootBudget.snapshot(),taskId,...(allowedTools?{sources:sourceSnapshots,resultRefs}:{}),semanticStatus:'unreviewed'};
    if(interrupted){
      let leaseReleased=false;if(effectsStopped){try{leaseReleased=claim.release();}catch{}}
      const original=durable.store.inspect(runId);
      return{...outcome,status:original.status==='active'?'interrupted':original.status,code:original.status==='active'?'HOST_STOPPED':original.snapshot.code,interruption:{effectsStopped,leaseReleased}};
    }
    if(claim){try{state.phase='terminal';state.host=host?.snapshot()??state.host;state.outcome=outcome;claim.finish(state);}catch(error){outcome.status=error.code==='RUN_CANCELLED'?'cancelled':'failed';outcome.code=error.code==='RUN_CANCELLED'?'CANCELLED':error.code||'CHECKPOINT_FAILED';}finally{try{claim.release();}catch{}}}
    return outcome;
  }
}
