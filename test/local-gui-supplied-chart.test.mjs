import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLocalGui} from '../src/gui-server.mjs';
import {createFinancialChartView} from '../src/gui/financial-chart-view.mjs';

test('Owner gets four typed user-supplied charts via GUI tool calls, with cold read and plain-text fallback',async t=>{
 const projectDir=await mkdtemp(resolve('.typed-chart-test-'));
 const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',
  model:'glm-5.3-flash',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{web:true}};
 let gui,sends=0;
 const answer='研究结论仍独立显示。';
 const result=(message,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
 const call=(name,id,args)=>result({tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
 const fetchImpl=async(_url,init)=>{
  sends++;
  const req=JSON.parse(init.body), tools=req.tools.map(x=>x.function.name);
  const replies=req.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
  if(!tools.includes('read_supplied_chart_data'))return result({content:answer});
  assert.match(JSON.stringify(req.messages),/When a chart materially helps/);
  if(replies.length===0)return call('read_supplied_chart_data','data-1',{});
  if(replies.length===1)return call('build_financial_chart','chart-1',replies[0]);
  assert.equal(replies[1].provenance,'user-supplied');
  return result({content:answer});
 };
 const start=async()=>{gui=await startLocalGui({projectDir,
  liveConfig:{...liveConfig,connectivity:{...liveConfig.connectivity,linkedPdf:true}},
  env:{ETF_GUI_PROVIDER_KEY:'test-only',ETF_GUI_AGENT_FINANCIAL_CHART:'1',ETF_GUI_CHART_COMPUTE:'1',ETF_GUI_PDF_CHART_CHAIN:'1'},fetchImpl});};
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 await start();
 assert.ok((await get('/api/workspace')).capabilities.includes('financial-chart-skill'));
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 async function done(id){
  for(let i=0;i<100;i++){
   const m=(await get(conv)).messages.find(x=>x.id===id);
   if(m&&!['active','admission-pending'].includes(m.status))return m;
   await new Promise(r=>setTimeout(r,15));
  }
  assert.fail('did not settle');
 }
 const views=[];
 for(const [i,kind,type,keys,a,b] of [
  [1,'financial-trend','line',['2026-03-31','2026-06-30'],[21,30],[20,null]],
  [2,'financial-columns','bar',['去年同季','本季'],[130,170],[120,150]],
  [3,'financial-stacked','stacked',['去年同季','本季'],[130,170],[-20,-15]],
  [4,'financial-share','pie',['游戏','云'],[52,38]],
 ]){
  const series=[{label:'分项甲',values:a},...(b?[{label:'分项乙',values:b}]:[])];
  const block=String.fromCharCode(96).repeat(3);
  const question='按表作图并解释。\n'+block+'financial-chart-data\n'+JSON.stringify({kind,keys,series,asOf:'2026-06-30',unit:type==='pie'?'%':'USD'})+'\n'+block;
  const id='typed-'+i;
  assert.equal((await post(conv+'/messages',{messageId:id,question,...(i%2?{chartSkill:'financial-chart@1'}:{})})).status,202);
  const m=await done(id);
  assert.equal(m.status,'completed',JSON.stringify(m));
  const [v]=m.chartViews??[];assert.ok(v,JSON.stringify(m));
  assert.equal(v.chart,type);assert.equal(v.provenance,'user-supplied');
  assert.deepEqual(v.series.map(x=>x.values),series.map(s=>s.values));views.push(v);
  const nodes=[];
  const create=tag=>{const n={tag,textContent:'',attrs:{},children:[],append(...items){this.children.push(...items);},setAttribute(k,x){this.attrs[k]=x;}};nodes.push(n);return n;};
  createFinancialChartView({createElement:create,createElementNS:(_,tag)=>create(tag)},v);
  assert.ok(nodes.some(n=>n.tag==='figure'));
  assert.ok(nodes.some(n=>n.textContent.includes('未独立核验')));
  if(type==='stacked'){
   const chart=nodes.find(n=>n.tag==='svg');
   const zero=Number(chart.children.find(n=>n.tag==='line'&&n.attrs.y1===n.attrs.y2).attrs.y1);
   const bars=chart.children.filter(n=>n.tag==='rect');
   assert.equal(bars.length,4);
   assert.ok(bars.slice(0,2).every(n=>Number(n.attrs.y)<zero));
   assert.ok(bars.slice(2).every(n=>Math.abs(Number(n.attrs.y)-zero)<0.01));
  }
 }
 const invalid='不完整数据只用文字。\n'+String.fromCharCode(96).repeat(3)+'financial-chart-data\n{"kind":"financial-trend","url":"https://example.invalid"}\n'+String.fromCharCode(96).repeat(3);
 assert.equal((await post(conv+'/messages',{messageId:'invalid',question:invalid,chartSkill:'financial-chart@1'})).status,202);
 assert.equal((await done('invalid')).chartViews,undefined);
 const before=sends;
 await gui.close();await start();
 for(let i=1;i<=4;i++)assert.deepEqual((await done('typed-'+i)).chartViews,[views[i-1]]);
 assert.equal(sends,before);
});
