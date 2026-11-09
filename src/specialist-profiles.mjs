import {open,constants,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {safeDirectory,ensureSafeDirectory,publishImmutable} from './storage-files.mjs';
import {sha256} from './source.mjs';
import {normalizeChildMethod} from './child.mjs';
import {normalizeChildExecution} from './child-execution.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>JSON.stringify(v,(_,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>sha256(canonical(v));
const exact=(v,fields)=>{if(!object(v)||Object.keys(v).sort().join(',')!==[...fields].sort().join(','))fail('SPECIALIST_FIELDS');};
const identifier=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const revision=v=>Number.isSafeInteger(v)&&v>0&&v<=256;
const name=v=>{if(typeof v!=='string'||!v.trim()||Buffer.byteLength(v)>160)fail('SPECIALIST_NAME');return v;};
const LIMIT=262144,MAX_GENERATIONS=256;
function profileInput(v){exact(v,['name','description','enabled','method']);name(v.name);if(typeof v.description!=='string'||Buffer.byteLength(v.description)>500||typeof v.enabled!=='boolean')fail('SPECIALIST_PROFILE');return{...v,method:normalizeChildMethod(v.method)};}
function refs(v){if(!Array.isArray(v)||v.length<1||v.length>8)fail('SPECIALIST_SELECTION');const seen=new Set();return v.map(x=>{exact(x,['profileId','revision']);if(!identifier(x.profileId)||!revision(x.revision)||seen.has(x.profileId))fail('SPECIALIST_SELECTION');seen.add(x.profileId);return{...x};});}
function presetInput(v){exact(v,['name','profiles']);return{name:name(v.name),profiles:refs(v.profiles)};}
function checkedRecord(r,kind){
 const fields=kind==='profile'?['profileId','revision','name','description','enabled','method','tombstone','contentSha256']:['presetId','revision','name','profiles','tombstone','contentSha256'];exact(r,[...fields,'creationInputSha256']);if(!hex(r.creationInputSha256))fail('SPECIALIST_CORRUPT');
 const {contentSha256,...content}=r;if(contentSha256!==hash(content)||!identifier(r[kind+'Id'])||!revision(r.revision)||typeof r.tombstone!=='boolean')fail('SPECIALIST_CORRUPT');
 if(kind==='profile'){profileInput({name:r.name,description:r.description,enabled:r.enabled,method:r.method});if(r.tombstone&&r.enabled)fail('SPECIALIST_CORRUPT');}else presetInput({name:r.name,profiles:r.profiles});return r;
}
const sealed=r=>({...r,contentSha256:hash(r)});
async function readJson(path){const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const stat=await f.stat();if(!stat.isFile()||stat.nlink!==1||stat.size>LIMIT)fail('SPECIALIST_UNSAFE_FILE');const b=Buffer.alloc(LIMIT+1);let size=0;for(;;){const r=await f.read(b,size,b.length-size);size+=r.bytesRead;if(!r.bytesRead||size===b.length)break;}if(size>LIMIT)fail('SPECIALIST_LIMIT');try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,size)));}catch{fail('SPECIALIST_CORRUPT');}}finally{await f.close();}}
function validateState(s,projectId,ordinal,previousSha256){
 exact(s,['schemaVersion','projectId','ordinal','previousSha256','profiles','presets']);if(s.schemaVersion!=='specialist-store@1'||s.projectId!==projectId)fail('SPECIALIST_SCOPE');if(s.ordinal!==ordinal||s.previousSha256!==previousSha256||!Array.isArray(s.profiles)||!Array.isArray(s.presets)||s.profiles.length>32||s.presets.length>32)fail('SPECIALIST_CORRUPT');
 for(const [kind,records]of [['profile',s.profiles],['preset',s.presets]]){const ids=new Set();for(const r of records){checkedRecord(r,kind);if(ids.has(r[kind+'Id']))fail('SPECIALIST_CORRUPT');ids.add(r[kind+'Id']);}}
 if(s.profiles.filter(p=>!p.tombstone).length>16||s.presets.filter(p=>!p.tombstone).length>16||s.profiles.filter(p=>p.enabled&&!p.tombstone).length>8)fail('SPECIALIST_CAPACITY');
}
/** Explicit project-local configuration, never authority, task queue or model execution. */
export async function openSpecialistProfiles({directory,projectId,create=false}){
 if(!identifier(projectId)||typeof create!=='boolean')fail('SPECIALIST_SCOPE');directory=create?await ensureSafeDirectory(directory):await safeDirectory(directory);
 async function read(){await safeDirectory(directory);const entries=await readdir(directory,{withFileTypes:true});const committed=entries.filter(e=>!e.name.startsWith('.'));
  if(!committed.length)fail('SPECIALIST_UNINITIALIZED');if(committed.length>MAX_GENERATIONS||committed.some(e=>!e.isFile()||!/^\d{8}\.json$/.test(e.name)))fail('SPECIALIST_CORRUPT');committed.sort((a,b)=>a.name.localeCompare(b.name));let last=null,previous=null;
  for(const [i,e]of committed.entries()){if(e.name!==String(i+1).padStart(8,'0')+'.json')fail('SPECIALIST_CORRUPT');const record=await readJson(join(directory,e.name));exact(record,['state','stateSha256']);if(hash(record.state)!==record.stateSha256)fail('SPECIALIST_CORRUPT');validateState(record.state,projectId,i+1,previous);last=record.state;previous=record.stateSha256;}
  return{state:last,sha256:previous};
 }
 async function publish(state){const bytes=Buffer.from(canonical({state,stateSha256:hash(state)})+'\n');if(bytes.length>LIMIT)fail('SPECIALIST_LIMIT');try{await publishImmutable(directory,String(state.ordinal).padStart(8,'0')+'.json',bytes);}catch(e){if(e.code==='EEXIST')fail('SPECIALIST_CONFLICT');throw e;}const d=await open(directory,'r');try{await d.sync();}finally{await d.close();}}
 if(create){const existing=await readdir(directory);if(existing.length===0)await publish({schemaVersion:'specialist-store@1',projectId,ordinal:1,previousSha256:null,profiles:[],presets:[]});}
 await read();
 async function mutate(kind,recordId,expected,input,remove=false,createId){const {state,sha256:previousSha256}=await read();const plural=kind==='profile'?'profiles':'presets',idKey=kind+'Id',items=state[plural];let next;
  if(recordId===null){const parsed=kind==='profile'?profileInput(input):presetInput(input);if(!identifier(createId))fail('SPECIALIST_CREATE_ID_REQUIRED');const existing=items.find(p=>p[idKey]===createId);if(existing){if(existing.creationInputSha256!==hash(parsed))fail('SPECIALIST_CONFLICT');return structuredClone(existing);}next=sealed({...parsed,[idKey]:createId,revision:1,tombstone:false,creationInputSha256:hash(parsed)});}
  else{if(!identifier(recordId)||!revision(expected))fail('SPECIALIST_SELECTION');const prior=items.find(p=>p[idKey]===recordId);if(!prior)fail('SPECIALIST_NOT_FOUND');if(prior.tombstone)fail('SPECIALIST_REMOVED');if(prior.revision!==expected)fail('SPECIALIST_CONFLICT');const parsed=remove?(kind==='profile'?{name:prior.name,description:prior.description,method:prior.method,enabled:false}:{name:prior.name,profiles:prior.profiles}):kind==='profile'?profileInput(input):presetInput(input);next=sealed({...parsed,[idKey]:recordId,revision:prior.revision+1,tombstone:remove,creationInputSha256:prior.creationInputSha256});}
  if(state.ordinal>=MAX_GENERATIONS)fail('SPECIALIST_HISTORY_LIMIT');
  if(kind==='preset'&&!remove)resolveProfiles(state,next.profiles);
  const result={...state,ordinal:state.ordinal+1,previousSha256,[plural]:recordId===null?[...items,next]:items.map(p=>p[idKey]===recordId?next:p)};validateState(result,projectId,result.ordinal,previousSha256);await publish(result);return structuredClone(next);
 }
 function resolveProfiles(state,selected){return refs(selected).map(ref=>{const p=state.profiles.find(p=>p.profileId===ref.profileId);if(!p)fail('SPECIALIST_NOT_FOUND');if(p.revision!==ref.revision)fail('SPECIALIST_STALE_PROFILE');if(p.tombstone||!p.enabled)fail('SPECIALIST_UNAVAILABLE');return p;});}
 return Object.freeze({
  async list(){const {state}=await read();return{projectId,profiles:state.profiles.filter(p=>!p.tombstone).map(({profileId,revision,name,description,enabled,contentSha256})=>({profileId,revision,name,description,enabled,contentSha256})),presets:state.presets.filter(p=>!p.tombstone).map(p=>structuredClone(p))};},
  async readProfile(profileId){if(!identifier(profileId))fail('SPECIALIST_SELECTION');const p=(await read()).state.profiles.find(p=>p.profileId===profileId);if(!p)fail('SPECIALIST_NOT_FOUND');return structuredClone(p);},
  async readPreset(presetId){if(!identifier(presetId))fail('SPECIALIST_SELECTION');const p=(await read()).state.presets.find(p=>p.presetId===presetId);if(!p)fail('SPECIALIST_NOT_FOUND');return structuredClone(p);},
  createProfile:(id,input)=>mutate('profile',null,null,input,false,id),updateProfile:(id,expected,input)=>mutate('profile',id,expected,input),removeProfile:(id,expected)=>mutate('profile',id,expected,null,true),
  createPreset:(id,input)=>mutate('preset',null,null,input,false,id),updatePreset:(id,expected,input)=>mutate('preset',id,expected,input),removePreset:(id,expected)=>mutate('preset',id,expected,null,true),
  async resolveSelection(selection){const {state}=await read();let selected,preset=null;
   if(Object.hasOwn(selection??{},'presetId')){exact(selection,['presetId','revision','maxChildren']);if(!identifier(selection.presetId)||!revision(selection.revision))fail('SPECIALIST_SELECTION');preset=state.presets.find(p=>p.presetId===selection.presetId);if(!preset||preset.tombstone)fail('SPECIALIST_UNAVAILABLE');if(preset.revision!==selection.revision)fail('SPECIALIST_STALE_PRESET');selected=preset.profiles;}
   else{exact(selection,['profiles','maxChildren']);selected=selection.profiles;}
   const profiles=resolveProfiles(state,selected),execution=normalizeChildExecution({schemaVersion:'child-execution@1',maxChildren:selection.maxChildren,methods:profiles.map(p=>p.method)});
   const metadata={schemaVersion:'specialist-selection@1',projectId,selection:structuredClone(selection),profiles:profiles.map(p=>({profileId:p.profileId,revision:p.revision,contentSha256:p.contentSha256,methodId:p.method.id,methodVersion:p.method.version,methodSha256:hash(p.method)})),...(preset?{preset:{presetId:preset.presetId,revision:preset.revision,contentSha256:preset.contentSha256}}:{})};
   return{execution,metadata:{...metadata,contentSha256:hash(metadata)}};
  }
 });
}

