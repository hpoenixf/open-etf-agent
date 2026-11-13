import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rename,symlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {validate,svg,block,sync,articleUrl} from '../scripts/sync-module-map.mjs';
const manifest=JSON.parse(await readFile(new URL('../docs/module-status.json',import.meta.url),'utf8'));
test('map requires reviewed current version, bilingual rows and six unique layers',()=>{
 validate(manifest,manifest.reviewedVersion);
 for(const mutate of [m=>m.reviewedVersion='99.0.0',m=>m.layers[1].id='L1',m=>delete m.layers[1].title.zh,m=>m.cards[0].source='../secret',m=>m.reviewedSource='main',m=>m.cards[0].name='x'.repeat(58),m=>m.cards[1].id=m.cards[0].id,m=>m.cards[0].group='unknown',m=>m.cards[0].status='passed',m=>delete m.cards[0].article,m=>m.cards[0].article.slug='../fake']){const m=structuredClone(manifest);mutate(m);assert.throws(()=>validate(m,manifest.reviewedVersion));}
});
test('both presentations have accessible text, fixed source and scope limits',()=>{
 for(const lang of ['en','zh']){const s=svg(manifest,lang),b=block(manifest,lang);assert.match(s,/<title id="title">/);assert.match(s,/<desc id="desc">/);assert.equal((s.match(/<a href=/g)||[]).length,manifest.cards.length);assert.ok(b.includes(manifest.articleSource));assert.ok(b.includes('docs/verification/README.md'));assert.ok(!s.includes('<script'));for(const c of manifest.cards){assert.ok(s.includes(`href="${articleUrl(c,lang)}"`));assert.ok(b.includes(`[${c.name}](${articleUrl(c,lang)})`));}assert.ok(b.includes('open-etf-agent#module-map'));}
 const m=structuredClone(manifest);m.cards[0].name='<script>&';assert.ok(svg(m,'en').includes('&lt;script&gt;&amp;'));
});
test('generation is deterministic; drift, missing links and version changes fail closed',async()=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp('test-output/module-map-');
 async function put(p,s){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),s);}
 await put('docs/module-status.json',JSON.stringify(manifest));await put('package.json',JSON.stringify({version:manifest.reviewedVersion}));
 for(const p of new Set([manifest.evidence,...manifest.cards.map(c=>c.source),...manifest.layers.flatMap(l=>Object.values(l.guide))]))await put(p,'fixture');
 for(const f of ['README.md','README.zh-CN.md'])await put(f,'preserved\n<!-- module-map:start -->\n<!-- module-map:end -->\nhistory');
 await sync({root});await sync({root,check:true});const a=await readFile(join(root,'README.md'),'utf8');await sync({root});assert.equal(await readFile(join(root,'README.md'),'utf8'),a);assert.ok(a.startsWith('preserved'));assert.ok(a.endsWith('history'));
 await put('README.md','<!-- module-map:end --><!-- module-map:start -->');await assert.rejects(sync({root}),/markers/);await put('README.md',a);
 await put('docs/assets/module-map.svg','stale');await assert.rejects(sync({root,check:true}),/Stale generated/);await sync({root});
 const missing=manifest.cards[0].source;await rename(join(root,missing),join(root,missing+'.saved'));await assert.rejects(sync({root}),/ENOENT/);await rename(join(root,missing+'.saved'),join(root,missing));
 await rename(join(root,'docs/assets/report-path.svg'),join(root,'docs/assets/report-path.saved'));await symlink('report-path.saved',join(root,'docs/assets/report-path.svg'));await assert.rejects(sync({root}),/symlink/);
 await put('package.json','{"version":"99.0.0"}');await assert.rejects(sync({root}),/needs scope review/);
});
