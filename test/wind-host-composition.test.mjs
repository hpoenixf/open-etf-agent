import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,readResearchReport,validateResearchConfig} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
const fixtureModel={mode:'fixture',provider:'test',protocol:'fixture@1',model:'scripted'};
const windData={schemaVersion:'wind-fund-research@1',approvedPublicQueries:true,approvedResultUse:true};
const conf=(extra={})=>({schemaVersion:'research-project@1',gateway:fixtureModel,capabilities:['report'],...extra});
const live={mode:'live',provider:'test',protocol:'chat-completions',model:'synthetic',endpoint:'https://provider.example/v1/chat/completions',apiKeyEnv:'MODEL_KEY'};
const key='synthetic-wind-key-0381-not-a-secret';
const search={category:'equity',metric:'one_year_return',comparison:'above',threshold:'20',unit:'percent'};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}],usage:null});
const final=text=>({kind:'final',text,usage:null});
async function prepare(config){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/wind-host-'));
 try{
  await createResearchProject({directory,config});
  const local=join(directory,'study.md');
  await writeFile(local,'Synthetic public research methodology. Never forward the private marker $LOCAL-ONLY to Wind.');
  const sources=await importProjectSources({projectDir:directory,files:[local]});
  return {directory,doc:sources.catalog.documents[0].id,bundle:sources.manifestSha256,remove:()=>rm(directory,{recursive:true,force:true})};
 }catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}

test('Wind project consent is explicit and model credentials cannot be reused',async()=>{
 assert.equal(validateResearchConfig(conf()).windData,undefined);
 assert.throws(()=>validateResearchConfig(conf({windData:{...windData,approvedResultUse:false}})),{code:'PROJECT_WIND_APPROVAL_REQUIRED'});
 assert.throws(()=>validateResearchConfig(conf({windData,gateway:{...live,apiKeyEnv:'WIND_API_KEY'}})),{code:'PROJECT_WIND_CREDENTIAL_SCOPE'});
 assert.throws(()=>validateResearchConfig(conf({windData,capabilities:['report','schedule']})),{code:'PROJECT_WIND_SCOPE'});
 const f=await prepare(conf({windData,gateway:live}));
 let contacts=0;
 const disallow=()=>{contacts++;throw Error('must remain offline');};
 try{
  await submitResearchTask({projectDir:f.directory,runId:'conflict',question:'Screen public funds.',sourceManifestSha256:f.bundle,authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
  await assert.rejects(workResearchTask({projectDir:f.directory,runId:'conflict',apiKey:key,windApiKey:key,fetchImpl:disallow,windFetchImpl:disallow}),{code:'PROJECT_WIND_CREDENTIAL_SCOPE'});
  assert.equal(contacts,0);
 }finally{await f.remove();}
});

test('ordinary Wind screening scopes vendor output and persists a reloadable report',async()=>{
 const f=await prepare(conf({windData,allowedTools:['read_page','save_report','wind_search_funds']}));
 const requests=[];let modelTurns=0,syntheticResult;
 const json=(id,result)=>Response.json({jsonrpc:'2.0',id,result});
 const fetch=async(url,init)=>{
  assert.equal(String(url),'https://mcp.wind.com.cn/vserver_fund_data/mcp/');
  assert.equal(init.redirect,'error');
  assert.equal(new Headers(init.headers).get('Authorization'),'Bearer '+key);
  assert.ok(!init.body.includes(key)&&!init.body.includes('$LOCAL-ONLY'));
  const {method,params,id}=JSON.parse(init.body);requests.push(method);
  if(method==='initialize')return json(id,{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'synthetic-wind',version:'1'}});
  if(method==='notifications/initialized')return new Response(null,{status:202});
  if(method==='tools/list')return json(id,{tools:[{name:'search_funds',inputSchema:{type:'object',properties:{question:{type:'string'}},required:['question'],additionalProperties:false},annotations:{readOnlyHint:true}}]});
  assert.equal(method,'tools/call');assert.equal(params.name,'search_funds');assert.match(params.arguments.question,/股票型基金.*近一年收益率.*20%/);
  return json(id,{content:[{type:'text',text:JSON.stringify({error:null,data:{data:[{columns:[{name:'基金代码'},{name:'基金名称'}],rows:[['123456.OF','Synthetic Alpha']]}]}})}]});
 };
 const gateway={mode:'fixture',async next({messages,tools}){
  modelTurns++;
  assert.ok(!JSON.stringify(messages).includes(key));assert.ok(tools.some(t=>t.name==='wind_search_funds'));assert.ok(!tools.some(t=>t.name==='wind_available_tools'));
  const results=messages.filter(m=>m.role==='tool').map(m=>m.result);
  if(!results.length)return call('wind','wind_search_funds',search);
  if(results.length===1){
   syntheticResult=results[0].value;assert.equal(syntheticResult?.kind,'wind-fund-observations@1');assert.equal(syntheticResult.identityConfirmation,'screening');assert.equal(syntheticResult.observations.rows.length,1);
   assert.equal(syntheticResult.sourceId,undefined);
   return call('read','read_page',{documentId:f.doc,page:1});
  }
  if(results.length===2)return call('report','save_report',{text:'# Synthetic screening\nWind fixture returned one screening observation. Local methodology [1] is the only original source.',sourceIds:[results[1].value.sourceId]});
  return final('Synthetic report saved.');
 }};
 try{
  await submitResearchTask({projectDir:f.directory,runId:'screen',question:'Screen disclosed funds. $LOCAL-ONLY. Save a report.',sourceManifestSha256:f.bundle});
  assert.deepEqual(requests,[]);assert.equal(modelTurns,0);
  const task=await workResearchTask({projectDir:f.directory,runId:'screen',gateway,windApiKey:key,windFetchImpl:fetch});
  assert.equal(task.run.status,'completed',JSON.stringify(task.run.snapshot));
  const receipt=await readResearchReport({projectDir:f.directory,runId:'screen'});
  assert.match(receipt.report.text,/one screening observation/);assert.equal(receipt.revision.sources.length,1);assert.equal(receipt.revision.sources[0].documentId,f.doc);
  const before=modelTurns;await workResearchTask({projectDir:f.directory,runId:'screen',gateway,windApiKey:key,windFetchImpl:fetch});assert.equal(modelTurns,before);
  assert.deepEqual(requests,['initialize','notifications/initialized','tools/list','tools/call']);
 }finally{await f.remove();}
});
