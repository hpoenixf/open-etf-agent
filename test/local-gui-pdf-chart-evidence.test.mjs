import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLocalGui} from '../src/gui-server.mjs';

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

test('owner GUI attachment exposes confirmed PDF cell values and immutable source coordinates without public web',async t=>{
 const projectDir=await mkdtemp(resolve('.owner-pdf-cell-test-'));
 const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',
  model:'glm-5.3-flash',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{web:true}};
 let observed;
 const result=(message,finish_reason='stop')=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
 const call=(name,id,args)=>result({tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
 const fetchImpl=async(_url,init)=>{
  const req=JSON.parse(init.body), tools=req.tools.map(x=>x.function.name);
  assert.ok(tools.includes('read_pdf_cell'));
  assert.ok(!tools.includes('public_web_read'));
  const replies=req.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
  if(replies.length===0)return call('read_pdf_page','page',{page:1});
  if(replies.length===1)return call('read_pdf_cell','cell',{page:1,table:1,row:1,column:2});
  if(replies.length===2){
   observed=replies[1];
   return call('save_report','report',{text:'Synthetic evidence [1]',sourceIds:[observed.sourceId]});
  }
  return result({content:'Synthetic evidence. No real service queried.'});
 };
 const gui=await startLocalGui({projectDir,liveConfig,env:{ETF_GUI_PROVIDER_KEY:'test-only'},fetchImpl});
 t.after(async()=>{await gui.close();await rm(projectDir,{recursive:true,force:true});});
 const post=(path,body,more={})=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json',...more},body:Buffer.isBuffer(body)?body:JSON.stringify(body)});
 const conv='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const upload=await post(conv+'/pdf',pdf(rows),{'content-type':'application/pdf','x-pdf-name':'chart-data.pdf'});
 assert.equal(upload.status,201);
 const attachment=await upload.json();
 const submit=await post(conv+'/messages',{messageId:'table-1',question:'Use the attached exact table cells.',attachmentId:attachment.id});
 assert.equal(submit.status,202);
 let settled;
 for(let i=0;i<100;i++){
  settled=(await fetch(gui.origin+conv).then(r=>r.json())).messages.find(m=>m.id==='table-1');
  if(settled&&['completed','failed'].includes(settled.status))break;
  await new Promise(r=>setTimeout(r,20));
 }
 assert.equal(settled?.status,'completed',JSON.stringify(settled));
 assert.equal(observed.text,'0.32');assert.equal(observed.page,1);
 assert.match(observed.sourceId,/^pdf:[a-f0-9]{64}:p1:t1:r1:c2$/);
 assert.match(observed.resultRef,/^result:sha256:[a-f0-9]{64}$/);
 assert.deepEqual([observed.pdf.cell.header,observed.pdf.cell.rowLabel,observed.pdf.cell.unit],['2026','NAV','%']);
 assert.equal(settled.chartViews,undefined); // numeric sourcing is reachable; this release does not adapt it to chart receipts
});
