import {open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {writeLocalModelManifest} from '../src/local-model-manifest.mjs';
export async function main(args=process.argv.slice(2)){
 if(args.length!==4||args[0]!=='--config'||args[2]!=='--output')throw Error('Usage: node scripts/prepare-local-model.mjs --config CONFIG.json --output MANIFEST.json');
 const file=await open(args[1],'r');let config;
 try{const stat=await file.stat();if(!stat.isFile()||stat.size>65536)throw Error('MODEL_MANIFEST_INPUT');const bytes=await file.readFile();if(bytes.length>65536)throw Error('MODEL_MANIFEST_INPUT');config=JSON.parse(bytes.toString('utf8'));}finally{await file.close();}
 const keys=['dimensions','maxModelBytes','maxTokens','model','modelDir','prompts','revision'];
 if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!keys.includes(k)))throw Error('MODEL_MANIFEST_INPUT');
 const result=await writeLocalModelManifest({...config,output:args[3]});
 process.stdout.write(JSON.stringify({schemaVersion:'local-model-preparation-result@1',manifestSha256:result.manifestSha256,fileCount:result.fileCount,modelBytes:result.modelBytes,qualification:'byte-inventory-only'})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{process.stderr.write((e.code??e.message)+'\n');process.exitCode=1;});
