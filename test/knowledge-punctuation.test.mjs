import test from 'node:test';import assert from 'node:assert/strict';import {createKnowledgeIndex,queryKnowledge} from '../src/knowledge.mjs';
function index(){return createKnowledgeIndex({catalog:{schemaVersion:'document-catalog@1',id:'punctuation',documents:[{id:'bond',name:'Bonds',version:'1',pages:["U.S. bonds; fund's duration. ".repeat(25)]},{id:'equity',name:'Equity',version:'1',pages:['VOO tracks S&P 500. NAV return 24.98%.']},{id:'symbol',name:'Symbols',version:'1',pages:['S means sulfur. A is the share class. 中文支持离线编辑。']}]},allowedDocuments:['bond','equity','symbol']});}
for(const query of ['VOO S&P500 NAV return','VOO S&P 500 NAV return','根据报告，VOO 的一年 NAV 回报与 S&P 500 有什么差别？'])test('compound query avoids unrelated singleton fragments: '+query,()=>{assert.equal(queryKnowledge(index(),{query,limit:1}).sources[0].documentId,'equity');});
test('standalone letters remain searchable without matching punctuation fragments',()=>{for(const q of ['S','A','Ｓ'])assert.equal(queryKnowledge(index(),{query:q,limit:1}).sources[0].documentId,'symbol');});
test('compound and meaningful constituent queries remain available',()=>{for(const q of ['U.S.','fund',"fund's",'fund’s'])assert.equal(queryKnowledge(index(),{query:q,limit:1}).sources[0].documentId,'bond');assert.equal(queryKnowledge(index(),{query:'离线编辑',limit:1}).sources[0].documentId,'symbol');});

test("compact index spelling S&P500 matches spaced S&P 500 without singleton pollution",()=>{const r=queryKnowledge(index(),{query:"S&P500",limit:1});assert.equal(r.sources[0].documentId,"equity");assert.equal(r.hits[0].score,2);});

test('compound punctuation never consumes adjacent Han runs',()=>{
 for(const text of ['U.S.国债收益率','1.国债收益率','S&P国债收益率','ETF国债收益率']){
  const index=createKnowledgeIndex({catalog:{schemaVersion:'document-catalog@1',id:'mixed',documents:[{id:'one',name:'mixed',version:'1',pages:[text]}]},allowedDocuments:['one']});
  for(const query of ['国债','收益率'])assert.equal(queryKnowledge(index,{query}).sources.length,1,`${text}: ${query}`);
  if(text.startsWith('U.S.'))assert.equal(queryKnowledge(index,{query:'U.S.'}).sources.length,1);
  if(text.startsWith('S&P'))assert.equal(queryKnowledge(index,{query:'S&P'}).sources.length,1);
 }
});
