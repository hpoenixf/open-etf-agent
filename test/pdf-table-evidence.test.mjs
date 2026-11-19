import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePdfBytes,openPdfInput} from '../src/pdf-input.mjs';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createResearchProject,submitResearchTask,workResearchTask,validateResearchConfig} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {sha256} from '../src/source.mjs';
import {validPdfTables,validPdfCell} from '../src/pdf-table-evidence.mjs';
const exec=promisify(execFile);

function pdf(rows) {
 const s=rows.flatMap(([y,...items])=>items.map(([x,value])=>`BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${value.replace(/[()]/g,'\\$&')}) Tj ET\n`)).join('');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`];
 let out='%PDF-1.4\n',offsets=[];
 objects.forEach((v,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${v}\nendobj\n`;});
 const xref=out.length;
 return Buffer.from(out+'xref\n0 6\n0000000000 65535 f \n'+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
}
const rows=[[740,[26,'PERFORMANCE (%)']],[722,[142,'2025'],[232,'2026']],[706,[28,'NAV'],[142,'0.32'],[232,'0.32']],[690,[28,'Benchmark'],[142,'1.10'],[232,'1.20']]];
test('native PDF preserves repeated values as independently positioned cells',async()=>{
 const parsed=await parsePdfBytes(pdf(rows));
 assert.deepEqual(parsed.tables[0][0].headers,['2025','2026']);
 assert.equal(parsed.tables[0][0].unit,'%');
 assert.equal(parsed.tables[0][0].rows[0].cells[0].text,'0.32');
 assert.notDeepEqual(parsed.tables[0][0].rows[0].cells[0].at,parsed.tables[0][0].rows[0].cells[1].at);
 assert.match(parsed.pages[0],/PERFORMANCE \(%\)/);
});
test('a two-column holdings section pins explicit unit and separates other panels',async()=>{
 const parsed=await parsePdfBytes(pdf([
  [740,[20,'left panel'],[312,'Top Holdings'],[520,'Weight (%)']],
  [723,[21,'other chart'],[312,'Asset X'],[536,'1.27']],
  [706,[20,'not a holding'],[312,'Asset Y'],[536,'1.27']],
  [674,[312,'Sector Breakdown'],[520,'Weight (%)']],
  [657,[312,'Sector A'],[536,'4.10']],
  [640,[312,'Sector B'],[536,'9.20']]
 ]));
 assert.deepEqual(parsed.tables[0].map(t=>[t.caption,t.headers,t.rows.map(r=>r.label)]),[
  ['Top Holdings',['Weight (%)'],['Asset X','Asset Y']],
  ['Sector Breakdown',['Weight (%)'],['Sector A','Sector B']]
 ]);
});
test('a numeric row missing a column is not interpreted as a table',async()=>{
 const parsed=await parsePdfBytes(pdf([...rows,[674,[28,'Reference'],[232,'5.55']]]));
 assert.equal(parsed.tables,undefined);
 assert.match(parsed.pages[0],/5\.55/);
});

