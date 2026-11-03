import test from 'node:test';
import assert from 'node:assert/strict';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { connectTrustedMcp, mcpPageContract } from '../src/mcp.mjs';
import { sha256 } from '../src/source.mjs';
async function fixture({ wrongPage = false, stall = false } = {}) {
 const documents=[{documentId:'new-guide',pages:3},{documentId:'short-guide',pages:1}];
 const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
 const server=new Server({name:'owned-pages',version:'1'},{capabilities:{tools:{}},supportedProtocolVersions:['2025-11-25']});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'read_page',description:'Explicit page contract',inputSchema:mcpPageContract(documents).inputSchema}]}));
 server.setRequestHandler(CallToolRequestSchema,async req=>{
  if(stall)await new Promise(()=>{});
  const {documentId,page}=req.params.arguments,text='A synthetic third page';
  const value={sourceId:`${documentId}@1:p${page}`,documentId,page:wrongPage?1:page,name:'Owned guide',version:'1',text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
  return {content:[{type:'text',text}],structuredContent:value};
 });
 await server.connect(serverTransport);
 return {server,connect:()=>connectTrustedMcp({transport:clientTransport,serverName:'owned-pages',documents,timeoutMs:200})};
}
test('explicit official SDK transport accepts new IDs/page 3 but rejects per-document and field scope',async()=>{
 const f=await fixture();const session=await f.connect();
 try {
  const result=await session.call('read_page',{documentId:'new-guide',page:3},{modelCallId:'fresh'});
  assert.equal(result.page,3);assert.equal(result.mcp.serverName,'owned-pages');assert.equal(session.pid,null);
  for(const args of [{documentId:'short-guide',page:2},{documentId:'atlas-a',page:1},{documentId:'new-guide',page:1,extra:true}])await assert.rejects(session.call('read_page',args,{modelCallId:'bad'}),/arguments/);
 }finally{await session.close();await f.server.close();}
});
test('injected transport retains source identity rejection and bounded timeout teardown',async()=>{
 for(const options of [{wrongPage:true},{stall:true}]){
  const f=await fixture(options);const s=await f.connect();
  try{await assert.rejects(s.call('read_page',{documentId:'new-guide',page:3},{modelCallId:'one'}));await assert.rejects(s.call('read_page',{documentId:'new-guide',page:3},{modelCallId:'two'}),/closed/);}finally{await s.close();await f.server.close();}
 }
});
test('page scope is validated and snapshotted rather than dynamically widened',()=>{
 const d=[{documentId:'owned',pages:1}],c=mcpPageContract(d);d[0].pages=16;
 assert.throws(()=>c.validateArguments({documentId:'owned',page:2}));
 assert.throws(()=>mcpPageContract([{documentId:'owned',pages:17}]));
});
