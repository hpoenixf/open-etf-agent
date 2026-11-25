import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {compareEtfSnapshots,parseEtfSnapshot} from '../src/etf-compare.mjs';

const leftPath='fixtures/etf-compare/alpha.json', rightPath='fixtures/etf-compare/beta.csv';
const left=JSON.parse(await readFile(leftPath,'utf8'));
const csv=await readFile(rightPath,'utf8');
const right=parseEtfSnapshot(csv,'csv');
const window={start:'2026-10-01',end:'2026-10-31'};
test('hand calculation preserves share classes and all inputs',()=>{
  const result=compareEtfSnapshots(left,right,window);
  assert.deepEqual(result.snapshots.map(s=>s.shareClassId),['alpha-a','beta-i']);
  assert.equal(result.fees.value,10);
  assert.equal(result.holdings.value,8000);
  assert.equal(result.sectors.value,9000);
  assert.equal(result.returns.left,0.08);
  assert.equal(result.returns.right,0.03);
  assert.equal(result.returns.difference,0.05);
  assert.equal(result.returns.inputs.left.start,100);
  assert.equal(result.returns.inputs.right.end,206);
});
test('missing differs from zero and comparison never crosses incompatible metadata',()=>{
  const missing=structuredClone(right);
  missing.feeBps=null;
  missing.holdings=null;
  missing.series.values.pop();
  const result=compareEtfSnapshots(left,missing,window);
  assert.deepEqual(result.fees.missing,['right.feeBps']);
  assert.deepEqual(result.holdings.missing,['right.holdings']);
  assert.deepEqual(result.returns.missing,['right.series.end']);
  for(const patch of [{currency:'USD',series:{...right.series,currency:'USD'}},{asOf:'2026-11-01'}]){
    const bad=compareEtfSnapshots(left,{...right,...patch},window);
    for(const key of ['fees','holdings','sectors','returns'])assert.equal(bad[key].status,'incomparable');
  }
  const zero=compareEtfSnapshots(left,{...right,feeBps:0},window);
  assert.equal(zero.fees.value,20);
});
test('malformed data and mixed series identities fail before calculation',()=>{
  assert.throws(()=>compareEtfSnapshots(left,{...right,series:{...right.series,shareClassId:left.shareClassId}},window),/SERIES_IDENTITY/);
  const basis=compareEtfSnapshots(left,{...right,series:{...right.series,basis:'nav-price'}},window);
  assert.equal(basis.returns.status,'incomparable');
  const partial=compareEtfSnapshots(left,{...right,holdings:{...right.holdings,coverage:'partial'}},window);
  assert.equal(partial.holdings.status,'missing');
  assert.throws(()=>parseEtfSnapshot('kind,key,value\nmeta,asOf,"bad\n','csv'),/CSV/);
  assert.throws(()=>compareEtfSnapshots({...left,asOf:'2026-02-31'},right,window),/AS_OF/);
});
test('standalone CLI reads JSON and CRLF CSV and prints a reproducible result',()=>{
  assert.deepEqual(parseEtfSnapshot(csv.replaceAll('\n','\r\n'),'csv'),right);
  const child=spawnSync(process.execPath,['src/etf-compare-cli.mjs','--left',leftPath,'--right',rightPath,'--start',window.start,'--end',window.end],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
  assert.equal(JSON.parse(child.stdout).holdings.value,8000);
});
