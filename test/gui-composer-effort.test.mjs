import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';

const src=await readFile(new URL('../src/gui/gui.mjs',import.meta.url),'utf8');
const html=await readFile(new URL('../src/gui/index.html',import.meta.url),'utf8');
const nodes=()=>new Map();
function boot(){
 const list=nodes(), values=new Map(), calls=[];
 const get=id=>{
  if(!list.has(id))list.set(id,{
   value:'',hidden:false,children:[],dataset:{},listeners:{},
   replaceChildren(...children){this.children=children;},
   addEventListener(name,fn){this.listeners[name]=fn;},
   querySelectorAll(){return [];},
   removeAttribute(name){delete this[name];},
   querySelector(){return get('summary-focus');},
   focus(){this.focused=true;},
   dispatchEvent(event){this.listeners[event.type]?.(event);}
  });
  return list.get(id);
 };
 const storage={getItem(k){return values.get(k)??null;},setItem(k,v){values.set(k,v);},removeItem(k){values.delete(k);}};
 const context=createContext({
  document:{getElementById:get,querySelectorAll(){return[];},createElement:()=>({})},
  window:{localStorage:storage},sessionStorage:storage, calls,
  crypto:{randomUUID(){return '01234567-89ab-cdef-0123-456789abcdef';}},
  Event:globalThis.Event
 });
 const start=src.lastIndexOf('\ntry {\n  await load();');
 assert.ok(start>0);
 runInContext(src.slice(0,start).replace(/^import[^\n]*\n/gm,''),context);
 const run=code=>runInContext(code,context);
 run(`state.conversation='test-conv'; state.workspace={mode:'live-research',projectId:'test-project',conversations:[],sources:[],
 liveNotice:{freeform:true},capabilities:['deep-research'],reasoningEffort:{status:'available',options:['low','high','max','medium']}};
 api=async(path,body)=>{calls.push(JSON.parse(JSON.stringify({path,body}))); if(calls.length===1)throw new Error('RETRY');}; select=async()=>{};`);
 get('source').value='';
 get('research-depth').value='auto';
 get('pdf-file').files=[];
 return {get,run,calls};
}
test('only verified owner capabilities display known provider choices; default is omitted',()=>{
 const {get,run}=boot();
 run('configureEffortPicker()');
 assert.equal(get('reasoning-effort-picker').hidden,false);
 assert.deepEqual(get('reasoning-effort').children.map(x=>x.value),['','low','high','max']);
 get('reasoning-effort').value='medium';
 assert.equal(run('Object.hasOwn(formDraft(),"reasoningEffort")'),false);
 get('reasoning-effort').value='high';
 assert.equal(run('formDraft().reasoningEffort'),'high');
 run("state.workspace.reasoningEffort.status='unverified'; configureEffortPicker()");
 assert.equal(get('reasoning-effort-picker').hidden,true);
 assert.equal(get('reasoning-effort').value,'');
 assert.equal(run('Object.hasOwn(formDraft(),"reasoningEffort")'),false);
 run("state.workspace.reasoningEffort.status='available'; state.workspace.liveNotice.freeform=false; configureEffortPicker()");
 assert.equal(get('reasoning-effort-picker').hidden,true);
});
test('effort and research depth persist in drafts, and immutable retry does not change either field',async()=>{
 const {get,run,calls}=boot();
 run('configureEffortPicker()');
 get('reasoning-effort').value='max';
 get('research-depth').value='standard';
 get('question').value='Synthetic question';
 run('saveDraft()');
 get('reasoning-effort').value='';
 get('research-depth').value='auto';
 run('restoreDraft()');
 assert.equal(get('reasoning-effort').value,'max');
 assert.equal(get('research-depth').value,'standard');
 const submit=get('composer').listeners.submit;
 await submit({preventDefault(){}});
 assert.equal(get('reasoning-effort').disabled,true);
 get('reasoning-effort').value='low';
 get('research-depth').value='deep';
 await submit({preventDefault(){}});
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0].body,calls[1].body);
 assert.equal(calls[0].body.reasoningEffort,'max');
 assert.equal(calls[0].body.researchDepth,'standard');
 assert.equal(get('reasoning-effort').value,'');
 assert.equal(get('research-depth').value,'auto');
 get('question').value='Another turn, no explicit effort';
 await submit({preventDefault(){}});
 assert.equal(Object.hasOwn(calls[2].body,'reasoningEffort'),false);
});
test('one explicit Skill menu, a visible clear affordance and native Escape handling',()=>{
 const {get,run}=boot();
 assert.equal((html.match(/id="chart-skill"/g)??[]).length,1);
 assert.match(html,/<details id="research-settings"[^>]*>/);
 assert.match(html,/<details id="pdf-picker"[^>]*>/);
 assert.doesNotMatch(html,/<details id="(?:pdf-picker|research-settings)"[^>]*\bopen\b/);
 assert.match(html,/<option value="auto">自动<\/option><option value="standard">标准研究<\/option><option value="deep">深度研究<\/option>/);
 get('chart-skill-picker').open=true;
 get('chart-skill').value='financial-chart@1';
 get('chart-skill').listeners.change();
 assert.equal(get('chart-skill-toggle').textContent,'金融图表');
 assert.equal(get('chart-skill-clear').hidden,false);
 assert.equal(run('formDraft().chartSkill'),'financial-chart@1');
 assert.equal(get('chart-skill-picker').open,false);
 get('chart-skill-clear').listeners.click();
 assert.equal(get('chart-skill-toggle').textContent,'选工具');
 assert.equal(get('chart-skill-clear').hidden,true);
 get('research-settings').open=true;
 let handled=false;
 get('research-settings').listeners.keydown({key:'Escape',preventDefault(){handled=true;}});
 assert.equal(handled,true);
 assert.equal(get('research-settings').open,false);
 assert.equal(get('summary-focus').focused,true);
});
test('History only reports authoritative request and wire status, not provider adoption',()=>{
 const {run}=boot();
 assert.match(run("effortHistory({requested:'max',serialized:'high'})"),/请求 最高 · 已写入请求 高；提供方实际采用情况未确认/);
 assert.match(run("effortHistory({requested:'high'})"),/未记录发送值/);
 assert.equal(run("effortHistory({requested:'medium',serialized:'high'})"),null);
 assert.equal(run('effortHistory(undefined)'),null);
});
