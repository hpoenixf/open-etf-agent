import test from 'node:test';
import assert from 'node:assert/strict';
import {projectProposalTrace} from '../src/live-trace.mjs';
const scope={allowedTools:['calculate_change','save_report'],allowedSourceIds:['atlas-a@A-2026-01:p1'],allowedDocuments:['atlas-a','atlas-b']};
test('5.9 proposal diagnostics never retain arbitrary text, headers or credential-shaped payloads',()=>{
 const secret='SYNTHETIC_PRIVATE_VALUE_DO_NOT_LOG';const proposal={kind:'calls',calls:[{id:secret,name:'save_report',arguments:{text:secret,sourceIds:[secret],headers:{authorization:secret},apiKey:secret}}],usage:{headers:{authorization:secret}}};const trace=projectProposalTrace(proposal,scope);assert.doesNotMatch(JSON.stringify(trace),/SYNTHETIC_PRIVATE_VALUE_DO_NOT_LOG|authorization|apiKey|headers/);assert.equal(trace.calls[0].name,'save_report');assert.equal(trace.calls[0].facts.extraFieldCount,2);assert.equal(trace.calls[0].facts.unknownSourceCount,1);
});
test('5.9 safe calculation facts distinguish missing fields and exact unit predicate failure',()=>{
 const call=arguments_=>({kind:'calls',calls:[{id:'synthetic',name:'calculate_change',arguments:arguments_}]});
 const missing=projectProposalTrace(call({baseline:120,current:300,unit:'rows/export'}),scope).calls[0].facts;assert.deepEqual(missing?.missingFields,['baselineUnit','currentUnit']);assert.equal(missing.extraFieldCount,1);
 const mismatch=projectProposalTrace(call({baseline:120,current:300,baselineUnit:'rows',currentUnit:'exports'}),scope).calls[0].facts;assert.equal(mismatch?.unitsEqual,false);assert.equal(mismatch.baselineUnitPatternValid,true);assert.equal(mismatch.numericFinite,true);assert.equal(mismatch.zeroBaseline,false);assert.equal(mismatch.arithmeticFinite,true);
});

test('5.9 unsupported names and nonnumeric JSON arguments remain safe diagnostic facts',()=>{
 assert.equal(projectProposalTrace({kind:'calls',calls:[{id:'synthetic',name:'__proto__',arguments:{}}]},scope).calls[0].name,'unsupported-tool');const trace=projectProposalTrace({kind:'calls',calls:[{id:'synthetic',name:'calculate_change',arguments:{baseline:{toString:null,valueOf:null},current:300,baselineUnit:'rows',currentUnit:'rows'}}]},scope);assert.equal(trace.calls[0].facts.numericFinite,false);assert.equal(trace.calls[0].facts.arithmeticFinite,false);
});
