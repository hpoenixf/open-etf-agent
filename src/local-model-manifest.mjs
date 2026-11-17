import {lstat,realpath,readdir,open,constants} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const unsupported=()=>fail('MODEL_MANIFEST_UNSUPPORTED');
const hash=b=>createHash('sha256').update(b).digest('hex');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const label=s=>typeof s==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(s);
const safeConfig=v=>{if(object(v)){if(Object.hasOwn(v,'auto_map')||Object.hasOwn(v,'custom_pipelines'))unsupported();for(const x of Object.values(v))safeConfig(x);}else if(Array.isArray(v))for(const x of v)safeConfig(x);};
const changed=(a,b)=>a.dev!==b.dev||a.ino!==b.ino||a.size!==b.size||a.mtimeMs!==b.mtimeMs||a.ctimeMs!==b.ctimeMs;
/** Inventory operator-selected immutable local files, never load or download them.
 * Hashes establish byte identity, not weight validity, provenance or model quality.
 */
export async function prepareLocalModelManifest({modelDir,model,revision,dimensions,maxTokens,prompts,maxModelBytes=8*1024**3}={}){
 if(typeof modelDir!=='string'||!label(model)||!label(revision)||!Number.isSafeInteger(dimensions)||dimensions<1||dimensions>1024||!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>1048576||!object(prompts)||Object.keys(prompts).sort().join(',')!=='document,query'||Object.values(prompts).some(p=>typeof p!=='string'||Buffer.byteLength(p)>64000)||!Number.isSafeInteger(maxModelBytes)||maxModelBytes<1||maxModelBytes>8*1024**3)fail('MODEL_MANIFEST_INPUT');
 const fixed={model,revision,dimensions,maxTokens,prompts:{document:prompts.document,query:prompts.query}};
 const root=resolve(modelDir),rootStat=await lstat(root);if(!rootStat.isDirectory()||rootStat.isSymbolicLink()||await realpath(root)!==root)unsupported();
 const files=Object.create(null),configs=new Map(),directories=[];let total=0,count=0;
 async function walk(directory){
  const before=await lstat(directory);if(!before.isDirectory()||before.isSymbolicLink()||await realpath(directory)!==directory)unsupported();directories.push([directory,before]);
  for(const name of (await readdir(directory)).sort()){
   const path=join(directory,name),stat=await lstat(path);if(stat.isSymbolicLink())unsupported();
   if(stat.isDirectory()){if(directories.length>4096)fail('MODEL_MANIFEST_LIMIT');await walk(path);continue;}
   if(!stat.isFile()||/\.(py|pyc|bin|pt|pth|pkl|pickle)$/i.test(name))unsupported();
   if(++count>4096||stat.size>maxModelBytes-total)fail('MODEL_MANIFEST_LIMIT');
   const key=relative(root,path).split(sep).join('/');
   if(key.startsWith('../')||await realpath(path)!==path)unsupported();
   const isJson=name.endsWith('.json'),jsonLimit=key==='tokenizer.json'?32*1024**2:2097152;
   if(isJson&&stat.size>jsonLimit)fail('MODEL_MANIFEST_LIMIT');
   const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW),digest=createHash('sha256'),chunks=[];let bytes=0;
   try{
    const opened=await file.stat();if(!opened.isFile()||changed(stat,opened))fail('MODEL_MANIFEST_CHANGED');
    const buffer=Buffer.alloc(1048576);while(true){const {bytesRead}=await file.read(buffer,0,buffer.length,null);if(!bytesRead)break;bytes+=bytesRead;if(bytes>stat.size||total+bytes>maxModelBytes)fail('MODEL_MANIFEST_CHANGED');const chunk=buffer.subarray(0,bytesRead);digest.update(chunk);if(isJson)chunks.push(Buffer.from(chunk));}
    if(bytes!==stat.size||changed(stat,await file.stat()))fail('MODEL_MANIFEST_CHANGED');
   }finally{await file.close();}
   if(changed(stat,await lstat(path)))fail('MODEL_MANIFEST_CHANGED');
   files[key]=digest.digest('hex');total+=bytes;
   if(isJson){let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{unsupported();}safeConfig(value);configs.set(key,value);}
  }
 }
 await walk(root);
 for(const [path,stat]of directories)if(changed(stat,await lstat(path))||await realpath(path)!==path)fail('MODEL_MANIFEST_CHANGED');
 const modules=configs.get('modules.json'),allowed=new Set(['sentence_transformers.models.Transformer','sentence_transformers.models.Pooling','sentence_transformers.models.Normalize']);
 if(!Array.isArray(modules)||!modules.length||modules[0]?.type!=='sentence_transformers.models.Transformer'||!Object.keys(files).some(p=>p.endsWith('.safetensors')))unsupported();
 for(const m of modules){if(!object(m)||!allowed.has(m.type)||m.path!==undefined&&typeof m.path!=='string')unsupported();const path=m.path??'';if(path.startsWith('/')||path.split(/[\\/]/).includes('..')||path.includes('\\'))unsupported();const dir=resolve(root,path);if(dir!==root&&!dir.startsWith(root+sep))unsupported();if(!directories.some(([d])=>d===dir))unsupported();}
 const manifest={schemaVersion:'local-embedding-model@1',...fixed,files:Object.fromEntries(Object.entries(files).sort(([a],[b])=>a<b?-1:a>b?1:0))};
 const bytes=Buffer.from(JSON.stringify(manifest)+'\n');if(bytes.length>1048576)fail('MODEL_MANIFEST_LIMIT');
 return {manifest,manifestSha256:hash(bytes),modelBytes:total,fileCount:count};
}
export async function writeLocalModelManifest(options={}){
 if(typeof options.output!=='string'||typeof options.modelDir!=='string')fail('MODEL_MANIFEST_INPUT');const root=resolve(options.modelDir),output=resolve(options.output);
 const parent=await realpath(resolve(output,'..'));if(parent===root||parent.startsWith(root+sep))fail('MODEL_MANIFEST_OUTPUT_SCOPE');
 const result=await prepareLocalModelManifest(options),file=await open(output,'wx',0o600);
 try{await file.writeFile(JSON.stringify(result.manifest)+'\n');await file.sync();}finally{await file.close();}
 return result;
}
