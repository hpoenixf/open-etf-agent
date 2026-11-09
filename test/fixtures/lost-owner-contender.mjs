import {openSession} from "../../src/session.mjs";
import {createSharedAdmission} from "../../src/admission.mjs";
import {join} from "node:path";
process.send({ready:true});
process.once("message",async input=>{
 let session,admission;
 try{Date.now=()=>input.observed;session=await openSession({directory:join(input.directory,"session"),clock:()=>input.time});admission=await createSharedAdmission({directory:join(input.directory,"capacity"),routeId:"test-route",existingOnly:true});const result=admission.recoverExpiredOwner({session,ticketId:input.ticketId,expectedTicketSha256:input.expectedTicketSha256});process.send({ok:true,operationId:result.release.operationId});}
 catch(error){process.send({ok:false,code:error.code??error.message});}
 finally{admission?.close();session?.close();process.disconnect();}
});
