import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { run } from '../src/runtime.mjs';
globalThis.fetch=()=>{throw new Error('OFFLINE_TEST_FETCH_FORBIDDEN');};
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/timeout-'));}
test('explicit one-hour duration is admitted without changing the logical or physical work',async()=>{
 const d=await directory();let calls=0;const result=await run({question:'Synthetic bound.',outputRoot:d,requireReport:false,limits:{maxRounds:36,maxTools:72,timeoutMs:3600000},gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Immediate synthetic result.'};}}});
 assert.equal(result.status,'completed');assert.equal(calls,1);
 const events=(await readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(events[0].limits,{maxRounds:36,maxTools:72,timeoutMs:3600000});
});
test('old defaults stay 12 rounds, 12 tools and 30 seconds',async()=>{
 const d=await directory();const result=await run({question:'Original defaults.',outputRoot:d,requireReport:false,gateway:{mode:'fixture',async next(){return{kind:'final',text:'Default.'};}}});assert.equal(result.status,'completed');
 const events=(await readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(events[0].limits,{maxRounds:12,maxTools:12,timeoutMs:30000});
});
test('duration overflow, non-integral limits and original round bounds reject before model dispatch',async()=>{
 const d=await directory();let calls=0;const gateway={async next(){calls++;throw new Error('must not dispatch');}};
 for(const limits of [{timeoutMs:3600001},{timeoutMs:0},{timeoutMs:1.5},{maxRounds:1001},{maxTools:1001}])await assert.rejects(run({question:'Reject.',outputRoot:d,gateway,limits}),e=>e.code==='INVALID_LIMIT');assert.equal(calls,0);
});
