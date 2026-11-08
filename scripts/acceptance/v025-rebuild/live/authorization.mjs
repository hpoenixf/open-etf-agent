import {readFile,realpath,lstat,readdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const tokens=new WeakMap(),here=dirname(fileURLToPath(import.meta.url));
export const sha256=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const EXPECTED_PLAN='06ef865d1781ca82caca60ed74b4a4c018446ceb53e574ce3511391c36048977';
export const SUPPLEMENT_CASE_IDS=Object.freeze(Array.from({length:9},(_,i)=>'RB25-'+String(i+2).padStart(2,'0')));
export function selectSupplementCases(plan,caseIds){
 if(!Array.isArray(caseIds)||caseIds.length!==9||caseIds.some((id,i)=>id!==SUPPLEMENT_CASE_IDS[i]))fail('LIVE_SUPPLEMENT_CASE_SCOPE');
 const selected=caseIds.map(id=>plan.cases.find(c=>c.id===id));if(selected.some(c=>!c)||selected.reduce((n,c)=>n+c.modelAttemptCap,0)!==76)fail('LIVE_SUPPLEMENT_PLAN_SCOPE');return selected;
}
export async function validateActualClaim({claimPath,expectedClaimSha256}){
 if(!/^[a-f0-9]{64}$/.test(expectedClaimSha256??''))fail('LIVE_CLAIM_EXPECTED_HASH_REQUIRED');
 const stat=await lstat(claimPath);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1048576)fail('LIVE_CLAIM_FILE');const raw=await readFile(claimPath);if(sha256(raw)!==expectedClaimSha256)fail('LIVE_CLAIM_HASH');const claim=JSON.parse(raw);
 if(claim.schema!=='rebuilt-v025-supplement-02-allocation@1'||claim.mode!=='actual'||claim.approved!==true||claim.owner!=='root-unique-launcher'||claim.noExtraFee!==true||claim.extraUsage!==false||claim.retry!==false||claim.cap!==108||claim.previousEpochHeld!==610||claim.epochHeldAfter!==718||!Number.isSafeInteger(claim.historicalUnknownLowerBound)||claim.historicalUnknownLowerBound<29||claim.oldV025Held!==120||claim.permanentAllocation!==true||claim.planSha256!==EXPECTED_PLAN||claim.endpoint!=='https://opencode.ai/inference/go/openai/v1/chat/completions'||claim.model!=='deepseek-v4.1-flash')fail('LIVE_CLAIM_SCOPE');
 if(!claim.historicalSummary||typeof claim.historicalSummary.provenance!=='string'||!claim.historicalSummary.provenance.trim())fail('LIVE_HISTORICAL_PROVENANCE_REQUIRED');
 selectSupplementCases(JSON.parse(await readFile(resolve(here,'../cases.json'))),claim.caseIds);
 if(!Number.isFinite(Date.parse(claim.expiresAt))||Date.parse(claim.expiresAt)<=Date.now()||Date.parse(claim.expiresAt)>Date.now()+1800000)fail('LIVE_CLAIM_EXPIRED');
 if(typeof claim.batchId!=='string'||!/^live-rb25-[a-z0-9-]{8,64}$/.test(claim.batchId)||typeof claim.directory!=='string'||resolve(claim.directory)!==claim.directory)fail('LIVE_CLAIM_IDENTITY');
 if(!Array.isArray(claim.closure)||!claim.closure.length||claim.closure.length>10000)fail('LIVE_CLOSURE');
 const files=new Set();for(const entry of claim.closure){if(!entry||typeof entry.path!=='string'||resolve(entry.path)!==entry.path||!/^[a-f0-9]{64}$/.test(entry.sha256)||files.has(entry.path))fail('LIVE_CLOSURE');files.add(entry.path);if(sha256(await readFile(entry.path))!==entry.sha256)fail('LIVE_CLOSURE_HASH');}
 async function requireTree(directory){for(const e of await readdir(directory,{withFileTypes:true})){if(e.isSymbolicLink())fail('LIVE_CLOSURE_SYMLINK');if(e.isDirectory())await requireTree(join(directory,e.name));else if(e.isFile()&&!files.has(join(directory,e.name)))fail('LIVE_CLOSURE_INCOMPLETE');}}
 await requireTree(resolve(here,'../../../../src'));
 for(const name of ['runner.mjs','sink.mjs','authorization.mjs','launcher.mjs','cold.mjs'])if(!files.has(join(here,name)))fail('LIVE_CLOSURE_INCOMPLETE');
 for(const path of [resolve(here,'../bridge.mjs'),resolve(here,'../cases.json'),resolve(here,'../plan.md'),resolve(here,'../../../../package-lock.json')])if(!files.has(path))fail('LIVE_CLOSURE_INCOMPLETE');
 if(sha256(await readFile(resolve(here,'../cases.json')))!==EXPECTED_PLAN)fail('LIVE_PLAN_HASH');
 const token=Object.freeze({claimPath:await realpath(claimPath),claimSha256:expectedClaimSha256});tokens.set(token,structuredClone(claim));return token;
}
export function requireActualToken(token){if(!tokens.has(token))fail('LIVE_APPROVED_CLAIM_REQUIRED');return structuredClone(tokens.get(token));}
