// Provider-free read-only preparation check. Never imports a runner or reads credentials.
import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const base=join(root,'openspec/changes/v034-context-fitting');
const digest=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('A14_INPUT_CONTRACT_INVALID');};
const keys=(v,expected)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...expected].sort().join())fail();};
const sourcePaths=['src/context.mjs','src/observe.mjs','src/research-project.mjs','src/runtime.mjs','src/session.mjs'];
export function validateContract(c,source,code){
 keys(c,['schemaVersion','candidateCommit','sourceFile','sourceSha256','sourceBytes','runtimeSha256','planned','requiredSuccesses','dispatchAuthorized','priorUnknownRequests','tasks','executionGate','safetyGate','profile']);
 if(c.schemaVersion!=='a14-real-acceptance-inputs@1'||c.candidateCommit!=='93d060f1c3cfce9b4b30ef67e860cbb1a9b3eaeb'||c.sourceFile!=='acceptance-source.txt'||digest(source)!==c.sourceSha256||source.length!==c.sourceBytes||c.planned!==10||c.requiredSuccesses!==9||c.dispatchAuthorized!==false||c.priorUnknownRequests!==2)fail();
 keys(c.runtimeSha256,sourcePaths);for(const p of sourcePaths)if(!code[p]||digest(code[p])!==c.runtimeSha256[p])fail();
 if(!Array.isArray(c.tasks)||c.tasks.length!==10)fail();
 for(const [i,t] of c.tasks.entries()){keys(t,['id','question','expectedOutcome','contextWorkingSetBytes','rubric','questionSha256','questionBytes']);if(t.id!==`a14-${String(i+1).padStart(2,'0')}`||typeof t.question!=='string'||!t.question||digest(Buffer.from(t.question))!==t.questionSha256||Buffer.byteLength(t.question)!==t.questionBytes||Buffer.byteLength(t.question)>16000||t.expectedOutcome!=='completed-with-report'||t.contextWorkingSetBytes!==(i===0?null:256)||!Array.isArray(t.rubric)||!t.rubric.length||t.rubric.some(x=>typeof x!=='string'||!x))fail();}
 if(JSON.stringify(c.profile)!==JSON.stringify({capabilities:['report'],allowedTools:['read_page','read_result','save_report'],contextBytes:1048576,limits:{maxRounds:20,maxTools:32,timeoutMs:300000,model:24,tool:40}}))fail();
 keys(c.executionGate,['route','budget','concurrency','automaticRetries','unknownPolicy']);if(c.executionGate.concurrency!==1||c.executionGate.automaticRetries!==0||c.executionGate.route!=='requires explicit approved provider/model/config identity'||c.executionGate.budget!=='requires reconciled cumulative ledger and explicit remaining cap'||c.executionGate.unknownPolicy!=='retain request and billing unknown; no refund or replay'||c.safetyGate!=='test/context-fitting-v034.test.mjs; capacity refusal/recovery are not normal-cohort successes')fail();
 return {schemaVersion:'a14-preparation-check@1',prepared:true,dispatchAuthorized:false,realAcceptance:'not-started',sourceSha256:digest(source),taskInputSha256:digest(Buffer.from(JSON.stringify(c.tasks))),tasks:10,priorUnknownRequests:2};
}
async function regular(p){const s=await lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>2*1024*1024)fail();return readFile(p);}
export async function checkInputs(){const c=JSON.parse(await regular(join(base,'acceptance-inputs.json')));const code={};for(const p of sourcePaths)code[p]=await regular(join(root,p));return validateContract(c,await regular(join(base,'acceptance-source.txt')),code);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{if(process.argv.length!==2)fail();console.log(JSON.stringify(await checkInputs(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
