import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {ownerToolCatalog} from '../src/gui-tool-catalog.mjs';

const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',
 model:'fixture',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4}};
const env={ETF_GUI_PROVIDER_KEY:'synthetic-model'};

test('catalog describes only configured public-facing capabilities and separates scheduled prompts',()=>{
 const narrow=ownerToolCatalog({connectivity:{},chartAvailable:true});
 assert.deepEqual(narrow.skills.map(x=>x.id),['auto','market-hotspot-analysis','long-horizon-analysis','financial-chart@1']);
 assert.deepEqual(narrow.tools.map(x=>x.label),['PDF 附件阅读']);
 assert.match(narrow.skills.at(-1).label,/用户提供/);
 const broad=ownerToolCatalog({connectivity:{web:true,linkedPdf:true,search:'exa-public-preview',searchAlternates:['deepseek-search','yuanbao-search'],wind:true},
  chartAvailable:true,chartAuto:true,dailyBrief:true});
 assert.deepEqual(broad.tools.map(x=>x.label),['PDF 附件阅读','公开网页阅读','公开 PDF 链接阅读','公开网页搜索 · Exa 预览',
  '公开网页搜索 · DeepSeek','公开网页搜索 · 腾讯元宝','Wind 基金日收盘价','每日跟踪简报']);
 assert.match(broad.tools.find(x=>x.label.endsWith('DeepSeek')).note,/可能计费/);
 assert.equal(broad.skills.some(x=>x.id==='daily-watch-brief'),false);
});

test('both manually selected Skills reach the model, automatic advertises the existing method tool, and an exact replay never works again',async t=>{
 const projectDir=await mkdtemp(resolve('.catalog-test-'));
 const sent=[];
 const gui=await startLocalGui({projectDir,liveConfig,env,fetchImpl:async(_endpoint,init)=>{
  const wire=JSON.parse(init.body);
  sent.push({text:JSON.stringify(wire.messages),tools:wire.tools?.map(x=>x.function.name)??[]});
  return Response.json({choices:[{message:{role:'assistant',content:'Answer.'},finish_reason:'stop'}]});
 }});
 t.after(async()=>{await gui.close();await rm(projectDir,{recursive:true,force:true});});
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const workspace=await get('/api/workspace');
 assert.deepEqual(workspace.toolCatalog.tools.map(x=>x.label),['PDF 附件阅读']);
 assert.doesNotMatch(JSON.stringify(workspace.toolCatalog),/synthetic-model|secret|https:\/\//);
 const conv=(await post('/api/conversations',{}).then(r=>r.json())).id;
 const path='/api/conversations/'+conv;
 for(const invalid of ['daily-watch-brief','public_web_search','invented-skill']){
  const r=await post(path+'/messages',{messageId:'bad-skill',question:'question',skillId:invalid});
  assert.equal(r.status,400);
  assert.equal((await r.json()).error,'GUI_RESEARCH_SKILL_UNAVAILABLE');
 }
 for(const [i,skillId] of ['market-hotspot-analysis','long-horizon-analysis','auto',undefined].entries()){
  const messageId='skill-'+i;
  const input={messageId,question:'Explain '+messageId,researchDepth:'standard',...(skillId?{skillId}:{})};
  assert.equal((await post(path+'/messages',input)).status,202);
  const complete=async()=>{
   for(let n=0;n<100;n++){
    const turn=(await get(path)).messages.find(x=>x.id===messageId);
    if(turn?.status==='completed'&&!turn.working)return true;
    if(turn?.status==='failed')throw Error(turn.code);
    await delay(20);
   }
   return false;
  };
  assert.ok(await complete());
  assert.equal((await post(path+'/messages',input)).status,202);
  assert.equal(sent.length,i+1);
 }
 for(const [i,skillId] of ['market-hotspot-analysis','long-horizon-analysis'].entries()){
  assert.ok(sent[i].text.includes('User-selected research Skill: '+skillId));
  assert.equal(sent[i].tools.includes('read_research_skill'),false);
 }
 assert.deepEqual(sent[2].tools,['read_research_skill']);
 assert.equal(sent[3].tools.includes('read_research_skill'),false);
});
