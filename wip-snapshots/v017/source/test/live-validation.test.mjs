import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {runPinnedValidation} from '../src/live-validation.mjs';
const configuration={endpoint:'https://provider.example.invalid/v1/chat/completions',model:'synthetic-model',apiKey:'synthetic-not-real-key',maxTotalCny:800};
async function root(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/pinned-live-fake-'));}
const baseline=resolve('test/fixtures/pinned-v01');
const local='1a787437c2a900c8a9fe27048e81aa86b703305b';const remote='f9370b81beef84199293120ee23d245bb0129553';
// Only Git identity/status is injected by this test-owned executable. Actual frozen
// v01 source/fixture bytes are still checked by the production hashing boundary.
// This does not claim a real remote checkout was created or add a Git worktree.
async function withGit({head=local,dirty='',top=baseline}={},fn){
 const directory=await root();const bin=join(directory,'bin');await mkdir(bin);await writeFile(join(bin,'git'),`#!${process.execPath}\nconst a=process.argv.slice(2);process.stdout.write(a.includes('--show-toplevel')?${JSON.stringify(top+'\n')}:a.includes('--porcelain')?${JSON.stringify(dirty)}:${JSON.stringify(head+'\n')});\n`,{mode:0o700});
 const before=process.env.PATH;process.env.PATH=bin+':'+before;try{return await fn(directory);}finally{process.env.PATH=before;}
}
const completion=(message,finish_reason)=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}],usage:{prompt_tokens:100,completion_tokens:20,cost:0,opencode:{billing_source:'go',allowance:0.001,list_cost:0.001}}});
async function basic(output){let requests=0;const result=await runPinnedValidation({version:'v01',baselineDirectory:baseline,configuration,ledgerDirectory:join(output,'ledger'),outputRoot:join(output,'case'),fetchImpl:async(url,init)=>{requests++;const body=JSON.parse(init.body);if(requests===1)return completion({content:null,tool_calls:['atlas-a','atlas-b'].map((documentId,i)=>({id:'read-'+i,type:'function',function:{name:'read_page',arguments:JSON.stringify({documentId,page:1})}}))},'tool_calls');if(requests===2){const sources=body.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value.sourceId);return completion({content:null,tool_calls:[{id:'save',type:'function',function:{name:'save_report',arguments:JSON.stringify({text:'# Synthetic comparison\nA supports CSV; B supports CSV and Markdown. Both require an online connection [1] [2].',sourceIds:sources})}}]},'tool_calls');}return completion({content:'Report saved after actual tool receipt.'},'stop');}});assert.equal(requests,3);assert.equal(result.calls,3);assert.equal(result.status,'completed');assert.equal(result.reservedCny,300);assert.equal(result.capCny,800);assert.ok(result.postRunReportReadback.sha256);return result;}
test('5.9 injected Git identity with real frozen v01 bytes executes actual Runtime/Gateway',async()=>withGit({},async output=>{const result=await basic(output);assert.equal(result.baselineCommit,local);}));
test('5.9 verified remote equivalent identity accepts the same actual source blobs',async()=>withGit({head:remote},async output=>{const result=await basic(output);assert.equal(result.baselineCommit,remote);assert.equal(result.originalLocalCommit,local);}));
async function rejection(options,expected){await withGit(options,async output=>{let calls=0;await assert.rejects(runPinnedValidation({version:'v01',baselineDirectory:baseline,configuration,ledgerDirectory:join(output,'ledger'),outputRoot:join(output,'case'),fetchImpl:async()=>{calls++;throw new Error('unexpected fake dispatch');}}),expected);assert.equal(calls,0);});}
test('5.9 wrong version identity is rejected before transport dispatch',async()=>rejection({head:'d8b5554130fc3d333d0e181edf92a51e9030f20c'},/BASELINE_HEAD_MISMATCH/));
test('5.9 directory other than repository root is rejected before transport dispatch',async()=>rejection({top:resolve('src')},/LIVE_BASELINE_DIRECTORY/));
test('5.9 dirty baseline identity is rejected before source import or fetch',async()=>rejection({dirty:'?? synthetic-untracked\n'},/LIVE_BASELINE_DIRTY/));
