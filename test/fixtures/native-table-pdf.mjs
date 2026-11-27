export function pdf(rows) {
 const s=rows.flatMap(([y,...items])=>items.map(([x,value])=>`BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${value.replace(/[()]/g,'\\$&')}) Tj ET\n`)).join('');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`];
 let out='%PDF-1.4\n',offsets=[];
 objects.forEach((v,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${v}\nendobj\n`;});
 const xref=out.length;
 return Buffer.from(out+'xref\n0 6\n0000000000 65535 f \n'+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
}
