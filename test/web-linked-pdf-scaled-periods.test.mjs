import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractPdfTables,validPdfCell,validPdfTables} from '../src/pdf-table-evidence.mjs';
import {prepareLinkedWebPdfSnapshot} from '../src/pdf-input.mjs';

const labels=['Three months ended 30 September 2026','Three months ended 30 September 2025',
 'Nine months ended 30 September 2026','Nine months ended 30 September 2025'];
const s=(text,x,y,w)=>({text,x,y,w});
function fixture(){
 const anchors=[18,22,26,30];
 const dates=[2026,2025,2026,2025];
 const row=(name,values,y)=>[s(name,4,y,6),...values.map((v,i)=>s(v,anchors[i]-3,y,3))];
 return [s('Financial highlights',4,4,7),s('Three months ended',16,7,5),s('Nine months ended',24,7,5),
  ...dates.map((_,i)=>s('30 September',anchors[i]-4,8,6)),
  ...dates.map((yr,i)=>s(String(yr),anchors[i]-2,9,2)),
  s('(RMB in millions, unless specified)',14,10,10),
  ...row('Capital expenditures',['3,000','2,000','10,000','7,000'],11.5),
  ...row('Adjusted margin',['25%','21%','23%','20%'],12.5),
  ...row('Revenue',['9,000','8,000','28,000','24,000'],13.5)];
}
const scoped={scaledPeriods:true};
test('scaled linked grid names the matching period even when two date pairs repeat',()=>{
 const spans=fixture();
 assert.deepEqual(extractPdfTables(spans),[]);
 const [table]=extractPdfTables(spans,scoped);
 assert.deepEqual(table.headers,labels);
 assert.equal(table.unit,'RMB million');
 assert.deepEqual(table.rows.map(r=>r.label),['Capital expenditures','Revenue']);
 assert.deepEqual(table.rows[0].cells.map(c=>c.text),['3,000','2,000','10,000','7,000']);
 assert.ok(validPdfCell({schemaVersion:'pdf-table-cell@1',page:undefined,table:1,row:1,column:3,caption:table.caption,
  header:table.headers[2],rowLabel:table.rows[0].label,unit:table.unit,at:table.rows[0].cells[2].at})===false);
 const cell={schemaVersion:'pdf-table-cell@1',table:1,row:1,column:3,caption:table.caption,
  header:table.headers[2],rowLabel:table.rows[0].label,unit:table.unit,at:table.rows[0].cells[2].at};
 assert.ok(validPdfCell(cell));
 assert.equal(validPdfCell({...cell,unit:'CNY'}),false);
 const forged=structuredClone(table);forged.headers[2]=forged.headers[0];
 assert.equal(validPdfTables([forged]),false);
});
test('scaled table never labels per-share or yuan exceptions as RMB millions',()=>{
 const kinds=['Basic earnings per share (yuan)','Diluted EPS','Dividend per share','每股收益（元）','Unit price (yuan)'];
 for(const label of kinds){
  const data=fixture().map(v=>v.y===12.5?{...v,text:v.text==='Adjusted margin'?label:v.text.slice(0,-1)}:v);
  const [table]=extractPdfTables(data,scoped);
  assert.deepEqual(table?.rows.map(r=>r.label),['Capital expenditures','Revenue'],label);
  const noExceptions=data.map(v=>v.text.startsWith('(RMB in')?{...v,text:'(RMB in millions)'}:v);
  assert.deepEqual(extractPdfTables(noExceptions,scoped),[],label);
 }
});
test('overlapping periods, missing cells, and mixed currency/percent rows fail closed',()=>{
 for(const change of [
  a=>a.map((v,i)=>i===1?{...v,w:14}:v),
  a=>a.filter(v=>v.text!=='7,000'),
  a=>a.map(v=>v.text==='23%'?{...v,text:'23'}:v),
  a=>a.map(v=>v.text==='7,000'?{...v,x:v.x+1.8}:v),
  a=>a.map(v=>v.text.startsWith('(RMB in')?{...v,text:'(RMB in billions)'}:v),
 ])assert.deepEqual(extractPdfTables(change(fixture()),scoped),[]);
});

const originalPath=process.env.OPEN_ETF_PUBLIC_PDF_ACCEPTANCE_FILE;
test('exact public HKEX original retains four correctly scoped page 12 capex points',
 {skip:!originalPath},async()=>{
 const {snapshot}=await prepareLinkedWebPdfSnapshot(await readFile(originalPath));
 assert.equal(snapshot.originalSha256,'cc70d57e4a3677f0ac9bb28085b8a9f1c2c83e49cbdae3a0d916cd82624d9614');
 assert.equal(snapshot.pages.length,50);
 const table=snapshot.tables[11].find(t=>t.rows.some(r=>r.label.startsWith('Capital expenditures')));
 const row=table.rows.find(r=>r.label.startsWith('Capital expenditures'));
 assert.equal(table.unit,'RMB million');
 assert.deepEqual([0,2,3,4].map(i=>[table.headers[i],row.cells[i].text]),labels.map((v,i)=>[v,['81,433','12,983','166,153','59,566'][i]]));
 assert.equal(table.rows.some(r=>r.label.includes('margin')),false);
});