test('an explicitly different column unit never inherits the caption unit',async()=>{
 for(const label of ['2026 (EUR)','2026 eur','2026 millions','2026 (USD millions)','2026 (JPY)']){
  const mismatch=[[740,[26,'Net assets (USD)']],[722,[142,'2025 (USD)'],[232,label]],...rows.slice(2)];
  const result=await parsePdfBytes(pdf(mismatch));
  assert.equal(result.tables,undefined);
  assert.ok(result.pages[0].includes(label));
 }
 const p=await parsePdfBytes(pdf(rows));
 const forged=structuredClone(p.tables[0][0]); forged.headers[1]='2026 (EUR)';
 assert.equal(validPdfTables([forged]),false);
 assert.equal(validPdfCell({schemaVersion:'pdf-table-cell@1',table:1,row:1,column:2,caption:'Net assets (USD)',rowLabel:'NAV',header:'2026 (EUR)',unit:'USD',at:[10,10]}),false);
});
test('oversized structural header leaves the whole ordinary page available',async()=>{
 const far='Long descriptive heading that does not fit the structured column limit (%)';
 const parsed=await parsePdfBytes(pdf([[740,[294,'Coverage'],[463,far]],[723,[294,'Item A'],[486,'1.27']],[706,[294,'Item B'],[486,'1.27']]]));
 assert.equal(parsed.tables,undefined);
 assert.match(parsed.pages[0],/Item A/);
 assert.ok(parsed.pages[0].includes(far));
});
test('snapshot shape refuses collapsed cell positions in either direction',async()=>{
 const p=await parsePdfBytes(pdf(rows));
 const sameCol=structuredClone(p.tables[0][0]);
 sameCol.rows[0].cells[1].at=[...sameCol.rows[0].cells[0].at];
 assert.equal(validPdfTables([sameCol]),false);
 const sameRow=structuredClone(p.tables[0][0]);
 for(let k=0;k<sameRow.headers.length;k++)sameRow.rows[1].cells[k].at=[...sameRow.rows[0].cells[k].at];
 assert.equal(validPdfTables([sameRow]),false);
 assert.equal(validPdfTables([p.tables[0][0],p.tables[0][0]]),false);
});
test('ordinary Project encodes distinct cell receipts and cold CLI returns the original table references',async()=>{
 await mkdir('test-output',{recursive:true});
 const root=await mkdtemp(resolve('test-output/pdf-tables-'));
 const inputPath=join(root,'same-value.pdf'), bytes=pdf(rows);
 const approval={providerApproved:true,dataApproved:true,costApproved:true};
 const endpoint='https://pdf-transport.invalid/v1/chat/completions';
 try{
  await createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'live',provider:'example',protocol:'chat-completions',model:'fixture',endpoint,apiKeyEnv:'PDF_TEST_KEY'},capabilities:['pdf','report']}});
  await writeFile(inputPath,bytes);
  const {manifestSha256,pdfSnapshot}=await importProjectSources({projectDir:root,files:[inputPath]});
  await submitResearchTask({projectDir:root,runId:'pdf-cell-proof',question:'What did both years report? Cite each cell.',sourceManifestSha256:manifestSha256,authorization:approval});
  await writeFile(inputPath,pdf(rows.map(([y,...items])=>[y,...items.map(([x,t])=>[x,t==='0.32'?'9.99':t])])));
  const requests=[], cells=[];
  const call=(id,name,args)=>Response.json({choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
  const fetchImpl=async(url,options)=>{
   assert.equal(url.href,endpoint);
   const request=JSON.parse(options.body); requests.push(request);
   const values=request.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
   assert.ok(request.tools.some(t=>t.function.name==='read_pdf_cell'));
   switch(requests.length){
    case 1:return call('page','read_pdf_page',{page:1});
    case 2:
      assert.equal(values[0].pdf.tables[0].rows[0].cells[1].text,'0.32');
      return call('cell2025','read_pdf_cell',{page:1,table:1,row:1,column:1});
    case 3:
      assert.equal(values[1].pdf.cell.header,'2025');cells.push(values[1]);
      return call('cell2026','read_pdf_cell',{page:1,table:1,row:1,column:2});
    case 4:
      assert.equal(values[2].pdf.cell.header,'2026');cells.push(values[2]);
      assert.equal(cells[0].sha256,cells[1].sha256);
      assert.notEqual(cells[0].resultRef,cells[1].resultRef);
      return call('save','save_report',{text:'2025 was 0.32% [1]; 2026 was 0.32% [2].',sourceIds:cells.map(c=>c.sourceId)});
    case 5:return Response.json({choices:[{finish_reason:'stop',message:{role:'assistant',content:'Report saved.'}}]});
    default:throw new Error('unexpected scripted request');
   }
  };
  const worker={projectDir:root,runId:'pdf-cell-proof',apiKey:'fixture-do-not-send-credential',fetchImpl};
  const stop=new AbortController();
  const paused=await workResearchTask({...worker,hostSignal:stop.signal,onCheckpoint({phase}){
   if(requests.length===3&&phase==='result-consumed')stop.abort();
  }});
  assert.equal(paused.workerStatus,'interrupted');
  assert.equal(requests.length,3);
  const parsed=await workResearchTask(worker);
  assert.equal(requests.length,5);
  assert.equal(parsed.run.status,'completed',JSON.stringify(parsed.run.snapshot));
  const {stdout}=await exec(process.execPath,['src/research-cli.mjs','run','report','--project',root,'--run','pdf-cell-proof']);
  const output=JSON.parse(stdout);
  assert.deepEqual(output.revision.sources.map(s=>s.pdf.cell.header),['2025','2026']);
  assert.deepEqual(output.revision.sources.map(s=>s.pdf.originalSha256),[sha256(bytes),sha256(bytes)]);
  assert.equal(output.revision.attachmentIds.length,1);
  assert.match(output.report.text,/row 1 NAV; column 2 2026; value 0.32; unit %; parser text origin/);
  const checker=openPdfInput({input:{snapshot:pdfSnapshot},store:{put(){throw new Error('verification must not write');}}});
  try{
   const retained=output.revision.sources[1];
   assert.equal(checker.verifyCell(retained),true);
   const altered=structuredClone(retained);
   altered.pdf.cell.at[0]+=.1;
   assert.equal(checker.verifyCell(altered),false);
   altered.pdf.cell.at=retained.pdf.cell.at;
   altered.pdf.cell.header='Substituted header';
   assert.equal(checker.verifyCell(altered),false);
  }finally{await checker.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});
test('explicit page-only tool selection stays page-only for a table-bearing PDF',async()=>{
 await mkdir('test-output',{recursive:true});
 const root=await mkdtemp(resolve('test-output/pdf-page-only-')),inputPath=join(root,'source.pdf');
 try{
  const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'page-only'},capabilities:['pdf','report'],allowedTools:['read_pdf_page','save_report']};
  assert.throws(()=>validateResearchConfig({...config,allowedTools:['read_pdf_cell','save_report']}),e=>e.code==='PROJECT_PDF_CELL_REQUIRES_PAGE');
  await createResearchProject({directory:root,config});
  await writeFile(inputPath,pdf(rows));
  const {manifestSha256,pdfSnapshot}=await importProjectSources({projectDir:root,files:[inputPath]});
  assert.equal(pdfSnapshot.schemaVersion,'pdf-input-snapshot@2');
  await submitResearchTask({projectDir:root,runId:'page-only',question:'Read the physical PDF page and report.',sourceManifestSha256:manifestSha256});
  const worked=await workResearchTask({projectDir:root,runId:'page-only',gateway:{mode:'fixture',async next({messages,tools}){
   assert.deepEqual(tools.map(t=>t.name).sort(),['read_pdf_page','save_report']);
   assert.ok(!messages.filter(m=>m.role==='user').some(m=>m.content.includes('read_pdf_cell')));
   const results=messages.filter(m=>m.role==='tool').map(m=>m.result.value);
   const call=(name,args)=>({kind:'calls',calls:[{id:name,name,arguments:args}]});
   if(!results.length)return call('read_pdf_page',{page:1});
   if(!results[1])return call('save_report',{text:'Physical page read [1].',sourceIds:[results[0].sourceId]});
   return {kind:'final',text:'Saved.'};
  }}});
  assert.equal(worked.run.status,'completed',JSON.stringify(worked.run.snapshot));
 }finally{await rm(root,{recursive:true,force:true});}
});
