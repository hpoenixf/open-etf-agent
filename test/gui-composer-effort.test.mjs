import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';

const src=await readFile(new URL('../src/gui/gui.mjs',import.meta.url),'utf8');
const html=await readFile(new URL('../src/gui/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../src/gui/gui.css',import.meta.url),'utf8');
const nodes=()=>new Map();
function boot(){
 const list=nodes(), values=new Map(), calls=[], media=new Map();
 const make=tag=>({
  tag,value:'',hidden:false,children:[],dataset:{},listeners:{},attrs:{},scrollTop:0,
  style:{setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}},
  get childElementCount(){return this.children.length;},
  append(...children){this.children.push(...children);},
  replaceChildren(...children){this.children=children;},
  addEventListener(name,fn){this.listeners[name]=fn;},
  querySelectorAll(){return [];},
  getBoundingClientRect(){return {top:0,bottom:600};},
  getAttribute(name){return this.attrs[name]??null;},
  setAttribute(name,value){this.attrs[name]=value;},
  showModal(){this.open=true;},
  close(){this.open=false;this.listeners.close?.();},
  removeAttribute(name){delete this[name];},
  querySelector(){return get('summary-focus');},
  focus(){this.focused=true;},
  dispatchEvent(event){this.listeners[event.type]?.(event);}
 });
 const get=id=>{
  if(!list.has(id))list.set(id,make());
  return list.get(id);
 };
 const storage={getItem(k){return values.get(k)??null;},setItem(k,v){values.set(k,v);},removeItem(k){values.delete(k);}};
 const context=createContext({
  document:{getElementById:get,querySelectorAll(){return[];},createElement:make},
  window:{localStorage:storage,matchMedia(query){
   if(!media.has(query))media.set(query,{matches:false,addEventListener(){}});
   return media.get(query);
  }},sessionStorage:storage, calls,
  crypto:{randomUUID(){return '01234567-89ab-cdef-0123-456789abcdef';}},
  setTimeout:()=>null,clearTimeout(){},Event:globalThis.Event
 });
 const start=src.lastIndexOf('\ntry {\n  initWorkbench();');
 assert.ok(start>0);
 runInContext(src.slice(0,start).replace(/^import[^\n]*\n/gm,''),context);
 const run=code=>runInContext(code,context);
 run(`state.conversation='test-conv'; state.workspace={mode:'live-research',projectId:'test-project',conversations:[],sources:[],
 liveNotice:{freeform:true},capabilities:['deep-research'],reasoningEffort:{status:'available',options:['low','high','max','medium']}};
 api=async(path,body)=>{calls.push(JSON.parse(JSON.stringify({path,body}))); if(calls.length===1)throw new Error('RETRY');}; select=async()=>{};`);
 get('source').value='';
 get('research-depth').value='auto';
 get('pdf-file').files=[];
 return {get,run,calls,media};
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

test('daily watch starts as one native disclosure, with the complete control panel inside',()=>{
 const daily=html.match(/<details id="daily-watch"([^>]*)>([\s\S]*?)<\/details>/);
 assert.ok(daily);
 assert.doesNotMatch(daily[1],/\bopen\b/);
 assert.match(daily[2],/^\s*<summary class="daily-capsule">[\s\S]*?<span>每日追踪<\/span>[\s\S]*?<\/summary>\s*<div class="daily-panel">/);
 assert.equal((daily[2].match(/<summary\b/g)??[]).length,1);
 for(const id of ['daily-form','daily-digest-form','daily-refresh','daily-items']){
  assert.equal((daily[2].match(new RegExp(`id="${id}"`,'g'))??[]).length,1);
 }
});

test('daily disclosure refreshes on opening, not closing, and does not clear an unsaved question',async()=>{
 const {get,run,calls}=boot();
 const daily=get('daily-watch');
 const toggle=daily.listeners.toggle;
 run(`api=async(path)=>{calls.push(path); return {items:[],autorun:false};}`);
 get('daily-question').value='比较黄金 ETF';
 daily.open=false;
 toggle();
 assert.equal(calls.length,0);
 daily.open=true;
 toggle();
 await Promise.resolve();
 assert.deepEqual(calls,['/api/daily-watch']);
 daily.open=false;
 toggle();
 assert.equal(get('daily-question').value,'比较黄金 ETF');
 assert.deepEqual(calls,['/api/daily-watch']);
});

