import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {runPortfolioRebalance,preparePortfolioRebalance} from '../src/portfolio-rebalance-demo.mjs';
import {openArtifactStore,encodeCsv} from '../src/artifacts.mjs';
import {createResultStore} from '../src/results.mjs';
import {sha256} from '../src/source.mjs';

test('portfolio: actual Runtime binds six original calculations and conserves synthetic cash',async()=>{
  await mkdir('test-output',{recursive:true});
  const outputRoot=await mkdtemp(resolve('test-output/portfolio-'));
  const result=await runPortfolioRebalance({outputRoot});
  assert.equal(result.status,'completed');assert.equal(result.mode,'fixture');
  assert.equal(result.toolsDispatched,15);assert.equal(result.rounds,5);
  assert.equal(result.publication,undefined);assert.equal(result.semanticStatus,'unreviewed');
  const manifest=JSON.parse(await readFile(join(result.directory,'manifest.json'),'utf8'));
  const report=await readFile(result.preview.report,'utf8');
  const store=await openArtifactStore({directory:result.directory,readOnly:true});
  const results=await createResultStore({directory:result.directory,readOnly:true});
  const revision=await store.readRevision(result.receipt.revisionId);
  assert.equal(revision.reportId,result.receipt.artifactId);assert.equal(revision.attachmentIds.length,7);
  assert.equal(manifest.calculations.length,6);assert.equal(manifest.sources.length,1);
  const original=await results.read(manifest.resultRefs[0].resultRef);
  const fixture=await readFile(new URL('../fixtures/portfolio-rebalance.json',import.meta.url),'utf8');
  assert.equal(original.text,fixture);assert.equal(original.sha256,sha256(fixture));
  const names=['dividend','overseas','bond','gold','ai','cash'];
  const expected=[-10000,5000,-5000,0,5000,5000];
  let currentTotal=0,targetTotal=0,sell=0,buy=0;
  for(const [i,c] of manifest.calculations.entries()){
    const stored=await results.readCalculation(c.ref.resultRef);assert.deepEqual(stored,c.value);
    assert.equal(stored.difference,expected[i]);assert.equal(stored.binding.sourceRef,manifest.resultRefs[0].resultRef);
    assert.equal(stored.binding.baseline.rowId,names[i]+'-current');assert.equal(stored.binding.current.rowId,names[i]+'-target');
    assert.equal(stored.binding.contentHash,sha256(fixture));assert.equal(stored.binding.coverage.storedTableComplete,true);
    currentTotal+=stored.inputs.baseline;targetTotal+=stored.inputs.current;
    if(i<5){sell+=Math.max(0,-stored.difference);buy+=Math.max(0,stored.difference);}
    const csv=(await store.read(revision.attachmentIds[i])).bytes.toString();
    const b=stored.binding,coverage=b.coverage;
    const cells={resultRef:c.ref.resultRef,baseline:stored.inputs.baseline,current:stored.inputs.current,
      difference:stored.difference,ratio:stored.ratio,increaseRatio:stored.increaseRatio,
      unit:stored.unit,currency:b.currency,dataAsOf:b.dataAsOf,sourceRef:b.sourceRef,contentHash:b.contentHash,
      baselineRow:b.baseline.rowIndex,baselineRowId:b.baseline.rowId,currentRow:b.current.rowIndex,currentRowId:b.current.rowId,
      selectionOffset:b.selection.offset,selectionLimit:b.selection.limit,storedRows:coverage.total,returnedRows:coverage.returned,
      rowIndices:coverage.rowIndices.join(';'),windowComplete:coverage.complete,storedTableComplete:coverage.storedTableComplete,
      calculation:stored.calculation,arithmetic:stored.arithmetic,
      scope:'synthetic same-snapshot comparison; no upstream completeness or semantic review'};
    assert.equal(csv,encodeCsv([Object.keys(cells),Object.values(cells).map(String)]));
    assert.ok(report.includes(c.ref.resultRef));
  }
  assert.equal(currentTotal,100000);assert.equal(targetTotal,currentTotal);assert.equal(sell,15000);assert.equal(buy,10000);
  const cash=manifest.calculations[5].value;assert.equal(cash.inputs.baseline+sell-buy,cash.inputs.current);assert.equal(cash.inputs.current,10000);
  assert.equal(-manifest.calculations[2].value.difference/currentTotal*100,5);
  const header=['bucket','classification','current_CNY','fixed_target_CNY','current_weight_pct','fixed_target_weight_pct','current_minus_target_pp','target_minus_current_CNY','calculationRef','sourceRef','source_sha256'];
  const rows=manifest.calculations.map((c,i)=>{const v=c.value;return[names[i],i===5?'cash-reserve-change':v.difference<0?'illustrative-sell':v.difference>0?'illustrative-buy':'hold',v.inputs.baseline,v.inputs.current,v.inputs.baseline/currentTotal*100,v.inputs.current/currentTotal*100,-v.difference/currentTotal*100,v.difference,c.ref.resultRef,v.binding.sourceRef,v.binding.contentHash].map(String);});
  const summary=await store.read(revision.attachmentIds[6]);
  assert.equal(summary.bytes.toString(),encodeCsv([header,...rows]));
  assert.equal(await readFile(result.preview.summaryCsv,'utf8'),summary.bytes.toString());
  assert.match(report,/现金行是储备变更，不是市场买单/);assert.match(report,/No live model/);assert.match(report,/不是模型推荐/);
  assert.match(report,/超配\/低配 pp/);assert.match(report,/未评估适当性/);
  assert.match(report,/\| 示意变动 CNY \|\n\| ---/);assert.doesNotMatch(report,/\|\n\n\|/);
  assert.equal(sha256(await readFile(result.preview.report)),result.receipt.sha256);
});

test('portfolio: fixture entry accepts no arbitrary paths or source overrides',async()=>{
  const prepared=preparePortfolioRebalance();const reader=prepared.extensions[0];
  for(const input of [null,[],{path:'/private'},{text:'override'}])assert.throws(()=>reader.validate(input));
  reader.validate({});
  assert.deepEqual(prepared.allowedTools,['read_portfolio_fixture','calculate_change','create_csv','save_report']);
  assert.equal(prepared.gateway.mode,'fixture');
});

test('portfolio: failed or unavailable tool cannot become a successful report',async()=>{
  for(const result of [{status:'failed'},{status:'succeeded',value:{available:false}}]){
    const {gateway}=preparePortfolioRebalance();
    await assert.rejects(gateway.next({messages:[{role:'tool',result}]}),/unavailable/);
  }
});

test('portfolio: missing original never falls back to prewritten financial output',async()=>{
  const {gateway}=preparePortfolioRebalance();
  const first=await gateway.next({messages:[]});assert.equal(first.calls[0].name,'read_portfolio_fixture');
  await assert.rejects(gateway.next({messages:[]}),/original unavailable/);
});
