import {open,constants} from 'node:fs/promises';
import {isAbsolute,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {safeDirectory} from './storage-files.mjs';
import {sha256} from './source.mjs';
import {createLocalEmbeddingBackend} from './local-embedding-process.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
// Trusted per-work executable selection, not task data or a generic transport.
// Construction is lazy: no process starts until an already reserved local stage.
export async function createProjectLocalEmbedding({mapping,profile,timeoutMs}){
 if(!mapping||Object.keys(mapping).sort().join(',')!=='manifestFile,modelDirectory,python,schemaVersion'||mapping.schemaVersion!=='local-embedding-runtime@1'||!['python','modelDirectory','manifestFile'].every(k=>typeof mapping[k]==='string'&&isAbsolute(mapping[k])))fail('KNOWLEDGE_QUERY_RUNTIME_CONFIG');
 const modelDir=await safeDirectory(mapping.modelDirectory);await safeDirectory(dirname(mapping.manifestFile));
 const handle=await open(mapping.manifestFile,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);let bytes;
 try{const s=await handle.stat();if(!s.isFile()||s.size>1048576)fail('KNOWLEDGE_QUERY_RUNTIME_CONFIG');bytes=await handle.readFile();if(bytes.length>1048576)fail('KNOWLEDGE_QUERY_RUNTIME_CONFIG');}finally{await handle.close();}
 if(sha256(bytes)!==profile.manifestSha256)fail('KNOWLEDGE_QUERY_MODEL_CHANGED');
 let manifest;try{manifest=JSON.parse(bytes);}catch{fail('KNOWLEDGE_QUERY_MODEL_CHANGED');}
 if(manifest.schemaVersion!=='local-embedding-model@1'||manifest.model!==profile.model||manifest.dimensions!==profile.dimensions||manifest.maxTokens!==profile.maxTokens)fail('KNOWLEDGE_QUERY_MODEL_CHANGED');
 return createLocalEmbeddingBackend({command:mapping.python,args:[fileURLToPath(new URL('../scripts/local-embedding-worker.py',import.meta.url)),'--model-dir',modelDir,'--manifest',mapping.manifestFile,'--manifest-sha256',profile.manifestSha256],identity:{model:profile.model,manifestSha256:profile.manifestSha256},maxTokens:profile.maxTokens,timeoutMs});
}
