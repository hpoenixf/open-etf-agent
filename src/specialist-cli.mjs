import {resolve} from 'node:path';
import {runSpecialistDemo,readSpecialistRun} from './specialist-demo.mjs';
try{
 const [action,...rest]=process.argv.slice(2);if(!['run','read','resume'].includes(action))throw new Error('INVALID_ARGUMENT');
 const options={},seen=new Set();for(let i=0;i<rest.length;i+=2){const key=rest[i],value=rest[i+1];if(!['--session','--run'].includes(key)||seen.has(key)||!value||value.startsWith('--')||value.includes('\0'))throw new Error('INVALID_ARGUMENT');seen.add(key);options[key.slice(2)]=value;}
 if(!options.session||(action==='run'?options.run!==undefined:!options.run))throw new Error('INVALID_ARGUMENT');
 const controller=new AbortController();const stop=()=>controller.abort();process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{const result=action==='read'?await readSpecialistRun({directory:resolve(options.session),runId:options.run}):await runSpecialistDemo({directory:resolve(options.session),runId:options.run,signal:controller.signal});process.stdout.write(JSON.stringify(result,null,2)+'\n');if(action!=='read'&&result.status!=='completed')process.exitCode=1;}
 finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}catch(error){process.stderr.write((error.code||error.message||'SPECIALIST_COMMAND_FAILED')+'\n');process.exitCode=2;}
