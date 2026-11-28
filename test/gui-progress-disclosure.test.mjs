import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const gui = await readFile(new URL('../src/gui/gui.mjs', import.meta.url), 'utf8');
function node(tag, text) {
  return { tag, text, open: false, children: [], isConnected: true,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children=children; },
    addEventListener() {},
  };
}
const steps = label => ({ status:'available', steps:[{ label }] });
const first = (target, tag) => target.children.find(el => el.tag===tag);

test('technical steps preserve explicit expansion and collapse across poll, missing data and transcript rebuild', () => {
  const context = { make: node, state:{ conversation:'c1', progress:new Map() } };
  runInNewContext(gui.slice(gui.indexOf('function progressContent('),gui.indexOf('function originalWebLink(')),context);
  const m = { id:'a' };
  const outer = context.progressDetails(m,node('context'));
  outer.open = true;
  const entry = context.state.progress.get(m.id);
  const content = entry.content;
  context.progressContent(content,steps('start'),entry);
  const before = first(content,'details');
  assert.equal(before.open,false);
  before.open=true; // Native toggle may not have emitted its event before a poll.
  context.progressContent(content,{...steps('updated'),activity:{modelReturns:4,tools:[
    {kind:'search',returned:2,unavailable:1},
    {kind:'analysis',returned:1,unavailable:0},
  ]}},entry);
  assert.deepEqual(content.children.filter(el=>el.tag==='p').map(el=>el.text),[
    '模型已返回 4 轮', '检索：2 次已返回，1 次未完成 · 计算与图表：1 次已返回',
  ]);
  assert.equal(first(content,'details').open,true);
  assert.equal(first(first(content,'details'),'ol').children[0].text,'updated');
  context.progressContent(content,{status:'unavailable'},entry);
  assert.equal(first(content,'details'),undefined);
  context.progressContent(content,steps('restored'),entry);
  assert.equal(first(content,'details').open,true);
  entry.data=steps('settled');
  entry.cachedTerminal=true;
  const replacement=context.progressDetails(m,node('context'));
  assert.equal(replacement.open,true);
  assert.equal(first(entry.content,'details').open,true);
  const other=context.progressDetails({id:'b'},node('context'));
  assert.equal(other.open,false);
  const independent=context.state.progress.get('b');
  context.progressContent(independent.content,steps('other'),independent);
  assert.equal(first(independent.content,'details').open,false);
  first(entry.content,'details').open=false;
  context.progressDetails(m,node('context'));
  assert.equal(first(entry.content,'details').open,false);
  context.state.progress.clear();
  assert.equal(context.progressDetails(m,node('context')).open,false);
});
