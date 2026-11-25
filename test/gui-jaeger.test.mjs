import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {join,resolve} from 'node:path';
import {mkdir,mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {prepareOwnerLangfuse} from '../src/gui-langfuse.mjs';
import {startLocalGui} from '../src/gui-server.mjs';

const localEnv={
  ETF_LANGFUSE_ENABLED:'1',ETF_LANGFUSE_PROFILE:'jaeger',ETF_JAEGER_OTLP_PORT:'4318',
  ETF_LANGFUSE_TRACE_SALT:'trace-synthetic-identifier-salt-only-do-not-use',
};
async function project(t){
  await mkdir('test-output',{recursive:true});
  const dir=await mkdtemp(resolve('test-output/gui-jaeger-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  return dir;
}
async function collector(t,{status=200,body='{}',headers={}}={}){
  const packets=[];
  const server=createServer(async(req,res)=>{
    const chunks=[];
    for await(const part of req)chunks.push(part);
    packets.push({url:req.url,headers:req.headers,body:Buffer.concat(chunks).toString('utf8')});
    res.writeHead(status,{'content-type':'application/json',...headers});res.end(body);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(ok=>server.close(ok)));
  return {packets,port:String(server.address().port)};
}
const meta=(span,k)=>span.attributes.find(a=>a.key==='langfuse.observation.metadata.'+k)?.value.stringValue;
async function receipt(dir){
  for(let i=0;i<150;i++){
    const file=(await readdir(join(dir,'langfuse-export')).catch(()=>[])).find(f=>f.endsWith('.settled.json'));
    if(file)return JSON.parse(await readFile(join(dir,'langfuse-export',file),'utf8'));
    await delay(20);
  }
  throw Error('missing settled export receipt');
}
test('Jaeger opt-in fails closed for invalid ports and cloud credential conflicts',()=>{
  for(const value of [undefined,'',4318,'localhost:4318','http://127.0.0.1:4318','4318/v1/traces','4318\n','04318','808','1023','65536','43e2'])assert.equal(prepareOwnerLangfuse({...localEnv,ETF_JAEGER_OTLP_PORT:value}),null);
  for(const override of [{ETF_LANGFUSE_ENABLED:'0'},{ETF_LANGFUSE_PROFILE:'cloud'},{ETF_LANGFUSE_PROFILE:'unknown'},{ETF_LANGFUSE_PUBLIC_KEY:'pk-lf-synthetic'},{ETF_LANGFUSE_SECRET_KEY:'sk-lf-synthetic'},{ETF_LANGFUSE_REGION:'us'},{ETF_LANGFUSE_TRACE_SALT:''}])assert.equal(prepareOwnerLangfuse({...localEnv,...override}),null);
  assert.ok(prepareOwnerLangfuse({...localEnv,ETF_JAEGER_OTLP_PORT:'1024'}));
  assert.ok(prepareOwnerLangfuse({...localEnv,ETF_JAEGER_OTLP_PORT:'65535'}));
});
test('owner GUI admits and publishes once; Jaeger gets only bounded metadata over native OTLP',async t=>{
  const sink=await collector(t,{body:'{"partialSuccess":{}}'}),dir=await project(t);let calls=0;
  const gui=await startLocalGui({projectDir:dir,env:{...localEnv,ETF_JAEGER_OTLP_PORT:sink.port,ETF_GUI_PROVIDER_KEY:'private-gateway-key'},liveConfig:{
    gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'private-model-alias',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
    limits:{model:4},connectivity:{web:true},
  },fetchImpl:async()=>{calls++;return Response.json(calls===1?{choices:[{message:{role:'assistant',tool_calls:[{id:'private-tool-id',type:'function',function:{name:'public_web_continue',arguments:'{"cursor":"private-cursor"}'}}]},finish_reason:'tool_calls'}]}:
    {choices:[{message:{role:'assistant',content:'Private owner answer text'},finish_reason:'stop'}],usage:{prompt_tokens:11,completion_tokens:8,total_tokens:19}});},
  langfuseOptions:{send:async()=>assert.fail('cloud fetch cannot receive a local send')}});
  t.after(()=>gui.close());
  const post=(path,b)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(b)});
  const {id}=await post('/api/conversations',{}).then(r=>r.json());
  const path='/api/conversations/'+id,input={messageId:'private-message-id',question:'private prompt text'};
  assert.equal((await post(path+'/messages',input)).status,202);
  assert.equal((await receipt(dir)).state,'transport-accepted');
  const answer=await fetch(gui.origin+path+'/messages/'+input.messageId+'/body').then(r=>r.json());
  assert.equal(answer.body.text,'Private owner answer text');
  assert.equal((await post(path+'/messages',input)).status,202);
  assert.equal(calls,2);assert.equal(sink.packets.length,1);
  const packet=sink.packets[0];assert.equal(packet.url,'/v1/traces');
  assert.equal(packet.headers.authorization,undefined);assert.equal(packet.headers['x-langfuse-ingestion-version'],undefined);
  for(const secret of [id,'private-gateway-key','private-model-alias','private-tool-id','private-cursor','public_web_continue','Private owner answer text','private-message-id','private prompt text',localEnv.ETF_LANGFUSE_TRACE_SALT])assert.equal(packet.body.includes(secret),false);
  const spans=JSON.parse(packet.body).resourceSpans[0].scopeSpans[0].spans;
  assert.deepEqual(spans.map(s=>s.name),['Research Run','Model dispatch','Model dispatch','Tool result','Delivery confirmed']);
  assert.ok(spans.every(s=>/^[a-f0-9]{32}$/.test(s.traceId)&&s.traceId===spans[0].traceId));
  assert.equal(meta(spans[0],'delivery_status'),'published');
  assert.equal(meta(spans[4],'readback'),'publication');
  assert.ok(spans[2].attributes.some(a=>a.key==='langfuse.observation.usage_details'&&a.value.stringValue==='{"input":11,"output":8,"total":19}'));
});
test('follow-up destinations are never contacted and rejected/partial/ambiguous outcomes settle once',async t=>{
  const redirect=await collector(t);
  for(const [config,want] of [
    [{status:307,headers:{location:'http://127.0.0.1:'+redirect.port+'/v1/traces'}},'rejected'],
    [{body:'{"partialSuccess":{"rejectedSpans":"1"}}'},'partial'],
    [{body:'{"partialSuccess":"invalid"}'},'unknown'],
    [{body:'{"partialSuccess":{"rejectedSpans":"0","errorMessage":"warning"}}'},'transport-accepted'],
    [{body:''},'unknown'],
    [{body:'x'.repeat(8193)},'unknown'],
  ]){
    const sink=await collector(t,config),dir=await project(t);
    for(let i=0;i<2;i++){
      const exporter=prepareOwnerLangfuse({...localEnv,ETF_JAEGER_OTLP_PORT:sink.port});
      exporter.start().finish(dir,{runId:'synthetic-test-run',status:'failed',delivery:'not-created'});
      await exporter.drain();
    }
    assert.equal((await receipt(dir)).state,want);
    assert.equal(sink.packets.length,1);
  }
  assert.equal(redirect.packets.length,0);
});
