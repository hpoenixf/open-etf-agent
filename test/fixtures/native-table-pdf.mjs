export function pdf(rows) {return multiPagePdf([rows]);}
export function multiPagePdf(pages,{padding=0}={}) {
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',
  `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 for(const [i,rows] of pages.entries()){
  const s=rows.flatMap(([y,...items])=>items.map(([x,value])=>`BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${value.replace(/[()]/g,'\\$&')}) Tj ET\n`)).join('');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`,
   `<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`);
 }
 let out='%PDF-1.4\n'+(padding?('% '+'p'.repeat(72)+'\n').repeat(Math.ceil(padding/75)):'');
 const offsets=[];
 objects.forEach((v,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${v}\nendobj\n`;});
 const xref=out.length,size=objects.length+1;
 return Buffer.from(out+`xref\n0 ${size}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
