// Bounded page-local observations for native financial tables. Work in the
// parser's top-left coordinates, not byte offsets or visual/OCR claims.
const rowTolerance=.10, columnTolerance=.36, maxTables=4, maxRows=16, maxColumns=8;
const short=(v,n)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=n&&!/[\x00-\x1f]/.test(v);
const keys=(v,s)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===s;
const position=v=>Array.isArray(v)&&v.length===2&&v.every(p=>Number.isFinite(p)&&p>=0&&p<=1000);
const n=v=>Math.round(v*1000)/1000;
const amount=/^(?:\((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?\)|[-+]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?)$/;
const unitSuffix=/\((%|USD|EUR|GBP|CNY|bps)\)$/i;
const heading=/[\p{L}][^\n]{1,100}\s*\((%|USD|EUR|GBP|CNY|bps)\)$/iu;
const unitMarker=/\b(?:USD|EUR|GBP|CNY|RMB|JPY|HKD|AUD|CAD|CHF|INR|SGD|KRW|MXN|NZD|NOK|SEK|ZAR|PCT|bps|thousands?|millions?|billions?|trillions?|dollars?|euros?|pounds?|cents?|basis points?)\b|%|[$€£¥]|(?:^|\s)[KMBT]$/i;
const canonicalUnit=value=>value?.toLowerCase()==='bps'?'bps':value?.toUpperCase();
function headerUnit(text){
 // Unrecognized labels that look like units/scales are not silently inherited.
 const suffix=text.match(/\(([^()]*)\)$/)??text.match(/(?:^|\s)(USD|EUR|GBP|CNY|bps|%)$/i);
 if(suffix){
  if(unitMarker.test(text.slice(0,suffix.index).trim()))return null;
  return canonicalUnit(suffix[1]);
 }
 return unitMarker.test(text)?null:undefined;
}
const label=v=>short(v,100)&&/\p{L}/u.test(v)&&!amount.test(v);
function grouped(spans){
 const rows=[];
 for(const item of [...spans].sort((a,b)=>a.y-b.y||a.x-b.x)){
  const row=rows.at(-1);
  if(row&&item.y-row.y<=rowTolerance)row.items.push(item);else rows.push({y:item.y,items:[item]});
 }
 return rows.map(r=>({...r,items:r.items.sort((a,b)=>a.x-b.x)}));
}
// Common factsheet layout: a named vertical section shares one header
// row with its explicitly unit-labelled value column. Do not carry a header
// across a different section or infer units from adjacent panels.
function twoColumnSection(rows,i,header){
 const siblings=rows[i].items;
 const title=siblings.filter(s=>s.x<header.x-5&&label(s.text)).at(-1);
 if(!title||siblings.some(s=>s.x>title.x&&s.x<header.x)||siblings.some(s=>s.x>header.x))return null;
 const rowData=[];let priorY=rows[i].y,referenceX;
 for(const row of rows.slice(i+1)){
  const spans=row.items.filter(s=>s.x>=title.x-.35&&s.x<=header.x+2.7);
  if(!spans.length)continue;
  if(row.y-priorY>1.35||spans.some(s=>heading.test(s.text)))break;
  const headings=spans.filter(s=>s.x<=title.x+.35&&label(s.text));
  const data=spans.filter(s=>s.x>=header.x-.36&&validPdfCellText(s.text));
  if(!data.length){
   if(headings.length&&spans.length>1)return null;
   break;
  }
  if(headings.length!==1||data.length!==1||spans.length!==2||rowData.length===maxRows||
     rowData.some(r=>r.label===headings[0].text)||referenceX!==undefined&&Math.abs(data[0].x-referenceX)>.39)return null;
  referenceX??=data[0].x;priorY=row.y;
  rowData.push({label:headings[0].text,cells:[{text:data[0].text,at:[n(data[0].x),n(data[0].y)]}]});
 }
 return rowData.length>=2?{caption:title.text,unit:canonicalUnit(header.text.match(heading)[1]),headers:[header.text],rows:rowData}:null;
}
const provesUnit=(caption,headers,unit)=>{
 if(typeof unit!=='string')return false;
 const captionUnit=headerUnit(caption);
 const headerUnits=headers.map(headerUnit);
 if(captionUnit!==undefined&&captionUnit!==unit||headerUnits.some(value=>value!==undefined&&value!==unit))return false;
 return canonicalUnit(caption.match(unitSuffix)?.[1])===unit||headers.length===1&&canonicalUnit(headers[0].match(unitSuffix)?.[1])===unit;
};
export function extractPdfTables(input) {
 if(!Array.isArray(input)||input.length>2400)return [];
 const rows=grouped(input.filter(s=>short(s.text,150)&&position([s.x,s.y])));
 const tables=[];
 for(let i=0;i<rows.length&&tables.length<maxTables;i++){
  for(const caption of rows[i].items.filter(s=>heading.test(s.text))){
   if(tables.length>=maxTables)break;
   const separate=twoColumnSection(rows,i,caption);
   if(separate&&validPdfTables([separate])){tables.push(separate);continue;}
   const unit=canonicalUnit(caption.text.match(heading)[1]);
   const right=Math.min(...rows.slice(Math.max(0,i-1),i+2).flatMap(r=>r.items).filter(s=>s.x>caption.x+5&&heading.test(s.text)).map(s=>s.x-.2),Infinity);
   const region=r=>r.items.filter(s=>s.x>=caption.x-.35&&s.x<right);
   const head=rows[i+1], first=rows[i+2];
   if(!head||!first||head.y-caption.y>1.6||first.y-head.y>1.35)continue;
   const start=region(first).filter(s=>label(s.text)&&s.x<caption.x+2.5);
   if(start.length!==1)continue;
   const rawHeaders=region(head).filter(s=>s.x>start[0].x+1.4);
   if(!rawHeaders.length||rawHeaders.length>maxColumns||new Set(rawHeaders.map(s=>s.text)).size!==rawHeaders.length||
      rawHeaders.some((s,k)=>!short(s.text,50)||(k>0&&s.x-rawHeaders[k-1].x<1.2)))continue;
   const rowData=[];let priorY=head.y, invalid=false;
   for(const row of rows.slice(i+2,i+3+maxRows)){
    const candidates=region(row);
    if(row.y-priorY>1.35||candidates.some(s=>heading.test(s.text)))break;
    const labels=candidates.filter(s=>s.x<rawHeaders[0].x-.6);
    const data=candidates.filter(s=>s.x>=rawHeaders[0].x-.6);
    // Prose can terminate a table. Partial numeric rows cannot silently
    // disappear: reject their region rather than shifting columns.
    if(!data.some(s=>amount.test(s.text)))break;
    if(labels.length!==1||!label(labels[0].text)||data.length!==rawHeaders.length||
       rowData.some(r=>r.label===labels[0].text)||rowData.length===maxRows||
       data.some((s,k)=>!validPdfCellText(s.text)||
          Math.abs(s.x-rawHeaders[k].x)>columnTolerance)){invalid=true;break;}
    rowData.push({label:labels[0].text,cells:data.map(s=>({text:s.text,at:[n(s.x),n(s.y)]}))});
    priorY=row.y;
   }
   const candidate={caption:caption.text,unit,headers:rawHeaders.map(s=>s.text),rows:rowData};
   if(!invalid&&validPdfTables([candidate]))tables.push(candidate);
  }
 }
 // If two candidate descriptions reuse a physical cell, neither is
 // reliable enough to cite as a table. Original page text survives.
 const colliding=new Set(), seen=new Map();
 for(const [index,table] of tables.entries()){
  for(const point of table.rows.flatMap(r=>r.cells.map(c=>c.at.join(',')))){
   const prior=seen.get(point);
   if(prior!==undefined){colliding.add(prior);colliding.add(index);}
   else seen.set(point,index);
  }
 }
 return tables.filter((_,i)=>!colliding.has(i));
}
export function validPdfTables(tables){
 if(!Array.isArray(tables)||tables.length>maxTables)return false;
 const collisions=new Set();
 return tables.every(t=>keys(t,'caption,headers,rows,unit')&&short(t.caption,115)&&
  Array.isArray(t.headers)&&t.headers.length>=1&&t.headers.length<=maxColumns&&t.headers.every(h=>short(h,50))&&provesUnit(t.caption,t.headers,t.unit)&&new Set(t.headers).size===t.headers.length&&
  Array.isArray(t.rows)&&t.rows.length>=2&&t.rows.length<=maxRows&&new Set(t.rows.map(r=>r?.label)).size===t.rows.length&&
  t.rows.every(r=>keys(r,'cells,label')&&label(r.label)&&Array.isArray(r.cells)&&r.cells.length===t.headers.length&&
   r.cells.every(c=>keys(c,'at,text')&&validPdfCellText(c.text)&&position(c.at)))&&distinctGrid(t.rows)&&t.rows.every(r=>r.cells.every(c=>{const id=c.at.join(',');if(collisions.has(id))return false;collisions.add(id);return true;})));
}
function distinctGrid(rows){
 let lastY=-1;
 for(const row of rows){
  const points=row.cells.map(c=>c.at), ys=points.map(p=>p[1]);
  if(points.some((p,i)=>i>0&&p[0]<=points[i-1][0])||Math.min(...ys)<=lastY||Math.max(...ys)-Math.min(...ys)>.101)return false;
  lastY=Math.max(...ys);
 }
 return true;
}
export function validPdfCell(c){
 return keys(c,'at,caption,column,header,row,rowLabel,schemaVersion,table,unit')&&c.schemaVersion==='pdf-table-cell@1'&&
  Number.isSafeInteger(c.table)&&c.table>=1&&c.table<=maxTables&&Number.isSafeInteger(c.row)&&c.row>=1&&c.row<=maxRows&&
  Number.isSafeInteger(c.column)&&c.column>=1&&c.column<=maxColumns&&short(c.caption,115)&&
  short(c.header,50)&&provesUnit(c.caption,[c.header],c.unit)&&label(c.rowLabel)&&position(c.at);
}
export const pdfCellLimits=Object.freeze({table:maxTables,row:maxRows,column:maxColumns});

export const validPdfCellText=v=>short(v,24)&&amount.test(v);
