import {join} from 'node:path';
import {lstat} from 'node:fs/promises';
import {run,validateRuntimeCheckpoint} from './runtime.mjs';
import {openSession} from './session.mjs';
import {createChatGateway} from './gateway.mjs';
import {openArtifactStore} from './artifacts.mjs';
import {createSpecialistChildBinding,sourceCheckBinding,readSpecialistHandoff} from './specialist-child.mjs';

const question='Compare the original synthetic guides; ask one source-checking specialist to inspect free export limits and caveats, then synthesize a cited report.';
const documents=['atlas-a','atlas-b'];
const chatCall=(id,name,args)=>({choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
const chatFinal=text=>({choices:[{finish_reason:'stop',message:{role:'assistant',content:text}}]});
// Local response construction exercises the real encoder/protocol only. It cannot perform network I/O.
function fixtureGateway(role,{summarySuffix='',onRequest}={}){
 const encoded=createChatGateway({endpoint:'https://synthetic.invalid/chat/completions',model:'source-check-fixture',apiKey:'synthetic-placeholder-not-a-secret',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:async(_url,request)=>{
  const body=JSON.parse(request.body);await onRequest?.(role,structuredClone(body));
  const results=body.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));let response;
  if(role==='child'){
   const acquired=results.filter(r=>r.status==='succeeded'&&r.value?.sourceId).map(r=>r.value);
   if(acquired.length<documents.length)response=chatCall('specialist-read-'+acquired.length,'read_page',{documentId:documents[acquired.length],page:1});
   else response=chatFinal('Derived source-check observation: inspected '+acquired.map(s=>`${s.documentId}@${s.version}:p${s.page}`).join(', ')+'. Original page text, not this observation, is the citation authority. '+summarySuffix);
  }else{
   const handoff=results.find(r=>r.value?.child)?.value;
   if(!handoff)response=chatCall('one-source-check','source_check',{question:'Check the disclosed free-export limits and shared online restriction from original pages; distinguish missing information.'});
   else if(!results.some(r=>r.value?.fileId))response=chatCall('specialist-main-report','save_report',{text:'# Main synthesis from one serial specialist\n\nChild status: '+handoff.child.status+'\n\n'+handoff.child.summary+'\n\n'+handoff.child.limitations.join('; ')+'\n\nOriginal acquired pages:\n'+handoff.sources.map((s,i)=>`[${i+1}] ${s.sourceId} (${s.resultRef})\n${s.text}`).join('\n\n'),sourceIds:handoff.sources.map(s=>s.sourceId)});
   else response=chatFinal('Main consumed the original specialist handoff and saved '+results.find(r=>r.value?.fileId).value.fileId+'.');
  }
  return new Response(JSON.stringify(response),{status:200,headers:{'content-type':'application/json'}});
 }});
 return Object.freeze({...encoded,mode:'fixture'});
}
export async function runSpecialistDemo({directory,runId,signal,onRequest,summarySuffix='',onCheckpoint}={}){
 if(typeof summarySuffix!=='string'||summarySuffix.length>1000)throw new Error('INVALID_SYNTHETIC_SUFFIX');
 const store=await openSession({directory});let token;
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'chat-completions-fixture',model:'source-check-fixture',version:'1'},plugins:[],adapters:[sourceCheckBinding({question,documents})]};
 const extensions=[createSpecialistChildBinding({store,parentClaim:()=>token,parentRunId:runId,outputRoot:join(directory,'runs'),question,documents,gatewayFactory:()=>fixtureGateway('child',{summarySuffix,onRequest})})];
 try{return {...await run({question,gateway:fixtureGateway('main',{onRequest}),extensions,outputRoot:join(directory,'runs'),signal,allowedTools:['source_check','save_report','read_page'],allowedDocuments:documents,requireReport:true,limits:{maxRounds:4,maxTools:2,timeoutMs:60000},durable:{store,runId,grantId:'synthetic-serial-specialist',bindings,rootLimits:{model:8,tool:6},onClaim:value=>{token=value;},onCheckpoint}}),mode:'fixture',providerCalls:0};}
 finally{store.close();}
}
export async function readSpecialistRun({directory,runId}={}){
 const stat=await lstat(join(directory,'session.sqlite'));if(!stat.isFile()||stat.isSymbolicLink())throw new Error('UNSAFE_SESSION_FILE');
 const store=await openSession({directory,readOnly:true});
 try{
  const parent=store.inspect(runId);validateRuntimeCheckpoint(parent.snapshot,parent.definition);
  const handoff=await readSpecialistHandoff({store,parentRunId:runId,question:parent.definition.question,documents:parent.definition.config.allowedDocuments});
  const receipt=parent.snapshot.outcome?.receipt;let report=null;
  if(receipt){const artifacts=await openArtifactStore({directory:parent.directory,readOnly:true});const revision=await artifacts.readRevision(receipt.revisionId);const record=await artifacts.read(revision.reportId);if(record.sha256!==receipt.sha256)throw new Error('SPECIALIST_REPORT_IDENTITY');report={revisionId:receipt.revisionId,sha256:record.sha256,text:record.bytes.toString('utf8')};}
  return {runId,parentStatus:parent.status,...handoff,report,semanticStatus:'unreviewed'};
 }finally{store.close();}
}
