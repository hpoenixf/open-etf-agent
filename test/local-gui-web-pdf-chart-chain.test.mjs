import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chartComputeAvailable,CHART_PDF_COMPUTE_CANONICAL} from '../src/financial-chart-compute.mjs';
import {OWNER_LINKED_PDF_INDEXED_CELLS} from '../src/gui-owner-web.mjs';
import {inspectResearchTask} from '../src/research-project.mjs';
import {startLocalGui} from '../src/gui-server.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';
import {multiPagePdf,pdf} from './fixtures/native-table-pdf.mjs';

const page='https://issuer.example/reports/latest';
const filing='https://issuer.example/reports/data.pdf';
const rows=[[740,[26,'PERFORMANCE (%)']],[722,[142,'2025'],[232,'2026']],[706,[28,'NAV'],[142,'0.32'],[232,'0.40']],[690,[28,'Benchmark'],[142,'1.10'],[232,'1.20']]];
const result=(msg,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...msg},finish_reason}]});
const call=(id,name,args)=>({type:'function',id,function:{name,arguments:JSON.stringify(args)}});
const proposal=(...calls)=>result({tool_calls:calls},'tool_calls');

test('HTML to a late page of a large linked PDF, then native cells to controlled chart, with exact original-source cold readback',{skip:!chartComputeAvailable()},async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/web-pdf-chain-'));
 const physicalPage=28;
 const original=multiPagePdf(Array.from({length:50},(_,i)=>i===physicalPage-1?rows:[]),{padding:1048576});
 assert.ok(original.length>1048576);
 let gui, modelCalls=0, linkId, refs, answer;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://issuer.example/robots.txt':{body:'User-agent: *\nAllow: /\n'},
  [page]:{body:'<main><h1>Public report</h1><a href="./data.pdf">Original filing PDF</a></main>',headers:{'content-type':'text/html'}},
  [filing]:{body:original,headers:{'content-type':'application/pdf'}},
 }});
 const options={projectDir,env:{ETF_GUI_PROVIDER_KEY:'test-only',ETF_GUI_AGENT_FINANCIAL_CHART:'1',ETF_GUI_CHART_COMPUTE:'1',ETF_GUI_PDF_CHART_CHAIN:'1'},
  liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:12},connectivity:{web:true,linkedPdf:true}},
  async fetchImpl(_url,{body}){
   modelCalls++;
   try{
   const req=JSON.parse(body), p=req.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
   const parameters=name=>req.tools.find(tool=>tool.function.name===name).function.parameters.properties;
   assert.ok(parameters('public_web_linked_pdf_page').tables);
   assert.ok(parameters('compute_chart_formula').cells);
   assert.ok(parameters('render_financial_chart').dataset.properties.series.items.anyOf);
   if(p.length===0)return proposal(call('html','public_web_read',{url:page}));
   if(p.length===1){linkId=p[0].pdfLinks.links[0].id;return proposal(call('tables','public_web_linked_pdf_page',{linkId,page:physicalPage,tables:true}));}
   if(p.length===2){
    assert.equal(p[1].kind,'web-pdf-original-tables@1');
    assert.deepEqual(p[1].tables,[{table:1,caption:'PERFORMANCE (%)',columns:[{column:1,label:'2025'},{column:2,label:'2026'}],
     rows:[{row:1,label:'NAV'},{row:2,label:'Benchmark'}],unit:'%'}]);
    const cell=column=>({linkId,page:physicalPage,table:1,row:1,column});
    return proposal(call('cell-first','public_web_linked_pdf_page',cell(1)),call('cell-second','public_web_linked_pdf_page',cell(2)),
     call('invalid-selector','public_web_linked_pdf_page',{...cell(1),tables:true}));
   }
   if(p.length===5){
    assert.equal(p[4].code,'WEB_PDF_SELECTOR_INVALID');assert.equal(p[4].networkAttempted,false);
    assert.deepEqual(p.slice(2,4).map(x=>[x.text,x.cell.header]),[['0.32','2025'],['0.40','2026']]);
    refs=p.slice(2,4).map(x=>'PDF:'+x.sourceRef);
    return proposal(call('bad','compute_chart_formula',{script:'growth(nav)',cells:{nav:['PDF:web-pdf-cell:sha256:'+'0'.repeat(64)]}}));
   }
   if(p.length===6){
    assert.equal(p[5].reason,'FORMULA_SOURCE_UNAVAILABLE');
    return proposal(call('calc','compute_chart_formula',{script:'growth(nav)',cells:{nav:[refs[0].slice(4),'[['+refs[1]+']]']}}));
   }
   if(p.length===7){
    assert.equal(p[6].value[0],null);assert.ok(Math.abs(p[6].value[1]-25)<1e-12);assert.deepEqual(p[6].sourceRefs,refs);assert.equal(p[6].formulaCallId,'calc');
    return proposal(call('chart','render_financial_chart',{dataset:{kind:'financial-columns',asOf:null,unit:'%',keys:['2025','2026'],series:[{label:'NAV growth',formulaCallId:'calc'}]}}));
   }
   assert.equal(p[7].view.series[0].values[0],null);assert.ok(Math.abs(p[7].view.series[0].values[1]-25)<1e-12);
   assert.equal(p[7].view.provenance,'agent-supplied');
   answer='基期 0.32 [['+refs[0]+']]，次期 0.40 [['+refs[1]+']]，按这两个原值算得相对变化 25%。';
   return result({content:answer});
   }catch(e){console.error(e);throw e;}
  }};
 gui=await startLocalGui(options);
 const get=p=>fetch(gui.origin+p).then(r=>r.json());
 const post=(p,v)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const response=await post(conv+'/messages',{messageId:'report',question:'Open the issuer’s release and calculate the change in NAV from the original PDF cells, with a chart.'});
 assert.equal(response.status,202,await response.text());
 let m;
 for(let i=0;i<150;i++){
  m=(await get(conv)).messages[0];if(m&&!m.working&&['completed','failed'].includes(m.status))break;await delay(35);
 }
 assert.equal(m?.status,'completed',JSON.stringify(m));
 assert.equal(m.output.answer,answer);
 const task=await inspectResearchTask({projectDir,runId:m.runId});
 assert.equal(task.definition.ownerLinkedPdfRevision,OWNER_LINKED_PDF_INDEXED_CELLS);
 assert.equal(task.definition.chartSkill,CHART_PDF_COMPUTE_CANONICAL);
 const base=conv+'/messages/report',sources=await get(base+'/sources'),body=await get(base+'/body');
 const cells=sources.readSources.filter(x=>x.kind==='web-pdf-original-cell@1');
 assert.deepEqual(cells.map(x=>[x.cited,x.page,x.cell.header,x.cell.unit]),[[true,physicalPage,'2025','%'],[true,physicalPage,'2026','%']]);
 assert.deepEqual(m.chartViews[0].sources.map(x=>[x.ref,x.url]),refs.map(ref=>[ref,filing+'#page='+physicalPage]));
 const before=[modelCalls,network.calls.length];
 assert.equal(network.calls.filter(x=>x.url===filing).length,1);
 // Disable the opt-in admissions on the same runtime binary. History must use
 // the Run's pinned adapters, not current discovery/activation flags.
 await gui.close();gui=await startLocalGui({...options,env:{ETF_GUI_PROVIDER_KEY:'test-only'}});
 assert.deepEqual(await get(base+'/sources'),sources);
 assert.deepEqual(await get(base+'/body'),body);
 assert.deepEqual((await get(conv)).messages[0].chartViews,m.chartViews);
 assert.deepEqual([modelCalls,network.calls.length],before);
});

