import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateManifest, validateQualifications, validateVersions, validateScenarioReceipt, validateReceipt, legacyManifest, renderTable } from './check-article-coverage.mjs';
import { validateContract, verifyScenarioSnapshot, verifyArticles } from './check-article-backlinks.mjs';
const load=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const m=await load('docs/verification/article-coverage.json'), versions=await load('versions.json');
const old=await load(m.receipt), source=await load(m.source), locale=await load('docs/verification/article-coverage.en.json');
const extras={'temporal':await load('docs/verification/v012-temporal.safe.json'),'ordinary-response':await load('docs/verification/v013-ordinary-response.safe.json')};
const clone=value=>structuredClone(value);
test('per-target: all targets have unique authoritative evidence bindings',()=>{
 validateManifest(m);validateVersions(versions,m);
 assert.deepEqual(Object.keys(m.targetEvidence).sort(),Object.keys(m.targets).sort());
 const legacy=legacyManifest(m).targets;
 assert.deepEqual(Object.keys(legacy).sort(),Object.keys(old.results).sort());
 for(const [id,result] of Object.entries(old.results)) assert.deepEqual(legacy[id],result.target);
 for(const [id,target] of Object.entries(m.targets)) if(target.kind==='scenario') {
  const q=m.qualifications[m.targetEvidence[id]];
  assert.equal(q.kind,'independent-scenario');assert.equal(q.scenario,target.name);
  assert.ok(extras[target.name]);
 }
});
test('per-target: original legacy receipt and runner identity remain valid',()=>{validateReceipt(old,m,source,old.inputSha256,old.runnerSha256);assert.equal(old.sourceCommit,'e1b8e4edde724548fab16d8ca4b205379bfa7f30');});
test('per-target: stale legacy target cannot borrow the original receipt',()=>{const x=clone(m);x.targets.child.case='retrieve-reread';assert.throws(()=>validateReceipt(old,x,source,old.inputSha256,old.runnerSha256),/Stale receipt/);});
test('per-target: missing, orphan or wrong-scenario bindings fail',()=>{for(const mutation of [x=>delete x.targetEvidence.temporal,x=>x.targetEvidence.temporal='ordinary-response',x=>x.qualifications.orphan={...x.qualifications.temporal,commit:'a'.repeat(40)}]){const x=clone(m);mutation(x);assert.throws(()=>validateQualifications(x));}});
test('per-target: malformed source/evidence/article pins fail',()=>{for(const mutation of [x=>x.qualifications.temporal.commit='main',x=>x.qualifications.temporal.evidenceCommit='main',x=>x.articles.find(a=>a.target==='temporal').articleCommit='main']){const x=clone(m);mutation(x);assert.throws(()=>validateQualifications(x));}});
test('per-target: introduced version must match scenario execution source',()=>{const x=clone(versions);x.targets.temporal.since='0.13';assert.throws(()=>validateVersions(x,m),/identity mismatch/);});
test('per-target: both independent scenarios reuse successful original observations',()=>{for(const [id,r] of Object.entries(extras))assert.ok(validateScenarioReceipt(r,id).report.sha256);});
test('per-target: removed, failed or duplicate scenario stage fails',()=>{for(const mutation of [q=>q.observations=q.observations.filter(o=>o.stage!=='independent-work'),q=>q.observations.find(o=>o.stage==='independent-work').exitCode=1,q=>q.observations.push(q.observations[0])]){const x=clone(extras.temporal);mutation(x.independentInstall);assert.throws(()=>validateScenarioReceipt(x,'temporal'));}});
test('per-target: wrong date, missing input and missing adoption fail',()=>{const time=clone(extras.temporal);time.independentInstall.taskTime.taskDate='2026-10-28';assert.throws(()=>validateScenarioReceipt(time,'temporal'));const inputs=clone(extras.temporal);inputs.independentInstall.inputFiles=[];assert.throws(()=>validateScenarioReceipt(inputs,'temporal'));const reply=clone(extras['ordinary-response']);delete reply.independent.adoptionCheckpointHash;assert.throws(()=>validateScenarioReceipt(reply,'ordinary-response'));});
test('per-target: scenario receipt cannot be substituted or edited in site snapshot',async()=>{const q=m.qualifications.temporal,text=await readFile(new URL('../'+q.receipt.path,import.meta.url),'utf8');assert.equal(verifyScenarioSnapshot(text,q).version,'0.12.0');assert.throws(()=>verifyScenarioSnapshot(text+' ',q),/differs/);});
test('per-target: display uses each original execution pin, not global main',()=>{const table=renderTable(m,m.verifiedAt,versions,'en',locale);assert.match(table,/46c2822/);assert.match(table,/300f78f/);assert.match(table,/e1b8e4e/);assert.match(table,/no Human Park/);});
test('per-target: schema2 source and renderer remain supported',()=>{const x=clone(m);x.schemaVersion=2;delete x.qualifications;delete x.targetEvidence;for(const id of ['temporal','ordinary-response'])delete x.targets[id];for(const row of x.articles)if(['temporal','ordinary-response'].includes(row.target)){row.target=null;row.status='无公开对应';delete row.articleCommit;}const v=clone(versions);delete v.targets.temporal;delete v.targets['ordinary-response'];validateManifest(x);validateVersions(v,x);validateContract(x,old,source);assert.match(renderTable(x,x.verifiedAt,v),/article-coverage:start/);});
test('per-target: scenario backlink contract refuses absent observations',()=>{assert.throws(()=>validateContract(m,old,source),/receipt/);const contract=validateContract(m,old,source,extras);assert.equal(contract.pins.temporal,m.qualifications.temporal.commit);assert.equal(contract.pins.child,m.verifiedAt);});
test('per-target: new bilingual body must contain real command sequence and fixed source',async()=>{
 const id='ordinary-response',pin=m.qualifications[id].commit,slug='agent-durable-human-interaction-response-adoption';
 const contract={verifiedAt:m.verifiedAt,articles:[{slug,target:id}],targets:{[id]:m.targets[id]},pins:{[id]:pin}};
 const body=`[CLI](https://github.com/hpoenixf/open-etf-agent/blob/${pin}/src/session-cli.mjs)\n\n\`\`\`bash\nnpm run session -- start --session runs/article-reply --case durable-response\nnpm run session -- question --session runs/article-reply --run RUN_ID --question QUESTION_ID\nnpm run session -- respond --session runs/article-reply --run RUN_ID --question QUESTION_ID --response reply-1 --text 'Synthetic label: blue'\nnpm run session -- resume --session runs/article-reply --run RUN_ID\nnpm run session -- response-status --session runs/article-reply --run RUN_ID\n\`\`\``;
 const run=text=>verifyArticles({contract,english:new Set([slug]),paths:[],read:async()=>text});assert.equal((await run(body)).checkedBodies,2);await assert.rejects(run(body.replace(pin,'a'.repeat(40))),/source/);await assert.rejects(run(body.replace(' -- resume ',' -- restart ')),/sequence/);
});
