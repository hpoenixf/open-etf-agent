import {open,constants} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sha256} from '../src/source.mjs';
import {safeDirectory} from '../src/storage-files.mjs';
import {loadProjectSources} from '../src/project-sources.mjs';
import {acquireKnowledgeVectors,inspectKnowledgeAcquisition} from '../src/knowledge-acquisition.mjs';
import {createLocalEmbeddingBackend} from '../src/local-embedding-process.mjs';
import {createKnowledgeIndex,queryKnowledge} from '../src/knowledge.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const schemas={prepare:['project','manifest','acquisition','model-dir','model-manifest','model-sha','python','queries','approve-selected-text','reuse?','timeout-ms?'],inspect:['project','acquisition'],query:['project','manifest','acquisition','query'],export:['project','acquisition','output']};
function parse(args){const [command,...rest]=args,fields=schemas[command];if(!fields)fail('PREPARED_KNOWLEDGE_USAGE');const allowed=new Set(fields.map(s=>s.replace(/\?$/,''))),options={};for(let i=0;i<rest.length;i++){const token=rest[i];if(!token.startsWith('--'))fail('PREPARED_KNOWLEDGE_USAGE');const name=token.slice(2);if(!allowed.has(name)||Object.hasOwn(options,name))fail('PREPARED_KNOWLEDGE_USAGE');if(name==='approve-selected-text')options[name]=true;else{const value=rest[++i];if(!value||value.startsWith('--'))fail('PREPARED_KNOWLEDGE_USAGE');options[name]=value;}}if(fields.filter(s=>!s.endsWith('?')).some(s=>!Object.hasOwn(options,s)))fail('PREPARED_KNOWLEDGE_USAGE');return{command,options};}
async function bytes(path,max){const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await file.stat();if(!stat.isFile()||stat.size>max)fail('PREPARED_KNOWLEDGE_INPUT_LIMIT');const b=await file.readFile();if(b.length>max)fail('PREPARED_KNOWLEDGE_INPUT_LIMIT');return b;}finally{await file.close();}}
const json=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
/** Dependency injection is for trusted in-process tests only; CLI has no backend
 * override flag or synthetic fallback. Real preparation always uses the local worker.
 */
export async function main(args=process.argv.slice(2),{backendFactory=createLocalEmbeddingBackend,write=s=>process.stdout.write(s)}={}){
 const {command,options:o}=parse(args),projectDir=await safeDirectory(o.project);let output;
 if(command==='prepare'){
  if(!/^[a-f0-9]{64}$/.test(o['model-sha'])||!isAbsolute(o.python))fail('PREPARED_KNOWLEDGE_INPUT');
  const modelDir=await safeDirectory(o['model-dir']),raw=await bytes(o['model-manifest'],1048576);if(sha256(raw)!==o['model-sha'])fail('LOCAL_MODEL_MANIFEST_CHANGED');const model=json(raw);
  if(model?.schemaVersion!=='local-embedding-model@1'||typeof model.model!=='string'||!model.model||!Number.isSafeInteger(model.dimensions)||model.dimensions<1||model.dimensions>1024||!Number.isSafeInteger(model.maxTokens)||model.maxTokens<1||model.maxTokens>1048576)fail('PREPARED_KNOWLEDGE_MODEL');
  const timeoutMs=o['timeout-ms']===undefined?30000:Number(o['timeout-ms']);if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)fail('PREPARED_KNOWLEDGE_INPUT');
  const queries=json(await bytes(o.queries,16384));
  const backend=backendFactory({command:o.python,args:[fileURLToPath(new URL('./local-embedding-worker.py',import.meta.url)),'--model-dir',modelDir,'--manifest',o['model-manifest'],'--manifest-sha256',o['model-sha']],identity:{model:model.model,manifestSha256:o['model-sha']},maxTokens:model.maxTokens,timeoutMs});
  try{const r=await acquireKnowledgeVectors({projectDir,manifestSha256:o.manifest,acquisitionId:o.acquisition,provider:{id:'local-sentence-transformers',model:model.model,revision:o['model-sha']},dimensions:model.dimensions,queries,backend,approveSelectedText:true,timeoutMs,...(o.reuse?{reuseAcquisitionId:o.reuse}:{})});output={status:'succeeded',acquisitionId:r.acquisitionId,manifestSha256:r.manifestSha256,vectorEvidenceSha256:r.vectorEvidenceSha256};}finally{backend.close();}
 }else{
  const saved=await inspectKnowledgeAcquisition({projectDir,acquisitionId:o.acquisition});
  if(command==='inspect'){const {vectorEvidence,...summary}=saved;output=summary;}
  else{
   if(saved.status!=='succeeded')fail('KNOWLEDGE_PREPARATION_INCOMPLETE');
   if(command==='export'){
    const file=await open(o.output,'wx',0o600);try{await file.writeFile(JSON.stringify(saved.vectorEvidence)+'\n');await file.sync();}finally{await file.close();}output={status:'exported',vectorEvidenceSha256:saved.evidenceSha256};
   }else{
    if(saved.manifestSha256!==o.manifest)fail('KNOWLEDGE_PREPARATION_SOURCE_MISMATCH');
    const query=new TextDecoder('utf-8',{fatal:true}).decode(await bytes(o.query,512));
    const {catalog}=await loadProjectSources({projectDir,manifestSha256:o.manifest});
    const index=createKnowledgeIndex({catalog,allowedDocuments:catalog.documents.map(d=>d.id),config:{algorithm:'hybrid'},vectorEvidence:saved.vectorEvidence});
    output={schemaVersion:'prepared-knowledge-query@1',manifestSha256:o.manifest,acquisitionId:o.acquisition,result:queryKnowledge(index,{query})};
   }
  }
 }
 write(JSON.stringify(output)+'\n');return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{process.stderr.write((e.code??e.message)+'\n');process.exitCode=1;});
