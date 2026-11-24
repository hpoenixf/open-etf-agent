import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {acquireWebPage} from '../src/web-transport.mjs';
import {openOwnerWeb} from '../src/gui-owner-web.mjs';
import * as policy from '../src/web-policy.mjs';

const url='https://example.com/a';
test('transport preserves only acquisition-owned timeout, not an external error code',async()=>{
 for(const [reason,code] of [
  [policy.webAcquisitionDeadline?.()??Object.assign(new Error('deadline'),{code:'WEB_TIMEOUT'}),'WEB_TIMEOUT'],
  [Object.assign(new Error('external abort'),{code:'WEB_TIMEOUT',dispatchState:'response-observed',automaticReplayAllowed:false}),'WEB_CANCELLED'],
  [new Error('cancel'),'WEB_CANCELLED'],
 ]){
  await assert.rejects(acquireWebPage({url,allowedUrls:[url],signal:AbortSignal.abort(reason)}),
   {code,requestCount:0,responseCount:0,dispatchState:'not-dispatched',automaticReplayAllowed:false});
 }
});
test('web owner exposes only a settled timeout as unavailable; unknown timeout and cancellation stay failed',async t=>{
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/deadline-'));t.after(()=>rm(projectDir,{recursive:true,force:true}));
 for(const [key,code,known,count,exposes,replay=false] of [
  ['known','WEB_TIMEOUT',true,0,true],['unknown','WEB_TIMEOUT',true,1,false],
  ['unproved','WEB_TIMEOUT',false,null,false],['replay','WEB_TIMEOUT',true,0,false,true],['cancel','WEB_CANCELLED',true,0,false],
 ]){
  const [read]=openOwnerWeb({profile:{web:true},runId:key,projectDir,transport:{async acquire(){throw Object.assign(new Error(code),{code});},async inspect(){return {status:'failed',code,dispatchOutcomeKnown:known,unknownRequests:count,plan:{urls:[url]},automaticReplayAllowed:replay};}}});
  const call={callId:key};
  if(exposes){const v=await read.execute({url},call);assert.equal(v.reason,code);assert.equal(v.requestOutcome,'no-unobserved-dispatch');assert.equal(v.automaticReplayAllowed,false);assert.deepEqual(await read.reconcile({url},call),v);}
  else{await assert.rejects(read.execute({url},call),{code});assert.equal(await read.reconcile({url},call),null);}
 }
});
