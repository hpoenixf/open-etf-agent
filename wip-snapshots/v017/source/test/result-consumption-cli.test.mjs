import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256} from '../src/source.mjs';
const child=args=>spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=512'}});
test('RC CLI exits then a separate reader process verifies original report CSV and selected-source identities',async()=>{
 await mkdir('test-output',{recursive:true});const output=await mkdtemp(resolve('test-output/result-cli-'));
 const produced=child(['src/cli.mjs','--case','result-consumption','--output',output]);assert.equal(produced.status,0,produced.stderr);const outcome=JSON.parse(produced.stdout);assert.equal(outcome.status,'completed');assert.equal(outcome.caseId,'result-consumption');assert.equal(outcome.semanticStatus,'unreviewed');assert.equal(outcome.mode,'fixture');
 const reader=child(['--input-type=module','--eval',`
  import {readFile} from 'node:fs/promises';
  import {openArtifactStore} from ${JSON.stringify(pathToFileURL(resolve('src/artifacts.mjs')).href)};
  import {createResultStore} from ${JSON.stringify(pathToFileURL(resolve('src/results.mjs')).href)};
  const directory=process.argv[1];
  const manifest=JSON.parse(await readFile(directory+'/manifest.json','utf8'));
  const artifacts=await openArtifactStore({directory,readOnly:true});
  const report=await artifacts.read(manifest.receipt.artifactId);
  const csv=await artifacts.read(manifest.receipt.attachmentIds[0]);
  const results=await createResultStore({directory});
  const calculation=await results.readCalculation(manifest.calculations[0].ref.resultRef);
  const source=await results.read(calculation.binding.sourceRef);
  process.stdout.write(JSON.stringify({report:report.bytes.toString(),csv:csv.bytes.toString(),reportHash:report.sha256,csvHash:csv.sha256,calculation,source,resultRef:manifest.calculations[0].ref.resultRef}));
 `,outcome.directory]);assert.equal(reader.status,0,reader.stderr);const seen=JSON.parse(reader.stdout);
 assert.equal(sha256(seen.report),outcome.receipt.sha256);assert.equal(sha256(seen.csv),seen.csvHash);assert.equal(seen.source.sha256,sha256(seen.source.text));assert.equal(seen.calculation.binding.contentHash,seen.source.sha256);assert.equal(seen.calculation.binding.current.rowIndex,2);assert.equal(seen.calculation.difference,150);assert.equal(seen.calculation.ratio,2.5);
 assert.ok(seen.report.includes(seen.resultRef));assert.ok(seen.csv.includes(seen.resultRef));assert.ok(seen.csv.includes(seen.source.sha256));assert.ok(seen.report.includes('currency USD'));assert.ok(seen.report.includes('dataAsOf 2026-10-01'));
 const original=await readFile('fixtures/comparison-table.json','utf8');assert.equal(seen.source.text,original);
});
