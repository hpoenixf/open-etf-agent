import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateManifest, validateQualifications, validateVersions, validateScenarioReceipt, validateReceipt, legacyManifest, renderTable, articleSlices, metadataFailure } from './check-article-coverage.mjs';
import { validateContract, verifyScenarioSnapshot, verifyArticles } from './check-article-backlinks.mjs';
const load=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const m=await load('docs/verification/article-coverage.json'), versions=await load('versions.json');
const old=await load(m.receipt), source=await load(m.source), locale=await load('docs/verification/article-coverage.en.json');
const extras={'memory-consumer':await load('docs/verification/v014-memory-consumer.safe.json'),'temporal':await load('docs/verification/v012-temporal.safe.json'),'ordinary-response':await load('docs/verification/v013-ordinary-response.safe.json')};
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
test('per-target: stale legacy target cannot borrow the original receipt',()=>{const x=clone(m);x.targets.child.case='retrieve-reread';assert.throws(()=>validateReceipt(old,x,source,old.inputSha256,old.runnerSha256),/Stale receipt|Duplicate executable target identity/);});
test('per-target: missing, orphan or wrong-scenario bindings fail',()=>{for(const mutation of [x=>delete x.targetEvidence.temporal,x=>x.targetEvidence.temporal='ordinary-response',x=>x.qualifications.orphan={...x.qualifications.temporal,commit:'a'.repeat(40)}]){const x=clone(m);mutation(x);assert.throws(()=>validateQualifications(x));}});
test('per-target: malformed source/evidence/article pins fail',()=>{for(const mutation of [x=>x.qualifications.temporal.commit='main',x=>x.qualifications.temporal.evidenceCommit='main',x=>x.articles.find(a=>a.target==='temporal').articleCommit='main']){const x=clone(m);mutation(x);assert.throws(()=>validateQualifications(x));}});
test('per-target: introduced version must match scenario execution source',()=>{const x=clone(versions);x.targets.temporal.since='0.13';assert.throws(()=>validateVersions(x,m),/identity mismatch/);});
test('per-target: both independent scenarios reuse successful original observations',()=>{for(const [id,r] of Object.entries(extras))assert.ok(validateScenarioReceipt(r,id).report.sha256);});
test('per-target: removed, failed or duplicate scenario stage fails',()=>{for(const mutation of [q=>q.observations=q.observations.filter(o=>o.stage!=='independent-work'),q=>q.observations.find(o=>o.stage==='independent-work').exitCode=1,q=>q.observations.push(q.observations[0])]){const x=clone(extras.temporal);mutation(x.independentInstall);assert.throws(()=>validateScenarioReceipt(x,'temporal'));}});
test('per-target: wrong date, missing input and missing adoption fail',()=>{const time=clone(extras.temporal);time.independentInstall.taskTime.taskDate='2026-10-28';assert.throws(()=>validateScenarioReceipt(time,'temporal'));const inputs=clone(extras.temporal);inputs.independentInstall.inputFiles=[];assert.throws(()=>validateScenarioReceipt(inputs,'temporal'));const reply=clone(extras['ordinary-response']);delete reply.independent.adoptionCheckpointHash;assert.throws(()=>validateScenarioReceipt(reply,'ordinary-response'));});
test('per-target: scenario receipt cannot be substituted or edited in site snapshot',async()=>{const q=m.qualifications.temporal,text=await readFile(new URL('../'+q.receipt.path,import.meta.url),'utf8');assert.equal(verifyScenarioSnapshot(text,q).version,'0.12.0');assert.throws(()=>verifyScenarioSnapshot(text+' ',q),/differs/);});
test('per-target: display uses each original execution pin, not global main',()=>{const table=renderTable(m,m.verifiedAt,versions,'en',locale);assert.match(table,/46c2822/);assert.match(table,/300f78f/);assert.match(table,/e1b8e4e/);assert.match(table,/no Human Park/);});
test('per-target: schema2 source and renderer remain supported',()=>{
 const x=clone(m),v=clone(versions);x.schemaVersion=2;delete x.qualifications;delete x.targetEvidence;
 for(const [id,t] of Object.entries(x.targets))if(t.kind==='scenario'){delete x.targets[id];delete v.targets[id];}
 for(const row of x.articles){delete row.additionalTargets;if(row.target && !x.targets[row.target]){row.target=null;row.status='无公开对应';delete row.articleCommit;}}
 validateManifest(x);validateVersions(v,x);validateContract(x,old,source);assert.match(renderTable(x,x.verifiedAt,v),/article-coverage:start/);
});
test('per-target: scenario backlink contract refuses absent observations',()=>{assert.throws(()=>validateContract(m,old,source),/receipt/);const contract=validateContract(m,old,source,extras);assert.equal(contract.pins.temporal,m.qualifications.temporal.commit);assert.equal(contract.pins.child,m.verifiedAt);});
test('per-target: new bilingual body must contain real command sequence and fixed source',async()=>{
 const id='ordinary-response',pin=m.qualifications[id].commit,slug='agent-durable-human-interaction-response-adoption';
 const contract={verifiedAt:m.verifiedAt,articles:[{slug,target:id}],targets:{[id]:m.targets[id]},pins:{[id]:pin}};
 const body=`[CLI](https://github.com/hpoenixf/open-etf-agent/blob/${pin}/src/session-cli.mjs)\n\n\`\`\`bash\nnpm run session -- start --session runs/article-reply --case durable-response\nnpm run session -- question --session runs/article-reply --run RUN_ID --question QUESTION_ID\nnpm run session -- respond --session runs/article-reply --run RUN_ID --question QUESTION_ID --response reply-1 --text 'Synthetic label: blue'\nnpm run session -- resume --session runs/article-reply --run RUN_ID\nnpm run session -- response-status --session runs/article-reply --run RUN_ID\n\`\`\``;
 const run=text=>verifyArticles({contract,english:new Set([slug]),paths:[],read:async()=>text});assert.equal((await run(body)).checkedBodies,2);await assert.rejects(run(body.replace(pin,'a'.repeat(40))),/source/);await assert.rejects(run(body.replace(' -- resume ',' -- restart ')),/sequence/);
});

