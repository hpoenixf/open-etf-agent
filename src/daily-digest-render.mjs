import {lexer} from './gui/vendor/marked-16.4.2.mjs';

const entities={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const e=value=>String(value??'').replace(/[&<>"']/g,c=>entities[c]);
function link(raw){
 try{const url=new URL(raw);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)return url.href;}catch{}
 return null;
}
const anchor=(url,content)=>'<a style="color:#155da8;overflow-wrap:anywhere" href="'+e(url)+'" rel="noopener noreferrer">'+content+'</a>';
const pre=content=>'<pre style="white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0">'+e(content)+'</pre>';
function tokens(items,depth=0){
 return (items??[]).map(t=>{
  if(depth>32)return e(t.raw??t.text);
  const inside=()=>t.tokens?.length?tokens(t.tokens,depth+1):e(t.text);
  const wrap=(tag,style)=>'<'+tag+(style?' style="'+style+'"':'')+'>'+inside()+'</'+tag+'>';
  switch(t.type){
   case 'space':return '';
   case 'heading':return wrap('h'+Math.max(2,Math.min(6,t.depth)),'line-height:1.35;margin:18px 0 7px');
   case 'paragraph':return wrap('p','margin:8px 0 12px');
   case 'blockquote':return wrap('blockquote','border-left:3px solid #c8d5e4;padding-left:12px;margin:12px 0');
   case 'strong':case 'em':case 'del':return wrap(t.type);
   case 'codespan':return '<code>'+e(t.text)+'</code>';
   case 'code':return pre(t.text);
   case 'hr':return '<hr style="border:0;border-top:1px solid #dce3eb;margin:16px 0">';
   case 'br':return '<br>';
   case 'text':case 'escape':return inside();
   case 'link':{const url=link(t.href);return url?anchor(url,inside()):inside();}
   case 'image':return e(t.text);
   case 'list':{
    const tag=t.ordered?'ol':'ul',start=t.ordered&&Number.isSafeInteger(t.start)&&t.start>0?' start="'+t.start+'"':'';
    return '<'+tag+start+' style="padding-left:22px;margin:8px 0 12px">'+t.items.map(i=>'<li style="padding:3px 0">'+(i.task?(i.checked?'☑ ':'☐ '):'')+tokens(i.tokens,depth+1)+'</li>').join('')+'</'+tag+'>';
   }
   case 'checkbox':return '';
   case 'table':{
    const row=(cells,tag)=>'<tr>'+cells.map(c=>'<'+tag+' style="padding:6px;border:1px solid #dce3eb;vertical-align:top;overflow-wrap:anywhere">'+tokens(c.tokens,depth+1)+'</'+tag+'>').join('')+'</tr>';
    return '<div style="max-width:100%;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead>'+row(t.header,'th')+'</thead><tbody>'+t.rows.map(c=>row(c,'td')).join('')+'</tbody></table></div>';
   }
   default:return e(t.raw??t.text);
  }
 }).join('');
}
function markdown(raw){
 try{return tokens(lexer(raw,{gfm:true}));}catch{return pre(raw);}
}
export function renderFullDailyDigestHtml({subject,intro,rows,footer}){
 const sections=rows.map(row=>'<section style="border-top:1px solid #dce3eb;padding:14px 0 12px">'
  +'<h2 style="font-size:17px;margin:0 0 8px">'+e(row.label)+'</h2>'
  +(row.detail?'<p style="margin:0 0 12px;color:#475569">'+e(row.detail)+' '+anchor(row.link,'打开工作台中的原报告')+'</p>':'')
  +(row.body?markdown(row.body):'')+'</section>').join('');
 return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
  +'<body style="margin:0;background:#f1f5f9;color:#172b44;font:16px/1.65 system-ui,sans-serif">'
  +'<main style="box-sizing:border-box;max-width:720px;margin:0 auto;background:#fff;padding:20px 16px;overflow-wrap:anywhere">'
  +'<h1 style="font-size:24px;line-height:1.35;margin:0 0 10px">'+e(subject)+'</h1><p>'+e(intro)+'</p>'
  +sections+'<p style="font-size:14px;color:#475569">'+e(footer)+'</p></main></body></html>';
}
