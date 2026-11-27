import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {openChartCompute,chartComputeAvailable} from '../src/financial-chart-compute.mjs';
import {startLocalGui} from '../src/gui-server.mjs';

const formula={script:'change = growth(revenue)\nchange',inputs:{revenue:[100,110,121]}};
const result=(msg,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...msg},finish_reason}]});
const proposal=(id,name,args)=>result({tool_calls:[{type:'function',id,function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');

test('fixed process interprets numeric additions and rejects imperative Python without executing it',{skip:!chartComputeAvailable()},async()=>{
 const t=openChartCompute();
 const v=await t.execute(formula,{});
 assert.equal(v.status,'computed');assert.deepEqual(v.value,[null,10,10]);assert.equal(v.provenance,'computed-unverified');
 t.verifyResult(v,{call:{arguments:formula}});
 assert.throws(()=>t.verifyResult(v,{call:{arguments:{...formula,script:'sum(revenue)'}}}),{code:'FORMULA_RESULT_INVALID'});
 for(const script of ['open("/etc/passwd")','import socket\n1','(1).__class__','x[0]','while True: pass\n1','10 ** 10000']){
  const refusal=await t.execute({script,inputs:{x:[1]}},{});
  assert.equal(refusal.status,'unavailable',script);
  assert.equal(Object.hasOwn(refusal,'value'),false);
  assert.ok(!JSON.stringify(refusal).includes(script));
 }
});

test('owner chart Skill can use controlled formula output and restore the chart without model dispatch',{skip:!chartComputeAvailable()},async t=>{
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/chart-formula-'));
 let gui,requests=0;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const opts={projectDir,env:{ETF_GUI_PROVIDER_KEY:'test-only',ETF_GUI_AGENT_FINANCIAL_CHART:'1',ETF_GUI_CHART_COMPUTE:'1'},
  liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:6},connectivity:{web:true}},
  async fetchImpl(_url,{body}){
   requests++;
   const r=JSON.parse(body),prior=r.messages.filter(x=>x.role==='tool');
   assert.ok(r.tools.some(t=>t.function.name==='compute_chart_formula'));
   if(!prior.length)return proposal('formula','compute_chart_formula',formula);
   if(prior.length===1){
    const output=JSON.parse(prior[0].content).value;
    assert.equal(output.provenance,'computed-unverified');
    return proposal('chart','render_financial_chart',{dataset:{kind:'financial-columns',asOf:'2025-09-30',unit:'%',keys:['Q1','Q2','Q3'],series:[{label:'Growth',values:output.value}]}});
   }
   return result({content:'The computed chart is saved. Inputs are synthetic.'});
  }};
 gui=await startLocalGui(opts);
 const post=(p,v)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const get=p=>fetch(gui.origin+p).then(r=>r.json());
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const response=await post(conv+'/messages',{messageId:'formula-chart',question:'Compare the growth of the three synthetic quarters in a chart.',skillId:'auto'});
 assert.equal(response.status,202,await response.text());
 let m;
 for(let i=0;i<100;i++){
  m=(await get(conv)).messages[0];if(m&&!m.working&&['completed','failed'].includes(m.status))break;await delay(30);
 }
 assert.equal(m?.status,'completed',JSON.stringify(m));
 assert.deepEqual(m.chartViews[0].series[0].values,[null,10,10]);assert.equal(m.chartViews[0].provenance,'agent-supplied');
 await gui.close();gui=await startLocalGui(opts);
 const cold=(await get(conv)).messages[0];
 assert.deepEqual(cold.chartViews,m.chartViews);assert.equal(requests,3);
});
