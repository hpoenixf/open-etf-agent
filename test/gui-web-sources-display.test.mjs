import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createContext,runInContext} from 'node:vm';

const source=await readFile(new URL('../src/gui/gui.mjs',import.meta.url),'utf8');
function setup(){
 const calls=[], requests=[];
 const make=(tag,text,cls)=>({
  tag,text,cls,children:[],isConnected:true,listeners:{},open:false,
  get childElementCount(){return this.children.length;},
  append(...nodes){this.children.push(...nodes);},
  replaceChildren(...nodes){this.children=nodes;},
  addEventListener(type,fn){this.listeners[type]=fn;},
  toggle(open){this.open=open;this.listeners.toggle?.();}
 });
 const state={workspace:{projectId:'owner-a'},conversation:'conv',selection:1,readSources:new Map()};
 const api=path=>{calls.push(path);return new Promise(resolve=>requests.push(resolve));};
 const context=createContext({make,state,api,URL});
 const excerpt=source.slice(source.indexOf('function originalWebLink('),source.indexOf('function render() {'));
 const details=runInContext(excerpt+'\nreadSourcesDetails',context);
 return {details,calls,requests,state};
}
const web=(url='https://example.org/a')=>({
 kind:'web-original-excerpt',url,page:2,pages:3,text:'<img src=x onerror=alert(1)>',
 id:'source-'+'a'.repeat(64),sha256:'b'.repeat(64)
});
const result=(readSources,projectId='owner-a')=>({projectId,conversationId:'conv',messageId:'turn',availability:'available',readSources});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('collapsed per-turn evidence does not fetch; opening shows exact saved excerpt and safe original link',async()=>{
 const {details,calls,requests}=setup();
 const view=details({id:'turn'});
 assert.equal(view.open,false);
 assert.match(view.children[0].text,/不等于已引用/);
 assert.deepEqual(calls,[]);
 view.toggle(true);
 assert.deepEqual(calls,['/api/conversations/conv/messages/turn/sources']);
 requests[0](result([web(),web('http://example.org'),web('javascript:alert(1)'),web('https://user@example.org'),web('https://example.org/#fake'),web('https://example.org/?private')]));
 await flush();
 const [excerpt]=view.children[1].children;
 assert.equal(view.children[1].children.length,1);
 assert.equal(excerpt.open,false);
 assert.equal(excerpt.children[0].text,'example.org · 原文摘录 2/3');
 const [,link,text]=excerpt.children;
 assert.equal(link.href,'https://example.org/a');
 assert.equal(link.rel,'noopener noreferrer');
 assert.equal(link.target,'_blank');
 assert.equal(link.referrerPolicy,'no-referrer');
 assert.equal(text.tag,'pre');
 assert.equal(text.text,web().text);
 assert.equal(calls.length,1,'no external request needed to display the saved excerpt');
});

test('a stale response from reused turn IDs cannot reach another workspace or conversation',async()=>{
 const {details,calls,requests,state}=setup();
 const old=details({id:'turn'});
 old.toggle(true);
 state.workspace={projectId:'owner-b'};
 state.selection++;
 state.readSources.clear();
 const newer=details({id:'turn'});
 newer.toggle(true);
 requests[0](result([web('https://old-owner.example.org/')]));
 requests[1]({...result([],'owner-b'),availability:'none'});
 await flush();
 assert.equal(calls.length,2);
 assert.match(newer.children[1].children[0].text,/没有查到/);
 assert.doesNotMatch(old.children[1].children[0].text,/old-owner/);
 newer.toggle(false);
 newer.toggle(true);
 assert.equal(calls.length,3);
 requests[2]({...result([web()],'owner-b'),messageId:'alien'});
 await flush();
 assert.match(newer.children[1].children[0].text,/无法核对/);
});

test('credential can rotate before workspace refresh: same conversation and turn IDs never display wrong-project text or cache it',async()=>{
 const {details,calls,requests,state}=setup();
 const mountedWorkspace=state.workspace;
 const view=details({id:'turn'});
 view.toggle(true);
 // A new credential routed this exact request to another owner, but until
 // workspace refresh all the local selection and cache identities still match.
 assert.equal(state.workspace,mountedWorkspace);
 const other={...web('https://wrong-owner.example.org/'),text:'FOREIGN EXCERPT'};
 requests[0](result([other],'owner-b'));
 await flush();
 assert.doesNotMatch(JSON.stringify(view.children[1]),/FOREIGN EXCERPT|wrong-owner/);
 assert.match(view.children[1].children[0].text,/无法核对/);
 assert.equal(state.readSources.get('turn').value.readSources,undefined);
 view.toggle(false);
 view.toggle(true);
 const {projectId,...noProject}=result([other]);
 requests[1](noProject);
 await flush();
 assert.match(view.children[1].children[0].text,/无法核对/);
 assert.equal(state.readSources.get('turn').value.readSources,undefined);
 view.toggle(false);
 view.toggle(true);
 requests[2](result([web()]));
 await flush();
 assert.equal(calls.length,3);
 assert.equal(view.children[1].children[0].children[1].href,'https://example.org/a');
});
