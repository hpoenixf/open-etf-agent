import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {suppliedChartDatasets} from '../src/financial-chart-input.mjs';
import {compileFinancialChart,sealFinancialChartEvidence} from '../src/financial-chart.mjs';
import {createFinancialChartView} from '../src/gui/financial-chart-view.mjs';

const asOf='2026-11-26',unit='%';
const periods=['报告期一','报告期二','报告期三'];
const dates=['2026-11-01','2026-11-05','2026-11-09','2026-11-15','2026-11-20'];
const data=(kind,keys,series)=>({kind,keys,series:series.map(([label,values])=>({label,values})),asOf,unit});
const heatmap=data('financial-heatmap',periods,[['利差',[8,-4,null]],['增长',[-5,3,0]],['利润',[2,4,6]],['现金流',[7,2,-1]],['收益',[3,4,5]]]);
const combo=data('financial-combo',periods,[['行业甲',[5,-3,4]],['行业乙',[2,4,1]]]);
const multiline=data('financial-multi-line',dates.slice(0,3),[['策略甲',[1,null,3]],['策略乙',[2,3,4]]]);
const area=data('financial-area',dates,[['净流入',[2,3,null,-4,-5]]]);
const firstBar={open:10,high:13,low:9,close:12};
const lastBar={open:11,high:12,low:8,close:9};
const ohlc={...data('financial-ohlc',dates.slice(0,3),[['示例份额',[firstBar,null,lastBar]]]),unit:'CNY/share'};
const fenced=d=>'请只用我给出的合成数据作图。\n'+String.fromCharCode(96).repeat(3)+'financial-chart-data\n'+JSON.stringify(d)+'\n'+String.fromCharCode(96).repeat(3);

function dom(){
 const nodes=[];
 const create=tag=>{const n={tag,textContent:'',attrs:{},children:[],events:{},addEventListener(type,handler){this.events[type]=handler;},append(...items){this.children.push(...items);},setAttribute(k,v){this.attrs[k]=v;}};nodes.push(n);return n;};
 return {nodes,createElement:create,createElementNS:(_,tag)=>create(tag)};
}
test('advanced charts reject malformed or unproved input, inconsistent data and unsupported chart inference',async()=>{
 const runId='advanced-fixture';
 for(const d of [
  {...heatmap,series:heatmap.series.slice(0,1)},
  {...heatmap,keys:['同名','同名','另列']},
  {...heatmap,series:heatmap.series.map(x=>({...x,label:'重复'}))},
  {...heatmap,series:heatmap.series.concat(Array(8).fill(heatmap.series[0]))},
  {...combo,series:combo.series.slice(0,1)},
  {...combo,unit:'two-axis'},
  {...combo,series:combo.series.map(s=>({...s,mark:'model-defined'}))},
  {...multiline,keys:['2026-11-05','2026-11-01','2026-11-09']},
  {...multiline,series:multiline.series.slice(0,1)},
  {...area,keys:[...area.keys.slice(0,4),'2026-11-30']},
  {...area,series:[...area.series,{label:'加入',values:[1,2,3,4,5]}]},
  {...ohlc,kind:'ohlc-candlestick'},
  {...ohlc,kind:'exchange-close-line'},
  {...ohlc,asOf:'2026-11-07'},
  {...ohlc,unit:'%'},
  {...ohlc,series:[{label:'无收盘输入',values:[10,null,9]}]},
  {...ohlc,series:[{label:'无有效交易',values:[null,null,null]}]},
  ...[{...firstBar,high:11},{...firstBar,open:0},{...firstBar,low:11},{...firstBar,close:-1},{...firstBar,adjustment:'unadjusted'}]
   .map(bar=>({...ohlc,series:[{label:'错误 OHLC',values:[bar,null,lastBar]}]})),
 ])assert.deepEqual(suppliedChartDatasets(fenced(d),runId),[],d.kind);
 assert.deepEqual(suppliedChartDatasets('画一个热力图，把没提供的权重猜一下。',runId),[]);
 const [accepted]=suppliedChartDatasets(fenced(combo),runId);
 const [a,b]=accepted.receipts;
 const {receiptId,data:wrongData}=sealFinancialChartEvidence({...b.data,unit:'CNY'});
 const wrong={...b,receiptId,data:wrongData};
 await assert.rejects(compileFinancialChart({runId,selection:{kind:accepted.kind,receiptIds:[a.receiptId,wrong.receiptId]},
  readCommittedEvidence:({receiptId:id})=>[a,wrong].find(x=>x.receiptId===id)}),{code:'CHART_NONCOMPARABLE'});
 const {receiptId:shiftedId,data:shiftedData}=sealFinancialChartEvidence({...b.data,rows:b.data.rows.slice(1)});
 await assert.rejects(compileFinancialChart({runId,selection:{kind:accepted.kind,receiptIds:[a.receiptId,shiftedId]},
  readCommittedEvidence:({receiptId:id})=>[a,{...b,receiptId:shiftedId,data:shiftedData}].find(x=>x.receiptId===id)}),{code:'CHART_NONCOMPARABLE'});
});

