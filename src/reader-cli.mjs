import {startReader} from './reader.mjs';
import {openSession} from './session.mjs';
import {DOCUMENT_REVOCATION_PROFILE} from './source.mjs';
let reader,store;const controller=new AbortController();const stop=()=>controller.abort();process.on('SIGINT',stop);process.on('SIGTERM',stop);
try{
 const options={};const args=process.argv.slice(2);for(let i=0;i<args.length;i++){const flag=args[i];if(!['--run','--port','--session','--run-id','--profile'].includes(flag)||Object.hasOwn(options,flag)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Arguments');options[flag]=args[++i];}
 if(!options['--run'])throw new Error('Run required');
 const protectedMode=['--session','--run-id','--profile'].some(k=>Object.hasOwn(options,k));
 if(protectedMode&&(!options['--session']||!options['--run-id']||options['--profile']!==DOCUMENT_REVOCATION_PROFILE))throw new Error('Protected profile required');
 const port=options['--port']===undefined?0:Number(options['--port']);
 if(protectedMode)store=await openSession({directory:options['--session'],profile:DOCUMENT_REVOCATION_PROFILE,readOnly:true});
 reader=await startReader({directory:options['--run'],port,...(protectedMode?{protectedContext:{store,runId:options['--run-id']}}:{})});
 process.stdout.write(JSON.stringify({origin:reader.origin,readOnly:true,scope:'loopback only',modelCalls:0})+'\n');if(!controller.signal.aborted)await new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true}));
}catch{process.stderr.write('READER_START_FAILED\n');process.exitCode=1;}
finally{try{await reader?.close();}finally{store?.close();process.off('SIGINT',stop);process.off('SIGTERM',stop);}}
