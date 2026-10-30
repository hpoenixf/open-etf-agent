import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {loadLiveConfig} from '../src/live-config.mjs';
const fakeKey='synthetic-key-not-a-real-credential';
const baseUrl='https://provider.example.invalid/v1',model='synthetic-model';
const authorization={providerApproved:true,syntheticDataApproved:true,costApproved:true,maxTotalCny:100000};
const expected={baseUrl,model};
async function fixture(text=`CHAT_BASE_URL=${baseUrl}\nCHAT_API_KEY=${fakeKey}\nCHAT_MODEL=${model}\n`,mode=0o600){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/fake-config-'));const path=join(directory,'synthetic.env');await writeFile(path,text,{mode});return{directory,path};}
test('5.8 missing trusted grant blocks before any configuration file read',async()=>{await assert.rejects(loadLiveConfig({path:'test-output/absent-not-real.env',expected}),/LIVE_BLOCKED/);});
test('5.8 valid synthetic config matches reviewed scope without serializing credential',async()=>{const{path}=await fixture();const config=await loadLiveConfig({path,expected,authorization});assert.equal(config.endpoint,baseUrl+'/chat/completions');assert.equal(config.model,model);assert.equal(config.apiKey,fakeKey);assert.doesNotMatch(JSON.stringify(config),/synthetic-key-not-a-real-credential/);});
test('5.8 unknown or duplicate assignments are rejected without echoing values',async()=>{for(const extra of [`DATABASE_URL=${fakeKey}\n`,`CHAT_API_KEY=other-synthetic-value\n`]){const{path}=await fixture(`CHAT_BASE_URL=${baseUrl}\nCHAT_API_KEY=${fakeKey}\nCHAT_MODEL=${model}\n`+extra);await assert.rejects(loadLiveConfig({path,expected,authorization}),error=>{assert.doesNotMatch(error.message,/synthetic-key-not-a-real-credential|other-synthetic-value/);return /CONFIG/.test(error.message);});}});
test('5.8 unsafe file permissions and static symlink refuse before use',async()=>{const wide=await fixture(undefined,0o644);await assert.rejects(loadLiveConfig({...wide,expected,authorization}),/CONFIG/);const actual=await fixture();const path=join(actual.directory,'alias.env');await symlink(actual.path,path);await assert.rejects(loadLiveConfig({path,expected,authorization}),/CONFIG/);});
test('5.8 changed endpoint or model cannot expand the trusted provider scope',async()=>{for(const text of [`CHAT_BASE_URL=https://other.example.invalid/v1\nCHAT_API_KEY=${fakeKey}\nCHAT_MODEL=${model}\n`,`CHAT_BASE_URL=${baseUrl}\nCHAT_API_KEY=${fakeKey}\nCHAT_MODEL=unapproved-model\n`]){const{path}=await fixture(text);await assert.rejects(loadLiveConfig({path,expected,authorization}),/CONFIG_SCOPE/);}});
test('5.8 incomplete and oversized synthetic configuration cannot become live authority',async()=>{for(const text of [`CHAT_BASE_URL=${baseUrl}\nCHAT_MODEL=${model}\n`,'x'.repeat(9000)]){const{path}=await fixture(text);await assert.rejects(loadLiveConfig({path,expected,authorization}),/CONFIG/);}});
