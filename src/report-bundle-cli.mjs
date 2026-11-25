import {parseArgs} from 'node:util';
import {exportReportBundle,verifyReportBundle} from './report-bundle.mjs';

const usage='Usage: node src/report-bundle-cli.mjs export --project DIR --run ID --out NEW_DIR\n'
  +'       node src/report-bundle-cli.mjs verify --bundle DIR [--expect-manifest SHA256]\n';
const [action,...args]=process.argv.slice(2);
if(action==='--help'&&!args.length)process.stdout.write(usage);
else try{
  const names=action==='export'?['project','run','out']:action==='verify'?['bundle','expect-manifest']:[];
  if(!names.length)throw new Error();
  const {values,tokens}=parseArgs({args,options:Object.fromEntries(names.map(name=>[name,{type:'string'}])),tokens:true});
  if(new Set(tokens.map(token=>token.name)).size!==tokens.length||!tokens.every(token=>token.value))throw new Error();
  if(action==='export'&&!(values.project&&values.run&&values.out)||action==='verify'&&(!values.bundle||
    values['expect-manifest']&&!/^[a-f0-9]{64}$/.test(values['expect-manifest'])))throw new Error();
  const result=await (action==='export'?exportReportBundle({directory:values.out,projectDir:values.project,runId:values.run}):
    verifyReportBundle({directory:values.bundle,expectedManifest:values['expect-manifest']}));
  process.stdout.write(JSON.stringify(result)+'\n');
}catch(error){
  const publicCodes=['EEXIST','ENOENT','PUBLISHED_REPORT_REQUIRED','PROJECT_REPORT_NOT_READY','REPORT_BODY_IDENTITY_UNAVAILABLE',
    'INVALID_BUNDLE_MEMBER','INVALID_BUNDLE_FILES','INVALID_BUNDLE_MANIFEST','MANIFEST_CHECKSUM_MISMATCH','BUNDLE_CHECKSUM_MISMATCH'];
  process.stderr.write((publicCodes.includes(error.code)?error.code:'REPORT_BUNDLE_FAILED')+'\n'+usage);
  process.exitCode=1;
}
