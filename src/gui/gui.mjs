import {downloadAnswerImage} from './answer-image.mjs';
import {createFinancialChartView} from './financial-chart-view.mjs';
import {publicPdfNavigationQuery} from './public-pdf-navigation.mjs';
import { renderMarkdown } from './markdown.mjs';
const byId = id => document.getElementById(id);
const state = { workspace: null, conversation: null, detail: null, poll: null, submitting: false, pending: null, failures: 0, selection:0, refreshSequence:0, appliedRefresh:0, progress:new Map(), readSources:new Map(), stopping:new Map() };
const statusLabels = {
  'admission-pending':'接收待确认', 'completed':'已完成', 'failed':'未完成', 'cancelled':'已取消',
  'active':'等待执行', 'fenced':'已暂停', 'unknown':'结果未知',
};
const phaseLabels = {
  ready:'已接收', 'proposal-sealed':'正在处理', 'result-consumed':'正在整理证据',
  'awaiting-response':'等待回复', 'awaiting-approval':'等待确认',
};
function make(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
async function api(path, body) {
  const post = body !== undefined;
  const result = await fetch(path, post ? { method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body) } : {});
  const data = await result.json();
  if (!result.ok) throw Error(data.error ?? 'HTTP_'+result.status);
  return data;
}
function message(text) {
  const n = byId('notice'); n.hidden = !text; n.textContent = text ?? '';
}
function pendingKey() { return (ownerMode()?'local-gui-pending@3:':'local-gui-pending@2:')+state.workspace.projectId; }
function draftKey(id = state.conversation) {
  return 'local-gui-draft@1:'+state.workspace.projectId+':'+(id ?? 'new');
}
const effortLabels = new Map([['low','低'],['high','高'],['max','最高']]);
function availableEffort() {
  const policy=state.workspace?.reasoningEffort;
  if(!ownerMode()||policy?.status!=='available'||!Array.isArray(policy.options))return [];
  return [...effortLabels.keys()].filter(option=>policy.options.includes(option));
}
function requestedEffort(value) { return availableEffort().includes(value) ? value : undefined; }
function effortField(value) {
  const reasoningEffort=requestedEffort(value);
  return reasoningEffort ? {reasoningEffort} : {};
}
function configureEffortPicker() {
  const field=byId('reasoning-effort'), selected=field.value, options=availableEffort();
  byId('reasoning-effort-picker').hidden=options.length===0;
  field.replaceChildren(...['',...options].map(value=>{
    const option=make('option',effortLabels.get(value)??'默认（不指定）');
    option.value=value;
    return option;
  }));
  field.value=options.includes(selected)?selected:'';
}
function effortHistory(value) {
  const requested=effortLabels.get(value?.requested), serialized=effortLabels.get(value?.serialized);
  if(!requested)return null;
  if(!serialized)return '模型思考强度：请求 '+requested+'；未记录发送值。';
  return '模型思考强度：请求 '+requested+' · 已写入请求 '+serialized+'；提供方实际采用情况未确认。';
}
function formDraft() {
  return { question:byId('question').value, sourceId:byId('source').value, researchDepth:byId('research-depth').value,
    ...effortField(byId('reasoning-effort').value),
    ...(!byId('chart-skill-picker').hidden&&byId('chart-skill').value?{chartSkill:byId('chart-skill').value}:{}) };
}
function saveDraft(draft=formDraft(), id=state.conversation) {
  if (!state.workspace) return;
  try {
    if (draft.question || ['standard','deep'].includes(draft.researchDepth) || draft.reasoningEffort || draft.chartSkill || draft.sourceId !== state.workspace.sources[0]?.id) {
      window.localStorage.setItem(draftKey(id),JSON.stringify(draft));
    } else window.localStorage.removeItem(draftKey(id));
  } catch { /* Browser storage is optional; don't block a normal submission. */ }
}
function readDraft(id=state.conversation) {
  try {
    return JSON.parse(window.localStorage.getItem(draftKey(id)));
  } catch { return null; }
}
function restoreDraft() {
  const draft = state.pending?.conversationId === state.conversation ? state.pending.input : readDraft();
  byId('question').value = typeof draft?.question==='string' ? draft.question.slice(0,3000) : '';
  byId('source').value = state.workspace.sources.find(s=>s.id===draft?.sourceId)?.id ?? state.workspace.sources[0]?.id ?? '';
  byId('research-depth').value=!byId('research-depth-picker').hidden&&['standard','deep'].includes(draft?.researchDepth)?draft.researchDepth:'auto';
  byId('reasoning-effort').value=requestedEffort(draft?.reasoningEffort)??'';
  byId('chart-skill').value=!byId('chart-skill-picker').hidden&&draft?.chartSkill==='financial-chart@1'?draft.chartSkill:'';
  updateChartSkillLabel();
  updateSettingsLabel();
}
function clearMatchingDraft({conversationId,input}) {
  const saved = readDraft(conversationId);
  if (saved?.question !== input.question || saved?.chartSkill !== input.chartSkill || saved?.reasoningEffort !== input.reasoningEffort || ownerMode() && (saved?.researchDepth??'auto')!==(input?.researchDepth??'auto') || !ownerMode() && saved?.sourceId !== input.sourceId) return;
  try { window.localStorage.removeItem(draftKey(conversationId)); }
  catch { /* Browser storage is optional. */ }
}
function fallbackTitle(id) { return '会话 · '+id.slice(-6); }
const liveMode = () => state.workspace?.mode === 'live-research';
const ownerMode = () => liveMode() && state.workspace?.liveNotice?.freeform === true;
function confirmLive() {
  const budget = state.workspace.liveNotice.maxModelCallsPerRun;
  return window.confirm('将向启动时配置的真实模型发送本次问题，并提供所选演练资料。'
    + '该任务最多调用模型 '+budget+' 次，费用由提供方计收。请勿输入敏感或未经授权的信息。确定继续？');
}
function isUnknownRun(message) { return /UNKNOWN|MISSING/.test(message.code ?? ''); }
function canActOnRun(message) {
  return message.status==='active'&&!isUnknownRun(message)&&(!ownerMode()||message.sourceId===null||message.attachment);
}
function stopKey(conversationId,message) { return JSON.stringify([conversationId,message.id,message.runId]); }
function activeStopTarget() {
  const conversationId=state.conversation;
  if(!conversationId||state.detail?.id!==conversationId)return null;
  const workers=state.detail.messages.filter(message=>message.working);
  if(workers.length!==1)return null; // An ambiguous Run cannot be stopped by guesswork.
  const [message]=workers;
  if(!canActOnRun(message)||!message.id||!message.runId)return null;
  return {conversationId,messageId:message.id,key:stopKey(conversationId,message),selection:state.selection};
}
async function stopCurrentRun() {
  const target=activeStopTarget();
  if(!target||state.stopping.has(target.key))return;
  const stillSelected=()=>state.conversation===target.conversationId&&state.selection===target.selection;
  state.stopping.set(target.key,target);
  message();
  controls();
  try {
    await api('/api/conversations/'+encodeURIComponent(target.conversationId)+'/messages/'+encodeURIComponent(target.messageId)+'/cancel',{});
  } catch {
    state.stopping.delete(target.key);
    if(stillSelected())message('未能确认停止，请查看当前任务状态；可在仍运行时重试。');
  }
  if(!stillSelected())return;
  controls();
  try { await refresh(); }
  catch { scheduleRefresh(); } // Keep the pending state until a fresh Run view, not the POST alone.
}
function controls() {
  const working = state.detail?.messages.some(m => m.working);
  const target=activeStopTarget(), stopping=target&&state.stopping.has(target.key);
  const stop=byId('stop'), send=byId('send');
  stop.hidden=!target;
  stop.setAttribute('aria-disabled',String(Boolean(stopping)));
  stop.title=stopping?'正在停止…':'停止研究';
  stop.setAttribute('aria-label',stop.title);
  send.hidden=Boolean(target);
  byId('send').disabled = state.submitting || working === true || !state.workspace;
  send.title = state.pending ? '重试原提交' : liveMode() ? '提交真实模型' : '提交演练';
  send.setAttribute('aria-label',send.title);
  send.dataset.retry=String(Boolean(state.pending));
  byId('question').readOnly = Boolean(state.submitting || state.pending);
  byId('pdf-file').disabled = Boolean(state.submitting || state.pending);
  byId('research-depth').disabled = Boolean(state.submitting || state.pending);
  byId('reasoning-effort').disabled = Boolean(state.submitting || state.pending);
  byId('chart-skill-clear').disabled = Boolean(state.submitting || state.pending);
  byId('chart-skill').disabled = Boolean(state.submitting || state.pending);
  byId('source').disabled = Boolean(state.submitting || state.pending);
  byId('new').disabled = Boolean(state.submitting || state.pending);
  for (const b of document.querySelectorAll('[data-reuse-question]')) {
    b.disabled = Boolean(state.submitting || state.pending || byId('question').value.trim());
  }
  for (const b of byId('conversation-list').querySelectorAll('button')) {
    b.disabled = Boolean((state.submitting || state.pending) && b.dataset.conversation !== state.conversation);
  }
}
function refreshHistory() {
  const list = byId('conversation-list');
  list.replaceChildren();
  const query = byId('history-search').value.normalize('NFKC').trim().toLowerCase();
  const shown = state.workspace.conversations.filter(c=>([c.title,c.id,fallbackTitle(c.id)]
    .join(' ').normalize('NFKC').toLowerCase().includes(query)));
  const empty = byId('history-empty');
  empty.hidden = shown.length > 0;
  empty.textContent = query ? '没找到匹配的会话' : '还没有会话';
  for (const c of shown) {
    const li = make('li'), b = make('button',c.title || fallbackTitle(c.id),'secondary');
    b.type = 'button'; b.dataset.conversation = c.id;
    b.setAttribute('aria-current', c.id === state.conversation ? 'true':'false');
    b.addEventListener('click',() => select(c.id).catch(failed));
    li.append(b); list.append(li);
  }
}
const workbench = { desktopHistory:true, compactHistory:false, desktopEvidence:false, lastCitation:null };
const compactHistory = () => window.matchMedia('(max-width:700px)').matches;
const compactEvidence = () => window.matchMedia('(max-width:930px)').matches;
const panelExpanded = id => byId(id).getAttribute('aria-expanded')==='true';
function preserveReadingAnchor(layout) {
  const pane=byId('reading-pane'), bounds=pane.getBoundingClientRect();
  const anchor=[...pane.querySelectorAll('.question,.markdown-body > *,.turn-actions')].find(node=>{
    const box=node.getBoundingClientRect();
    return box.bottom>bounds.top&&box.top<bounds.bottom;
  });
  const top=anchor?.getBoundingClientRect().top;
  layout();
  if(top!==undefined)pane.scrollTop+=anchor.getBoundingClientRect().top-top;
}
function setHistoryOpen(open) {
  workbench[compactHistory()?'compactHistory':'desktopHistory']=open;
  byId('history').hidden=!open;
  byId('history-toggle').setAttribute('aria-expanded',String(open));
  byId('workspace').dataset.history=String(open);
}
function setEvidenceOpen(open) {
  const toggle=byId('evidence-toggle'), dialog=byId('mobile-evidence');
  const compact=compactEvidence(), desktopOpen=!compact&&open;
  if (!compact)workbench.desktopEvidence=open;
  byId('workspace').dataset.evidence=String(desktopOpen);
  byId('desktop-evidence').hidden=!desktopOpen;
  toggle.setAttribute('aria-controls',compact?'mobile-evidence':'desktop-evidence');
  toggle.setAttribute('aria-expanded',String(open));
  if(compact&&open&&!dialog.open)dialog.showModal();
  if((!compact||!open)&&dialog.open)dialog.close();
}
function fitComposerPanels() {
  const toolbar=byId('composer-actions');
  const viewport=window.visualViewport;
  const spill=toolbar.getBoundingClientRect().top-(viewport?.offsetTop??0);
  // 6px for the panel-to-toolbar gap, 8px clear of the top of the visible page.
  toolbar.style.setProperty('--composer-panel-room',Math.max(44,Math.floor(spill)-14)+'px');
}
function initWorkbench() {
  const historyMedia=window.matchMedia('(max-width:700px)');
  const evidenceMedia=window.matchMedia('(max-width:930px)');
  const sync=()=>{
    setHistoryOpen(historyMedia.matches?workbench.compactHistory:workbench.desktopHistory);
    setEvidenceOpen(evidenceMedia.matches?byId('mobile-evidence').open:workbench.desktopEvidence);
  };
  historyMedia.addEventListener('change',sync);
  evidenceMedia.addEventListener('change',sync);
  sync();
  const viewport=window.visualViewport;
  // The dock may change size as the textarea or permissions disclosure changes.
  if(window.ResizeObserver){
    const fit=new window.ResizeObserver(fitComposerPanels);
    fit.observe(byId('composer'));
    fit.observe(byId('workspace'));
  }
  if(viewport){
    const fit=()=>{
      const root=document.documentElement;
      const useHeight=compactEvidence()&&Math.abs(viewport.scale-1)<.02;
      if(useHeight)root.style.setProperty('--workbench-height',Math.floor(viewport.height)+'px');
      else root.style.removeProperty('--workbench-height');
      root.dataset.shortViewport=String(useHeight&&viewport.height<=550);
      root.dataset.veryShortViewport=String(useHeight&&viewport.height<=380);
      fitComposerPanels();
    };
    viewport.addEventListener('resize',fit);
    evidenceMedia.addEventListener('change',fit);
    fit();
  }
}
function showEvidence(source,index,trigger) {
  const node = byId('evidence-template').content.cloneNode(true);
  node.querySelector('h3').textContent = '来源 ['+index+']'+(source.pdfPage?' · PDF 第 '+source.pdfPage+' 页':'');
  node.querySelector('pre').textContent = source.text;
  node.querySelector('small').textContent = source.sha256 ? 'SHA-256 '+source.sha256 : '';
  byId('desktop-evidence-content').replaceChildren(node.cloneNode(true));
  byId('mobile-evidence-content').replaceChildren(node);
  byId('desktop-evidence').dataset.selected='true';
  workbench.lastCitation=trigger;
  preserveReadingAnchor(()=>setEvidenceOpen(true));
}
function resetEvidence() {
  byId('desktop-evidence').dataset.selected='false';
  for(const id of ['desktop-evidence-content','mobile-evidence-content']) {
    byId(id).replaceChildren(make('p','点击回答中的来源，即可查看原文。','muted'));
  }
  workbench.lastCitation=null;
  if(byId('mobile-evidence').open)setEvidenceOpen(false);
}
function progressContent(target, value) {
  target.replaceChildren();
  if(value?.researchIntent==='deep'||value?.researchIntent==='research')target.append(make('p',value.researchIntent==='deep'?'当前模式：深度研究':'当前模式：资料查证','muted'));
  const deep=value?.deepProgress;
  const label={ 'awaiting-first-proposal':'等待首轮研究',collecting:'正在查找原始资料','sources-checked':'已完成来源查询，暂无可用原文','originals-read':'已读取原始资料','delivery-unverified':'运行结束，正文尚未核验','delivered':'正文已保存并读回',stopped:'研究已停止' }[deep?.phase];
  if(label)target.append(make('p',label+' · 已读取原文条目 '+deep.originalsRead+(deep.unavailableSourceChecks?' · 无可用原文的查询 '+deep.unavailableSourceChecks+' 次':''),'muted'));
  if (!value || value.status!=='available' || !value.steps?.length) {
    target.append(make('p',value?.status==='unavailable'?'暂未读到可显示的研究记录。':'尚无已记录的步骤。','muted'));
    return;
  }
  if(value.omitted>0)target.append(make('p','仅展示最近的步骤。','muted'));
  const sequence=make('details');
  sequence.append(make('summary','查看技术步骤'));
  const list=make('ol');
  for(const step of value.steps)list.append(make('li',step.label));
  sequence.append(list);
  target.append(sequence);
}
async function loadProgress(conversation, entry, message) {
  if(entry.loading||(!message.working&&entry.cachedTerminal))return;
  entry.loading=true;
  try {
    const value=await api('/api/conversations/'+encodeURIComponent(conversation)+'/messages/'+encodeURIComponent(message.id)+'/progress');
    if(state.conversation!==conversation||state.progress.get(message.id)!==entry)return;
    entry.data=value;
    entry.cachedTerminal=['completed','failed','cancelled'].includes(message.status)&&value.status==='available';
    if(entry.content?.isConnected)progressContent(entry.content,value);
  } catch {
    if(entry.content?.isConnected)progressContent(entry.content,{status:'unavailable'});
  } finally { entry.loading=false; }
}
function progressDetails(message, context) {
  const details=make('details',undefined,'research-progress');
  const content=make('div',undefined,'research-progress-body');
  const conversation=state.conversation;
  const entry=state.progress.get(message.id)??{open:false};
  entry.content=content;
  state.progress.set(message.id,entry);
  details.append(make('summary','研究进度'));
  if(context.childElementCount)details.append(context);
  details.append(content);
  progressContent(content,{...entry.data,...(message.deepProgress?{deepProgress:message.deepProgress}:{})});
  details.open=entry.open;
  details.addEventListener('toggle',()=>{
    if(!details.isConnected)return;
    entry.open=details.open;
    if(details.open)void loadProgress(conversation,entry,message);
  });
  if(details.open)void loadProgress(conversation,entry,message);
  return details;
}
function originalWebLink(href,pdf=false) {
  if(typeof href!=='string')return null;
  try {
    const url=new URL(href);
    return url.protocol==='https:'&&!url.username&&!url.password&&!href.includes('#')&&(!href.includes('?')||(pdf&&publicPdfNavigationQuery(url)))?url:null;
  } catch {return null;}
}
function readSourcesContent(target, value) {
  target.replaceChildren();
  if(!value){target.append(make('p','正在读取这条回答已保存的网页记录。','muted'));return;}
  const note={
    none:'没有查到本次已读取的网页原文。搜索预览不算原文。',
    partial:'仅显示仍可核对的网页摘录，记录不完整。',
    unavailable:'暂时无法核对已读取的网页摘录。',
  }[value.availability];
  if(note)target.append(make('p',note,'muted'));
  for(const source of Array.isArray(value.readSources)?value.readSources:[]){
    const pdf=source?.kind==='web-pdf-original-page';
    if((!pdf&&source?.kind!=='web-original-excerpt')||typeof source.text!=='string'||
       !Number.isSafeInteger(source.page)||source.page<1||!Number.isSafeInteger(source.pages)||source.pages<source.page)continue;
    const url=originalWebLink(source.url,pdf);
    if(!url)continue;
    let parent=target;
    if(pdf){
      parent=target.querySelector('.linked-pdf-records');
      if(!parent){parent=make('section',undefined,'linked-pdf-records');parent.append(make('h4','公开 PDF 原文页'));target.append(parent);}
    }
    const excerpt=make('details',undefined,'web-source-excerpt');
    excerpt.append(make('summary',url.hostname+(pdf?' · PDF 物理页 ':' · 原文摘录 ')+source.page+'/'+source.pages+(pdf?(source.cited?' · 已引用':' · 已读，未引用'):'')));
    const link=make('a',pdf?'打开来源 PDF（可能更新）':'打开原网页');
    if(pdf)url.hash='page='+source.page;
    link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
    excerpt.append(link,make('pre',source.text,'web-source-text'));
    parent.append(excerpt);
  }
  if(!target.childElementCount)target.append(make('p','暂时无法核对已读取的网页摘录。','muted'));
}
async function loadReadSources(entry) {
  if(entry.loading||typeof entry.project!=='string'||!entry.project)return;
  const identity=()=>state.workspace?.projectId===entry.project&&state.conversation===entry.conversation&&
    state.selection===entry.selection&&state.readSources.get(entry.messageId)===entry;
  entry.loading=true;
  try {
    const value=await api('/api/conversations/'+encodeURIComponent(entry.conversation)+
      '/messages/'+encodeURIComponent(entry.messageId)+'/sources');
    if(!identity())return;
    entry.value=value?.projectId===entry.project&&value.messageId===entry.messageId&&value.conversationId===entry.conversation?
      value:{availability:'unavailable'};
  } catch {if(identity())entry.value={availability:'unavailable'};}
  finally {
    entry.loading=false;
    if(identity()&&entry.open&&entry.content?.isConnected)readSourcesContent(entry.content,entry.value);
    if(identity()&&entry.inline?.length)hydrateInlineCitations(entry);
  }
}
function hydrateInlineCitations(entry) {
  for(const [span,ref,number] of entry.inline){
    const row=(Array.isArray(entry.value?.readSources)?entry.value.readSources:[]).find(source=>source?.cited===true&&typeof source.text==='string'&&
      (source.citationRef===ref||source.kind==='web-pdf-original-page'&&'PDF:'+source.id===ref));
    const pdf=row?.kind==='web-pdf-original-page';
    const url=row&&(!pdf||Number.isSafeInteger(row.page)&&row.page>0)&&originalWebLink(row.url,pdf);
    if(!url){span.textContent=entry.value?'［来源未能核对］':'［核对中］';continue;}
    if(pdf)url.hash='page='+row.page;
    const link=make('a','['+number+']','inline-source');
    link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
    link.title=pdf?'原 PDF 第 '+row.page+' 页':row.text.slice(0,140);
    span.replaceChildren(link);
  }
}
function readSourcesDetails(message,inline=[]) {
  const details=make('details',undefined,'research-progress read-web-sources');
  const content=make('div',undefined,'research-progress-body');
  let entry=state.readSources.get(message.id);
  if(!entry||entry.selection!==state.selection){
    entry={project:state.workspace.projectId,conversation:state.conversation,selection:state.selection,messageId:message.id,open:false};
    state.readSources.set(message.id,entry);
  }
  entry.content=content;
  entry.inline=inline;
  if(inline.length){hydrateInlineCitations(entry);if(!entry.value)void loadReadSources(entry);}
  details.append(make('summary',state.workspace?.liveNotice?.connectivity?.linkedPdf?'已读网页与 PDF（不等于已引用）':'已读网页（不等于已引用）'),content);
  details.open=entry.open;
  if(entry.open)readSourcesContent(content,entry.value);
  details.addEventListener('toggle',()=>{
    if(!details.isConnected||entry.content!==content)return;
    const opened=details.open&&!entry.open;
    entry.open=details.open;
    if(opened){readSourcesContent(content,entry.value);void loadReadSources(entry);}
  });
  return details;
}
function render() {
  const t = byId('transcript'), pane=byId('reading-pane');
  const savedTop=pane.scrollTop;
  t.replaceChildren();
  for (const m of state.detail?.messages ?? []) {
    const article = make('article',undefined,'turn');
    article.dataset.turnId=m.id;
    const prompt = make('section',undefined,'turn-prompt');
    prompt.setAttribute('aria-label','你的问题');
    prompt.append(make('span','你','speaker'),make('p',m.question ?? '问题尚未读回','question'));
    const response = make('section',undefined,'turn-response');
    response.setAttribute('aria-label','研究助手');
    const header = make('div',undefined,'turn-header');
    const isUnknown = isUnknownRun(m);
    const status = isUnknown ? '结果未知' : m.working ? phaseLabels[m.phase] ?? '处理中' : statusLabels[m.status] ?? '状态待核对';
    const badge=make('span',status,m.status==='completed'&&!isUnknown&&!m.working?'visually-hidden':'state');
    header.append(make('h2','研究助手','speaker'),badge);
    response.append(header);
    const route={deep:'深度研究',research:'资料查证',direct:'普通回答',standard:'标准研究'}[m.effectiveResearchIntent];
    const requested={auto:'自动',standard:'标准研究',deep:'深度研究'}[m.researchDepth];
    const context=make('div',undefined,'research-context');
    if(requested||route)context.append(make('p',(requested?'研究模式：'+requested:'')+(route?(requested?' · ':'')+'实际路线：'+route:''),'muted'));
    const effort=effortHistory(m.reasoningEffort);
    if(effort)context.append(make('p',effort,'muted'));
    if(m.attachment)prompt.append(make('p','PDF：'+m.attachment.name+' · '+m.attachment.pages+' 页','attachment'));
    response.append(progressDetails(m,context));
    if(m.evidenceAssessment==='unreviewed')response.append(make('p','结论与引文未独立核验。','evidence-note muted'));
    const providerFailure=(/^PROVIDER_HTTP_(403|429)$/).exec(m.code??'');
    if (providerFailure) {
      const guidance=providerFailure[1]==='403'?'提供方拒绝访问，请核对账户、地区及模型权限。'
        :'提供方限制了请求，请核对可用额度或频率。';
      response.append(make('p',m.code+' · '+guidance+' 本次未自动重发。','warning'));
    }
    if (m.output?.warning) {
      if(m.status==='completed'){
        const disclosure=make('details',undefined,'turn-notice');
        disclosure.append(make('summary','来源与限制'),make('p',m.output.warning,'muted'));
        response.append(disclosure);
      } else response.append(make('p',m.output.warning,'warning'));
    }
    const inline=[], numbers=new Map(), imageBlocks=[];
    const canVerifyCitation=state.workspace.capabilities.includes('read-web-sources')&&m.output?.publicationStatus==='published';
    const registerCitation=(span,ref)=>{
      if(!canVerifyCitation){span.textContent='［来源未能核对］';return;}
      span.textContent='［核对中］';
      if(!numbers.has(ref))numbers.set(ref,numbers.size+1);
      inline.push([span,ref,numbers.get(ref)]);
    };
    const renderAnswer=value=>{
      const block=renderMarkdown(document,value,registerCitation);
      imageBlocks.push(block);
      return block;
    };
    const hasSeparateAnswer=m.output?.answer && m.output.answer !== m.output?.report?.text;
    if (hasSeparateAnswer) response.append(renderAnswer(m.output.answer));
    if (m.output?.report) {
      response.append(make('h3','已保存的报告',hasSeparateAnswer?'report-heading':'visually-hidden'),renderAnswer(m.output.report.text));
    } else if (m.error || m.status==='completed' && !m.output?.answer) {
      response.append(make('p','没有读到已保存报告。','muted'));
    }
    const sources=make('div',undefined,'citation-actions');
    for (const [i,source] of (m.output?.sources ?? []).entries()) {
      const label=Number.isSafeInteger(source.pdfPage)&&source.pdfPage>0?'PDF 第 '+source.pdfPage+' 页':'核对来源';
      const citation = make('button',label+' ['+(i+1)+']','secondary');
      citation.type='button'; citation.addEventListener('click',() => showEvidence(source,i+1,citation)); sources.append(citation);
    }
    if(sources.childElementCount)response.append(sources);
    if(state.workspace.capabilities.includes('read-web-sources')&&m.output?.publicationStatus==='published')
      response.append(readSourcesDetails(m,inline));
    for(const chart of m.chartViews??[]){
      try{response.append(createFinancialChartView(document,chart));}
      catch{/* A rejected chart view must not hide the durable answer. */}
    }
    const actions = make('div',undefined,'turn-actions');
    if (m.output?.report) {
      const report = m.output.report;
      const copy = make('button','复制 Markdown','secondary');
      copy.type='button';
      copy.addEventListener('click',async()=>{
        try {
          await window.navigator.clipboard.writeText(report.text);
          message('已复制保存的 Markdown 报告。');
        } catch { message('无法访问剪贴板，请使用下载 Markdown。'); }
      });
      const download = make('a','下载 Markdown','secondary download');
      download.href='/api/conversations/'+encodeURIComponent(state.conversation)+'/messages/'+encodeURIComponent(m.id)+'/report.md';
      download.download='etf-report-'+m.id+'.md';
      actions.append(copy,download);
    }
    if (!m.working && m.status==='completed' && imageBlocks.some(block=>block.textContent.trim())) {
      const save=make('button','导出图片','secondary');
      save.type='button';
      save.addEventListener('click',async()=>{
        if(save.disabled)return;
        save.disabled=true;
        try{await downloadAnswerImage(document,imageBlocks,m.id);message('已导出回答图片。');}
        catch(error){message(error.message==='ANSWER_IMAGE_TOO_LONG'?'回答太长，无法导出为单张图片。可下载 Markdown。':'未能生成图片，请重试。');}
        finally{save.disabled=false;}
      });
      actions.append(save);
    }
    if (m.question) {
      const reuse = make('button','复用这个问题','secondary');
      reuse.type='button';
      reuse.dataset.reuseQuestion='';
      reuse.title='仅在输入框为空时填入，可编辑，不会提交';
      reuse.addEventListener('click',()=>{
        if (state.pending || state.submitting || byId('question').value.trim()) return;
        byId('question').value=m.question;
        if (state.workspace.sources.some(s=>s.id===m.sourceId)) byId('source').value=m.sourceId;
        saveDraft(); controls(); byId('question').focus();
      });
      actions.append(reuse);
    }
    if(actions.childElementCount) response.append(actions);
    if (!m.working && canActOnRun(m)) {
      const conversationId=state.conversation;
      const b = make('button','继续原任务','secondary');
      b.type='button'; b.addEventListener('click',async()=> {
        if(state.conversation!==conversationId)return;
        try {
          if (liveMode() && !ownerMode() && !confirmLive()) return;
          await api('/api/conversations/'+conversationId+'/messages/'+m.id+'/work',
            liveMode()&&!ownerMode()?{approveLive:true}:{});
          if(state.conversation===conversationId)await refresh();
        } catch(e) { if(state.conversation===conversationId)failed(e); }
      });
      response.append(b);
    }
    article.append(prompt,response);
    t.append(article);
  }
  byId('intro').hidden = (state.detail?.messages.length ?? 0)>0;
  pane.scrollTop=savedTop;
  controls();
}
function scheduleRefresh() {
  clearTimeout(state.poll);
  if (!state.detail?.messages.some(m=>m.working)) return;
  state.poll = setTimeout(()=>refresh().catch(error=>{
    if (++state.failures<3) scheduleRefresh(); else failed(error);
  }),500);
}
async function refresh() {
  const selected = state.conversation, selection = state.selection;
  if (!selected) return;
  const seq=++state.refreshSequence;
  const detail = await api('/api/conversations/'+selected);
  if (state.selection !== selection||seq<state.appliedRefresh) return;
  state.appliedRefresh=seq;
  for(const [key,request] of state.stopping){
    if(request.conversationId===selected&&!detail.messages.some(m=>m.working&&canActOnRun(m)&&stopKey(selected,m)===key))state.stopping.delete(key);
  }
  state.failures = 0;
  const old = JSON.stringify(state.detail);
  state.detail = detail;
  const row = state.workspace.conversations.find(c=>c.id===selected);
  const title = detail.title;
  if (row && row.title !== title) { row.title=title; refreshHistory(); controls(); }
  if (old !== JSON.stringify(detail)) render();
  else {
    controls();
    for (const item of detail.messages){const entry=state.progress.get(item.id);if(entry?.open)void loadProgress(selected,entry,item);}
  }
  scheduleRefresh();
}
function conversationHash(hash=location.hash){
  const parsed=/^#([A-Za-z0-9_-]{1,48})(?:~([A-Za-z0-9_-]{1,48}))?$/.exec(hash);
  return parsed?{conversationId:parsed[1],messageId:parsed[2]}:{};
}
function focusTurn(messageId){
  if(messageId)Array.from(byId('transcript').children).find(el=>el.dataset.turnId===messageId)?.scrollIntoView({block:'start'});
}
async function select(id,messageId) {
  if (state.pending && state.pending.conversationId !== id) return;
  const changed=state.conversation!==id;
  if (changed) {
    state.progress.clear();
    state.readSources.clear();
    message();
    if(state.conversation)byId('pdf-file').value='';byId('pdf-file').dispatchEvent(new Event('change'));
    byId('research-depth').value='auto'; byId('reasoning-effort').value=''; byId('chart-skill').value=''; updateChartSkillLabel(); updateSettingsLabel(); closeComposerOptions();
    resetEvidence();
    byId('reading-pane').scrollTop=0;
    state.detail=null;
  }
  clearTimeout(state.poll);
  state.selection++; state.conversation=id;
  restoreDraft();
  location.hash=id+(messageId?'~'+messageId:'');
  refreshHistory();
  if(compactHistory())setHistoryOpen(false);
  render();
  await refresh();
  if(state.conversation===id)focusTurn(messageId);
}
async function load() {
  const workspace = await api('/api/workspace');
  if(workspace.projectId!==state.workspace?.projectId)state.readSources.clear();
  state.workspace = workspace;
  configureEffortPicker();
  updateSettingsLabel();
  if (ownerMode()) {
    const badge=byId('mode-badge');
    badge.textContent='真实模型';
    badge.title='提交后会向已配置的模型发送问题';
    byId('mode-heading').textContent='今天想了解什么？';
    byId('mode-intro').textContent='直接输入问题。回复保存在会话历史里。';
    const c=state.workspace.liveNotice.connectivity??{};
    const paidLabels={'deepseek-search':'DeepSeek','yuanbao-search':'腾讯元宝'};
    const alternates=(c.searchAlternates??[]).map(id=>paidLabels[id]).filter(Boolean);
    const capabilities=[c.search?(c.searchProvider==='deepseek-search'?'公开网页搜索（DeepSeek，可能计费）':c.searchProvider==='yuanbao-search'?'公开网页搜索（腾讯元宝，可能计费）':'公开网页搜索（Exa 预览）'):null,alternates.length?'补充搜索：'+alternates.join('、')+'（可能计费）':null,c.web?'公开网页读取':null,c.wind?'Wind 基金日收盘价':null].filter(Boolean);
    byId('mode-note').textContent=(capabilities.length?'已启用：'+capabilities.join('、')+'。当前事实以实际来源为准。':'不联网检索新闻或行情。')
      +' 普通问题可能连同本会话近期问答的摘录发给配置的模型；跨越 PDF 附件轮次不沿用历史。新建会话可从空白开始。';
    byId('source-picker').hidden=true;
    byId('pdf-picker').hidden=!state.workspace.capabilities.includes('pdf-attachment');
    byId('research-depth-picker').hidden=!state.workspace.capabilities.includes('deep-research');
    updateSettingsLabel();
    byId('chart-skill-picker').hidden=!state.workspace.capabilities.includes('financial-chart-skill');
    byId('chart-skill-slot').hidden=byId('chart-skill-picker').hidden;
    byId('chart-skill').options[0].textContent=state.workspace.capabilities.includes('financial-chart-auto')?'自动（适用时使用图表）':'自动（支持你提供的明确数据）';
    byId('source').required=false;
    byId('question').placeholder='输入你的问题';
  } else if (liveMode()) {
    const badge=byId('mode-badge');
    badge.textContent='真实模型 · 仅本机';
    badge.title='显式提交后会向已配置的提供方发送数据并可能计费';
    byId('mode-intro').textContent='选择一份合成资料，明确同意后用所配置的模型生成可回读报告。';
    byId('mode-note').textContent='真实模型，可能计费。每次提交前须同意发送本次问题与所选资料。';
  }
  const s = byId('source'), old=s.value;
  s.replaceChildren();
  for (const source of state.workspace.sources) {
    const o = make('option',source.title); o.value=source.id; s.append(o);
  }
  if (state.workspace.sources.some(x => x.id === old)) s.value=old;
  byId('daily-watch').hidden=!state.workspace.capabilities.includes('daily-watch');
  refreshHistory(); controls();
}
async function create(initialDraft) {
  const c = await api('/api/conversations',{});
  await load();
  if(initialDraft) { saveDraft(initialDraft,c.id); saveDraft({question:'',sourceId:state.workspace.sources[0]?.id??''},null); }
  await select(c.id);
  return c.id;
}
function failed(e) {
  message(({GUI_WORKER_BUSY:'已有任务执行，待完成后再提交。',GUI_ORIGIN_REQUIRED:'请从启动命令显示的本机地址打开。',CONVERSATION_ID_CONFLICT:'原提交内容已不同，请先确认原会话状态。',PDF_UPLOAD_LIMIT:'PDF 不能超过 1 MiB 或 16 页。',PDF_LIMIT_PAGES:'PDF 不能超过 16 页。',PDF_LIMIT_TEXT:'PDF 提取内容超出支持范围，请缩小文件范围。',PDF_ENCRYPTED:'该 PDF 已加密，请上传未加密副本。',PDF_NO_TEXT_LAYER:'没有可用的文字层。请先用本地 OCR 或上传带文字层的版本。',PDF_INVALID_FORMAT:'未识别为 PDF 文件。',PDF_PARSE_FAILED:'无法读取这个 PDF。',PDF_TIMEOUT:'PDF 解析超时，请尝试较小的文件。',PROJECT_SOURCE_INVALID_INPUT:'请选择文件名有效的 PDF。',GUI_PDF_UPLOAD_BUSY:'另一个 PDF 正在处理，请稍后重试。'})[e.message] ?? '未确认操作结果，请刷新并查看会话；重试会沿用原提交。');
}
let editingDaily=null,dailyRequestId=null,dailyEmailToken=null,dailyDigestToken=null;
const dailyStatuses={unknown:'结果未知，不会自动重跑',submitted:'已提交',completed:'已完成',failed:'未完成',cancelled:'已取消'};
const emailStatuses={pending:'邮件待处理',accepted:'邮件服务已接收','not-dispatched':'邮件未发出',unknown:'邮件结果未知，不会自动重发',unavailable:'无可发送的正文',empty:'没有纳入摘要的追踪'};
function resetDaily(){
  editingDaily=null;dailyRequestId=null;
  byId('daily-form').reset();
  byId('daily-reset').hidden=true;
}
async function focusDailyTurn(row){
  try{await select(row.conversationId,row.messageId);}catch(error){failed(error);}
}
async function showDaily(){
  const data=await api('/api/daily-watch');
  const nextEmailToken=data.emailConsentToken??null;
  if(dailyEmailToken&&dailyEmailToken!==nextEmailToken)byId('daily-email').checked=false;
  dailyEmailToken=nextEmailToken;
  byId('daily-email-choice').hidden=!data.emailAvailable;
  byId('daily-email-target').textContent=(data.emailContentMode==='full-report'?'（包含完整正文）':'')+(data.emailPreview?'（'+data.emailPreview+'）':'');
  const digest=data.digest;
  const newDigestToken=digest?.consentToken??null;
  if(dailyDigestToken&&dailyDigestToken!==newDigestToken)byId('daily-digest-watch').checked=false;
  dailyDigestToken=newDigestToken;
  byId('daily-digest-settings').hidden=!digest?.available;
  byId('daily-digest-watch-choice').hidden=!digest?.available;
  if(digest?.available){
    byId('daily-digest-time').value=digest.localTime??'';
    byId('daily-digest-on').checked=digest.enabled&&!digest.requiresConfirmation;
    byId('daily-digest-note').textContent=(digest.contentMode==='full-report'?'在设定的北京时间发送一封邮件，包含已纳入追踪的完整报告正文。未完成项目只显示状态；不会启动研究。':'在设定的北京时间发一封摘要，仅含状态和工作台链接，不会启动研究。')+(digest.recipientPreview?'收件人：'+digest.recipientPreview+'。':'');
    byId('daily-digest-status').textContent=digest.requiresConfirmation?'投递配置已变更，请重新确认。':digest.enabled?'当前已启用。':'当前未启用。';
    byId('daily-digest-history').replaceChildren(...digest.history.map(item=>make('li',item.date+' · '+(emailStatuses[item.status]??'状态待核对'))));
  }
  byId('daily-status').textContent=data.autorun?'定时服务已启用。':'定时服务尚未启用，可以先保存问题。';
  const list=byId('daily-items');list.replaceChildren();
  for(const item of data.items){
    const card=make('section',undefined,'daily-item');
    card.append(make('h3',item.question),make('p',item.localTime+' · 北京时间 · '+(item.requiresReview?'运行配置变化，请确认后重新启用':item.enabled?'已启用':'已暂停'),'muted'));
    const edit=make('button','编辑','secondary');edit.type='button';
    edit.addEventListener('click',()=>{
      editingDaily=item.id;
      byId('daily-reset').hidden=false;
      byId('daily-question').value=item.question;
      byId('daily-time').value=item.localTime;
      byId('daily-enabled').checked=item.enabled;
      byId('daily-email').checked=item.emailConfirmed;
      byId('daily-digest-watch').checked=item.digestConfirmed;
      byId('daily-question').focus();
    });
    const toggle=make('button',item.requiresReview?'确认并重新启用':item.enabled?'暂停':'启用','secondary');toggle.type='button';
    toggle.addEventListener('click',async()=>{
      toggle.disabled=true;
      try{
        await api('/api/daily-watch/'+encodeURIComponent(item.id),{question:item.question,localTime:item.localTime,enabled:item.requiresReview||!item.enabled});
        await showDaily();
      }catch{byId('daily-status').textContent='操作未确认，请刷新状态。';toggle.disabled=false;}
    });
    card.append(edit,toggle);
    if(item.digestEnabled&&digest?.available&&!item.digestConfirmed)card.append(make('p','请重新确认此追踪是否纳入摘要。','muted'));
    else if(item.digestConfirmed)card.append(make('p','纳入每日邮件摘要。','muted'));
    if(item.emailEnabled&&data.emailAvailable&&!item.emailConfirmed)card.append(make('p','请重新确认邮件收件人。','muted'));
    if(item.history.length){
      const history=make('ul');
      for(const row of item.history){
        const li=make('li',row.date+' · '+(dailyStatuses[row.status]??'状态待核对')+(emailStatuses[row.emailStatus]?' · '+emailStatuses[row.emailStatus]:''));
        if(row.runId){
          const open=make('button','查看本轮对话','secondary');open.type='button';
          open.addEventListener('click',()=>void focusDailyTurn(row));
          li.append(open);
        }
        if(row.baseline){
          const reference=make('button','基线：'+row.baseline.date,'secondary');reference.type='button';
          reference.addEventListener('click',()=>void focusDailyTurn(row.baseline));
          li.append(reference);
        }else if(row.baseline===null)li.append(make('span',' · 无已核验基线','muted'));
        history.append(li);
      }
      card.append(history);
    }
    list.append(card);
  }
}
function refreshDaily(){void showDaily().catch(()=>{byId('daily-status').textContent='暂时读不到追踪状态。';});}
byId('daily-watch').addEventListener('toggle',()=>{if(byId('daily-watch').open)refreshDaily();});
byId('daily-refresh').addEventListener('click',refreshDaily);
byId('daily-reset').addEventListener('click',resetDaily);
byId('daily-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const save=byId('daily-save');if(save.disabled)return;save.disabled=true;
  try{
    if(!editingDaily)dailyRequestId??='w'+crypto.randomUUID().replaceAll('-','').slice(0,24);
    await api('/api/daily-watch'+(editingDaily?'/'+encodeURIComponent(editingDaily):''),{
      ...(editingDaily?{}:{requestId:dailyRequestId}),question:byId('daily-question').value,localTime:byId('daily-time').value,enabled:byId('daily-enabled').checked,
      ...(!byId('daily-digest-watch-choice').hidden?{digestEnabled:byId('daily-digest-watch').checked,...(byId('daily-digest-watch').checked?{digestConsentToken:dailyDigestToken}:{})}:{}),
      ...(!byId('daily-email-choice').hidden?{emailEnabled:byId('daily-email').checked,...(byId('daily-email').checked?{emailConsentToken:dailyEmailToken}:{})}:{}),
    });
    resetDaily();await showDaily();
  }catch{byId('daily-status').textContent='未确认保存，请先刷新状态。';}
  finally{save.disabled=false;}
});
byId('daily-digest-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const save=byId('daily-digest-save');if(save.disabled)return;save.disabled=true;
  try{
    const enabled=byId('daily-digest-on').checked;
    await api('/api/daily-digest',{localTime:byId('daily-digest-time').value,enabled,...(enabled?{consentToken:dailyDigestToken}:{})});
    await showDaily();
  }catch{byId('daily-digest-status').textContent='未确认保存，请刷新后再核对。';}
  finally{save.disabled=false;}
});
byId('history-toggle').addEventListener('click',()=>preserveReadingAnchor(()=>setHistoryOpen(!panelExpanded('history-toggle'))));
for(const id of ['history-toggle','history'])byId(id).addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!panelExpanded('history-toggle'))return;
  event.preventDefault();
  preserveReadingAnchor(()=>setHistoryOpen(false));
  byId('history-toggle').focus();
});
byId('evidence-toggle').addEventListener('click',()=>{
  workbench.lastCitation=null;
  preserveReadingAnchor(()=>setEvidenceOpen(!panelExpanded('evidence-toggle')));
});
byId('desktop-evidence').addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  event.preventDefault();
  preserveReadingAnchor(()=>setEvidenceOpen(false));
  byId('evidence-toggle').focus();
});
byId('history-search').addEventListener('input',()=>{if(state.workspace){refreshHistory();controls();}});
byId('question').addEventListener('input',()=>{if(!state.pending){saveDraft();controls();}});
byId('pdf-file').addEventListener('change',()=>{
  const file=byId('pdf-file').files?.[0];
  const toggle=byId('pdf-toggle');
  toggle.textContent=file?'已附 PDF':'＋ PDF';
  toggle.dataset.active=String(Boolean(file));
  if(file)toggle.title=file.name;else toggle.removeAttribute('title');
});
function updateChartSkillLabel(){
  const hasSkill=byId('chart-skill').value==='financial-chart@1';
  const trigger=byId('chart-skill-toggle');
  trigger.textContent=hasSkill?'金融图表':'选工具';
  trigger.dataset.active=String(hasSkill);
  byId('chart-skill-clear').hidden=!hasSkill;
}
function updateSettingsLabel(){
  const settings=byId('research-settings');
  settings.hidden=byId('research-depth-picker').hidden&&byId('reasoning-effort-picker').hidden;
  const active=(!byId('research-depth-picker').hidden&&byId('research-depth').value!=='auto') ||
    (!byId('reasoning-effort-picker').hidden&&Boolean(byId('reasoning-effort').value));
  const trigger=byId('research-settings-toggle');
  trigger.title=active?'设置（已选研究选项）':'设置';
  trigger.setAttribute('aria-label',trigger.title);
  trigger.dataset.active=String(active);
}
const composerOptions=['chart-skill-picker','pdf-picker','research-settings','mode-disclosure'];
function closeComposerOptions(except){
  for(const id of composerOptions){
    const panel=byId(id);
    if(panel!==except)panel.open=false;
  }
}
for(const id of composerOptions){
  const panel=byId(id);
  panel.addEventListener('toggle',()=>{if(panel.open){closeComposerOptions(panel);fitComposerPanels();}});
  panel.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!panel.open)return;
    event.preventDefault();
    panel.open=false;
    panel.querySelector('summary').focus({preventScroll:true});
  });
}
byId('chart-skill-clear').addEventListener('click',()=>{
  if(state.pending||state.submitting)return;
  byId('chart-skill').value='';
  updateChartSkillLabel();
  saveDraft();
  byId('chart-skill-picker').open=false;
  byId('chart-skill-toggle').focus({preventScroll:true});
});
byId('chart-skill').addEventListener('change',()=>{
  updateChartSkillLabel();
  if(!state.pending)saveDraft();
  byId('chart-skill-picker').open=false;
  byId('chart-skill-toggle').focus({preventScroll:true});
});
byId('source').addEventListener('change',()=>{if(!state.pending)saveDraft();});
for(const id of ['research-depth','reasoning-effort'])byId(id).addEventListener('change',()=>{
  updateSettingsLabel();
  if(!state.pending)saveDraft();
});
byId('close-evidence').addEventListener('click',()=>byId('mobile-evidence').close());
byId('mobile-evidence').addEventListener('close',()=>{
  if(!compactEvidence())return;
  byId('evidence-toggle').setAttribute('aria-expanded','false');
  const trigger=workbench.lastCitation;
  workbench.lastCitation=null;
  (trigger?.isConnected?trigger:byId('evidence-toggle')).focus({preventScroll:true});
});
byId('new').addEventListener('click',()=> {
  if (state.submitting || state.pending || !state.workspace) return;
  state.submitting=true; controls();
  create().catch(failed).finally(()=>{state.submitting=false;controls();});
});
byId('stop').addEventListener('click',stopCurrentRun);
byId('composer').addEventListener('submit',async e=>{
  e.preventDefault();
  if (state.submitting || state.detail?.messages.some(m=>m.working)) return;
  const q=byId('question');
  if (!q.value.trim() && !state.pending) return;
  if (liveMode() && !ownerMode() && !confirmLive()) return;
  try {
    message(); state.submitting=true; controls();
    closeComposerOptions();
    const original = formDraft();
    const file=!state.pending&&!byId('pdf-picker').hidden?byId('pdf-file').files[0]:null;
    const chartSkill=!state.pending&&!byId('chart-skill-picker').hidden?byId('chart-skill').value:'';
    if(file&&chartSkill){message('请在图表 Skill 和 PDF 附件之间选择一种。');return;}
    if (!state.conversation) await create(original);
    else if (!state.pending) saveDraft(original);
    let attachment;
    if(file) {
      if(file.size>1048576) throw new Error('PDF_UPLOAD_LIMIT');
      const response=await fetch('/api/conversations/'+state.conversation+'/pdf',{method:'POST',headers:{'content-type':'application/pdf','x-pdf-name':encodeURIComponent(file.name)},body:file});
      if(response.status===413)throw new Error('PDF_UPLOAD_LIMIT');
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error);
      attachment=payload.id;
    }
    state.pending ??= { conversationId:state.conversation,
      input:{messageId:'m'+Date.now()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,24),question:original.question,...(ownerMode()?{...(attachment?{attachmentId:attachment}:chartSkill?{chartSkill}:{}),researchDepth:original.researchDepth,...effortField(original.reasoningEffort)}:{sourceId:original.sourceId})} };
    sessionStorage.setItem(pendingKey(),JSON.stringify(state.pending));
    const {conversationId,input}=state.pending;
    await api('/api/conversations/'+conversationId+'/messages',liveMode()&&!ownerMode()?{...input,approveLive:true}:input);
    clearMatchingDraft(state.pending);
    state.pending=null; sessionStorage.removeItem(pendingKey()); q.value=''; byId('pdf-file').value='';byId('pdf-file').dispatchEvent(new Event('change'));
    byId('research-depth').value='auto'; byId('reasoning-effort').value=''; byId('chart-skill').value=''; updateChartSkillLabel(); updateSettingsLabel(); closeComposerOptions();
    await select(conversationId);
  } catch(error){ failed(error); }
  finally { state.submitting=false; controls(); }
});
try {
  initWorkbench();
  await load();
  const stored = sessionStorage.getItem(pendingKey());
  const legacy = sessionStorage.getItem('local-gui-pending@1')
    || (ownerMode() && sessionStorage.getItem('local-gui-pending@2:'+state.workspace.projectId));
  const pending=stored ? JSON.parse(stored):null;
  const anchor=conversationHash();
  const wanted=pending?.conversationId??anchor.conversationId;
  const existing=state.workspace.conversations.find(c=>c.id===wanted) ?? state.workspace.conversations[0];
  if(existing) {
    if (pending?.conversationId===existing.id) state.pending=pending;
    await select(existing.id,!pending&&anchor.conversationId===existing.id?anchor.messageId:undefined);
    if(state.pending) {
      if(state.detail?.messages.some(m=>m.id===pending.input.messageId && m.status!=='admission-pending')) {
        clearMatchingDraft(pending);
        sessionStorage.removeItem(pendingKey());
        state.pending=null; restoreDraft();
      } else message('上一笔提交仍待确认。重试将使用原消息编号。');
    }
  } else restoreDraft();
  if (!state.pending && !stored && legacy) message('发现旧版未确认提交，未重发。请先核对会话历史。');
  controls();
} catch(error) { failed(error); }
