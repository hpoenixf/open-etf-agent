import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {openOwnerWeb} from '../src/gui-owner-web.mjs';
import {inspectWebAcquisition} from '../src/web-acquisition.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';

const good='https://example.com/verified',slow='https://epaper.cs.com.cn/owner-timeout-fixture';
const robots=u=>new URL('/robots.txt',u).href;
const reply=(message,finish_reason)=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
const call=(id,url)=>reply({tool_calls:[{type:'function',id,function:{name:'public_web_read',arguments:JSON.stringify({url})}}]},'tool_calls');
for(const [phase,closeOnDestroy] of [['page',true],['page',false],['robots',true],['robots',false]])test('owner original '+phase+' timeout '+(closeOnDestroy?'with local close preserves earlier evidence and body':'without close proof stays terminal'),async t=>{
 const projectDir=await mkdtemp(resolve('.owner-web-timeout-test-'));
 let gui,requests=0,first,body;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 // Run the real host transport/acquisition owner. Fake only stdlib I/O and
 // advance the actual 30 s deadline when the exact hanging request starts.
 const nativeSetTimeout=globalThis.setTimeout,deadlines=[];
 t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>{
  const timer=nativeSetTimeout(fn,ms,...args);
  if(ms===30000)deadlines.push(()=>{clearTimeout(timer);fn(...args);});
  return timer;
 });
 const allowed={body:'User-agent: *\nAllow: /\n'};
 const hung=()=>{assert.ok(deadlines.length>=4);queueMicrotask(deadlines.at(-1));return {hang:true,closeOnDestroy};};
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  [robots(good)]:allowed,[good]:{body:'Synthetic original source: the verified category was broad market.'},
  [robots(slow)]:phase==='robots'?hung:allowed,
  ...(phase==='page'?{[slow]:hung}:{}),
 }});
 const options={projectDir,liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',
  model:'synthetic-go-model',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{web:true}},
  env:{ETF_GUI_PROVIDER_KEY:'fixture-placeholder'},async fetchImpl(_url,{body:requestBody}){
   requests++;
   const results=JSON.parse(requestBody).messages.filter(x=>x.role==='tool').map(x=>JSON.parse(x.content).value);
   if(results.length===0)return call('first-read',good);
   if(results.length===1){first=results[0];assert.equal(first.url,good);assert.match(first.text,/verified category/);return call('timeout-read',slow);}
   const unavailable=results[1];
   assert.equal(unavailable.kind,'public-web-page-unavailable@1');
   assert.equal(unavailable.reason,'WEB_TIMEOUT');
   assert.equal(unavailable.requestOutcome,'unknown');
   assert.equal(unavailable.localRequestClosed,true);
   assert.equal(unavailable.automaticReplayAllowed,false);
   assert.ok(!Object.hasOwn(unavailable,'manifestSha256')&&!Object.hasOwn(unavailable,'text'));
   body='The verified category was broad market. [[WEB:'+first.manifestSha256+':1]] The second source could not be read.';
   return reply({content:body},'stop');
  }};
 const start=async()=>{gui=await startLocalGui(options);};
 await start();
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const post=(path,value)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(value)});
 const {id}=await post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
 const input={messageId:'evening-proof',question:'Use the first verified source, then try the second public source.'};
 assert.equal((await post(path+'/messages',input)).status,202);
 let result;
 for(let i=0;i<100;i++){
  result=await get(path);
  if(['completed','failed'].includes(result.messages[0]?.status)&&!result.messages[0]?.working)break;
  await delay(25);
 }
 const [turn]=result.messages;
 const count=closeOnDestroy?3:2;
 assert.equal(requests,count,JSON.stringify(turn));
 assert.equal(turn.status,closeOnDestroy?'completed':'failed',JSON.stringify(turn));
 const attempted=[robots(good),good,robots(slow),...(phase==='page'?[slow]:[])];
 assert.deepEqual(network.calls.map(x=>x.url),attempted);
 assert.equal(network.requests.at(-1).destroyed,true);
 const acquisitionId='page-'+createHash('sha256').update(JSON.stringify([turn.runId,'timeout-read'])).digest('hex').slice(0,40);
 const native=await inspectWebAcquisition({projectDir,acquisitionId});
 assert.equal(native.code,'WEB_TIMEOUT');
 assert.equal(native.unknownRequests,1);
 assert.equal(native.automaticReplayAllowed,false);
 assert.equal(native.localTimeoutClose,closeOnDestroy?(phase==='page'?'direct-original-get-close@1':'direct-original-robots-close@1'):undefined);
 if(closeOnDestroy){
  assert.equal(turn.output.answer,body);
  const sources=await get(path+'/messages/evening-proof/sources');
  assert.equal(sources.readSources.length,1);
  assert.equal(sources.readSources[0].url,good);
  await gui.close();await start();
  assert.deepEqual(await get(path),result);
  assert.equal((await post(path+'/messages',input)).status,202);
  const [read]=openOwnerWeb({profile:{web:true},projectDir,runId:turn.runId});
  const parsed=await read.reconcile({url:slow},{callId:'timeout-read'});
  assert.equal(parsed.localRequestClosed,true);
  await assert.rejects(read.execute({url:slow},{callId:'timeout-read'}),{code:'WEB_ACQUISITION_ALREADY_EXISTS'});
  const terminalPath=join(projectDir,'web-acquisitions',acquisitionId,'terminal.json');
  const original=JSON.parse(await readFile(terminalPath));
  await writeFile(terminalPath,JSON.stringify({...original,localTimeoutClose:'invalid'}));
  await assert.rejects(read.reconcile({url:slow},{callId:'timeout-read'}),{code:'WEB_ACQUISITION_RECORD_INVALID'});
  delete original.localTimeoutClose;
  await writeFile(terminalPath,JSON.stringify(original));
  await assert.rejects(read.reconcile({url:slow},{callId:'timeout-read'}),{code:'WEB_PAGE_EVIDENCE_CHANGED'});
 }
 assert.equal(requests,count);
 assert.deepEqual(network.calls.map(x=>x.url),attempted);
});
