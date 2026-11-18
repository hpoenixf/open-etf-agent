import {open,constants,mkdir,lstat,readdir,unlink} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {safeDirectory,publishImmutable} from './storage-files.mjs';
import {importProjectSources,loadProjectSources} from './project-sources.mjs';
import {sha256} from './source.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>sha256(canonical(v));
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==keys.split(',').sort().join(','))fail('MATERIAL_CORRUPT');};
const LIMIT=524288,MAX_GENERATIONS=256;
const name=n=>String(n).padStart(8,'0')+'.json';
async function read(path,recover=false){
 let f;try{
  await safeDirectory(dirname(path));f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const stat=await f.stat();
  if(!stat.isFile()||![1,2].includes(stat.nlink)||stat.size>LIMIT)fail('MATERIAL_UNSAFE_FILE');
  const bytes=Buffer.alloc(LIMIT+1);let size=0;while(size<bytes.length){const r=await f.read(bytes,size,bytes.length-size);size+=r.bytesRead;if(!r.bytesRead)break;}
  if(size>LIMIT)fail('MATERIAL_LIMIT');let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,size)));}catch{fail('MATERIAL_CORRUPT');}
  if(stat.nlink===2){
   // publishImmutable can be interrupted between link and temporary-name unlink.
   // Only its exact UUID temporary sibling on the same inode is recoverable;
   // an arbitrary external hardlink is never accepted or unlinked.
   const prefix='.'+basename(path)+'-',matches=[];
   for(const name of await readdir(dirname(path))){if(!name.startsWith(prefix)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(name.slice(prefix.length)))continue;
    const temp=join(dirname(path),name);let candidate;try{candidate=await lstat(temp);}catch(e){if(e.code==='ENOENT')continue;throw e;}
    if(candidate.isFile()&&!candidate.isSymbolicLink()&&candidate.dev===stat.dev&&candidate.ino===stat.ino)matches.push(temp);
   }
   const current=await f.stat();
   if(current.nlink===2){if(matches.length!==1)fail('MATERIAL_UNSAFE_FILE');if(!recover)fail('MATERIAL_RECOVERY_NEEDED');
    const named=await lstat(path),temp=await lstat(matches[0]);if(!named.isFile()||named.isSymbolicLink()||!temp.isFile()||temp.isSymbolicLink()||named.dev!==stat.dev||named.ino!==stat.ino||temp.dev!==stat.dev||temp.ino!==stat.ino||temp.nlink!==2)fail('MATERIAL_UNSAFE_FILE');
    await unlink(matches[0]);const dir=await open(dirname(path),'r');try{await dir.sync();}finally{await dir.close();}
   }else if(current.nlink!==1)fail('MATERIAL_UNSAFE_FILE');
   if((await f.stat()).nlink!==1)fail('MATERIAL_UNSAFE_FILE');
  }
  return value;
 }finally{await f?.close();}
}
function validate(s,projectId,ordinal,previousSha256){
 exact(s,'schemaVersion,projectId,ordinal,previousSha256,materials');
 if(s.schemaVersion!=='research-materials@1'||s.projectId!==projectId||s.ordinal!==ordinal||s.previousSha256!==previousSha256||!Array.isArray(s.materials)||s.materials.length>64)fail('MATERIAL_CORRUPT');
 const ids=new Set();for(const m of s.materials){exact(m,'id,revision,removed,versions');if(!id(m.id)||ids.has(m.id)||typeof m.removed!=='boolean'||!Array.isArray(m.versions)||!m.versions.length||m.versions.length>32||m.revision!==m.versions.length+(m.removed?1:0))fail('MATERIAL_CORRUPT');ids.add(m.id);
 const keys=new Set();for(const [i,v]of m.versions.entries()){exact(v,'version,manifestSha256,contentKey');if(v.version!==i+1||!hex(v.manifestSha256)||!hex(v.contentKey)||keys.has(v.contentKey))fail('MATERIAL_CORRUPT');keys.add(v.contentKey);}}
}
// Equivalence includes interpretation, not merely original bytes. Filename is
// descriptive and deliberately not an identity. PDF parser identity is sealed
// by the existing snapshot; text uses the existing UTF-8 page contract.
function contentKey(bundle){const f=bundle.manifest.files[0];return hash({kind:f.kind,originalSha256:f.originalSha256,interpretation:f.kind==='text'?'utf8-pages-v1':f.snapshotSha256});}
/** Project-local selection history, NOT current authorization or a task owner. */
export async function openResearchMaterials({projectDir,projectId,create=false,recover=false}={}){
 if(!id(projectId)||typeof create!=='boolean'||typeof recover!=='boolean'||create&&recover)fail('MATERIAL_SCOPE');
 projectDir=await safeDirectory(resolve(projectDir));const directory=join(projectDir,'materials'),registration=join(projectDir,'.materials-registration');
 async function durable(dir,file,value,signal){const bytes=Buffer.from(canonical(value)+'\n');if(bytes.length>LIMIT)fail('MATERIAL_LIMIT');await publishImmutable(dir,file,bytes,signal);const f=await open(dir,'r');try{await f.sync();}finally{await f.close();}}
 async function immutable(dir,file,value){try{await durable(dir,file,value);}catch(e){if(e.code!=='EEXIST')throw e;if(canonical(await read(join(dir,file)))!==canonical(value))fail('MATERIAL_CORRUPT');}}
 // Prepared state is durable first. The exclusive seal link is the sole CAS /
 // linearization point; no persistent lock and no automatic redispatch on loss.
 async function publish(state,signal){signal?.throwIfAborted();if(state.ordinal>MAX_GENERATIONS)fail('MATERIAL_LIMIT');const record={state,stateSha256:hash(state)};
 await immutable(registration,'.prepared-'+record.stateSha256+'.json',record);signal?.throwIfAborted();
 try{await durable(registration,name(state.ordinal),{ordinal:state.ordinal,stateSha256:record.stateSha256},signal);}catch(e){if(e.code==='EEXIST')fail('MATERIAL_CONFLICT');throw e;}
 await immutable(directory,name(state.ordinal),record);
 }
 let registered=true;try{await lstat(registration);}catch(e){if(e.code!=='ENOENT')throw e;registered=false;}
 if(!registered){if(!create)fail('MATERIAL_NOT_INITIALIZED');try{await lstat(directory);fail('MATERIAL_REGISTRATION_MISSING');}catch(e){if(e.code!=='ENOENT')throw e;}
 try{await mkdir(registration);}catch(e){if(e.code==='EEXIST')fail('MATERIAL_CONFLICT');throw e;}
 await durable(registration,'identity.json',{schemaVersion:'research-material-registration@1',projectId});const parent=await open(projectDir,'r');try{await parent.sync();}finally{await parent.close();}
 await mkdir(directory);await publish({schemaVersion:'research-materials@1',projectId,ordinal:1,previousSha256:null,materials:[]});}
 await safeDirectory(registration);await safeDirectory(directory);
 if(canonical(await read(join(registration,'identity.json'),recover))!==canonical({schemaVersion:'research-material-registration@1',projectId}))fail('MATERIAL_SCOPE');
 async function head(repair=false){await safeDirectory(registration);await safeDirectory(directory);
 const seals=(await readdir(registration)).filter(n=>n!=='identity.json'&&!n.startsWith('.')).sort();if(!seals.length||seals.length>MAX_GENERATIONS)fail('MATERIAL_CORRUPT');let last=null,previous=null;const repairs=[];
 for(const [i,file]of seals.entries()){if(file!==name(i+1))fail('MATERIAL_CORRUPT');const seal=await read(join(registration,file),repair);exact(seal,'ordinal,stateSha256');if(seal.ordinal!==i+1||!hex(seal.stateSha256))fail('MATERIAL_CORRUPT');let record,missing=false;
 try{record=await read(join(directory,file),repair);}catch(e){if(e.code!=='ENOENT')throw e;missing=true;try{record=await read(join(registration,'.prepared-'+seal.stateSha256+'.json'),repair);}catch(e){if(e.code==='ENOENT')fail('MATERIAL_HEAD_MISSING');throw e;}}
 exact(record,'state,stateSha256');if(record.stateSha256!==seal.stateSha256||hash(record.state)!==record.stateSha256)fail('MATERIAL_CORRUPT');validate(record.state,projectId,i+1,previous);if(missing)repairs.push({file,record});last=record.state;previous=record.stateSha256;}
 const entries=await readdir(directory,{withFileTypes:true});
 if(canonical((await readdir(registration)).filter(n=>n!=='identity.json'&&!n.startsWith('.')).sort())!==canonical(seals))fail('MATERIAL_CONFLICT');
 for(const entry of entries){if(entry.name.startsWith('.'))continue;if(!entry.isFile()||!seals.includes(entry.name))fail('MATERIAL_CORRUPT');}
 if(repairs.length&&!repair)fail('MATERIAL_RECOVERY_NEEDED');for(const r of repairs)await immutable(directory,r.file,r.record);return{state:last,sha256:previous};
 }
 if(recover){
  // Prepared losers are not committed state, but a crashed publication can leave
  // their known immutable object with its owned temporary hardlink too.
  const names=await readdir(registration);if(names.length>4096)fail('MATERIAL_LIMIT');
  for(const file of names){if(!/^\.prepared-[a-f0-9]{64}\.json$/.test(file))continue;const record=await read(join(registration,file),true);exact(record,'state,stateSha256');if(!hex(record.stateSha256)||file!=='.prepared-'+record.stateSha256+'.json'||hash(record.state)!==record.stateSha256)fail('MATERIAL_CORRUPT');}
 }
 await head(recover);
 const find=(state,key)=>{if(!id(key))fail('MATERIAL_ID');const m=state.materials.find(m=>m.id===key);if(!m)fail('MATERIAL_NOT_FOUND');return m;};
 async function mutate({id:key,file,expectedRevision,signal},remove=false){if(!id(key))fail('MATERIAL_ID');signal?.throwIfAborted();const before=await head(),prior=before.state.materials.find(m=>m.id===key);
 if(expectedRevision!==undefined&&!positive(expectedRevision))fail('MATERIAL_CONFLICT');
 if(prior?.removed){if(remove&&expectedRevision===prior.revision-1)return structuredClone(prior);fail('MATERIAL_REMOVED');}if(remove&&!prior)fail('MATERIAL_NOT_FOUND');
 let next;if(remove){if(expectedRevision!==prior.revision)fail('MATERIAL_CONFLICT');next={...prior,revision:prior.revision+1,removed:true};}
 else{const bundle=await importProjectSources({projectDir,files:[file],signal}),keyHash=contentKey(bundle),existing=prior?.versions.find(v=>v.contentKey===keyHash);
 if(existing){if(existing.version!==prior.versions.length)fail('MATERIAL_HISTORICAL_CONTENT');if(expectedRevision!==undefined&&expectedRevision!==prior.revision&&expectedRevision!==prior.revision-1)fail('MATERIAL_CONFLICT');if((await head()).sha256!==before.sha256)fail('MATERIAL_CONFLICT');return structuredClone(prior);}if(prior?expectedRevision!==prior.revision:expectedRevision!==undefined)fail('MATERIAL_CONFLICT');
 if((!prior&&before.state.materials.length>=64)||(prior&&prior.versions.length>=32))fail('MATERIAL_LIMIT');
 next={id:key,revision:(prior?.revision??0)+1,removed:false,versions:[...(prior?.versions??[]),{version:(prior?.versions.length??0)+1,manifestSha256:bundle.manifestSha256,contentKey:keyHash}]};}
 const state={...before.state,ordinal:before.state.ordinal+1,previousSha256:before.sha256,materials:prior?before.state.materials.map(m=>m.id===key?next:m):[...before.state.materials,next]};validate(state,projectId,state.ordinal,before.sha256);await publish(state,signal);return structuredClone(next);
 }
 return Object.freeze({list:async()=>structuredClone((await head()).state.materials.filter(m=>!m.removed)),read:async key=>structuredClone(find((await head()).state,key)),import:input=>mutate(input),remove:input=>mutate(input,true),
 async select({id:key,version}){const m=find((await head()).state,key);if(m.removed)fail('MATERIAL_REMOVED');if(!positive(version))fail('MATERIAL_VERSION');const v=m.versions.find(v=>v.version===version);if(!v)fail('MATERIAL_VERSION');const bundle=await loadProjectSources({projectDir,manifestSha256:v.manifestSha256});if(contentKey(bundle)!==v.contentKey)fail('MATERIAL_CORRUPT');return structuredClone(v);}
 });
}
