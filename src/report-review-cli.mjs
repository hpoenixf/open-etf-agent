import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareReportReview,submitReportReview,executeReportReview,readReportReview,cancelReportReview,createReviewFixtureGateway} from './report-review.mjs';
try {
 const [action,...args]=process.argv.slice(2),options={};
 if(!['prepare','run','read','cancel'].includes(action))throw Error('INVALID_REVIEW_ARGUMENTS');
 for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!['--session','--run','--source','--revision','--request','--gateway-module'].includes(key)||Object.hasOwn(options,key)||!value||value.startsWith('--')||/[\u0000-\u001f]/.test(value))throw Error('INVALID_REVIEW_ARGUMENTS');options[key]=value;}
 const keys=Object.keys(options).filter(k=>k!=='--gateway-module').sort().join(',');
 const expected=action==='prepare'?['--request','--revision','--session','--source']:['--run','--session'];
 if(options['--gateway-module']&&!['prepare','run'].includes(action)||keys!==expected.sort().join(','))throw Error('INVALID_REVIEW_ARGUMENTS');
 const directory=resolve(options['--session']),runId=options['--run'];let result;
 // Explicit Host-owned executable configuration, never a model-selected module.
 const provider=options['--gateway-module']?await import(pathToFileURL(resolve(options['--gateway-module'])).href):null;
 if(provider&&(!provider.gatewayBinding||typeof provider.createGateway!=='function'))throw Error('INVALID_REVIEW_GATEWAY_MODULE');
 if(action==='prepare'){const request=await prepareReportReview({sourceDirectory:resolve(options['--source']),revisionId:options['--revision'],requestId:options['--request']});result=await submitReportReview({directory,request,...(provider?{gatewayBinding:provider.gatewayBinding}:{})});}
 else if(action==='read')result=await readReportReview({directory,runId});
 else if(action==='cancel')result=await cancelReportReview({directory,runId});
 else {
  const controller=new AbortController(),stop=()=>controller.abort();process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try {
   result=await executeReportReview({directory,runId,...(provider?{gatewayFactory:provider.createGateway,gatewayBinding:provider.gatewayBinding}:{gateway:createReviewFixtureGateway()}),signal:controller.signal});
  } finally {process.off('SIGINT',stop);process.off('SIGTERM',stop);}
 }
 process.stdout.write(JSON.stringify(result,null,2)+'\n');if(action==='run'&&result.status!=='completed')process.exitCode=1;
}catch(error){process.stderr.write((error.code??error.message??'REVIEW_COMMAND_FAILED')+'\n');process.exitCode=2;}
