import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {acquireKnowledgeVectors} from '../../src/knowledge-acquisition.mjs';
const [projectDir,manifestSha256]=process.argv.slice(2),original=fs.link;
fs.link=async(source,destination)=>{if(destination.endsWith('/terminal.json')&&destination.includes('/crash-fork/')){process.send?.({phase:'before-terminal'});await new Promise(()=>{});}return original(source,destination);};syncBuiltinESMExports();
const backend={identity:{model:'synthetic',manifestSha256:'a'.repeat(64)},maxTokens:8,tokenize:async()=>({tokenIds:[1],truncated:false}),encodeDocument:async()=>{throw Error('MUST_NOT_ENCODE_DOCUMENT');},encodeQuery:async r=>({vector:[0,1],truncated:false,tokenIdsSha256:r.tokenIdsSha256})};
await acquireKnowledgeVectors({projectDir,manifestSha256,acquisitionId:'crash-fork',reuseAcquisitionId:'base',provider:{id:'synthetic',model:'test',revision:'1'},dimensions:2,queries:['crash query'],backend,approveSelectedText:true});
