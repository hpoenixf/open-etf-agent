import {paginateWebText,webTextProfile} from './web-text-pages.mjs';
import {parse,defaultTreeAdapter} from 'parse5';
import {webFailure,webLimits} from './web-policy.mjs';
const OMIT=new Set(['script','style','template','noscript','svg','math','head','iframe','object','embed']);
const BLOCK=new Set(['p','div','section','article','main','header','footer','nav','aside','h1','h2','h3','h4','h5','h6','li','ul','ol','table','tr','br','pre','blockquote','hr']);
// Bound parser work during construction, not only after an AST already exists.
// This conservative profile is not a hard synchronous CPU interruption.
function boundedTreeAdapter(limits){
 const base=defaultTreeAdapter,adapter={},templateParents=new WeakMap();let created=0,work=0;
 const charge=(n=1)=>{work+=n;if(work>Math.min(400000,limits.nodes*64))throw webFailure('WEB_EXTRACTION_WORK_LIMIT');};
 const count=()=>{charge();if(++created>limits.nodes)throw webFailure('WEB_EXTRACTION_WORK_LIMIT');};
 const attach=(parent,node)=>{
  let depth=0;for(let n=parent;n;n=n.parentNode??templateParents.get(n)){charge();if(n===node||++depth>128)throw webFailure('WEB_EXTRACTION_DEPTH_LIMIT');}
  const pending=[[node,depth+1]];
  while(pending.length){const [n,d]=pending.pop();charge();if(d>128)throw webFailure('WEB_EXTRACTION_DEPTH_LIMIT');
   for(const child of n.childNodes??[])pending.push([child,d+1]);if(n.content)pending.push([n.content,d+1]);
  }
 };
 // Accessors also spend work: parser scope scans and malformed-tree repair are
 // bounded even when they do not create new nodes. Default methods are pure data.
 for(const [name,fn] of Object.entries(base))adapter[name]=(...args)=>{charge();return fn(...args);};
 for(const name of ['createDocument','createDocumentFragment','createElement','createCommentNode','createTextNode'])adapter[name]=(...args)=>{count();return base[name](...args);};
 adapter.appendChild=(parent,node)=>{attach(parent,node);base.appendChild(parent,node);};
 adapter.insertBefore=(parent,node,reference)=>{charge(parent.childNodes.length);attach(parent,node);base.insertBefore(parent,node,reference);};
 adapter.setTemplateContent=(template,content)=>{attach(template,content);templateParents.set(content,template);base.setTemplateContent(template,content);};
 adapter.detachNode=node=>{charge(node.parentNode?.childNodes.length??0);base.detachNode(node);};
 adapter.insertText=(parent,text)=>{
  charge();const prev=parent.childNodes.at(-1);
  if(prev&&base.isTextNode(prev))prev.value+=text;
  else adapter.appendChild(parent,adapter.createTextNode(text));
 };
 adapter.insertTextBefore=(parent,text,reference)=>{
  charge(parent.childNodes.length);const prev=parent.childNodes[parent.childNodes.indexOf(reference)-1];
  if(prev&&base.isTextNode(prev))prev.value+=text;
  else adapter.insertBefore(parent,adapter.createTextNode(text),reference);
 };
 adapter.setDocumentType=(document,...args)=>{charge(document.childNodes.length);if(!document.childNodes.some(n=>n.nodeName==='#documentType'))count();base.setDocumentType(document,...args);};
 adapter.adoptAttributes=(recipient,attrs)=>{charge(recipient.attrs.length+attrs.length);base.adoptAttributes(recipient,attrs);};
 return adapter;
}
export function extractWebText(body,contentType,{limits:input}={}){
 const limits=webLimits(input);if(!Buffer.isBuffer(body)||!body.length||body.length>limits.bodyBytes)throw webFailure('WEB_BODY_LIMIT');
 if(typeof contentType!=='string'||contentType.length>256)throw webFailure('WEB_CONTENT_TYPE');
 const match=/^\s*(text\/html|text\/plain)\s*(?:;\s*charset\s*=\s*(?:"(utf-8|us-ascii)"|(utf-8|us-ascii))\s*)?$/i.exec(contentType);
 if(!match)throw webFailure('WEB_CONTENT_TYPE');
 let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(body);}catch{throw webFailure('WEB_INVALID_UTF8');}
 if(source.includes('\0')||(/us-ascii/i.test(contentType)&&/[^\x00-\x7f]/.test(source)))throw webFailure('WEB_INVALID_UTF8');
 let text,parser,nodes=0;
 if(match[1].toLowerCase()==='text/plain'){text=source;parser=webTextProfile('text/plain');}
 else{
  const document=parse(source,{scriptingEnabled:false,treeAdapter:boundedTreeAdapter(limits)}),parts=[],stack=[{node:document,end:false}],inspect=[document];let size=0;
  while(inspect.length){const n=inspect.pop();if(++nodes>limits.nodes)throw webFailure('WEB_EXTRACTION_WORK_LIMIT');
   if(n.tagName==='meta'){const attrs=Object.fromEntries((n.attrs??[]).map(a=>[a.name,a.value]));const declared=attrs.charset??(attrs['http-equiv']?.toLowerCase()==='content-type'?/charset\s*=\s*([^;\s]+)/i.exec(attrs.content??'')?.[1]:undefined);if(declared!==undefined&&!/^(utf-8|us-ascii)$/i.test(declared))throw webFailure('WEB_CONTENT_ENCODING');}
   for(const child of n.childNodes??[])inspect.push(child);if(n.content)inspect.push(n.content);
  }
  const append=s=>{size+=Buffer.byteLength(s);if(size>limits.textBytes)throw webFailure('WEB_TEXT_LIMIT');parts.push(s);};
  while(stack.length){const {node,end}=stack.pop();if(end){append('\n');continue;}if(OMIT.has(node.tagName))continue;
   if(node.nodeName==='#text'){append(node.value);continue;}
   if(BLOCK.has(node.tagName)){append('\n');stack.push({node,end:true});}
   for(let i=(node.childNodes?.length??0)-1;i>=0;i--)stack.push({node:node.childNodes[i],end:false});
  }
  text=parts.join('').replace(/[\t\f\r ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();parser=webTextProfile('text/html');
 }
 if(!text.trim())throw webFailure('WEB_TEXT_EMPTY');if(Buffer.byteLength(text)>limits.textBytes)throw webFailure('WEB_TEXT_LIMIT');
 const pages=paginateWebText(text);
 return {text,pages,originalMediaType:match[1].toLowerCase(),extraction:{profile:parser,coverage:'static-text-only',visualInspection:'not-performed'}};
}
