import test from 'node:test';
import assert from 'node:assert/strict';
import { projectContext } from '../src/context.mjs';
import { sha256 } from '../src/source.mjs';
const user = { role: 'user', content: 'Keep my original question and conditions.' };
const known=new Map();
const group=(id,text,status='succeeded')=>{
  const source={sourceId:id,documentId:'atlas-a',name:'Synthetic context fixture',version:'A',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
  const fields=Object.fromEntries(['sourceId','documentId','name','version','page','sha256','mediaType'].map(k=>[k,source[k]]));const resultRef='result:sha256:'+sha256(JSON.stringify(fields));known.set(id,{...fields,resultRef});
  return [{role:'assistant',calls:[{id,name:'read_page',arguments:{documentId:'atlas-a',page:1}}]},{role:'tool',callId:id,result:{callId:id,status,dispatched:true,value:{...source,resultRef}}}];
};
const lookupSource=async id=>known.get(id);
test('4.2 old source payload becomes exact reread ref without changing original history', async () => {
  const a = group('old-a', 'x'.repeat(1800)); const b = group('old-b', 'y'.repeat(1800));
  const messages = [user, { role: 'assistant', calls: [...a[0].calls,...b[0].calls] }, a[1], b[1], ...group('latest', 'recent original bytes')];
  const projected = await projectContext({ messages, maxBytes: 3000, lookupSource });
  assert.deepEqual(projected[0], user); assert.equal(messages[2].result.value.text.length, 1800);
  assert.equal(projected[2].result.value.text, undefined); assert.match(projected[2].result.value.resultRef, /^result:sha256:/);
  assert.equal(projected[3].callId, 'old-b'); assert.equal(projected[3].result.value.text, undefined);
  assert.equal(projected[2].callId, 'old-a'); assert.equal(projected[5].result.value.text, 'recent original bytes'); assert.ok(Buffer.byteLength(JSON.stringify(projected)) <= 3000);
});
test('4.2 no partial assistant/tool group or invalid pairing is accepted', async () => {
  await assert.rejects(projectContext({ messages: [user, group('missing', 'x')[0]], maxBytes: 2000, lookupSource }), /group|pair|settled/i);
  const a = group('a','x'); const b = group('b','y'); const assistant = { role:'assistant', calls:[...a[0].calls,...b[0].calls] };
  const badInner = structuredClone(b[1]); badInner.result.callId = 'other';
  for (const results of [[a[1]], [a[1],a[1]], [a[1],badInner], [b[1],a[1]]]) await assert.rejects(projectContext({ messages:[user,assistant,...results], maxBytes:2000,lookupSource }), /group|pair/i);
});
test('4.2 oversized mandatory user and latest group fail instead of truncating', async () => {
  await assert.rejects(projectContext({ messages: [{ role: 'user', content: 'x'.repeat(3000) }, ...group('last','text')], maxBytes: 1000, lookupSource }), /budget|limit|context/i);
});
test('4.2 failed source results cannot be rewritten into successful reread references', async () => {
  const messages = [user,...group('failed','x'.repeat(2000),'failed'),...group('last','recent')];
  await assert.rejects(projectContext({ messages, maxBytes: 1200, lookupSource }), /budget|limit|context/i);
});

test('4.2 projection never launders a lookalike or altered payload into an acquired ref',async()=>{
  for(const change of [value=>{delete value.resultRef;},value=>{value.version='unacquired-version';},value=>{value.page=2;},value=>{value.text='forged body '.repeat(300);}]){
    const old=group('original','x'.repeat(3000));const latest=group('recent','retained current bytes');change(old[1].result.value);
    await assert.rejects(projectContext({messages:[user,...old,...latest],maxBytes:2200,lookupSource}),/budget|limit|context|identity|snapshot/i);
  }
});
