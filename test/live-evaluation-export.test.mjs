import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const source='1'.repeat(40), prior='2'.repeat(40);
const hash='3'.repeat(64),traceId='4'.repeat(32);
const ids=['REG','TIME','WEB','PDF','ETFS','FIN','DEEP','LIFE','ACT','MAIL'].flatMap(g=>Array.from({length:20},(_,i)=>g+'-'+String(i+1).padStart(2,'0')));
const raw={case:'PDF-04',source,provider:'opencode-go',state:'completed',questionSha256:hash,inputSha256:hash,httpStatus:202,runId:'run-pdf',
 runtime:{status:'completed',modelUses:3,toolUses:2},
 evaluation:{bodyHttp:200,coldHttp:200,exactColdBody:true,bodySha256:hash,bodyBytes:10,semanticCheck:'numeric-component-only',numericMatch:true},
 observation:{http:200,status:'available',stepCodes:['started','test-private','completed']},collector:{state:'query-verified',traceId,spanNames:['Research Run','Delivery confirmed']},privateText:'never output'};
const side={schemaVersion:'open-live-postread@1',caseId:'PDF-04',sourceCommit:source,runId:'run-pdf',traceId,bodySha256:hash,publicationRevision:1,publicationBindingHash:hash,
 reportRevisionId:'revision:sha256:'+hash,checkedSource:{id:'pdf:'+hash+':p3',page:3,sha256:hash,originalSha256:hash},sourceClaimMatched:true};
async function setup(t){
 const dir=await mkdtemp(resolve('test-output','live-export-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const manifest=join(dir,'cases.json');
 await writeFile(manifest,JSON.stringify(ids.map(id=>({id,real_model:true,prompt:'test-private'}))));
 const set=(name,r)=>writeFile(join(dir,name),JSON.stringify(r));
 const command=(commit=source)=>execFileSync(process.execPath,['src/public-eval-cli.mjs','export-live',manifest,dir,commit],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 return {set,command,dir};
}
test('public live export preserves exact candidate, trace and page binding without raw content',async t=>{
 const f=await setup(t);await f.set('PDF-04-live-once.json',raw);await f.set('PDF-04-postread.safe.json',side);
 const wire=f.command();assert.doesNotMatch(wire,/never output|test-private/);
 const report=JSON.parse(wire),r=report.cases.find(x=>x.caseId==='PDF-04');
 assert.equal(report.denominator,200);assert.equal(r.delivery.status,'verified');assert.equal(r.jaeger.traceId,traceId);assert.equal(r.postRead.checkedSource.page,3);assert.equal(r.semanticStatus,'unreviewed');
 assert.deepEqual(JSON.parse(f.command(prior)).cases.find(x=>x.caseId==='PDF-04'),{caseId:'PDF-04',state:'not-run',priorSource:source});
});
test('public live export fails closed on cross-run evidence and symlink receipts',async t=>{
 const f=await setup(t);await f.set('PDF-04-live-once.json',raw);await f.set('PDF-04-postread.safe.json',{...side,traceId:'5'.repeat(32)});
 assert.throws(()=>f.command(),e=>e.status===2&&e.stderr.includes('POSTREAD_IDENTITY_MISMATCH'));
 await f.set('PDF-04-postread.safe.json',side);
 await symlink('PDF-04-live-once.json',join(f.dir,'PDF-06-live-once.json'));
 assert.throws(()=>f.command(),e=>e.status===2&&e.stderr.includes('INPUT_UNAVAILABLE_OR_MALFORMED'));
});
