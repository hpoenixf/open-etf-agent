import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openSession} from '../../src/session.mjs';
import {submitRun} from '../../src/runtime.mjs';
import {workRun} from '../../src/worker.mjs';
import {createDynamicKnowledgeTool} from '../../src/knowledge-query-tool.mjs';
import {sha256} from '../../src/source.mjs';
const [directory,action,runId,pause='',tick]=process.argv.slice(2),leaseTick=Number(tick);
if(!['submit','work'].includes(action)||!Number.isSafeInteger(leaseTick))throw Error('INVALID_QUERY_PROCESS_FIXTURE');
const store=await openSession({directory,profile:'local-knowledge-query@1',clock:()=>leaseTick,leaseMs:100});let token;
const send=x=>process.send?.({...x,pid:process.pid});
const barrier=async phase=>{if(pause===phase){send({kind:'barrier',phase});await new Promise(()=>{});}};
const catalog={schemaVersion:'document-catalog@1',id:'process-query',documents:[{id:'cash',name:'Cash',version:'1',pages:['Cash reserves cover redemptions.']}]};
const vectors={schemaVersion:'knowledge-vector-evidence@1',provider:{id:'local-sentence-transformers',model:'synthetic-local',revision:'a'.repeat(64)},dimensions:2,pages:[{sourceId:'cash@1:p1',sha256:sha256(catalog.documents[0].pages[0]),vector:[1,0]}],queries:[{querySha256:sha256('seed'),vector:[1,0]}]};
const dynamic=createDynamicKnowledgeTool({catalog,allowedDocuments:['cash'],config:{algorithm:'hybrid',maxResults:1},vectorEvidence:vectors,sourceManifestSha256:'d'.repeat(64),queryConfig:{modelManifestSha256:'a'.repeat(64),maxTokens:8,maxQueries:2},store,runId,getClaim:()=>token,backendFactory:()=>{
 return{identity:{model:'synthetic-local',manifestSha256:'a'.repeat(64)},maxTokens:8,
  async tokenize(){await appendFile(join(directory,'stages.txt'),'tokenize\n');await barrier('tokenizer-dispatched');return{tokenIds:[1],truncated:false};},
  encodeDocument(){throw Error('PAGE_REENCODE_FORBIDDEN');},
  async encodeQuery(r){await appendFile(join(directory,'stages.txt'),'encode\n');await barrier('encoder-dispatched');return{vector:[1,0],truncated:false,tokenIdsSha256:r.tokenIdsSha256};}
 };
}});
const extension={...dynamic.tool,async execute(args,context){await barrier('before-backend');const value=await dynamic.tool.execute(args,context);await barrier('receipt-before-host');return value;}};
const options={question:'Find liquidity evidence.',requireReport:true,publication:true,hostProjection:'host-results@3',contextBytes:1048576,documentCatalog:catalog,allowedDocuments:['cash'],allowedTools:['knowledge_query','read_page','read_result','save_report'],knowledgeQueryEffects:dynamic.profile,extensions:[extension],outputRoot:join(directory,'runs'),limits:{maxRounds:8,maxTools:8,timeoutMs:30000},gateway:{mode:'fixture',async next({messages}){
 const values=messages.filter(m=>m.role==='tool').map(m=>m.result),evidence=values.find(r=>r.value?.kind==='knowledge-evidence')?.value;
 if(!evidence)return{kind:'calls',calls:[{id:'q',name:'knowledge_query',arguments:{query:'liquidity'}}]};
 if(!values.some(r=>r.value?.path==='report.md'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'Cash covers redemptions [1].',sourceIds:evidence.sources.map(s=>s.sourceId)}}]};
 return{kind:'final',text:'Saved.'};
}},durable:{store,runId,grantId:'query-process-fixture',rootLimits:{model:8,tool:8},bindings:{gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'fixture',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'},dynamic.binding]},onClaim:t=>{token=t;},async onCheckpoint(v){if(v.phase==='result-consumed')await barrier('host-result-consumed');}}};
try{if(action==='submit')send({kind:'submitted',run:await submitRun(options)});else send({kind:'observation',observation:await workRun(options)});}catch(e){send({kind:'fixture-error',code:e.code??e.message});process.exitCode=2;}finally{store.close();process.disconnect?.();}