// Verify the frozen identity against its single canonical descriptor copy. No
// mutable catalog is consulted during ACK replay, worker startup or cold read.
export function verifySpecialistSelection(metadata,execution,projectId){
 exact(metadata,['schemaVersion','projectId','selection','profiles','contentSha256',...(metadata?.preset!==undefined?['preset']:[])]);
 const {contentSha256,...body}=metadata;
 if(metadata.schemaVersion!=='specialist-selection@1'||metadata.projectId!==projectId||hash(body)!==contentSha256)fail('SPECIALIST_FROZEN_CHANGED');
 const normalized=normalizeChildExecution(execution),s=metadata.selection;
 if(Object.hasOwn(s??{},'presetId')){exact(s,['presetId','revision','maxChildren']);if(!identifier(s.presetId)||!revision(s.revision))fail('SPECIALIST_SELECTION');exact(metadata.preset,['presetId','revision','contentSha256']);if(metadata.preset.presetId!==s.presetId||metadata.preset.revision!==s.revision||!hex(metadata.preset.contentSha256))fail('SPECIALIST_FROZEN_CHANGED');}
 else{exact(s,['profiles','maxChildren']);refs(s.profiles);if(metadata.preset!==undefined)fail('SPECIALIST_FROZEN_CHANGED');}
 if(s.profiles&&s.profiles.length!==normalized.methods.length)fail('SPECIALIST_FROZEN_CHANGED');
 if(normalized.maxChildren!==s.maxChildren||!Array.isArray(metadata.profiles)||metadata.profiles.length!==normalized.methods.length)fail('SPECIALIST_FROZEN_CHANGED');
 metadata.profiles.forEach((p,i)=>{exact(p,['profileId','revision','contentSha256','methodId','methodVersion','methodSha256']);const m=normalized.methods[i];if(!identifier(p.profileId)||!revision(p.revision)||!hex(p.contentSha256)||p.methodId!==m.id||p.methodVersion!==m.version||p.methodSha256!==hash(m)||s.profiles&&(p.profileId!==s.profiles[i]?.profileId||p.revision!==s.profiles[i]?.revision))fail('SPECIALIST_FROZEN_CHANGED');});
 if(new Set(metadata.profiles.map(p=>p.profileId)).size!==metadata.profiles.length)fail('SPECIALIST_FROZEN_CHANGED');
 return metadata;
}
