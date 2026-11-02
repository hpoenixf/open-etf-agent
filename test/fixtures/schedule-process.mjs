import { openSession } from '../../src/session.mjs';
import { SCHEDULE_PROFILE } from '../../src/schedule.mjs';
import { scheduleDemoOptions } from '../../src/schedule-demo.mjs';
import { materializeScheduledRun } from '../../src/runtime.mjs';
import { workRun } from '../../src/worker.mjs';
const input=JSON.parse(process.argv[2]);
let store;
try{
 store=await openSession({directory:input.directory,profile:SCHEDULE_PROFILE,...(input.clock===undefined?{}:{clock:()=>input.clock}),readOnly:input.operation==='read'});
 const prior=store.inspectSchedule(input.reference);let result,calls=0;
 if(input.operation==='read')result={occurrence:prior,publication:prior.runId?store.publication(prior.runId):null};
 else{
  const options=await scheduleDemoOptions(store);const next=options.gateway.next;options.gateway.next=async args=>{calls++;return next(args);};
  const occurrence=await materializeScheduledRun(options,input.reference);
  if(input.operation==='work'&&occurrence.state==='materialized')result={occurrence,outcome:await workRun({...options,durable:{...options.durable,runId:occurrence.runId}})};
  else if(input.operation==='cancel')result=store.cancelSchedule(input.reference,{revoke:input.revoke??false});
  else result=occurrence;
 }
 process.stdout.write(JSON.stringify({pid:process.pid,calls,result})+'\n');
}catch(error){process.stderr.write((error.code??'SCHEDULE_PROCESS_FAILED')+'\n');process.exitCode=1;}finally{store?.close();}
