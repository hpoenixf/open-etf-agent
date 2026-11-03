import {open,constants} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {safeDirectory} from './storage-files.mjs';
import {createResearchProject,updateResearchProject,inspectResearchProject,readProjectJson,submitResearchTask,workResearchTask,inspectResearchTask,cancelResearchTask,respondResearchTask,readResearchReport,applyProjectMemoryIntent,approveProjectMemoryIntent,listResearchInteractions,inspectResearchInteraction} from './research-project.mjs';
import {importProjectSources,loadProjectSources} from './project-sources.mjs';
import {openMemoryLibrary} from './memory.mjs';
import {startReader} from './reader.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const RESEARCH_HELP=`Local single-user research application (JSON output; no .env loading).
Usage: node src/research-cli.mjs <group> <command> [options]
  project init --project DIR --config JSON_FILE
  project update --project DIR --config JSON_FILE --expected-config SHA256
  project inspect --project DIR
  source import --project DIR --files JSON_FILE
  source list --project DIR --manifest SHA256
  run submit --project DIR --run ID --question TEXT_FILE --manifest SHA256
      [--approve-provider --approve-data --approve-cost]
      [--memory-intents JSON_FILE] [--task-time JSON_FILE] [--schedule JSON_FILE]
  run work --project DIR --run ID
  run inspect|cancel --project DIR --run ID
  interaction list --project DIR [--run ID] [--limit NUMBER] [--after CURSOR]
  interaction inspect --project DIR --run ID --question-id ID
  run respond --project DIR --run ID --question-id ID --response-id ID --text TEXT_FILE
  run report|serve --project DIR --run ID [--port NUMBER (serve only)]
  report inspect|serve --project DIR --run ID [--port NUMBER (serve only)]
  memory approve-intent --project DIR --operation save|revise|forget --intent ID
      --approve-intent [--text TEXT_FILE] [--entry ID --revision NUMBER]
  memory inspect --project DIR [--entry ID]
  memory save --project DIR --intent ID --text TEXT_FILE --approve-intent
  memory revise --project DIR --intent ID --entry ID --revision NUMBER --text TEXT_FILE --approve-intent
  memory forget --project DIR --intent ID --entry ID --revision NUMBER --approve-intent

