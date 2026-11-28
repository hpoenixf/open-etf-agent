import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {readTimeline} from '../src/observe.mjs';

test('provider errors and failovers preserve the timeline without leaking diagnostics',async()=>{
  const output = resolve('test-output');
  await mkdir(output,{recursive:true});
  const dir = await mkdtemp(join(output,'provider-reject-'));
  try{
    const rows=[
      {type:'tool_result',sequence:1,name:'public_web_linked_pdf_page',status:'succeeded'},
      {type:'model_failover',sequence:2,target:'secret upstream'},
      {type:'model_protocol_rejected',sequence:3,diagnostic:{reason:'private string'},inputHash:'secret hash'},
      {type:'run_finished',sequence:4,status:'failed',code:'PROVIDER_PROTOCOL_INVALID'},
    ];
    await writeFile(join(dir,'run.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    const timeline=await readTimeline(dir);
    assert.deepEqual(timeline.entries.map(e=>e.type),rows.map(e=>e.type));
    assert.equal(timeline.entries[0].name,'public_web_linked_pdf_page');
    assert.doesNotMatch(JSON.stringify(timeline),/secret|private string/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
