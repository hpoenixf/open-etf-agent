import {renderMarkdown} from '/markdown.mjs';

const get=id=>document.getElementById(id);
const storageKey='open-etf-guest-tab@1';
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
let state={token:null,history:[]};
try {
  const saved=JSON.parse(sessionStorage.getItem(storageKey)??'null');
  if (saved && typeof saved.token==='string' && tokenPattern.test(saved.token) && Array.isArray(saved.history)
      && saved.history.every(turn=>typeof turn?.question==='string'&&typeof turn?.answer==='string')) state=saved;
} catch { /* Browser storage may be unavailable; do not use persistent storage. */ }

function save() {
  try {
    if (state.token) sessionStorage.setItem(storageKey,JSON.stringify(state));
    else sessionStorage.removeItem(storageKey);
  } catch { /* Stay in this page's memory in private/restricted storage mode. */ }
}
function put(id,text) { get(id).textContent=text; }
function render() {
  get('entry').hidden=Boolean(state.token);
  get('chat').hidden=!state.token;
  get('logout').hidden=!state.token;
  const transcript=get('transcript');
  transcript.replaceChildren();
  for (const turn of state.history) {
    const q=document.createElement('li'), a=document.createElement('li');
    q.className='query';
    q.textContent=turn.question;
    a.append(renderMarkdown(document,turn.answer));
    transcript.append(q,a);
  }
}
async function post(path,data,token,signal) {
  const response=await fetch('/api/guest/'+path,{method:'POST',cache:'no-store',credentials:'omit',
    headers:{'content-type':'application/json',...(token?{'x-etf-guest-session':token}:{})},body:JSON.stringify(data),signal});
  const value=await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error),{status:response.status});
  return value;
}

let answerFlight, stateEpoch=0;
function erase() {
  stateEpoch++;
  answerFlight?.abort();
  state={token:null,history:[]}; save(); render();
  get('question').value=''; get('phrase').focus();
}
get('login').addEventListener('submit',async event=>{
  event.preventDefault();
  const phrase=get('phrase'), submit=get('login').querySelector('button');
  const value=phrase.value;
  phrase.value=''; submit.disabled=true; put('notice','正在登录…');
  try {
    const {token}=await post('sign-in',{phrase:value});
    if (!tokenPattern.test(token)) throw new Error('GUEST_UNAVAILABLE');
    state={token,history:[]}; save();render();put('notice','');get('question').focus();
  } catch(error) { put('notice',error.status===429?'访问尝试过多，请稍后再试。':error.status===401?'游客口令不正确。':'暂时无法登录，请稍后再试。'); }
  finally { submit.disabled=false; }
});

get('logout').addEventListener('click',()=>{
  const token=state.token;
  erase();put('notice','已清除此标签页的游客对话。');
  if (token) void post('sign-out',{},token).catch(()=>{});
});

get('composer').addEventListener('submit',async event=>{
  event.preventDefault();
  if (answerFlight||!state.token) return;
  const question=get('question'), submit=get('composer').querySelector('button');
  const value=question.value.trim();
  if (!value) return;
  const epoch=stateEpoch;
  const flight=new AbortController();answerFlight=flight;
  submit.disabled=true;put('notice','正在回答…');
  try {
    const {answer}=await post('answer',{question:value,history:state.history},state.token,flight.signal);
    if(epoch!==stateEpoch) return;
    state.history.push({question:value,answer});
    save();render();if(question.value.trim()===value) question.value='';
    put('notice','');
  } catch(error) {
    if(epoch!==stateEpoch) return;
    if(error.status===401) { erase();put('notice','游客会话已结束，请重新登录。'); }
    else put('notice',error.status===413?'对话已超过模型可处理的长度。退出后可以开启新对话。':'本次未能回答，没有自动重试。');
  } finally { if(answerFlight===flight) answerFlight=null;submit.disabled=false; }
});
if (state.token) {
  // Do not paint cached data until the restored token is still a guest session.
  get('entry').hidden=true;
  const current=state.token;
  post('status',{},current).then(()=>{if(state.token===current)render();}).catch(error=>{
    if(state.token!==current)return;
    if(error.status===401){erase();put('notice','游客会话已结束，请重新登录。');}
    else { get('logout').hidden=false;put('notice','无法核验游客会话，刷新页面重试或退出清除对话。'); }
  });
} else render();
