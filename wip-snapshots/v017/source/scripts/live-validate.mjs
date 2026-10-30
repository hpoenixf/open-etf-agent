import {resolve} from 'node:path';
import {loadLiveConfig} from '../src/live-config.mjs';
import {runPinnedValidation} from '../src/live-validation.mjs';
import {parseLiveOptions} from '../src/live-options.mjs';
const controller=new AbortController();const cancel=()=>controller.abort();process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
try{
 const options=parseLiveOptions(process.argv.slice(2));
 const configuration=await loadLiveConfig({path:resolve(options.configPath),expected:options.expected,authorization:options.authorization});
 const result=await runPinnedValidation({version:options.version,baselineDirectory:resolve(options.baselineDirectory),configuration,ledgerDirectory:resolve(options.ledgerDirectory),outputRoot:resolve(options.outputRoot),signal:controller.signal});process.stdout.write(JSON.stringify(result,null,2)+'\n');if(result.status!=='completed')process.exitCode=1;
}catch(error){process.stderr.write((typeof error.code==='string'&&/^[A-Z_0-9]+$/.test(error.code)?error.code:'LIVE_VALIDATION_FAILED')+'\n');process.exitCode=2;}
finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
