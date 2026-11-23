import test from 'node:test';
import assert from 'node:assert/strict';
import {sealFinancialChartEvidence,compileFinancialChart,createFinancialChartSkill,
 projectFinancialChart,CHART_TOOL_NAME} from '../src/financial-chart.mjs';
import {createFinancialChartView} from '../src/gui/financial-chart-view.mjs';
const runId='run-1',callId='chart-1',date='2026-11-22';
const base={schemaVersion:'chart-typed-evidence@1',runId,toolCallId:'evidence-1',
 metric:'nav-series',unit:'CNY/unit',basis:'fund-nav-per-unit',dimension:'date',asOf:date,
 periodStart:null,originReceiptIds:['result:sha256:'+'a'.repeat(64)],label:'Synthetic <img onerror=x>',provenance:'synthetic',
 rows:[{key:'2026-11-01',value:1.23},{key:'2026-11-02',value:null},{key:'2026-11-03',value:1.26}]};
function fixture(input=base,extra=[]){
 const all=[input,...extra].map(x=>sealFinancialChartEvidence(x));
 const selection={kind:input.metric,receiptIds:all.map(x=>x.receiptId)};
 const readCommittedEvidence=async({receiptId})=>{
  const row=all.find(x=>x.receiptId===receiptId);
  return row&&{...row,status:'succeeded',toolCallId:row.data.toolCallId};
 };
 return {runId,selection,readCommittedEvidence,all};
}
function nativeDom(){
 const seen=[];
 const make=(tag,ns)=>{const e={tag,ns,textContent:'',attrs:{},children:[],
  append(...nodes){this.children.push(...nodes);},
  setAttribute(key,value){this.attrs[key]=value;}};
  seen.push(e);return e;
 };
 return {seen,doc:{createElement:k=>make(k),createElementNS:(ns,k)=>make(k,ns)}};
}
async function projection(f){
 const value=await compileFinancialChart(f);
 return projectFinancialChart({...f,callId,readCommittedChartResult:async()=>({
   name:CHART_TOOL_NAME,status:'succeeded',dispatched:true,runId,callId,arguments:f.selection,value,
 })});
}

test('express Skill inputs select prior native receipts only; implicit model JSON and altered numbers are rejected',async()=>{
 const f=fixture(),skill=createFinancialChartSkill(f);
 const chart=await skill.execute(f.selection);
 assert.deepEqual(chart.series[0].values,[1.23,null,1.26]);
 assert.equal(chart.dimension,'date');
 await assert.rejects(skill.execute({...f.selection,title:'model title'}),{code:'CHART_REQUEST_INVALID'});
 await assert.rejects(skill.execute({...f.selection,receiptIds:['chart-evidence:sha256:'+'0'.repeat(64)]}),{code:'CHART_UNVERIFIED_SOURCE'});
 await assert.rejects(projectFinancialChart({...f,callId,readCommittedChartResult:async()=>({kind:'prose',value:chart})}),
  {code:'CHART_RESULT_NOT_ACCEPTED'});
 const forged=structuredClone(chart);forged.series[0].values[0]=99;
 await assert.rejects(projectFinancialChart({...f,callId,readCommittedChartResult:async()=>({
  name:CHART_TOOL_NAME,status:'succeeded',dispatched:true,runId,callId,arguments:f.selection,value:forged,
 })}),{code:'CHART_RESULT_CHANGED'});
 await assert.rejects(compileFinancialChart({...f,runId:'different-run'}),{code:'CHART_UNVERIFIED_SOURCE'});
});
test('line gaps are not connected; the SVG uses only generated safe marks and text nodes',async()=>{
 const view=await projection(fixture()),{seen,doc}=nativeDom();
 createFinancialChartView(doc,view);
 const lines=seen.filter(n=>n.tag==='line');
 assert.equal(lines.length,2); // axes only, no line across null gap
 assert.ok(seen.some(n=>n.textContent.includes('<img onerror=x>')&&n.tag==='th'));
 assert.ok(seen.some(n=>n.textContent.includes('不是实时数据')));
 assert.ok(seen.every(n=>!['img','script','style','foreignObject','a'].includes(n.tag)&&!Object.keys(n.attrs).some(x=>/^on|href/.test(x))));
});
test('return and expense bar comparisons require same metric units and declared period',async()=>{
 const sample={...base,metric:'return-comparison',dimension:'fund',unit:'%',basis:'total-return',periodStart:'2026-11-01',
 rows:[{key:'Fund A',value:-2.3},{key:'Fund B',value:1.5}]};
 const view=await projection(fixture(sample)),{doc,seen}=nativeDom();createFinancialChartView(doc,view);
 assert.equal(view.chart,'bar');
 assert.equal(seen.filter(n=>n.tag==='rect').length,2);
 assert.throws(()=>sealFinancialChartEvidence({...sample,basis:'NAV or close'}),{code:'CHART_EVIDENCE_INVALID'});
 assert.throws(()=>sealFinancialChartEvidence({...sample,periodStart:'2026-12-01'}),{code:'CHART_EVIDENCE_INVALID'});
 assert.equal((await compileFinancialChart(fixture({...sample,metric:'expense-comparison',basis:'annual-expense-ratio',
  periodStart:null,rows:[{key:'Fund A',value:0.13}]}))).chart,'bar');
 await assert.rejects(compileFinancialChart(fixture(base,[{...base,label:'other currency',unit:'USD/unit'}])),{code:'CHART_NONCOMPARABLE'});
});
test('holding pie preserves the total basis and shows a separate remainder instead of renormalizing',async()=>{
 const data={...base,metric:'holdings-pie',dimension:'holding',unit:'%',basis:'percent-of-fund-net-assets',periodStart:null,
 rows:[{key:'A',value:40},{key:'B',value:15},{key:'uncertain',value:null}]};
 const view=await projection(fixture(data)),{seen,doc}=nativeDom();
 assert.deepEqual(view.series[0].values,[40,15,null]);
 assert.deepEqual(view.coverage,{total:100,remainder:45,remainderLabel:'未列出或未核实'});
 createFinancialChartView(doc,view);
 assert.equal(seen.filter(n=>n.tag==='path').length,3);
 assert.ok(seen.some(n=>n.textContent==='未列出或未核实'));
 await assert.rejects(compileFinancialChart(fixture({...data,rows:[{key:'A',value:70},{key:'B',value:50}]})),{code:'CHART_PIE_COVERAGE'});
});
test('candlestick requires actual ordered OHLC values, not close-only input',async()=>{
 const data={...base,metric:'ohlc-candlestick',unit:'CNY/share',basis:'exchange-daily-ohlc-unadjusted',
 rows:[{key:'2026-11-01',value:{open:10,high:15,low:8,close:14}},{key:'2026-11-02',value:null},
  {key:'2026-11-03',value:{open:14,high:17,low:9,close:12}}]};
 const view=await projection(fixture(data)),{seen,doc}=nativeDom();
 createFinancialChartView(doc,view);
 assert.equal(seen.filter(n=>n.tag==='rect').length,2);
 assert.ok(seen.some(n=>n.textContent.includes('开 10；高 15；低 8；收 14')));
 assert.throws(()=>sealFinancialChartEvidence({...data,rows:base.rows}),{code:'CHART_EVIDENCE_INVALID'});
 assert.throws(()=>sealFinancialChartEvidence({...data,rows:[{key:'2026-11-01',value:{open:10,high:11,low:8,close:14}}]}),{code:'CHART_EVIDENCE_INVALID'});
});
