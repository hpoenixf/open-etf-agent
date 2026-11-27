import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLocalGui} from '../src/gui-server.mjs';
import {createFinancialChartView} from '../src/gui/financial-chart-view.mjs';
import {suppliedChartDatasets} from '../src/financial-chart-input.mjs';
import {openSuppliedChartTools} from '../src/financial-chart-owner.mjs';

const question='请只用我提供的虚构数据，不联网、不查持仓。请实际生成两张图：柱状图：基金甲 8%、基金乙 3%、基金丙 5%；饼图：科技 50%、金融 30%、消费 20%。请渲染图表，不要用表格或代码块代替。';
const enumerated='请用我提供的数据作两张图。①柱状图：基金甲 8%、基金乙 3%、基金丙 5%；②饼图：科技 50%、金融 30%、消费 20%。不联网。';
test('admission only reads exact labeled percentage pairs, with separate Run-bound receipts',async()=>{
 const runId='test-run';
 const d=suppliedChartDatasets(question,runId);
 assert.equal(d.length,2);
 assert.deepEqual(suppliedChartDatasets(enumerated,runId).map(x=>x.kind),d.map(x=>x.kind));
 assert.deepEqual(suppliedChartDatasets('请生成两张图：柱状图：甲 3%-8%、乙 4%；饼图：甲 50%、乙 50%。',runId),[]);
 assert.deepEqual(d.map(x=>x.receipts[0].data.rows.map(r=>r.value)),[[8,3,5],[50,30,20]]);
 assert.deepEqual(d.map(x=>x.receipts[0].data.asOf),[null,null]);
 assert.notEqual(d[0].receipts[0].data.originReceiptIds[0],d[1].receipts[0].data.originReceiptIds[0]);
 assert.notEqual(d[0].receipts[0].receiptId,suppliedChartDatasets(question,'other-run')[0].receipts[0].receiptId);
 assert.deepEqual(suppliedChartDatasets('饼图：甲 60%、乙 60%。',runId),[]);
 assert.deepEqual(suppliedChartDatasets('饼图：三个行业分别为 50%、30%、20%。',runId),[]);
 assert.deepEqual(suppliedChartDatasets('柱状图：甲 3%、乙 3亿元。',runId),[]);
 assert.deepEqual(suppliedChartDatasets('柱状图：甲 3%、甲 4%。',runId),[]);
 assert.deepEqual(suppliedChartDatasets('柱状图：甲 3%-8%、乙 4%。',runId),[]);
 const [reader,builder]=openSuppliedChartTools({runId,readRun:()=>null,operatorText:question});
 const {datasets}=await reader.execute({});
 assert.throws(()=>builder.validate(datasets[0]),/CHART_UNVERIFIED_SOURCE/);
 assert.throws(()=>builder.validate({...datasets[0],receiptIds:datasets[1].receiptIds}),/CHART_UNVERIFIED_SOURCE/);
});

test('one natural message yields two accepted tool charts, cold-read unchanged and no guessed date',async t=>{
 const projectDir=await mkdtemp(resolve('.prose-chart-test-'));
 let gui,sends=0;
 const endpoint='https://opencode.ai/inference/go/openai/v1/chat/completions';
 const answer='这是用户提供的例子，未独立核验。';
 const result=(message,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
 const call=(name,id,args)=>result({tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
 const fetchImpl=async(url,init)=>{
  assert.equal(String(url),endpoint);
  sends++;
  const req=JSON.parse(init.body);
  const chart=req.tools.find(x=>x.function.name==='build_financial_chart')?.function;
  if(!chart){assert.equal(req.tools.some(x=>x.function.name==='read_supplied_chart_data'),false);return result({content:'未提供本轮数据。'});}
  assert.deepEqual(chart.parameters.properties.kind.enum,['financial-columns','financial-share']);
  const replies=req.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
  if(!replies.length)return call('read_supplied_chart_data','two-source',{});
  const [bar,pie]=replies[0].datasets;
  if(replies.length===1)return call('build_financial_chart','two-bar',bar);
  if(replies.length===2)return call('build_financial_chart','two-pie',pie);
  assert.equal(replies[1].chart,'bar');
  assert.equal(replies[2].chart,'pie');
  return result({content:answer});
 };
 const start=async()=>{gui=await startLocalGui({projectDir,liveConfig:{gateway:{provider:'opencode-go-owner',endpoint,model:'glm-5.3-flash',
  apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:6},connectivity:{web:true}},env:{ETF_GUI_PROVIDER_KEY:'test-only'},fetchImpl});};
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 await start();
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 assert.equal((await post(conv+'/messages',{messageId:'prose-two',question})).status,202);
 let m;
 for(let i=0;i<100;i++){
  m=(await get(conv)).messages.find(x=>x.id==='prose-two');
  if(m&&!['active','admission-pending'].includes(m.status))break;
  await new Promise(r=>setTimeout(r,15));
 }
 assert.equal(m?.status,'completed',JSON.stringify(m));
 const views=m.chartViews;
 assert.deepEqual(views.map(v=>[v.chart,v.keys,v.series[0].values,v.provenance,v.asOf]),[
  ['bar',['基金甲','基金乙','基金丙'],[8,3,5],'user-supplied',null],
  ['pie',['科技','金融','消费'],[50,30,20],'user-supplied',null],
 ]);
 const nodes=[];
 const create=tag=>{const n={tag,textContent:'',attrs:{},children:[],append(...a){this.children.push(...a);},setAttribute(k,v){this.attrs[k]=v;}};nodes.push(n);return n;};
 const doc={createElement:create,createElementNS:(_,tag)=>create(tag)};
 views.forEach(view=>createFinancialChartView(doc,view));
 assert.equal(nodes.filter(n=>n.tag==='figure').length,2);
 assert.equal(nodes.filter(n=>n.tag==='figcaption'&&n.textContent.includes('未提供日期')).length,2);
 assert.equal(nodes.filter(n=>n.tag==='p'&&n.textContent.includes('未独立核验')).length,2);
 const before=sends;
 await gui.close();await start();
 assert.deepEqual((await get(conv)).messages[0].chartViews,views);
 assert.equal(sends,before);
 assert.equal((await post(conv+'/messages',{messageId:'prose-two',question})).status,202);
 assert.equal(sends,before);
 assert.equal((await post(conv+'/messages',{messageId:'prose-no-new',question:'请把上一轮的数据重新画成柱状图。'})).status,202);
 let followup;
 for(let i=0;i<100;i++){
  followup=(await get(conv)).messages.find(x=>x.id==='prose-no-new');
  if(followup&&!['active','admission-pending'].includes(followup.status))break;
  await new Promise(r=>setTimeout(r,15));
 }
 assert.equal(followup?.status,'completed',JSON.stringify(followup));
 assert.equal(followup.chartViews,undefined);
 assert.equal(sends,before+1);
});
