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
