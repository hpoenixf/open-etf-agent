import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLocalGui} from '../src/gui-server.mjs';
import {inspectResearchTask} from '../src/research-project.mjs';
import {readOwnerChartViews} from '../src/financial-chart-owner.mjs';

test('selected chart Skill calls native Wind then compiles original same-Run tool data; cold read never calls provider',async t=>{
 const projectDir=await mkdtemp(resolve('.chart-test-'));
 const env={ETF_GUI_PROVIDER_KEY:'synthetic-model-key',WIND_API_KEY:'synthetic-wind-key'};
 const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',
  model:'fixture',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{wind:true}};
 let gui,calls=0,windCalls=0;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const windQuery={windCode:'588200.SH',beginDate:'2026-06-01',endDate:'2026-06-03'};
 const result=(content,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...content},finish_reason}]});
 const modelCall=(name,id,args)=>result({tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
 const ownerWindFetch=async (url,init)=>{
  assert.equal(url,'https://mcp.wind.com.cn/vserver_fund_data/mcp/');
  const payload=JSON.parse(init.body);windCalls++;
  if(payload.method==='notifications/initialized')return new Response(null,{status:202});
  const result=payload.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1.0.0'}}:
   {content:[{type:'text',text:JSON.stringify({data:{columns:[{name:'TIME'},{name:'MATCH'},{name:'Wind代码'}],
    rows:[['2026-06-01',1.32,windQuery.windCode],['2026-06-03',1.35,windQuery.windCode]]}})}]};
  return Response.json({jsonrpc:'2.0',id:payload.id,result},{headers:{'mcp-session-id':'test-only'}});
 };
 const fetchImpl=async(_url,init)=>{
  const req=JSON.parse(init.body);calls++;
  const tools=req.tools.map(x=>x.function.name), responses=req.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
  if(!tools.includes('build_financial_chart'))return result({content:'Fake prose { "schemaVersion": "financial-chart@1" }'});
  if(JSON.stringify(req.messages).includes('Auto prefers plain text')){
   assert.match(JSON.stringify(req.messages),/If a supported daily exchange-close chart materially assists/);
   return result({content:'No chart necessary.'});
  }
  assert.deepEqual(req.tools.find(x=>x.function.name==='build_financial_chart').function.parameters.properties.kind.enum,['exchange-close-line']);
  if(responses.length===0)return modelCall('wind_fund_daily_close','wind-evidence',windQuery);
  if(responses.length===1){
   assert.match(responses[0].chartEvidenceReceiptId,/^chart-evidence:sha256:/);
   return modelCall('build_financial_chart','explicit-chart',{kind:'exchange-close-line',receiptIds:[responses[0].chartEvidenceReceiptId]});
  }
  assert.equal(responses[1].schemaVersion,'financial-chart@1');
  return result({content:'Synthetic test answer. Not live data.'});
 };
 const start=async(auto=false)=>{gui=await startLocalGui({projectDir,liveConfig,env:{...env,...(auto?{ETF_GUI_FINANCIAL_CHART_AUTO:'1'}:{})},ownerWindFetch,fetchImpl});};
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 await start();
 assert.ok((await get('/api/workspace')).capabilities.includes('financial-chart-skill'));
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 async function done(messageId){
  for(let i=0;i<100;i++){
   const m=(await get(conv)).messages.find(x=>x.id===messageId);
   if(m&&m.status!=='active'&&m.status!=='admission-pending')return m;
   await new Promise(r=>setTimeout(r,15));
  }
  assert.fail('did not settle');
 }
 assert.equal((await post(conv+'/messages',{messageId:'auto-1',question:'No chart explicitly selected'})).status,202);
 assert.equal((await done('auto-1')).chartViews,undefined);
 const input={messageId:'chart-1',question:'Draw a daily close line',chartSkill:'financial-chart@1'};
 assert.equal((await post(conv+'/messages',{...input,attachmentId:'0'.repeat(64)})).status,400);
 assert.equal((await post(conv+'/messages',input)).status,202);
 const chart=await done('chart-1');
 assert.equal(chart.status,'completed',JSON.stringify(chart));
 assert.equal(chart.chartViews[0].kind,'exchange-close-line');
 assert.equal(chart.chartViews[0].title,'场内基金未复权日收盘价');
 assert.deepEqual(chart.chartViews[0].series[0].values,[1.32,null,1.35]);
 assert.equal(chart.chartViews[0].series[0].label,windQuery.windCode);
 assert.doesNotMatch(JSON.stringify(chart),/synthetic-wind-key|synthetic-model-key/);
 const {run}=await inspectResearchTask({projectDir,runId:chart.runId});
 const forged=structuredClone(run);
 const old=forged.snapshot.messages.find(m=>m.role==='tool'&&m.callId==='wind-evidence');
 old.result.value.rows[0].close=99;
 await assert.rejects(readOwnerChartViews(forged),{code:'CHART_WIND_RESULT_INVALID'});
 const justProse={...run,snapshot:{...run.snapshot,messages:run.snapshot.messages.filter(m=>m.callId!=='explicit-chart')}};
 assert.deepEqual(await readOwnerChartViews(justProse),[]);
 await gui.close();
 await start();
 assert.deepEqual((await done('chart-1')).chartViews,chart.chartViews);
 assert.equal((await post(conv+'/messages',input)).status,202);
 const {chartSkill:_,...changed}=input;assert.equal((await post(conv+'/messages',changed)).status,409);
 assert.equal(calls,4);
 assert.equal(windCalls,3);
 await gui.close();
 await start(true);
 assert.ok((await get('/api/workspace')).capabilities.includes('financial-chart-auto'));
 assert.equal((await post(conv+'/messages',{messageId:'auto-1',question:'No chart explicitly selected'})).status,202);
 assert.equal(calls,4); // previously admitted auto did not acquire new policy
 assert.equal((await post(conv+'/messages',{messageId:'auto-plain',question:'Auto prefers plain text'})).status,202);
 const plain=await done('auto-plain');
 assert.equal(plain.chartViews,undefined);
 assert.equal((await inspectResearchTask({projectDir,runId:plain.runId})).definition.chartSkill,'financial-chart-auto@1');
 assert.equal(calls,5);
 assert.equal(windCalls,3);
});
