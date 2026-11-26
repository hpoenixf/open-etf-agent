import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {brandPaths,brandViewBox} from '../src/gui/brand-mark.mjs';
import assert from 'node:assert/strict';
import {answerImageBlocks,wrapAnswerImageText,downloadAnswerImage} from '../src/gui/answer-image.mjs';

const txt=textContent=>({nodeType:3,textContent});
const el=(tagName,...childNodes)=>({tagName,nodeType:1,childNodes,children:childNodes.filter(n=>n.nodeType===1)});

test('export uses only structured answer text, preserving headings, rows and line breaks',()=>{
 const table=el('TABLE');
 table.rows=[{cells:[el('TH',txt('指数')),el('TH',txt('表现'))]},{cells:[el('TD',txt('甲')),el('TD',txt('+3%'))]}];
 const a=el('DIV',el('H2',txt('观察')),el('P',txt('第一行'),el('BR'),el('A',txt('来源'))));
 const code=el('DIV',el('PRE',el('CODE',txt('a\nb'))));
 assert.deepEqual(answerImageBlocks([a,code]),[
  {kind:'heading',text:'观察'},{kind:'paragraph',text:'第一行\n来源'},
  {kind:'code',text:'a\nb'},
 ]);
 const b=el('DIV',el('DIV',table),el('OL',el('LI',el('P',txt('证据')))));
 assert.deepEqual(answerImageBlocks([b]).map(x=>x.text),['指数  |  表现','甲  |  +3%','1. 证据']);
});

test('wrap preserves graphemes and blank code lines',()=>{
 assert.deepEqual(wrapAnswerImageText('甲👩‍💻乙\n\n丙',1,x=>[...new Intl.Segmenter().segment(x)].length),['甲','👩‍💻','乙','','丙']);
});

test('image export draws the full supplied answer and downloads locally as PNG',async()=>{
 const drawn=[], paths=[];
 const ctx={measureText(text){return {width:text.length*12};},fillRect(){},save(){},restore(){},translate(){},scale(){},fill(p){paths.push(p.d);},stroke(p){paths.push(p.d);},fillText(text,x,y){drawn.push({text,x,y,font:this.font});}};
 const canvas={getContext:k=>(assert.equal(k,'2d'),ctx),
  toBlob(cb,type){assert.equal(type,'image/png');cb(new Blob(['synthetic-bytes'],{type}));}};
 let clicked=false;
 const link={click(){clicked=true;assert.match(this.href,/^blob:/);assert.equal(this.download,'etf-answer-turn-1.png');},remove(){}};
 const doc={defaultView:{Path2D:class{constructor(d){this.d=d;}}},createElement(tag){return tag==='canvas'?canvas:link;},body:{append(x){assert.equal(x,link);}}};
 const table=el('TABLE');
 table.rows=[{cells:[el('TH',txt('指标')),el('TH',txt('数值'))]}];
 await downloadAnswerImage(doc,[el('DIV',el('H2',txt('示例标题')),el('P',txt('仅回答正文')),table)],'turn-1');
 assert.ok(clicked);
 assert.match(drawn.find(x=>x.text==='仅回答正文').font,/28px/);
 assert.match(drawn.find(x=>x.text==='示例标题').font,/34px/);
 assert.match(drawn.find(x=>x.text==='指标  |  数值').font,/24px/);
 assert.match(drawn.at(-1).font,/20px/);
 assert.equal(drawn.at(-1).text,'来自 open-etf-agent');
 assert.deepEqual(paths,brandPaths.map(x=>x.d));
 assert.ok(drawn.at(-1).y>drawn.find(x=>x.text==='仅回答正文').y);
 assert.ok(drawn.at(-1).y<canvas.height);
 assert.equal(canvas.width,960);
 assert.ok(canvas.height>150);
 await assert.rejects(downloadAnswerImage(doc,[el('PRE',txt('字'.repeat(40001)))],'large'),/ANSWER_IMAGE_TOO_LONG/);
});


test('the site artwork exactly matches the local image watermark paths',async()=>{
 const svg=await readFile(new URL('../src/gui/brand.svg',import.meta.url),'utf8');
 assert.ok(svg.includes('viewBox="'+brandViewBox+'"'));
 assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map(x=>x[1]),brandPaths.map(x=>x.d));
 assert.doesNotMatch(svg,/<script|(?:href|src)=/i);
});
