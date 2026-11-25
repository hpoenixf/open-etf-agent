import test from 'node:test';
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
 const drawn=[];
 const ctx={measureText(text){return {width:text.length*12};},fillRect(){},fillText(text){drawn.push(text);}};
 const canvas={getContext:k=>(assert.equal(k,'2d'),ctx),
  toBlob(cb,type){assert.equal(type,'image/png');cb(new Blob(['synthetic-bytes'],{type}));}};
 let clicked=false;
 const link={click(){clicked=true;assert.match(this.href,/^blob:/);assert.equal(this.download,'etf-answer-turn-1.png');},remove(){}};
 const doc={createElement(tag){return tag==='canvas'?canvas:link;},body:{append(x){assert.equal(x,link);}}};
 await downloadAnswerImage(doc,[el('DIV',el('P',txt('仅回答正文')))],'turn-1');
 assert.ok(clicked);
 assert.ok(drawn.includes('仅回答正文'));
 assert.equal(canvas.width,960);
 assert.ok(canvas.height>150);
 await assert.rejects(downloadAnswerImage(doc,[el('PRE',txt('字'.repeat(40001)))],'large'),/ANSWER_IMAGE_TOO_LONG/);
});
