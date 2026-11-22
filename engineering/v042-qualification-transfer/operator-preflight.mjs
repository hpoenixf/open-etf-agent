import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {constants} from 'node:fs';
import {lstat,open,readFile,readdir,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {frozenPlan,PLAN_SHA} from './run.mjs';

class Stop extends Error {}
const stop=(code)=>{throw new Stop(code);};
const configHash=(type,b)=>createHash('sha1').update(type+' '+b.length+'\0').update(b).digest();
const stable=x=>JSON.stringify(x,(_,v)=>(v&&typeof v==='object'&&!Array.isArray(v))?Object.fromEntries(Object.entries(v).sort()):v);
const blob=(s)=>Buffer.from(s,'utf8');
async function tree(root){
 const rows=[];
 for(const ent of await readdir(root,{withFileTypes:true})){
  const file=join(root,ent.name);
  if(ent.isDirectory())rows.push({name:ent.name,tree:true,type:'40000',sha:await tree(file)});
  else if(ent.isFile()){
   const stat=await lstat(file);rows.push({name:ent.name,type:stat.mode&0o111?'100755':'100644',sha:configHash('blob',await readFile(file))});
  }else stop('UNEXPECTED_SRC_ENTRY_TYPE');
 }
 rows.sort((a,b)=>Buffer.compare(blob(a.name+(a.tree?'/':'')),blob(b.name+(b.tree?'/':''))));
 return configHash('tree',Buffer.concat(rows.flatMap(row=>[blob(row.type+' '+row.name+'\x00'),row.sha])));
}
const canonical=async p=>isAbsolute(p??'')&&await realpath(p)===p;
async function absentChild(p){
 if(!isAbsolute(p??'')||resolve(p)!==p||!(await canonical(dirname(p))))stop('UNSAFE_STAGING_PATH');
 try{await lstat(p);stop('PROJECT_OR_LEDGER_ALREADY_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
}
async function main(){
 const {values:v}=parseArgs({options:{source:{type:'string'},'staged-source-only':{type:'boolean'},
  config:{type:'string'},project:{type:'string'},ledger:{type:'string'},'program-used-at-least':{type:'string'},'max-provider-posts':{type:'string'}},strict:true});
 const plan=await frozenPlan();
 const checkout=v.source;
 if(process.version!=='v26.11.1')stop('REQUIRE_OFFICIAL_NODE_26_11_1');
 if(!(await canonical(checkout)))stop('UNSAFE_SOURCE_PATH');
 const verifiedSrc=(await tree(join(checkout,'src'))).toString('hex');
 if(verifiedSrc!==plan.runtimeSrc)stop('WORKTREE_SRC_TREE_MISMATCH');
 const candidates=['gui-server','research-project','conversation','web-acquisition','project-sources'];
 // Same source modules as the dispatcher, but no create/start/execute calls.
 await Promise.all(candidates.map(n=>import(pathToFileURL(join(checkout,'src',n+'.mjs')).href)));
 if(v['staged-source-only']){
  console.log(JSON.stringify({mode:'staged-content-check-only',candidateCommitProven:false,src:verifiedSrc,imports:candidates.length,plan:PLAN_SHA,modelRequests:0,projectWrites:0}));
  return;
 }
 const git=args=>execFileSync('git',['-C',checkout,...args],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','ignore']}).trim();
 if(git(['rev-parse','HEAD'])!==plan.candidate||git(['rev-parse','HEAD:src'])!==plan.runtimeSrc||
    git(['status','--porcelain','--untracked-files=all','--','src','package.json','package-lock.json']))stop('UNVERIFIED_CANDIDATE_HEAD_OR_DEPENDENCIES');
 const used=v['program-used-at-least'],cap=v['max-provider-posts'];
 if(!/^\d{1,5}$/.test(used??'')||Number(used)<64||Number(used)>=50000||
    !/^\d{1,5}$/.test(cap??'')||Number(cap)<1||
    Number(cap)>Math.min(plan.maxCohortPhysicalPosts,50000-Number(used)))stop('INVALID_CURRENT_PROGRAM_ACCOUNTING_OR_CAP');
 if(v.project===v.ledger||v.project?.startsWith(checkout+'/')||v.ledger?.startsWith(checkout+'/'))stop('PROJECT_AND_LEDGER_MUST_BE_DISTINCT_AND_OUTSIDE_SOURCE');
 await absentChild(v.project);await absentChild(v.ledger);
 if(!(await canonical(v.config)))stop('UNSAFE_CONFIG_PATH');
 const fd=await open(v.config,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 let cfg;
 try{
  const s=await fd.stat();if(!s.isFile()||s.size>65536||s.mode&0o077)stop('CONFIG_NOT_SMALL_PRIVATE_REGULAR_FILE');
  cfg=JSON.parse(await fd.readFile('utf8'));
 }finally{await fd.close();}
 const keys=Object.keys(cfg.connectivity??{}).sort();
 if(cfg.gateway?.provider!=='opencode-go-owner'||cfg.gateway.endpoint!=='https://opencode.ai/inference/go/openai/v1/chat/completions'||
    cfg.gateway.apiKeyEnv!=='ETF_GUI_PROVIDER_KEY'||cfg.connectivity?.web!==true||
    cfg.connectivity.search!=='exa-public-preview'||keys.join(',')!=='search,web'||cfg.toolAccounting!==undefined||
    stable(cfg.limits)!==stable(plan.limits))stop('EXACT_REPLACEMENT_LAUNCH_PROFILE_MISMATCH');
 console.log(JSON.stringify({mode:'sg-candidate-preflight-only',candidate:plan.candidate,src:verifiedSrc,plan:PLAN_SHA,
   cumulativeUsedAtLeast:Number(used),cohortCap:Number(cap),keysRead:false,operatorStillMustVerifyAccount:true,modelRequests:0,projectWrites:0}));
}
try{await main();}catch(e){console.error('PREFLIGHT_STOP '+(e instanceof Stop?e.message:'SAFE_PREFLIGHT_FAILURE'));process.exitCode=1;}
