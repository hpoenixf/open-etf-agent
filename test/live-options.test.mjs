import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLiveOptions} from '../src/live-options.mjs';
const args=['--version','v01','--baseline','baseline','--config','operator.env','--ledger','ledger','--output','output','--base-url','https://provider.example.invalid/v1','--model','synthetic-model','--max-total-cny','800','--confirm-provider','--confirm-synthetic-data','--confirm-cost'];
test('5.9 portable CLI refuses absent cost grant before reading any configuration',()=>{assert.throws(()=>parseLiveOptions(args.filter(a=>a!=='--confirm-cost')),/LIVE_ARGUMENTS/);});
test('5.9 portable CLI uses explicit operator budget and paths, never the historical grant',()=>{const options=parseLiveOptions(args);assert.equal(options.authorization.maxTotalCny,800);assert.equal(options.version,'v01');assert.equal(options.baselineDirectory,'baseline');assert.equal(options.configPath,'operator.env');assert.equal(options.authorization.costApproved,true);});
test('5.9 portable CLI refuses duplicate flags, unknown version and missing baseline',()=>{assert.throws(()=>parseLiveOptions([...args,'--confirm-cost']),/LIVE_ARGUMENTS/);assert.throws(()=>parseLiveOptions(args.map(a=>a==='v01'?'v06':a)),/LIVE_ARGUMENTS/);assert.throws(()=>parseLiveOptions(args.filter((a,i)=>i!==2&&i!==3)),/LIVE_ARGUMENTS/);});