test('additional slices: one Memory article keeps the original target and independently binds its consumer',()=>{
 const row=m.articles.find(a=>a.slug==='026-agent-memory-forget-durable-effects'),slices=articleSlices(row);
 assert.equal(row.target,'memory');assert.deepEqual(m.targets.memory,old.results.memory.target);
 assert.deepEqual(slices.map(s=>s.target),[row.target,...row.additionalTargets.map(s=>s.target)]);
 const table=renderTable(m,m.verifiedAt,versions,'en',locale),line=table.split('\n').find(line=>line.includes('/articles/'+row.slug+')'));
 for(const slice of slices){const q=m.qualifications[m.targetEvidence[slice.target]],since=versions.targets[slice.target].since;assert.ok(line.includes(q.commit));assert.ok(line.includes(`[v${since}]`));}
 assert.equal(table.split('\n').filter(line=>line.includes('/articles/'+row.slug+')')).length,1);
});
test('additional slices: existing schema3 with no optional field remains valid',()=>{
 const x=clone(m),v=clone(versions),l=clone(locale),row=x.articles.find(a=>a.target==='memory');
 for(const slice of row.additionalTargets){delete x.targets[slice.target];delete x.targetEvidence[slice.target];delete x.qualifications[slice.target];delete v.targets[slice.target];}
 delete row.additionalTargets;delete l.articles[row.slug].additionalScopes;
 validateManifest(x);validateVersions(v,x);validateReceipt(old,x,source,old.inputSha256,old.runnerSha256);
 assert.doesNotThrow(()=>renderTable(x,x.verifiedAt,v,'en',l));
});
test('additional slices: duplicate target, forged article identity and orphan target fail',()=>{
 for(const mutate of [row=>row.additionalTargets.push(clone(row.additionalTargets[0])),row=>row.additionalTargets[0].target='memory',row=>row.additionalTargets[0].slug='different-article',row=>row.additionalTargets=[]]){
  const x=clone(m);mutate(x.articles.find(a=>a.target==='memory'));assert.throws(()=>validateManifest(x));
 }
 const x=clone(m);x.targets.orphan={kind:'scenario',name:'memory-consumer'};x.targetEvidence.orphan='memory-consumer';assert.throws(()=>validateManifest(x),/Unused|Orphan/);
});
test('additional slices: aliases cannot inflate distinct qualified target identities',()=>{
 const x=clone(m),row=x.articles.find(a=>a.target==='memory');x.targets.alias=clone(x.targets['memory-consumer']);x.targetEvidence.alias='memory-consumer';row.additionalTargets.push({...row.additionalTargets[0],target:'alias'});assert.throws(()=>validateManifest(x),/Duplicate executable target identity/);
});
test('additional slices: relation validation does not confuse target count with article count',()=>{
 const x=clone(m),row=clone(x.articles.find(a=>a.target==='memory'));
 row.additionalTargets=Object.keys(x.targets).filter(id=>id!==row.target).map(target=>({target,status:'verified',scope:'Synthetic structural fixture only',articleCommit:'a'.repeat(40)}));
 x.articles=[row];x.articleCatalog.count=x.articles.length;assert.ok(Object.keys(x.targets).length>x.articles.length);assert.doesNotThrow(()=>validateManifest(x));
});
test('additional slices: EN display cannot add execution facts or omit the extra scope',()=>{
 const slug='026-agent-memory-forget-durable-effects';
 for(const mutate of [l=>delete l.articles[slug].additionalScopes,l=>l.articles[slug].additionalScopes['memory-consumer'].status='verified',l=>l.articles[slug].additionalScopes['memory-consumer'].articleBlob='main']){
  const l=clone(locale);mutate(l);assert.throws(()=>renderTable(m,m.verifiedAt,versions,'en',l));
 }
});
test('Memory qualification: changed library, mismatched consumed revision and missing temporary stage fail',()=>{
 for(const mutate of [q=>q.unchangedLibraryBytes=false,q=>q.memory.consumed[0].revision=0,q=>q.memory.requests.find(r=>r.consumed.length).consumed[0].id='different',q=>q.observations=q.observations.filter(o=>o.stage!=='independent-temporary')]){
  const r=clone(extras['memory-consumer']);mutate(r.independent);assert.throws(()=>validateScenarioReceipt(r,'memory-consumer'));
 }
});


test('metadata diagnostics preserve failed public path and rate fields without an IP or a retry',async()=>{
 const response=new Response(JSON.stringify({message:'API rate limit exceeded for 192.0.2.1'}),{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':'1234567890','retry-after':'60'}});
 const text=await metadataFailure(response,'git/commits/'+'a'.repeat(40));
 assert.match(text,/HTTP 403/);assert.match(text,/git\/commits\/a{40}/);assert.match(text,/"remaining":"0"/);assert.match(text,/"reset":"1234567890"/);assert.match(text,/"retryAfter":"60"/);assert.doesNotMatch(text,/192\.0\.2\.1/);assert.match(text,/not a complete pass/);
});
