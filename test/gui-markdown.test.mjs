import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown} from '../src/gui/markdown.mjs';

const doc={
  createElement(tag){return {tag,ownerDocument:doc,children:[],attributes:{},
    append(node){this.children.push(node);},replaceChildren(){this.children=[];},
    setAttribute(k,v){this.attributes[k]=v;},
  };},
  createTextNode(text){return {text};}
};
const nodes=(n)=>[n,...(n.children??[]).flatMap(nodes)];
const text=(n)=>nodes(n).map(x=>x.text??'').join('');
test('headings, nested lists, tables, quotes, code, bold and valid source links render as DOM',()=>{
  const raw='# 结论\n\n- **费率**\n  - 原文\n\n|基金|费率|\n|---|---|\n|ETF|0.03%|\n\n> 注释\n\n```text\nNAV\n```\n\n[来源](https://example.org/a?q=1)';
  const node=renderMarkdown(doc,raw), items=nodes(node);
  for(const t of ['h2','ul','strong','table','th','td','blockquote','pre','code','a'])assert.ok(items.some(x=>x.tag===t),t);
  assert.equal(text(items.find(x=>x.tag==='h2')),'结论');
  assert.equal(text(items.find(x=>x.tag==='code')),'NAV');
  assert.equal(items.find(x=>x.tag==='a').href,'https://example.org/a?q=1');
  assert.equal(items.find(x=>x.tag==='a').rel,'noopener noreferrer');
  assert.equal(items.find(x=>x.className==='markdown-table').tabIndex,0);
});
test('plain-text safety: never instantiate HTML, embedded resources or unsafe protocols',()=>{
  const raw='<script>bad()</script>\n\n<img src=x onerror=bad()>\n\n[x](javascript:evil) [y](data:text/plain,na) [z](https://a:b@example.org) ![图](https://evil.invalid)';
  const node=renderMarkdown(doc,raw);
  assert.ok(!nodes(node).some(x=>['a','img','script','iframe','svg'].includes(x.tag)));
  assert.match(text(node),/bad\(\)/);
  assert.match(text(node),/图/);
});
test('oversized answer stays fully readable, not silently truncated',()=>{
  const value='# '+ '字'.repeat(165000);
  const node=renderMarkdown(doc,value);assert.equal(node.children[0].tag,'pre');assert.equal(text(node),value);
});

test('inline evidence tokens reach only the citation projection, not code or link titles',()=>{
 const ref='WEB:'+'a'.repeat(64)+':1', pdf='PDF:web-pdf-page:sha256:'+'b'.repeat(64);
 const seen=[];const node=renderMarkdown(doc,'主张 [['+ref+']] **结论 [['+pdf+']]** `[['+ref+']]` [来源](https://example.org "[['+ref+']]")',(span,key)=>{
  span.append(doc.createTextNode('［引用］'));seen.push(key);
 });
 assert.deepEqual(seen,[ref,pdf]);
 assert.match(text(node),/主张 ［引用］ 结论 ［引用］/);
});
