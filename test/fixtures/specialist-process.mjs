import {appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {runSpecialistDemo,readSpecialistRun} from '../../src/specialist-demo.mjs';
const [directory,mode,runId]=process.argv.slice(2);
if(['kill-before-parent-commit','resume-before-parent-commit'].includes(mode)){
 const {run}=await import('../../src/runtime.mjs');const {openSession}=await import('../../src/session.mjs');const {createSpecialistChildBinding,sourceCheckBinding}=await import('../../src/specialist-child.mjs');
 const store=await openSession({directory});let token;const question='Synthetic reconcile original child.',documents=['atlas-a'];
 const record=role=>appendFile(join(directory,'request-counts.safe.jsonl'),JSON.stringify({role,pid:process.pid})+'\n');
 const childGateway=()=>({mode:'fixture',async next({messages}){await record('child');return messages.some(m=>m.role==='tool')?{kind:'final',text:'Derived original one-page finding.'}:{kind:'calls',calls:[{id:'read-original',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};}});
 const adapter=createSpecialistChildBinding({store,parentClaim:()=>token,parentRunId:runId||undefined,outputRoot:join(directory,'runs'),question,documents,gatewayFactory:childGateway});const execute=adapter.execute;
 adapter.execute=async(...args)=>{const result=await execute(...args);if(mode==='kill-before-parent-commit'){process.send?.({kind:'checkpoint',runId:token.runId});await new Promise(()=>{});}return result;};
 try{const result=await run({question,gateway:{mode:'fixture',async next({messages}){await record('main');return messages.some(m=>m.role==='tool')?{kind:'final',text:'Consumed original settled Child.'}:{kind:'calls',calls:[{id:'delegate',name:'source_check',arguments:{question:'Check page one.'}}]};}},extensions:[adapter],outputRoot:join(directory,'runs'),allowedTools:['read_page','source_check'],allowedDocuments:documents,requireReport:false,limits:{maxRounds:4,maxTools:2,timeoutMs:30000},durable:{store,runId:runId||undefined,grantId:'synthetic-reconcile',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'reconcile',version:'1'},plugins:[],adapters:[sourceCheckBinding({question,documents})]},rootLimits:{model:8,tool:6},onClaim:value=>token=value}});process.stdout.write(JSON.stringify(result)+'\n');}finally{store.close();}
}
else if(mode==='read'){process.stdout.write(JSON.stringify(await readSpecialistRun({directory,runId}))+'\n');}
else{
 const result=await runSpecialistDemo({directory,runId:runId||undefined,onRequest:async role=>{await appendFile(join(directory,'request-counts.safe.jsonl'),JSON.stringify({role,pid:process.pid})+'\n');},onCheckpoint:mode==='kill-after-child'?async point=>{if(point.phase==='result-committed'&&point.callId==='one-source-check'){process.send?.({kind:'checkpoint',runId:point.runId});await new Promise(()=>{});}}:undefined});
 process.send?.({kind:'outcome',result});process.stdout.write(JSON.stringify(result)+'\n');
}
