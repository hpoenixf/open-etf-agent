const byId = id => document.getElementById(id);
const state = { workspace: null, conversation: null, detail: null, poll: null, submitting: false, pending: null, failures: 0, selection:0, progress:new Map() };
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
function formDraft() {
  return { question:byId('question').value, sourceId:byId('source').value };
}
function saveDraft(draft=formDraft(), id=state.conversation) {
  if (!state.workspace) return;
  try {
    if (draft.question || draft.sourceId !== state.workspace.sources[0]?.id) {
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
}
function clearMatchingDraft({conversationId,input}) {
  const saved = readDraft(conversationId);
  if (saved?.question !== input.question || !ownerMode() && saved?.sourceId !== input.sourceId) return;
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
function controls() {
  const working = state.detail?.messages.some(m => m.working);
  byId('send').disabled = state.submitting || working === true || !state.workspace;
  byId('send').textContent = state.pending ? '重试原提交' : liveMode() ? '提交真实模型' : '提交演练';
  byId('question').readOnly = Boolean(state.submitting || state.pending);
  byId('pdf-file').disabled = Boolean(state.submitting || state.pending);
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
function showEvidence(source,index) {
  const node = byId('evidence-template').content.cloneNode(true);
  node.querySelector('h3').textContent = '来源 ['+index+']'+(source.pdfPage?' · PDF 第 '+source.pdfPage+' 页':'');
  node.querySelector('pre').textContent = source.text;
  node.querySelector('small').textContent = source.sha256 ? 'SHA-256 '+source.sha256 : '';
  if (window.matchMedia('(max-width:930px)').matches) {
    byId('mobile-evidence-content').replaceChildren(node);
    if (!byId('mobile-evidence').open) byId('mobile-evidence').showModal();
  } else {
    byId('desktop-evidence').replaceChildren(make('h2','来源与核对'),node);
  }
}
function progressContent(target, value) {
  target.replaceChildren();
  if (!value || value.status!=='available' || !value.steps?.length) {
    target.append(make('p',value?.status==='unavailable'?'暂未读到可显示的研究记录。':'尚无已记录的步骤。','muted'));
    return;
  }
  if(value.omitted>0)target.append(make('p','仅展示最近的步骤。','muted'));
  const list=make('ol');
  for(const step of value.steps)list.append(make('li',step.label));
  target.append(list);
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
function progressDetails(message) {
  const details=make('details',undefined,'research-progress');
  const content=make('div',undefined,'research-progress-body');
  const conversation=state.conversation;
  const entry=state.progress.get(message.id)??{open:false};
  entry.content=content;
  state.progress.set(message.id,entry);
  details.append(make('summary','研究进度'),make('p','仅展示实际执行记录，不包含模型内部推理。','muted'),content);
  progressContent(content,entry.data);
  details.open=entry.open;
  details.addEventListener('toggle',()=>{
    if(!details.isConnected)return;
    entry.open=details.open;
    if(details.open)void loadProgress(conversation,entry,message);
  });
  if(details.open)void loadProgress(conversation,entry,message);
  return details;
}
function render() {
  const t = byId('transcript');
  t.replaceChildren();
  for (const m of state.detail?.messages ?? []) {
    const article = make('article',undefined,'turn'), header = make('div',undefined,'turn-header');
    const isUnknown = /UNKNOWN|MISSING/.test(m.code ?? '');
    const status = isUnknown ? '结果未知' : m.working ? phaseLabels[m.phase] ?? '处理中' : statusLabels[m.status] ?? '状态待核对';
    header.append(make('strong','你'),make('span',status,'state'));
    article.append(header,make('p',m.question ?? '问题尚未读回','question'));
    if(m.attachment) article.append(make('p','PDF：'+m.attachment.name+' · '+m.attachment.pages+' 页','muted'));
    article.append(progressDetails(m));
    const providerFailure=(/^PROVIDER_HTTP_(403|429)$/).exec(m.code??'');
    if (providerFailure) {
      const guidance=providerFailure[1]==='403'?'提供方拒绝访问，请核对账户、地区及模型权限。'
        :'提供方限制了请求，请核对可用额度或频率。';
      article.append(make('p',m.code+' · '+guidance+' 本次未自动重发。','warning'));
    }
    if (m.output?.warning) article.append(make('p',m.output.warning,'warning'));
    if (m.output?.answer && m.output.answer !== m.output?.report?.text) article.append(make('pre',m.output.answer));
    if (m.output?.report) {
      article.append(make('h3','已保存的报告'),make('pre',m.output.report.text));
    } else if (m.error || m.status==='completed') {
      article.append(make('p','没有读到已保存报告。','muted'));
    }
    for (const [i,source] of (m.output?.sources ?? []).entries()) {
      const citation = make('button','核对来源 ['+(i+1)+']','secondary');
      citation.type='button'; citation.addEventListener('click',() => showEvidence(source,i+1)); article.append(citation);
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
    if(actions.childElementCount) article.append(actions);
    if (m.status === 'active' && !isUnknown && (!ownerMode() || m.sourceId===null || m.attachment)) {
      const action = m.working ? 'cancel' : 'work';
      const b = make('button',m.working?'取消本次':'继续原任务','secondary');
      b.type='button'; b.addEventListener('click',async()=> {
        try {
          if (liveMode() && !ownerMode() && action==='work' && !confirmLive()) return;
          await api('/api/conversations/'+state.conversation+'/messages/'+m.id+'/'+action,
            liveMode()&&!ownerMode()&&action==='work'?{approveLive:true}:{});
          await refresh();
        } catch(e) { failed(e); }
      });
      article.append(b);
    }
    t.append(article);
  }
  byId('intro').hidden = (state.detail?.messages.length ?? 0)>0;
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
  const detail = await api('/api/conversations/'+selected);
  if (state.selection !== selection) return;
  state.failures = 0;
  const old = JSON.stringify(state.detail);
  state.detail = detail;
  const row = state.workspace.conversations.find(c=>c.id===selected);
  const title = detail.title;
  if (row && row.title !== title) { row.title=title; refreshHistory(); controls(); }
  if (old !== JSON.stringify(detail)) render();
  else for (const item of detail.messages){const entry=state.progress.get(item.id);if(entry?.open)void loadProgress(selected,entry,item);}
  scheduleRefresh();
}
async function select(id) {
  if (state.pending && state.pending.conversationId !== id) return;
  if (state.conversation !== id) {
    state.progress.clear();
    message();
    if(state.conversation)byId('pdf-file').value='';
    const dialog=byId('mobile-evidence');
    if (dialog.open) dialog.close();
    byId('mobile-evidence-content').replaceChildren();
    byId('desktop-evidence').replaceChildren(make('h2','来源与核对'),make('p','选中报告的引用，即可核对保存的原文。','muted'));
  }
  clearTimeout(state.poll);
  state.selection++; state.conversation=id; state.detail=null;
  restoreDraft();
  location.hash=id;
  refreshHistory();
  byId('history').dataset.open='false'; byId('history-toggle').setAttribute('aria-expanded','false');
  render();
  await refresh();
}
async function load() {
  state.workspace = await api('/api/workspace');
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
byId('history-toggle').addEventListener('click',()=> {
  const b = byId('history-toggle'), isOpen=b.getAttribute('aria-expanded')==='true';
  b.setAttribute('aria-expanded',String(!isOpen)); byId('history').dataset.open=String(!isOpen);
});
byId('history-search').addEventListener('input',()=>{if(state.workspace){refreshHistory();controls();}});
byId('question').addEventListener('input',()=>{if(!state.pending){saveDraft();controls();}});
byId('source').addEventListener('change',()=>{if(!state.pending)saveDraft();});
byId('close-evidence').addEventListener('click',()=>byId('mobile-evidence').close());
byId('new').addEventListener('click',()=> {
  if (state.submitting || state.pending || !state.workspace) return;
  state.submitting=true; controls();
  create().catch(failed).finally(()=>{state.submitting=false;controls();});
});
byId('composer').addEventListener('submit',async e=>{
  e.preventDefault();
  if (state.submitting) return;
  const q=byId('question');
  if (!q.value.trim() && !state.pending) return;
  if (liveMode() && !ownerMode() && !confirmLive()) return;
  try {
    message(); state.submitting=true; controls();
    const original = formDraft();
    const file=!state.pending&&!byId('pdf-picker').hidden?byId('pdf-file').files[0]:null;
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
      input:{messageId:'m'+Date.now()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,24),question:original.question,...(ownerMode()?(attachment?{attachmentId:attachment}:{}):{sourceId:original.sourceId})} };
    sessionStorage.setItem(pendingKey(),JSON.stringify(state.pending));
    const {conversationId,input}=state.pending;
    await api('/api/conversations/'+conversationId+'/messages',liveMode()&&!ownerMode()?{...input,approveLive:true}:input);
    clearMatchingDraft(state.pending);
    state.pending=null; sessionStorage.removeItem(pendingKey()); q.value=''; byId('pdf-file').value='';
    await select(conversationId);
  } catch(error){ failed(error); }
  finally { state.submitting=false; controls(); }
});
try {
  await load();
  const stored = sessionStorage.getItem(pendingKey());
  const legacy = sessionStorage.getItem('local-gui-pending@1')
    || (ownerMode() && sessionStorage.getItem('local-gui-pending@2:'+state.workspace.projectId));
  const pending=stored ? JSON.parse(stored):null;
  const wanted=pending?.conversationId ?? location.hash.slice(1);
  const existing=state.workspace.conversations.find(c=>c.id===wanted) ?? state.workspace.conversations[0];
  if(existing) {
    if (pending?.conversationId===existing.id) state.pending=pending;
    await select(existing.id);
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