test('transcript separates user question, rendered answer, and neutral optional settings',()=>{
 const {get,run}=boot();
 run(`globalThis.renderMarkdown=(doc,value)=>{const element=doc.createElement('div');element.className='markdown-body';element.textContent=value;return element;};
  state.detail={messages:[{id:'q1',status:'completed',question:'比较黄金 ETF',researchDepth:'deep',effectiveResearchIntent:'deep',
    reasoningEffort:{requested:'max',serialized:'high'}, evidenceAssessment:'unreviewed',
    output:{answer:'原样 Markdown',report:{text:'原样 Markdown'},sources:[{text:'原文'}]}}]};render();`);
 const [turn]=get('transcript').children;
 const [prompt,answer]=turn.children;
 assert.equal(get('intro').hidden,true);
 assert.equal(turn.dataset.turnId,'q1');
 assert.equal(prompt.attrs['aria-label'],'你的问题');
 assert.equal(prompt.children[1].textContent,'比较黄金 ETF');
 assert.equal(answer.attrs['aria-label'],'研究助手');
 assert.equal(answer.children[0].children[1].textContent,'已完成');
 assert.equal(answer.children[0].children[1].className,'visually-hidden');
 const disclosure=answer.children.find(x=>x.className==='research-progress');
 assert.equal(disclosure.open,false);
 const [summary,context]=disclosure.children;
 assert.equal(summary.textContent,'研究进度');
 assert.match(context.children[0].textContent,/实际路线：深度研究/);
 assert.match(context.children[1].textContent,/已写入请求 高/);
 assert.equal(answer.children.find(x=>x.className==='markdown-body').textContent,'原样 Markdown');
 assert.equal(answer.children.find(x=>x.className==='citation-actions').children[0].textContent,'核对来源 [1]');
 assert.deepEqual(Array.from(answer.children.find(x=>x.className==='turn-actions').children,element=>element.textContent),
  ['复制 Markdown','下载 Markdown','导出图片','复用这个问题']);
});

test('transcript keeps active progress and provider rejection visible without burying them in settings',()=>{
 const {get,run}=boot();
 run(`state.detail={messages:[{id:'q2',status:'active',working:true,phase:'proposal-sealed',question:'当前任务'},
   {id:'q3',status:'failed',code:'PROVIDER_HTTP_429',question:'需要重试'}]};render();`);
 const [active,failed]=get('transcript').children.map(turn=>turn.children[1]);
 assert.equal(active.children[0].children[1].className,'state');
 assert.equal(active.children[0].children[1].textContent,'正在处理');
 assert.equal(active.children.find(x=>x.className==='research-progress').children[0].textContent,'研究进度');
 assert.match(failed.children.find(x=>x.className==='warning').textContent,/PROVIDER_HTTP_429/);
});

test('dock lives outside the scrollable reading pane and panel triggers are independently labelled',()=>{
 assert.match(html,/<meta name="viewport"[^>]+interactive-widget=resizes-content/);
 assert.match(html,/<section id="transcript"[^>]*><\/section>\s*<\/div>\s*<div class="composer-dock">\s*<form id="composer">/);
 assert.match(html,/<button id="history-toggle"[^>]+aria-label="会话历史"[^>]+aria-controls="history"/);
 assert.match(html,/<button id="evidence-toggle"[^>]+aria-label="来源与核对"[^>]+aria-controls="desktop-evidence"/);
});

