import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectScheduledTask,listScheduledTasks,runDueScheduledTasks} from '../../../../src/scheduled-tasks.mjs';
import {readResearchReport} from '../../../../src/research-project.mjs';
import {openArtifactStore} from '../../../../src/artifacts.mjs';
import {startReader} from '../../../../src/reader.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const [operation,projectDir,runId]=process.argv.slice(2);
if(operation==='inspect')console.log(JSON.stringify(await inspectScheduledTask({projectDir,runId})));
else if(operation==='list')console.log(JSON.stringify(await listScheduledTasks({projectDir})));
else if(operation==='sweep')console.log(JSON.stringify(await runDueScheduledTasks({projectDir})));
else if(operation==='http'){
 const report=await readResearchReport({projectDir,runId}),reader=await startReader({directory:report.directory,port:0});
 try{const artifacts=await openArtifactStore({directory:report.directory,readOnly:true});const original=await artifacts.read(report.revision.reportId);assert.equal(hash(original.bytes),original.sha256);assert.equal(original.sha256,report.report.sha256);assert.equal(original.bytes.length,report.report.bytes);assert.match(reader.origin,/^http:\/\/127\.0\.0\.1:\d+$/);const checks=[];const paths=[['/artifacts/'+report.revision.reportId,original.bytes],['/revisions/'+report.receipt.revisionId,Buffer.from(JSON.stringify(report.revision)+'\n')],...report.revision.sources.map((s,i)=>['/sources/'+report.receipt.revisionId+'/'+i,Buffer.from(s.text)])];for(const[path,expected]of paths){const response=await fetch(reader.origin+path,{redirect:'error',signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,expected);checks.push({path,basis:path.startsWith('/artifacts/')?'original-artifact-store-bytes':path.startsWith('/revisions/')?'original-reader-defined-json-serialization':'registered-original-source-text-bytes',status:200,bytes:bytes.length,sha256:hash(bytes)});}console.log(JSON.stringify({runId,checks,report}));}finally{await reader.close();}
}else throw new Error('COLD_OPERATION');