test('PDF without a structured table still publishes cited text and cold History',{skip:!chartComputeAvailable()},async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/web-pdf-no-table-'));
 const prose='The fund changed its benchmark in July.';
 let gui, modelCalls=0, answer;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://issuer.example/robots.txt':{body:'User-agent: *\nAllow: /\n'},
  [page]:{body:'<main><a href="./data.pdf">Original filing PDF</a></main>',headers:{'content-type':'text/html'}},
  [filing]:{body:pdf([[740,[26,prose]]]),headers:{'content-type':'application/pdf'}},
 }});
 const options={projectDir,env:{ETF_GUI_PROVIDER_KEY:'test-only',ETF_GUI_AGENT_FINANCIAL_CHART:'1',ETF_GUI_CHART_COMPUTE:'1',ETF_GUI_PDF_CHART_CHAIN:'1'},
  liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:8},connectivity:{web:true,linkedPdf:true}},
  async fetchImpl(_url,{body}){
   modelCalls++;
   const p=JSON.parse(body).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
   if(p.length===0)return proposal(call('html','public_web_read',{url:page}));
   const linkId=p[0].pdfLinks.links[0].id;
   if(p.length===1)return proposal(call('tables','public_web_linked_pdf_page',{linkId,page:1,tables:true}));
   assert.equal(p[1].kind,'web-pdf-tables-unavailable@1');
   assert.equal(p[1].code,'WEB_PDF_NO_STRUCTURED_TABLE');
   if(p.length===2)return proposal(call('text','public_web_linked_pdf_page',{linkId,page:1}));
   assert.equal(p[2].kind,'web-pdf-original-page');
   assert.ok(p[2].text.includes(prose));
   answer=prose+' [[PDF:'+p[2].sourceRef+']] No table was available for a computed chart.';
   return result({content:answer});
  }};
 gui=await startLocalGui(options);
 const get=p=>fetch(gui.origin+p).then(r=>r.json());
 const post=(p,v)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const response=await post(conv+'/messages',{messageId:'report',question:'Read the original filing and chart it only if a numeric table is available.'});
 assert.equal(response.status,202,await response.text());
 let m;
 for(let i=0;i<150;i++){
  m=(await get(conv)).messages[0];if(m&&!m.working&&['completed','failed'].includes(m.status))break;await delay(35);
 }
 assert.equal(m?.status,'completed',JSON.stringify(m));
 assert.equal(m.output.answer,answer);
 assert.deepEqual(m.chartViews??[],[]);
 const base=conv+'/messages/report',body=await get(base+'/body'),sources=await get(base+'/sources');
 const pages=sources.readSources.filter(x=>x.kind==='web-pdf-original-page');
 assert.deepEqual(pages.map(x=>[x.cited,x.page]),[[true,1]]);
 assert.equal(sources.readSources.some(x=>x.kind==='web-pdf-original-cell@1'),false);
 assert.equal(network.calls.filter(x=>x.url===filing).length,1);
 const before=[modelCalls,network.calls.length];
 assert.equal(modelCalls,4);
 await gui.close();gui=await startLocalGui(options);
 assert.deepEqual(await get(base+'/sources'),sources);
 assert.deepEqual(await get(base+'/body'),body);
 assert.deepEqual([modelCalls,network.calls.length],before);
});
