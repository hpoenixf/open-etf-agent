import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSkillMcpExtensions } from '../src/extensions.mjs';
import { mcpPageContract } from '../src/mcp.mjs';
import { fileURLToPath } from 'node:url';
test('explicit local Skill root uses original bounded catalog and MCP page scope independently of fixture gateway',async()=>{
 const contract=mcpPageContract([{documentId:'custom',pages:3}]);let closed=0;
 const prepared=await prepareSkillMcpExtensions({skillRoot:fileURLToPath(new URL('../fixtures/skills',import.meta.url)),connect:async()=>({tools:[{name:'read_page',description:'owned',inputSchema:contract.inputSchema}],validateArguments:contract.validateArguments,call:async(name,args,ctx)=>({name,args,callId:ctx.modelCallId}),close:async()=>{closed++;}})});
 try{
  assert.equal(prepared.gateway,undefined);
  const list=await prepared.extensions.find(x=>x.name==='list_skills').execute();assert.ok(list.skills.length);
  const read=prepared.extensions.find(x=>x.name==='read_skill_resource');await assert.rejects(read.execute({skillId:list.skills[0].id,path:'../secret'}));
  const page=prepared.extensions.find(x=>x.name==='mcp_read_page');page.validate({documentId:'custom',page:3});assert.throws(()=>page.validate({documentId:'atlas-a',page:1}));
  assert.equal((await page.execute({documentId:'custom',page:3},{callId:'host-call'})).callId,'host-call');
 }finally{await prepared.close();}assert.equal(closed,1);
});
test('assembly requires explicit trusted root/catalog and connector',async()=>{
 await assert.rejects(prepareSkillMcpExtensions({}));
 await assert.rejects(prepareSkillMcpExtensions({skillRoot:'unused',catalog:{},connect:async()=>{throw new Error('must not connect');}}),/Explicit/);
});