test('exact public capex cells feed amount and growth charts and survive a cold GUI read',
 {skip:!originalPath},async t=>{
 const {mkdir,mkdtemp,rm}=await import('node:fs/promises');
 const {resolve}=await import('node:path');
 const {setTimeout:delay}=await import('node:timers/promises');
 const {startLocalGui}=await import('../src/gui-server.mjs');
 const {chartComputeAvailable}=await import('../src/financial-chart-compute.mjs');
 const {mockWebNetwork}=await import('./fixtures/web-network.mjs');
 if(!chartComputeAvailable())return t.skip('Controlled formula worker is unavailable');
 const file=await readFile(originalPath);
 const page='https://issuer.example/results',pdf='https://issuer.example/report.pdf';
 const wire=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://issuer.example/robots.txt':{body:'User-agent: *\nAllow: /'},
  [page]:{body:'<main><a href="./report.pdf">Report PDF</a></main>',headers:{'content-type':'text/html'}},
  [pdf]:{body:file,headers:{'content-type':'application/pdf'}},
 }});
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/scaled-pdf-charts-'));
 let gui,calls=0,ids;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const res=(message,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
 const f=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
 const tool=(...tool_calls)=>res({tool_calls},'tool_calls');
 const amounts=[81433,12983,166153,59566];
 const periodKeys=['Q3 2026','Q3 2025','9M 2026','9M 2025'];
 const growthKeys=['Q3 YoY','9M YoY'];
 const expectedGrowth=[527.2279134252484,178.9393278044522];
 const chart=(id,unit,keys,formulaCallId)=>f(id,'render_financial_chart',{dataset:{kind:'financial-columns',asOf:'2026-09-30',unit,keys,series:[{label:'Capital expenditures',formulaCallId}]}});
 const options={projectDir,env:{ETF_GUI_PROVIDER_KEY:'test-only',ETF_GUI_AGENT_FINANCIAL_CHART:'1',ETF_GUI_CHART_COMPUTE:'1',ETF_GUI_PDF_CHART_CHAIN:'1'},
  liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:12},connectivity:{web:true,linkedPdf:true}},
  async fetchImpl(_url,{body}){
   const p=JSON.parse(body).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
   switch(++calls){
    case 1:return tool(f('html','public_web_read',{url:page}));
    case 2:return tool(f('table','public_web_linked_pdf_page',{linkId:p[0].pdfLinks.links[0].id,page:12,tables:true}));
    case 3:{
     const hit=p[1].tables.find(t=>t.rows.some(r=>r.label.startsWith('Capital expenditures')));
     const row=hit.rows.find(r=>r.label.startsWith('Capital expenditures')).row;
     assert.equal(hit.unit,'RMB million');
     return tool(...[1,3,4,5].map((column,i)=>f('capex-'+i,'public_web_linked_pdf_page',{linkId:p[0].pdfLinks.links[0].id,page:12,table:hit.table,row,column})));
    }
    case 4:{
     const cells=p.slice(2,6);assert.deepEqual(cells.map(x=>x.cell.header),labels);
     ids=cells.map(x=>x.sourceRef);
     return tool(f('amounts','compute_chart_formula',{script:'capex',cells:{capex:ids}}),
      f('growth','compute_chart_formula',{script:'pct(newcap, oldcap) - 100',cells:{newcap:[ids[0],ids[2]],oldcap:[ids[1],ids[3]]}}));
    }
    case 5:
     assert.deepEqual(p[6].value,amounts);
     assert.equal(p[7].value.length,2);
     p[7].value.forEach((v,i)=>assert.ok(Math.abs(v-expectedGrowth[i])<1e-9));
     return tool(chart('currency','RMB million',periodKeys,'amounts'),chart('percent','%',growthKeys,'growth'));
    default:return res({content:'Capital expenditures: '+ids.map(id=>'[[PDF:'+id+']]').join(' ')});
   }
  }};
 gui=await startLocalGui(options);
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const post=(path,v)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const endpoint=conv+'/messages/report';
 const admitted=await post(conv+'/messages',{messageId:'report',question:'Read the filing and chart the quarterly and nine-month capex amounts and year-over-year changes.'});
 assert.equal(admitted.status,202);
 let m;
 for(let n=0;n<150;n++){m=(await get(conv)).messages[0];if(m&&!m.working&&['completed','failed'].includes(m.status))break;await delay(35);}
 assert.equal(m?.status,'completed');
 assert.equal(m.chartViews.length,2);
 const [currency,growth]=m.chartViews;
 assert.deepEqual([currency.unit,growth.unit],['CNY million','%']);
 assert.deepEqual([currency.keys,growth.keys],[periodKeys,growthKeys]);
 assert.deepEqual(currency.series[0].values,amounts);
 growth.series[0].values.forEach((v,i)=>assert.ok(Math.abs(v-expectedGrowth[i])<1e-9));
 const saved=await get(endpoint+'/sources');
 assert.deepEqual(saved.readSources.filter(s=>s.kind==='web-pdf-original-cell@1').map(s=>[s.page,s.cell.header,s.cell.unit,s.cited]),
  labels.map(h=>[12,h,'RMB million',true]));
 const before=[calls,wire.calls.length];
 assert.equal(wire.calls.filter(x=>x.url===pdf).length,1);
 await gui.close();gui=await startLocalGui({...options,env:{ETF_GUI_PROVIDER_KEY:'test-only'}});
 assert.deepEqual((await get(conv)).messages[0].chartViews,m.chartViews);
 assert.deepEqual(await get(endpoint+'/sources'),saved);
 assert.deepEqual([calls,wire.calls.length],before);
});
