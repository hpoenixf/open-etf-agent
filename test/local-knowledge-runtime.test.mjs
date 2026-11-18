import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {sha256} from '../src/source.mjs';
import {createProjectLocalEmbedding} from '../src/local-knowledge-runtime.mjs';
test('selected local runtime binds exact manifest bytes, model shape and fixed worker without starting encoding',async t=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/local-knowledge-runtime-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'model'));const bytes=Buffer.from(JSON.stringify({schemaVersion:'local-embedding-model@1',model:'test-local',dimensions:2,maxTokens:8}));const manifestFile=join(root,'manifest.json');await writeFile(manifestFile,bytes);const profile={model:'test-local',manifestSha256:sha256(bytes),dimensions:2,maxTokens:8};const mapping={schemaVersion:'local-embedding-runtime@1',python:process.execPath,modelDirectory:join(root,'model'),manifestFile};
 const backend=await createProjectLocalEmbedding({mapping,profile,timeoutMs:1000});t.after(()=>backend.close());assert.deepEqual(backend.identity,{model:profile.model,manifestSha256:profile.manifestSha256});assert.equal(backend.maxTokens,8);
 for(const bad of [{...mapping,python:'relative'},{...mapping,extra:true}])await assert.rejects(createProjectLocalEmbedding({mapping:bad,profile,timeoutMs:1000}),{code:'KNOWLEDGE_QUERY_RUNTIME_CONFIG'});
 await assert.rejects(createProjectLocalEmbedding({mapping,profile:{...profile,model:'different'},timeoutMs:1000}),{code:'KNOWLEDGE_QUERY_MODEL_CHANGED'});
 await writeFile(manifestFile,Buffer.concat([bytes,Buffer.from('\n')]));await assert.rejects(createProjectLocalEmbedding({mapping,profile,timeoutMs:1000}),{code:'KNOWLEDGE_QUERY_MODEL_CHANGED'});
});
