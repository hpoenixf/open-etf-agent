import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {startLocalGui} from '../src/gui-server.mjs';
import {openAgentChart,readAgentChartViews} from '../src/financial-chart-agent.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';

const url='https://example.com/results';
const quotes=['Revenue 2025Q2 CNY million 18,450','Revenue 2025Q3 CNY million 19,287'];
const dataset={kind:'financial-columns',keys:['2025Q2','2025Q3'],series:[{label:'Revenue',values:[18450,19287]}],asOf:'2025-09-30',unit:'CNY million'};
const proposal=(id,name,args)=>Response.json({choices:[{message:{role:'assistant',tool_calls:[{type:'function',id,function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]});
const final=()=>Response.json({choices:[{message:{role:'assistant',content:'The comparison and its limitations are noted. The document values are synthetic.'},finish_reason:'stop'}]});

test('owner Auto accepts structured values from a committed report and reopens the rendered view from History',async t=>{
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/agent-chart-'));
 mockWebNetwork(t,{passthroughLoopback:true,routes:{'https://example.com/robots.txt':{body:'User-agent: *\nAllow: /\n'},[url]:{body:quotes.join('\n')}}});
 let gui,requests=0;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const opts={projectDir,env:{ETF_GUI_PROVIDER_KEY:'test-only',ETF_GUI_AGENT_FINANCIAL_CHART:'1'},
  liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:6},connectivity:{web:true}},
  async fetchImpl(_url,{body}){
   requests++;const r=JSON.parse(body),prior=r.messages.filter(x=>x.role==='tool');
   assert.ok(r.tools.some(t=>t.function.name==='render_financial_chart'));
   if(!prior.length)return proposal('report','public_web_read',{url});
   if(prior.length===1){
    const source=JSON.parse(prior[0].content).value;
    const ref='WEB:'+source.manifestSha256+':'+source.page;
    return proposal('chart','render_financial_chart',{dataset,evidence:quotes.map((quote,key)=>({quote,key,ref,series:0}))});
   }
   assert.equal(JSON.parse(prior.at(-1).content).value.view.provenance,'document-reported');
   return final();
  }};
 gui=await startLocalGui(opts);
 const post=(p,v)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const get=p=>fetch(gui.origin+p).then(r=>r.json());
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const response=await post(conv+'/messages',{messageId:'report-chart',question:'Show a chart from the publisher’s latest quarterly results.',skillId:'auto'});
 assert.equal(response.status,202,await response.text());
 let m;
 for(let i=0;i<100;i++){
  m=(await get(conv)).messages[0];if(m&&!m.working&&['completed','failed'].includes(m.status))break;await delay(30);
 }
 assert.equal(m?.status,'completed',JSON.stringify(m));
 assert.deepEqual(m.chartViews[0].series[0].values,[18450,19287]);
 assert.equal(m.chartViews[0].sources[0].url,url);
 assert.equal(m.chartViews[0].provenance,'document-reported');
 await gui.close();gui=await startLocalGui(opts);
 const cold=(await get(conv)).messages[0];
 assert.deepEqual(cold.chartViews,m.chartViews);assert.equal(cold.output.answer,m.output.answer);assert.equal(requests,3);
});

test('cross-run or altered evidence cannot gain source-checked attribution; script-equivalent payload is accepted',async()=>{
 const r={runId:'fixture',snapshot:{messages:[]}};
 const t=openAgentChart({readRun:()=>r});
 const c={id:'chart1',name:t.name,arguments:{dataset,evidence:[{key:0,series:0,ref:'WEB:'+'e'.repeat(64)+':1',quote:quotes[0]}]}};
 r.snapshot.messages.push({role:'assistant',calls:[c]});
 const v=await t.execute(c.arguments,{callId:c.id});
 assert.equal(v.status,'saved');
 assert.equal(v.view.provenance,'agent-supplied');
 assert.deepEqual(v.view.sources,[]);
 r.snapshot.messages.push({role:'tool',callId:c.id,result:{callId:c.id,status:'succeeded',dispatched:true,value:v}});
 assert.equal((await readAgentChartViews(r)).length,1);
 assert.equal((await t.execute({dataset:{...dataset,series:[{label:'invalid',values:[1,Infinity]}]}},{callId:'bad'})).reason,'CHART_DATA_INVALID');
 await assert.rejects(t.verifyResult({...v,view:{...v.view,provenance:'document-reported'}},{call:c}),{code:'CHART_RESULT_CHANGED'});
});

test('PDF page citations are from accepted original reads, not invented URLs',async()=>{
 const r={runId:'pdf-proof',snapshot:{messages:[]}};
 const sourceRef='web-pdf-page:sha256:'+'d'.repeat(64), body=['Reporting cutoff: September 30, 2025.',...quotes].join('\n');
 const pdf={id:'pdf1',name:'public_web_linked_pdf_page',arguments:{page:2}};
 const result={kind:'web-pdf-original-page',url:'https://example.com/quarter.pdf',page:2,sourceRef,text:body,sha256:createHash('sha256').update(body).digest('hex')};
 r.snapshot.messages.push({role:'assistant',calls:[pdf]},{role:'tool',callId:pdf.id,result:{callId:pdf.id,status:'succeeded',dispatched:true,value:result}});
 const arguments_={dataset,evidence:quotes.map((quote,key)=>({quote,key,ref:'PDF:'+sourceRef,series:0}))};
 r.snapshot.messages.push({role:'assistant',calls:[{id:'chart',name:'render_financial_chart',arguments:arguments_}]});
 const v=await openAgentChart({readRun:()=>r}).execute(arguments_,{callId:'chart'});
 assert.equal(v.view.provenance,'document-reported');
 assert.equal(v.view.sources[0].url,'https://example.com/quarter.pdf#page=2');
 const simple=await openAgentChart({readRun:()=>r}).execute({dataset,evidence:['PDF:'+sourceRef]},{callId:'chart'});
 assert.equal(simple.view.sources[0].url,v.view.sources[0].url);
 assert.equal(simple.view.provenance,'agent-supplied','a source link is not point-level proof');
 const dateSafe=openAgentChart({readRun:()=>r,dateSafe:true});
 assert.equal((await dateSafe.execute(arguments_,{callId:'chart'})).view.asOf,'2025-09-30');
 assert.equal((await dateSafe.execute({dataset},{callId:'chart'})).view.asOf,null);
 const tampered={...arguments_,dataset:{...dataset,series:[{label:'Revenue',values:[19287,18450]}]}};
 const disputed=await openAgentChart({readRun:()=>r}).execute(tampered,{callId:'chart'});
 assert.equal(disputed.view.provenance,'agent-supplied');
});

test('accepts names and units actually proposed by the live model; mixed units get specific guidance',async()=>{
 const t=openAgentChart({readRun:()=>({runId:'aliases',snapshot:{messages:[]}})});
 const call=(kind,unit,keys,series)=>t.execute({dataset:{...dataset,kind,unit,keys,series}},{callId:'chart'});
 const bar=await call('bar','亿元人民币',dataset.keys,[{label:'营业收入',values:[1845.04,1928.69]}]);
 assert.equal(bar.view.kind,'financial-columns');assert.equal(bar.view.unit,'CNY 100 million');assert.equal(bar.view.series[0].values[1],1928.69);
 const pie=await call('donut','%', ['A','B'],[{label:'结构',values:[60,40]}]);
 assert.equal(pie.view.chart,'pie');
 const line=await call('line','RMB million',dataset.keys,dataset.series);
 assert.deepEqual(line.view.keys,dataset.keys);assert.equal(line.view.chart,'bar');
 const mix=await call('combo-bar-line','亿元人民币 / %',dataset.keys,dataset.series);
 assert.equal(mix.reason,'CHART_UNIT_UNSUPPORTED');assert.match(mix.hint,/percentages/);
});

test('date-safe agent chart accepts null and drops a cutoff absent from the current question and retained sources',async()=>{
 const dataset={kind:'financial-columns',asOf:null,unit:'%',keys:['Q1','Q2','Q3'],series:[{label:'Growth',values:[null,10,10]}]};
 const readRun=()=>({runId:'date-safe',snapshot:{messages:[]}});
 const render=(d,operatorText)=>openAgentChart({readRun,dateSafe:true,operatorText}).execute({dataset:d},{callId:'chart'});
 for(const asOf of [null,'2025-09-30']){
  const v=await render({...dataset,asOf},'Synthetic Q1 Q2 Q3 only');
  assert.equal(v.status,'saved'); assert.equal(v.view.asOf,null); assert.deepEqual(v.view.series[0].values,[null,10,10]);
 }
 const known=await render({...dataset,asOf:'2026-09-30'},'Cutoff: September 30, 2026.');
 assert.equal(known.view.asOf,'2026-09-30');
 const bad=await render({...dataset,kind:'financial-trend',keys:['2026-07-31','2026-08-31','2026-09-30']},'Synthetic Q1 Q2 Q3 only');
 assert.equal(bad.status,'unavailable');
 const legacy=await openAgentChart({readRun}).execute({dataset:{...dataset,asOf:'2025-09-30'}},{callId:'chart'});
 assert.equal(legacy.view.asOf,'2025-09-30');
});

for(const mixed of [false,true])test('acquisition exhaustion '+(mixed?'inside a mixed group':'before a new group')+' allows chart and publication',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/research-control-'));
 mockWebNetwork(t,{passthroughLoopback:true,routes:{'https://example.com/robots.txt':{body:'User-agent: *\nAllow: /\n'},[url]:{body:quotes.join('\n')},[url+'-second']:{body:quotes.join('\n')}}});
 let gui;const wire=[];
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const opts={projectDir,env:{ETF_GUI_PROVIDER_KEY:'test-only',ETF_GUI_AGENT_FINANCIAL_CHART:'1'},
  liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:3,maxRounds:6,maxTools:mixed?2:1,tool:mixed?2:1},connectivity:{web:true}},
  async fetchImpl(_url,{body}){
   const r=JSON.parse(body),prior=r.messages.filter(x=>x.role==='tool');wire.push(r);
   if(wire.length===1)return proposal('source','public_web_read',{url});
   if(wire.length===2){
    assert.equal(r.tools.some(t=>t.function.name==='public_web_read'),mixed);
    assert.ok(r.tools.some(t=>t.function.name==='render_financial_chart'));
    const source=JSON.parse(prior[0].content).value,ref='WEB:'+source.manifestSha256+':'+source.page;
    const chart={dataset,evidence:quotes.map((quote,key)=>({quote,key,ref,series:0}))};
    if(!mixed)return proposal('chart','render_financial_chart',chart);
    const calls=[['second-source','public_web_read',{url:url+'-second'}],['extra-source','public_web_read',{url:url+'-unregistered-on-fixture'}],['chart','render_financial_chart',chart]];
    return Response.json({choices:[{message:{role:'assistant',tool_calls:calls.map(([id,name,args])=>({
     id,type:'function',function:{name,arguments:JSON.stringify(args)},
    }))},finish_reason:'tool_calls'}]});
   }
   return final();
  }};
 gui=await startLocalGui(opts);
 const post=(p,v)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const get=p=>fetch(gui.origin+p).then(r=>r.json());
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const response=await post(conv+'/messages',{messageId:'research-control',question:'根据腾讯财报绘制相关解读的图表，要尽可能多',skillId:'auto',researchDepth:'auto'});
 assert.equal(response.status,202,await response.text());
 let m;
 for(let i=0;i<120;i++){m=(await get(conv)).messages[0];if(m&&!m.working&&['completed','failed'].includes(m.status))break;await delay(30);}
 assert.equal(m.status,'completed',JSON.stringify(m));assert.equal(wire.length,3);
 assert.match(wire[0].messages[0].content,/deep-evidence@4/);
 assert.equal(wire.flatMap(r=>r.messages).filter(m=>m.role==='system'&&m.content.includes('Evidence acquisition advisory: 80%')).length,1);
 assert.equal(Object.hasOwn(wire[2],'tools'),false);assert.equal(Object.hasOwn(wire[2],'tool_choice'),false);assert.equal(m.chartViews.length,1);
 if(mixed){
  const refused=wire[2].messages.find(m=>m.role==='tool'&&m.tool_call_id==='extra-source');
  assert.ok(refused);assert.match(refused.content,/TOOL_LIMIT/);
  const second=wire[2].messages.find(m=>m.role==='tool'&&m.tool_call_id==='second-source');
  assert.match(second?.content??'',/public-web-page@/);
 }
 await gui.close();gui=await startLocalGui(opts);
 const cold=(await get(conv)).messages[0];assert.deepEqual(cold.chartViews,m.chartViews);assert.equal(cold.output.answer,m.output.answer);assert.equal(wire.length,3);
});
