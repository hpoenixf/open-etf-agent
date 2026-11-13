import {pathToFileURL} from 'node:url';
import {readProjectJson} from '../src/research-project.mjs';
import {loadProjectSources} from '../src/project-sources.mjs';
import {evaluateKnowledgeRetrieval} from '../src/knowledge-evaluation.mjs';
export async function main(args=process.argv.slice(2)){
 if(args.length!==8||args[0]!=='--project'||args[2]!=='--manifest'||args[4]!=='--vectors'||args[6]!=='--cases')throw Error('Usage: node scripts/evaluate-knowledge.mjs --project DIR --manifest SHA256 --vectors JSON --cases JSON');
 const sources=await loadProjectSources({projectDir:args[1],manifestSha256:args[3]});
 if(!sources.catalog)throw Error('KNOWLEDGE_TEXT_REQUIRED');
 const result=evaluateKnowledgeRetrieval({catalog:sources.catalog,allowedDocuments:sources.catalog.documents.map(d=>d.id),vectorEvidence:await readProjectJson(args[5],1048576),evaluation:await readProjectJson(args[7],65536)});
 process.stdout.write(JSON.stringify(result)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{process.stderr.write((e.code??e.message)+'\n');process.exitCode=1;});