test('desktop workbench panels collapse independently and anchor the reading position',()=>{
 const {get,run}=boot();
 run('initWorkbench()');
 const pane=get('reading-pane');
 let anchorTop=110;
 pane.scrollTop=245;
 pane.querySelectorAll=()=>[{getBoundingClientRect:()=>({top:anchorTop,bottom:anchorTop+20})}];
 const evidence=get('desktop-evidence');
 const updateEvidence=evidence.hidden;
 Object.defineProperty(evidence,'hidden',{get(){return updateEvidence;},set(value){anchorTop=value?110:140;}});
 assert.equal(get('history').hidden,false);
 get('evidence-toggle').listeners.click();
 assert.equal(get('evidence-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(pane.scrollTop,275);
 get('history-toggle').listeners.click();
 assert.equal(get('history').hidden,true);
 assert.equal(get('evidence-toggle').getAttribute('aria-expanded'),'true');
 let handled=false;
 get('desktop-evidence').listeners.keydown({key:'Escape',preventDefault(){handled=true;}});
 assert.equal(handled,true);
 assert.equal(get('evidence-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(get('evidence-toggle').focused,true);
 assert.equal(pane.scrollTop,245);
});

test('compact history is closed by default and sources open and dismiss in a dialog',()=>{
 const {get,run,media}=boot();
 run(`window.matchMedia('(max-width:700px)').matches=true;
   window.matchMedia('(max-width:930px)').matches=true;
   initWorkbench();`);
 assert.equal(media.size,2);
 assert.equal(get('history').hidden,true);
 get('history-toggle').listeners.click();
 assert.equal(get('history').hidden,false);
 get('evidence-toggle').listeners.click();
 assert.equal(get('history').hidden,false);
 assert.equal(get('workspace').dataset.evidence,'false');
 assert.equal(get('evidence-toggle').getAttribute('aria-controls'),'mobile-evidence');
 assert.equal(get('mobile-evidence').open,true);
 get('close-evidence').listeners.click();
 assert.equal(get('mobile-evidence').open,false);
 assert.equal(get('evidence-toggle').getAttribute('aria-expanded'),'false');
 assert.equal(get('evidence-toggle').focused,true);
});

test('clicking a citation automatically opens the matching evidence panel and keeps the original source',()=>{
 const {get,run}=boot();
 const makeSource=()=>{
  const fields={h3:{},pre:{},small:{}};
  return {fields,cloneNode(){
    const clone=makeSource();
    for(const name of Object.keys(fields))clone.fields[name].textContent=fields[name].textContent;
    return clone;
   },querySelector(name){return fields[name];}};
 };
 get('evidence-template').content={cloneNode:makeSource};
 run("initWorkbench(); showEvidence({pdfPage:2,text:'不可变原文',sha256:'receipt'},2)");
 assert.equal(get('evidence-toggle').getAttribute('aria-expanded'),'true');
 assert.equal(get('desktop-evidence').dataset.selected,'true');
 assert.equal(get('desktop-evidence-content').children[0].fields.pre.textContent,'不可变原文');
 assert.equal(get('desktop-evidence-content').children[0].fields.h3.textContent,'来源 [2] · PDF 第 2 页');
 get('evidence-toggle').listeners.click();
 assert.equal(get('desktop-evidence').hidden,true);
 get('evidence-toggle').listeners.click();
 assert.equal(get('desktop-evidence-content').children[0].fields.pre.textContent,'不可变原文');
});


test('the host status notice does not claim the app shell’s remaining height',()=>{
 const hosted=html.replace('<body>','<body><p>Fixture host status notice</p>');
 assert.match(hosted,/<body><p>Fixture host status notice<\/p>\s*<header class="masthead"/);
 assert.match(css,/body\{[^}]+display:flex;flex-direction:column\}/);
 assert.match(css,/body > :not\(#workspace\)\{flex:none\}/);
 assert.match(css,/\.workspace\{[^}]+flex:1 1 0;min-height:0/);
 assert.match(css,/\.reading-pane\{min-height:0/);
});


test('the short-viewport toolbar bounds its own scrollable popup without scrolling the workbench',()=>{
 const {get,run}=boot();
 assert.match(css,/body\{position:fixed;[^}]+overflow:clip/);
 assert.match(css,/\.composer-panel \{[^}]+var\(--composer-panel-room,42dvh\)[^}]+overflow: auto; overscroll-behavior: contain/);
 const toolbar=get('composer-actions');
 toolbar.getBoundingClientRect=()=>({top:119});
 run("window.visualViewport={offsetTop:5}; fitComposerPanels()");
 assert.equal(toolbar.style['--composer-panel-room'],'100px');
 toolbar.getBoundingClientRect=()=>({top:40});
 run('fitComposerPanels()');
 assert.equal(toolbar.style['--composer-panel-room'],'44px');
});

test('one icon action slot contains the Send, Stop, and toolbar info popover with readable control names',()=>{
 const {get}=boot();
 assert.match(html,/<div id="composer-actions"[\s\S]+<details id="mode-disclosure"[^>]*>\s*<summary aria-label="本次权限与数据说明"/);
 assert.match(html,/<div class="composer-submit-slot">\s*<button id="send" type="submit" aria-label="提交演练"/);
 assert.match(html,/<button id="stop" type="button" aria-label="停止研究"[^>]*hidden/);
 get('mode-disclosure').open=true;
 get('pdf-picker').open=true;
 get('mode-disclosure').listeners.toggle();
 assert.equal(get('pdf-picker').open,false);
 let handled=false;
 get('mode-disclosure').listeners.keydown({key:'Escape',preventDefault(){handled=true;}});
 assert.equal(handled,true);
 assert.equal(get('mode-disclosure').open,false);
 assert.equal(get('summary-focus').focused,true);
});

const stopFixture = `
 const active={id:'msg-1',runId:'run-1',sourceId:null,status:'active',working:true,question:'原始问题'};
 state.detail={id:'test-conv',messages:[active]};
 let finishCancel;
 let terminal=false;
 api=async(path,body)=>{
   calls.push({path,body});
   if(path.endsWith('/cancel'))return new Promise(resolve=>{finishCancel=resolve;});
   return {id:'test-conv',messages:[terminal?{...active,status:'cancelled',working:false}:active]};
 };
 controls();
`;
test('Stop stays in the composer while the exact request settles; accepted is not a terminal success',async()=>{
 const {get,run,calls}=boot();
 run(stopFixture);
 assert.equal(get('stop').hidden,false);
 assert.equal(get('send').hidden,true);
 assert.equal(get('stop').getAttribute('aria-label'),'停止研究');
 const first=get('stop').listeners.click();
 assert.equal(get('stop').getAttribute('aria-disabled'),'true');
 assert.equal(get('stop').getAttribute('aria-label'),'正在停止…');
 await get('stop').listeners.click();
 assert.deepEqual(calls.map(x=>x.path),['/api/conversations/test-conv/messages/msg-1/cancel']);
 run("finishCancel({status:'cancel-requested'})");
 await first;
 assert.equal(get('stop').hidden,false);
 assert.equal(get('stop').getAttribute('aria-disabled'),'true');
 assert.equal(get('notice').hidden,true);
 run('terminal=true');
 await run('refresh()');
 assert.equal(get('stop').hidden,true);
 assert.equal(get('send').hidden,false);
 assert.equal(get('notice').hidden,true);
 assert.equal(run('state.stopping.size'),0);
});

test('rejected Stop reports an unconfirmed result and remains retryable only while active',async()=>{
 const {get,run,calls}=boot();
 run(stopFixture);
 run(`api=async(path,body)=>{
   calls.push({path,body});
   if(path.endsWith('/cancel'))throw Error('STOP_REJECTED');
   return {id:'test-conv',messages:[terminal?{...active,status:'completed',working:false}:active]};
 };`);
 await get('stop').listeners.click();
 assert.match(get('notice').textContent,/未能确认停止/);
 assert.equal(get('stop').getAttribute('aria-disabled'),'false');
 assert.equal(get('stop').hidden,false);
 run('terminal=true');
 await get('stop').listeners.click();
 assert.equal(get('send').hidden,false);
 assert.equal(get('stop').hidden,true);
 assert.equal(calls.filter(c=>c.path.endsWith('/cancel')).length,2);
});

test('Stop never uses a foreign, unknown or ambiguous Run; switching does not redirect an in-flight cancel',async()=>{
 const {get,run,calls}=boot();
 run(stopFixture);
 run("state.detail={id:'foreign',messages:[active]}; controls()");
 assert.equal(get('stop').hidden,true);
 await get('stop').listeners.click();
 run("state.detail={id:'test-conv',messages:[{...active,code:'RUN_UNKNOWN'}]}; controls()");
 assert.equal(get('stop').hidden,true);
 await get('stop').listeners.click();
 run("state.detail={id:'test-conv',messages:[active,{...active,id:'msg-2',runId:'run-2'}]}; controls()");
 await get('stop').listeners.click();
 assert.equal(calls.length,0);
 run("state.detail={id:'test-conv',messages:[active]}; controls()");
 const cancel=get('stop').listeners.click();
 run("state.conversation='other'; state.selection++; state.detail={id:'other',messages:[]}; controls(); finishCancel({status:'cancel-requested'})");
 await cancel;
 assert.deepEqual(calls.map(x=>x.path),['/api/conversations/test-conv/messages/msg-1/cancel']);
 assert.equal(get('stop').hidden,true);
 assert.equal(get('notice').hidden,true);
});


test('the masthead contains only panel navigation, with model mode inside the permission popover',()=>{
 const masthead=html.match(/<header class="masthead"[^>]*>([\s\S]*?)<\/header>/);
 assert.ok(masthead);
 assert.equal((masthead[1].match(/<button\b/g)??[]).length,2);
 assert.doesNotMatch(masthead[1],/mode-badge|brand-symbol|subbrand/);
 assert.match(html,/<details id="mode-disclosure"[\s\S]*?<p id="mode-badge"/);
});

test('tool picker renders only server catalog entries and carries a selected method through retry',async()=>{
 const {get,run,calls}=boot();
 run(`state.workspace.toolCatalog={skills:[{id:'auto',label:'自动'},{id:'market-hotspot-analysis',label:'热点解读'},{id:'long-horizon-analysis',label:'长期视角分析'},{id:'financial-chart@1',label:'金融图表（用户数据）'}],
   tools:[{label:'PDF 附件阅读',note:'上传后可用'},{label:'Exa',note:'公开搜索'}]};configureToolCatalog();`);
 assert.deepEqual(get('chart-skill').children.map(o=>o.value),['','market-hotspot-analysis','long-horizon-analysis','financial-chart@1']);
 assert.deepEqual(get('owner-tool-list').children.map(li=>li.children[0].textContent),['PDF 附件阅读','Exa']);
 get('chart-skill').value='market-hotspot-analysis';
 get('question').value='Interpret a public event.';
 const submit=get('composer').listeners.submit;
 await submit({preventDefault(){}});
 await submit({preventDefault(){}});
 assert.equal(calls[0].body.skillId,'market-hotspot-analysis');
 assert.deepEqual(calls[0].body,calls[1].body);
 assert.equal(get('chart-skill').value,'');
});
