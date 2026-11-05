import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openSession} from '../src/session.mjs';
import {run,submitRun} from '../src/runtime.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {childExecutionBinding,createChildExecutionBinding,inspectChildExecutions} from '../src/child-execution.mjs';
const [directory,mode,target]=process.argv.slice(2);
const question='Check the selected original synthetic page.',documents=['atlas-a'],execution={schemaVersion:'child-execution@1',maxChildren:2,methods:[CLAIM_COMPARISON_METHOD]};
const selected={question,documents,execution},store=await openSession({directory,leaseMs:150});let token,paused=false;
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const checkpoint=async event=>{const role=event.runId==='original'?'main':'child';if(mode==='start'&&!paused&&role+':'+event.phase===target){paused=true;process.send?.({kind:'checkpoint',pid:process.pid,role,phase:event.phase,runId:event.runId,root:store.inspect('original'),children:store.listChildren('original')});await new Promise(()=>{});}};
const binding=createChildExecutionBinding({store,parentRunId:'original',parentClaim:()=>token,...selected,outputRoot:join(directory,'runs'),onCheckpoint:checkpoint,gatewayFactory:()=>({mode:'fixture',async next({messages}){await appendFile(join(directory,'fixture-requests.txt'),'child\n');return messages.some(m=>m.role==='tool')?{kind:'final',text:'Derived source observation.'}:call('page','read_page',{documentId:'atlas-a',page:1});}})});
const options={question,allowedTools:['delegate_child','read_page'],allowedDocuments:documents,requireReport:false,extensions:[binding],outputRoot:join(directory,'runs'),hostSignal:new AbortController().signal,limits:{maxRounds:8,maxTools:6,timeoutMs:15000},gateway:{mode:'fixture',async next({messages}){await appendFile(join(directory,'fixture-requests.txt'),'main\n');return messages.some(m=>m.role==='tool')?{kind:'final',text:'Main consumed the original Child.'}:call('delegate','delegate_child',{methodId:'claim-comparison',question:'Check the original page.',documents});}},durable:{store,runId:'original',grantId:'synthetic-process-proof',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'no-provider',version:'1'},plugins:[],adapters:[childExecutionBinding(selected)]},rootLimits:{model:12,tool:10},onClaim:v=>token=v,onCheckpoint:checkpoint}};
try{if(mode==='start')await submitRun(options);const result=await run(options),history=await inspectChildExecutions({store,parentRunId:'original',...selected});process.send?.({kind:'result',pid:process.pid,result,history});}finally{store.close();}
