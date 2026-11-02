// Pure declaration check: no provider, credentials, database, network or publishing.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function evaluateReleaseQualification(record) {
 const reject=reason=>({policy:'real-ten-min-nine-20261102',eligible:false,reason});
 if(record?.realProviderApplicability==='not-supported')return reject('profile-not-applicable; scope review required, not a live pass');
 const g=record?.normalGate,tasks=g?.tasks,ids=g?.taskIds;
 if(g?.planned!==10||g.requiredSuccesses!==9||g.threshold!==0.9)return reject('requires exactly ten tasks and nine successes');
 if(!Array.isArray(ids)||ids.length!==10||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==10)return reject('ten distinct frozen task identities required');
 if(!Array.isArray(tasks)||tasks.length!==10||tasks.some((t,i)=>t?.id!==ids[i]))return reject('all ten outcomes, including unknowns and not-run, must remain');
 if(!/^[a-f0-9]{64}$/.test(record.executionIdentity??'')||tasks.some(t=>t.executionIdentity!==record.executionIdentity))return reject('execution identity/equivalence mismatch');
 const statuses=new Set(['success','failure','timeout','cancelled','unknown','not-run']);
 if(tasks.some(t=>!statuses.has(t.status)))return reject('unrecognized outcome');
 const attempted=tasks.filter(t=>t.status!=='not-run').length;
 if(g.attempted!==attempted||g.notRun!==10-attempted)return reject('attempted/not-run denominator differs');
 if(attempted!==10)return reject('incomplete ten-task cohort');
 if(tasks.some(t=>t.realProvider!==true||!Number.isSafeInteger(t.physicalRequests)||t.physicalRequests<0||(t.status==='success'&&t.physicalRequests<1)))return reject('real tasks required; requests and tasks are different counts');
 if(tasks.some(t=>t.status!=='success'&&t.eligibleSuccess===true))return reject('failed/unknown outcome cannot become a success');
 const successful=tasks.filter(t=>t.status==='success'&&t.eligibleSuccess===true&&t.runtimeAccepted===true&&t.workflowCompleted===true&&t.deliveryReadback===true&&t.onTime===true&&t.unknownEffects!==true).length;
 if(g.successes!==successful||g.observedRate!==successful/10)return reject('reported successes differ from original eligible outcomes');
 if(successful<9)return reject('fewer than nine of ten successful tasks');
 if(record.separateSafetyGatePassed!==true)return reject('separate required safety gate incomplete');
 return {policy:'real-ten-min-nine-20261102',eligible:true,planned:10,attempted:10,successes:successful,observedRate:successful/10,scope:'declared receipts only; fixed evidence and publication review still required'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==3)throw Error('Usage: node scripts/release-qualification.mjs DECISION.json');const result=evaluateReleaseQualification(JSON.parse(await readFile(process.argv[2],'utf8')));console.log(JSON.stringify(result,null,2));if(!result.eligible)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}
}