--files is a JSON array of explicitly selected local .txt/.md/.markdown/.pdf paths,
resolved from the current directory, never a directory scan. Limits: 64 documents,
16 text pages per document, 64000 UTF-8 bytes per page, 1 MiB text catalog,
one PDF; PDF parser limits also apply. Import returns an immutable manifest SHA256.
Submit does not call a model. Live submit requires all three explicit approvals:
configured provider, selected source/question/Memory data, and configured cost limit.
Work uses only the environment variable named by gateway.apiKeyEnv. Fixture projects
cannot be executed by this CLI. Repeat work to resume the SAME run; do not resubmit.
Ctrl-C/SIGTERM stops the Host cooperatively, not the task. Only cancel cancels a run.
Reader serves verified persisted artifacts on 127.0.0.1 and never runs a model.
approve-intent returns an unconsumed intent; put it in an explicit JSON array file
for submit --memory-intents. Memory mutations require an explicit one-time intent; revise/forget require revision.
All options are single-use. Unknown options and positional arguments are rejected.
`;
const specifications={
 'interaction list':['project','run?','limit?','after?'],
 'interaction inspect':['project','run','question-id'],
 'project update':['project','config','expected-config'],
 'project init':['project','config'], 'project inspect':['project'],
 'source import':['project','files'], 'source list':['project','manifest'],
 'run submit':['project','run','question','manifest','approve-provider?','approve-data?','approve-cost?','memory-intents?','task-time?','schedule?'],
 'run work':['project','run'], 'run inspect':['project','run'], 'run cancel':['project','run'],
 'run respond':['project','run','question-id','response-id','text'],
 'run report':['project','run'], 'run serve':['project','run','port?'],
 'report inspect':['project','run'], 'report serve':['project','run','port?'],
 'memory approve-intent':['project','operation','intent','approve-intent','text?','entry?','revision?'],
 'memory inspect':['project','entry?'], 'memory save':['project','intent','text','approve-intent'],
 'memory revise':['project','intent','entry','revision','text','approve-intent'],
 'memory forget':['project','intent','entry','revision','approve-intent']
};
const flags=new Set(['approve-provider','approve-data','approve-cost','approve-intent']);
export function parseResearchArguments(args){
 if(args.length===0||(args.length===1&&['help','--help','-h'].includes(args[0])))return{help:true};
 const command=args.slice(0,2).join(' '),spec=specifications[command];if(!spec)fail('CLI_UNKNOWN_COMMAND');
 const allowed=new Set(spec.map(v=>v.replace(/\?$/,''))),options={};
 for(let i=2;i<args.length;i++){const token=args[i];if(!token.startsWith('--'))fail('CLI_UNEXPECTED_ARGUMENT');const name=token.slice(2);if(!allowed.has(name))fail('CLI_UNKNOWN_OPTION');if(Object.hasOwn(options,name))fail('CLI_REPEATED_OPTION');if(flags.has(name))options[name]=true;else{const value=args[++i];if(!value||value.startsWith('--')||value.includes('\0'))fail('CLI_OPTION_VALUE_REQUIRED');options[name]=value;}}
 for(const name of spec.filter(v=>!v.endsWith('?')))if(!Object.hasOwn(options,name))fail('CLI_REQUIRED_OPTION');
 return {command,options};
}
async function textFile(path,limit){await safeDirectory(dirname(resolve(path)));const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const s=await file.stat();if(!s.isFile()||s.size>limit)fail('CLI_UNSAFE_TEXT_FILE');const bytes=Buffer.alloc(limit+1);let count=0;while(count<bytes.length){const{bytesRead}=await file.read(bytes,count,bytes.length-count);if(!bytesRead)break;count+=bytesRead;}if(count>limit)fail('CLI_UNSAFE_TEXT_FILE');let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count));}catch{fail('CLI_INVALID_UTF8');}if(!text.trim()||text.includes('\0'))fail('CLI_EMPTY_OR_BINARY_TEXT');return text;}finally{await file.close();}}
function integer(value,min,max){if(!/^(0|[1-9][0-9]*)$/.test(value))fail('CLI_INVALID_INTEGER');const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)fail('CLI_INVALID_INTEGER');return n;}
function sourceResult(value){return{manifestSha256:value.manifestSha256,manifest:value.manifest};}
function taskResult(value){const d=value.definition,r=value.run;return{...(r?.snapshot?{phase:r.snapshot.phase,...(r.snapshot.code?{code:r.snapshot.code}:{}),...(r.snapshot.phase==='awaiting-response'?{response:{deadlineAt:r.definition.deadlineAt,questionId:r.snapshot.responseQuestion,question:r.snapshot.proposal?.calls?.[r.snapshot.cursor]?.arguments?.question}}:{})}:{}),runId:d.runId,projectId:d.projectId,sourceManifestSha256:d.sourceManifestSha256,grantId:d.grantId,...(value.schedule?{schedule:value.schedule}:{}),run:r?Object.fromEntries(['runId','rootId','parentRunId','status','rootStatus','rootUsage','directory','revision','cancelled','createdAt','updatedAt'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]])):null};}
// Never expose arbitrary exception messages, provider response bodies, or stacks.
export function researchError(error){const code=typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{1,80}$/.test(error.code)?error.code:'RESEARCH_OPERATION_FAILED';return{error:code,hint:code==='RESEARCH_OPERATION_FAILED'?'Check explicit input files, project state and configuration. No provider error body is displayed.':'See help and verify the named operation inputs.'};}
function redact(text,secret){let value=text;if(secret)value=value.split(secret).join('[REDACTED]');return value.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'Bearer [REDACTED]').replace(/\bsk-[A-Za-z0-9_-]{8,}/g,'[REDACTED]');}
export async function runResearchCli(args,{stdout=process.stdout,stderr=process.stderr,signals=process}={}){
 let secret;const emit=v=>stdout.write(redact(JSON.stringify(v),secret)+'\n');
 try{
  const parsed=parseResearchArguments(args);if(parsed.help){stdout.write(RESEARCH_HELP);return 0;}
  const {command,options:o}=parsed,projectDir=resolve(o.project),runId=o.run;
  if(command==='interaction list'){emit(await listResearchInteractions({projectDir,runId,limit:o.limit===undefined?50:integer(o.limit,1,50),after:o.after}));return 0;}
  if(command==='interaction inspect'){emit(await inspectResearchInteraction({projectDir,runId,questionId:o['question-id']}));return 0;}
  if(command==='project init'){emit(await createResearchProject({directory:projectDir,config:await readProjectJson(o.config)}));return 0;}
  if(command==='project update'){emit(await updateResearchProject({projectDir,config:await readProjectJson(o.config),expectedConfigSha256:o['expected-config']}));return 0;}
  if(command==='project inspect'){emit(await inspectResearchProject({projectDir}));return 0;}
  if(command==='source import'){await inspectResearchProject({projectDir});emit(sourceResult(await importProjectSources({projectDir,files:await readProjectJson(o.files)})));return 0;}
  if(command==='source list'){await inspectResearchProject({projectDir});emit(sourceResult(await loadProjectSources({projectDir,manifestSha256:o.manifest})));return 0;}
  if(command==='run submit'){
   const question=await textFile(o.question,16000),extra={};
   for(const [key,arg]of [['memoryIntents','memory-intents'],['taskTime','task-time'],['schedule','schedule']])if(o[arg])extra[key]=await readProjectJson(o[arg]);
   await submitResearchTask({projectDir,runId,question,sourceManifestSha256:o.manifest,authorization:{providerApproved:o['approve-provider']===true,dataApproved:o['approve-data']===true,costApproved:o['approve-cost']===true},...extra});emit(taskResult(await inspectResearchTask({projectDir,runId})));return 0;
  }
  if(command==='run work'){
   const {definition:{config}}=await inspectResearchTask({projectDir,runId});if(config.gateway.mode!=='live')fail('CLI_LIVE_WORK_REQUIRED');secret=process.env[config.gateway.apiKeyEnv];if(!secret)fail('CLI_API_KEY_ENV_REQUIRED');
   const host=new AbortController(),stop=()=>host.abort();signals.on('SIGINT',stop);signals.on('SIGTERM',stop);
   try{await workResearchTask({projectDir,runId,apiKey:secret,hostSignal:host.signal});emit(taskResult(await inspectResearchTask({projectDir,runId})));}finally{signals.off('SIGINT',stop);signals.off('SIGTERM',stop);}return 0;
  }
  if(command==='run inspect'){emit(taskResult(await inspectResearchTask({projectDir,runId})));return 0;}
  if(command==='run cancel'){await cancelResearchTask({projectDir,runId});emit(taskResult(await inspectResearchTask({projectDir,runId})));return 0;}
  if(command==='run respond'){emit(await respondResearchTask({projectDir,runId,questionId:o['question-id'],responseId:o['response-id'],text:await textFile(o.text,16000)}));return 0;}
  if(command==='run report'||command==='report inspect'){emit(await readResearchReport({projectDir,runId}));return 0;}
  if(command.endsWith(' serve')){
   const port=o.port===undefined?0:integer(o.port,0,65535),report=await readResearchReport({projectDir,runId});
   const reader=await startReader({directory:report.directory,port});
   try{await new Promise(resolve=>{const stop=()=>{signals.off('SIGINT',stop);signals.off('SIGTERM',stop);resolve();};signals.on('SIGINT',stop);signals.on('SIGTERM',stop);emit({runId,origin:reader.origin,directory:report.directory,receipt:report.receipt});});}finally{await reader.close();}return 0;
  }
  if(command==='memory inspect'){
   await inspectResearchProject({projectDir});const memory=await openMemoryLibrary({directory:join(projectDir,'memory'),writable:false});try{emit(o.entry?await memory.read(o.entry):{libraryId:memory.libraryId,entries:await memory.list()});}finally{await memory.close();}return 0;
  }
  if(command.startsWith('memory ')){
   const operation=command==='memory approve-intent'?o.operation:command.split(' ')[1];
   if(!['save','revise','forget'].includes(operation)||(operation==='save'&&(o.entry||o.revision))||(operation==='forget'&&o.text)||((operation==='save'||operation==='revise')&&!o.text)||(operation!=='save'&&(!o.entry||!o.revision)))fail('CLI_MEMORY_ARGUMENTS');
   emit(await (command==='memory approve-intent'?approveProjectMemoryIntent:applyProjectMemoryIntent)({projectDir,operation,intentId:o.intent,explicit:o['approve-intent']===true,...(o.text?{text:await textFile(o.text,8000)}:{}),...(o.entry?{entryId:o.entry,expectedRevision:integer(o.revision,1,Number.MAX_SAFE_INTEGER)}:{})}));return 0;
  }
  fail('CLI_UNKNOWN_COMMAND');
 }catch(error){stderr.write(JSON.stringify(researchError(error))+'\n');return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await runResearchCli(process.argv.slice(2));
