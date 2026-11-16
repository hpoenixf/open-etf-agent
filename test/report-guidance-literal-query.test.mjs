import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {REPORT_GUIDANCE_PROFILE,reportGuidanceFor} from '../src/report-guidance.mjs';

test('historical v3 guidance stays byte-for-byte stable',()=>{
 assert.equal(createHash('sha256').update(reportGuidanceFor({reportGuidance:'source-faithful-report@3'})).digest('hex'),'ce3c0ec4ff5288b5f99a30b27ba37e57714b47602ade9a32dcc2ae0df1f3d1d5');
});
test('historical v4 guidance stays byte-for-byte stable',()=>{
 assert.equal(createHash('sha256').update(reportGuidanceFor({reportGuidance:'source-faithful-report@4'})).digest('hex'),'e40f58f1498a4294d65ce6c7509a1fa14c601825c3cd12a44686f8475281d42d');
});

test('new task guidance treats a requested query as literal data and preserves exclusive scope',()=>{
 assert.equal(REPORT_GUIDANCE_PROFILE,'source-faithful-report@5');
 const text=reportGuidanceFor({reportGuidance:REPORT_GUIDANCE_PROFILE});
 assert.match(text,/Query <text>/);
 assert.match(text,/copy <text> exactly/);
 assert.match(text,/not a topic to summarize/);
 assert.match(text,/only.*excludes alternatives within its stated scope/);
 assert.match(text,/requested output format/);
 assert.match(text,/not a claim of Host semantic verification/);
 assert.doesNotMatch(text,/previously downloaded notes|imported documents|offline viewing|B0[1-9]|B10/);
 assert.ok(Buffer.byteLength(text)<=Buffer.byteLength(reportGuidanceFor({reportGuidance:'source-faithful-report@2'})));
});
