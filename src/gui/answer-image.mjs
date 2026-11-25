import {drawBrandMark} from './brand-mark.mjs';
// Browser adapter: export only rendered answer DOM. No HTML execution, network, or model calls.
const fontFamily='"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif';
const width=960, padding=56, maxHeight=14000, footerHeight=76;
const styles={
 heading:{font:'600 26px '+fontFamily,step:38,after:12,color:'#112337'},
 paragraph:{font:'400 20px '+fontFamily,step:32,after:12,color:'#162b3d'},
 code:{font:'400 18px ui-monospace,monospace',step:29,after:14,color:'#1e3a50'},
 table:{font:'400 18px '+fontFamily,step:29,after:4,color:'#1e3a50'},
};
function text(node){
 if(node.nodeType===3)return node.textContent ?? '';
 if(node.tagName==='BR')return '\n';
 return Array.from(node.childNodes??[],text).join('');
}
export function answerImageBlocks(articles){
 const rows=[];
 const push=(kind,value)=>{ if(value.trim())rows.push({kind,text:value}); };
 const visit=(node,prefix='')=>{
  const tag=node.tagName??'';
  if(/^H[1-6]$/.test(tag)){push('heading',prefix+text(node));return;}
  if(tag==='PRE'){push('code',text(node));return;}
  if(tag==='P'){push('paragraph',prefix+text(node));return;}
  if(tag==='TABLE'){
   for(const row of node.rows)push('table',Array.from(row.cells,cell=>text(cell).trim()).join('  |  '));
   return;
  }
  if(tag==='UL'||tag==='OL'){
   let i=Number(node.start)||1;
   for(const item of node.children){
    const children=Array.from(item.childNodes);
    const inline=children.filter(x=>x.tagName!=='UL'&&x.tagName!=='OL').map(text).join('\n').trim();
    push('paragraph',prefix+(tag==='OL'?(i++)+'. ':'• ')+inline);
    for(const child of children)if(child.tagName==='UL'||child.tagName==='OL')visit(child,prefix+'　');
   }
   return;
  }
  if(tag==='BLOCKQUOTE'){push('paragraph','│ '+text(node));return;}
  if(node.nodeType===3){push('paragraph',prefix+text(node));return;}
  for(const child of node.childNodes??[])visit(child,prefix);
 };
 for(const article of articles)visit(article);
 return rows;
}
export function wrapAnswerImageText(value,maxWidth,measure){
 const lines=[];
 const segments=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
 for(const para of value.replace(/\r\n?/g,'\n').split('\n')){
  let line='';
  for(const item of segments?segments.segment(para):para){
   const segment=typeof item==='string'?item:item.segment;
   if(line&&measure(line+segment)>maxWidth){lines.push(line);line='';}
   line+=segment;
  }
  lines.push(line);
 }
 return lines;
}
export async function downloadAnswerImage(doc,articles,messageId){
 const blocks=answerImageBlocks(articles);
 if(!blocks.length)throw Error('EMPTY_ANSWER_IMAGE');
 if(blocks.reduce((sum,b)=>sum+b.text.length,0)>40000)throw Error('ANSWER_IMAGE_TOO_LONG');
 const canvas=doc.createElement('canvas'), context=canvas.getContext('2d');
 if(!context)throw Error('ANSWER_IMAGE_UNAVAILABLE');
 let y=116; const lines=[];
 for(const {kind,text:value} of blocks){
  const style=styles[kind];
  context.font=style.font;
  for(const line of wrapAnswerImageText(value,width-padding*2,s=>context.measureText(s).width)){
   lines.push({style,line,y}); y+=style.step;
   if(y+style.after+footerHeight>maxHeight)throw Error('ANSWER_IMAGE_TOO_LONG');
  }
  y+=style.after;
 }
 canvas.width=width;canvas.height=y+footerHeight;
 context.fillStyle='#fbfdff';context.fillRect(0,0,width,canvas.height);
 context.fillStyle='#173249';context.fillRect(0,0,width,8);
 context.font='600 23px '+fontFamily;
 context.fillText('Open ETF Agent · 研究回答',padding,62);
 context.fillStyle='#dce6ef';context.fillRect(padding,81,width-padding*2,1);
 for(const {style,line,y:lineY} of lines){
  context.font=style.font;context.fillStyle=style.color;
  context.fillText(line,padding,lineY);
 }
 context.fillStyle='#dce6ef';context.fillRect(padding,y+13,width-padding*2,1);
 context.font='500 16px '+fontFamily;
 context.fillStyle='#536b80';
 context.textAlign='right';
 const watermark='来自 open-etf-agent';
 const right=width-padding;
 if(doc.defaultView?.Path2D){
  drawBrandMark(context,doc.defaultView.Path2D,right-context.measureText(watermark).width-30,y+24,23);
 }
 context.fillText(watermark,right,y+43);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob)throw Error('ANSWER_IMAGE_UNAVAILABLE');
 const url=URL.createObjectURL(blob);
 const link=doc.createElement('a');link.href=url;link.download='etf-answer-'+String(messageId).replace(/[^A-Za-z0-9_-]/g,'_')+'.png';
 try{doc.body.append(link);link.click();}
 finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