test('owner GUI auto offers five rich profiles from frozen data, renders SVG+table, and reopens without model calls',async t=>{
 const projectDir=await mkdtemp(resolve('.advanced-chart-test-'));
 let gui,calls=0;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const cases=[heatmap,combo,multiline,area,ohlc];
 let current;
 const result=(message,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
 const call=(name,id,args)=>result({tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
 const endpoint='https://opencode.ai/inference/go/openai/v1/chat/completions';
 const start=async()=>{gui=await startLocalGui({projectDir,liveConfig:{gateway:{provider:'opencode-go-owner',endpoint,model:'synthetic-go-model',
  apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{web:true}},env:{ETF_GUI_PROVIDER_KEY:'fixture-placeholder'},async fetchImpl(url,{body}){
   assert.equal(String(url),endpoint);calls++;
   const request=JSON.parse(body),builder=request.tools.find(x=>x.function.name==='build_financial_chart').function;
   assert.deepEqual(builder.parameters.properties.kind.enum,[current.kind]);
   assert.match(JSON.stringify(request.messages),/heatmap for a same-unit/);
   const results=request.messages.filter(x=>x.role==='tool').map(x=>JSON.parse(x.content).value);
   if(!results.length)return call('read_supplied_chart_data','range-source',{});
   if(results.length===1){assert.equal(results[0].receiptIds.length,current.series.length);return call('build_financial_chart','range-chart',results[0]);}
   assert.equal(results[1].kind,current.kind);return result({content:'采用用户提供的数据，未独立核实。'});
  }});};
 await start();
 const get=path=>fetch(gui.origin+path).then(r=>r.json()),post=(path,value)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(value)});
 const {id}=await post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
 const views=[];
 for(const [i,d] of cases.entries()){
  current=d;
  const messageId='advanced-'+i,input={messageId,question:fenced(d)};
  assert.equal((await post(path+'/messages',input)).status,202);
  let turn;
  for(let wait=0;wait<120;wait++){
   turn=(await get(path)).messages.find(m=>m.id===messageId);
   if(['completed','failed'].includes(turn?.status)&&!turn.working)break;
   await delay(20);
  }
  assert.equal(turn?.status,'completed',JSON.stringify(turn));
  const [view]=turn.chartViews;views.push(view);
  assert.equal(view.provenance,'user-supplied');
  assert.equal(view.kind,d.kind);
  assert.deepEqual(view.keys,d.keys);
  assert.deepEqual(view.series.map(({label,values})=>({label,values})),d.series);
  const doc=dom();createFinancialChartView(doc,view);
  const tags=(tag)=>doc.nodes.filter(n=>n.tag===tag);
  const svg=tags('svg')[0];
  if(view.chart==='heatmap'){
   assert.equal(svg.children.filter(n=>n.tag==='rect'&&n.children.some(c=>c.tag==='title')).length,15);
   assert.equal(svg.children.filter(n=>n.tag==='text'&&n.textContent==='—').length,1);
   assert.deepEqual(tags('th').map(n=>n.textContent),['项目',...periods,...d.series.map(s=>s.label)]);
   assert.ok(tags('td').some(n=>n.textContent==='缺失'));
  }else if(view.chart==='combo'){
   assert.deepEqual(view.series.map(s=>s.mark),['bar','line']);
   const hit=svg.children.filter(n=>n.attrs.class==='financial-chart-period-hit');
   assert.equal(svg.children.filter(n=>n.tag==='rect'&&!n.attrs.class).length,3);
   assert.equal(hit.length,3);
   assert.equal(hit[1].attrs.tabindex,'0');
   const readout=tags('p').find(n=>n.attrs['aria-live']==='polite');
   const guide=svg.children.find(n=>n.attrs['stroke-dasharray']);
   assert.equal(guide.attrs.visibility,'hidden');
   hit[1].events.focus();
   assert.equal(guide.attrs.visibility,'visible');
   assert.equal(readout.textContent,'报告期二：行业甲（柱） -3 %；行业乙（线） 4 %');
   const secondPeriodX=guide.attrs.x1;
   hit[2].events.pointerenter();
   assert.equal(guide.attrs.x1,guide.attrs.x2);
   assert.notEqual(guide.attrs.x1,secondPeriodX);
   assert.equal(readout.textContent,'报告期三：行业甲（柱） 4 %；行业乙（线） 1 %');
   hit[2].events.pointerleave();
   assert.equal(guide.attrs.x1,secondPeriodX);
   hit[1].events.blur();
   assert.equal(guide.attrs.visibility,'hidden');
   assert.equal(svg.children.filter(n=>n.tag==='line'&&n.attrs['stroke-width']==='2').length,2);
   const malformed=structuredClone(view);malformed.series[0].mark='line';
   assert.throws(()=>createFinancialChartView(dom(),malformed),/Invalid approved/);
  }else if(view.chart==='multi-line'){
   assert.equal(new Set(svg.children.filter(n=>n.tag==='circle').map(n=>n.attrs.fill)).size,2);
   assert.equal(svg.children.filter(n=>n.tag==='line'&&n.attrs['stroke-width']==='2').length,2);
  }else if(view.chart==='area'){
   assert.equal(svg.children.filter(n=>n.tag==='polygon').length,2);
   assert.equal(svg.children.filter(n=>n.tag==='polyline').length,2);
  }else if(view.chart==='candlestick'){
   assert.equal(view.kind,'financial-ohlc');
   assert.equal(view.basis,'user-supplied');
   assert.equal(svg.children.filter(n=>n.tag==='rect').length,2);
   assert.ok(tags('td').some(n=>n.textContent==='开 10；高 13；低 9；收 12'));
   assert.ok(tags('td').some(n=>n.textContent==='缺失'));
   assert.throws(()=>createFinancialChartView(dom(),{...view,kind:'ohlc-candlestick'}),/Invalid approved/);
  }
 }
 assert.equal(calls,15);
 await gui.close();await start();
 assert.deepEqual((await get(path)).messages.map(m=>m.chartViews[0]),views);
 assert.equal(calls,15);
});
