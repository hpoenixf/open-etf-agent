import {open,constants,lstat,realpath} from 'node:fs/promises';
import {resolve,join,dirname,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {registerHooks,isBuiltin} from 'node:module';
import {safeDirectory,ensureSafeDirectory,publishImmutable} from './storage-files.mjs';
import {sha256} from './source.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const snapshots=new Set();let hooks;
function registerSnapshot(url){
 snapshots.add(url);
 hooks??=registerHooks({resolve(specifier,context,nextResolve){
  if(snapshots.has(context.parentURL)&&!isBuiltin(specifier)&&!isAbsolute(specifier)&&!specifier.startsWith('file:'))fail('PROJECT_PLUGIN_DEPENDENCY_UNSUPPORTED');
  return nextResolve(specifier,context);
 }});
}
async function readModule(path){
 let file;
 try{
  path=resolve(path);await safeDirectory(dirname(path));
  file=await open(path,constants.O_RDONLY|constants.O_NONBLOCK|constants.O_NOFOLLOW);
  const before=await file.stat({bigint:true});if(!before.isFile()||before.size>1048576n)fail('PROJECT_TRUSTED_PACKAGE_CHANGED');
  const bytes=Buffer.alloc(1048577);let count=0;
  while(count<bytes.length){const r=await file.read(bytes,count,bytes.length-count);if(!r.bytesRead)break;count+=r.bytesRead;}
  const after=await file.stat({bigint:true}),named=await lstat(path,{bigint:true});
  if(count>1048576||after.size!==BigInt(count)||['ino','dev','size','mtimeNs','ctimeNs'].some(k=>before[k]!==after[k]||after[k]!==named[k])||await realpath(path)!==path)fail('PROJECT_TRUSTED_PACKAGE_CHANGED');
  return bytes.subarray(0,count);
 }catch(e){if(e.code?.startsWith('PROJECT_'))throw e;fail('PROJECT_TRUSTED_PACKAGE_CHANGED');}
 finally{await file?.close();}
}
/** Host-approved executable JavaScript, NOT a security sandbox.
 * The entry is snapshotted and hash-bound; its original path is never imported.
 * Relative and bare-package dependencies from that entry are unsupported, even
 * for later dynamic imports. Node builtins and explicit absolute/file imports
 * remain trusted host code: their bytes and transitive dependencies are NOT
 * certified by this entry hash. A plugin may perform arbitrary trusted effects.
 * The scoped resolver remains installed so delayed entry imports follow the same
 * rule. This does not constrain code reached through an absolute dependency.
 * The project-owned CAS must remain host-owned; file hashes are not filesystem
 * access control against another process modifying the snapshot directory.
 */
export async function loadProjectPlugins({projectDir,config}={}){
 projectDir=await safeDirectory(projectDir);
 const selected=config?.trustedPackages??[];
 if(!Array.isArray(selected)||selected.length>8)fail('PROJECT_TRUSTED_PACKAGES');
 if(!selected.length)return [];
 if(!config.capabilities?.includes('trusted-tools'))fail('PROJECT_TRUSTED_PACKAGES');
 const directory=await ensureSafeDirectory(join(projectDir,'plugins')),staged=[];
 // Stage and verify every selected module before executing any selected entry.
 for(const p of selected){
  if(!p||Object.keys(p).some(k=>!['modulePath','sha256','trustedCodeApproved'].includes(k))||typeof p.modulePath!=='string'||!p.modulePath||p.modulePath.includes('\0')||!(/^[a-f0-9]{64}$/).test(p.sha256)||p.trustedCodeApproved!==true)fail('PROJECT_TRUSTED_PACKAGES');
  const filename=p.sha256+'.mjs',path=join(directory,filename);
  let exists=true;try{await lstat(path);}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}
  if(exists){
   // Recovery is bound to the admitted snapshot, not a mutable original path.
   // Corruption is an error, never permission to recreate or replace the entry.
   if(sha256(await readModule(path))!==p.sha256)fail('PROJECT_TRUSTED_PACKAGE_CHANGED');
  }else{
   const bytes=await readModule(resolve(projectDir,p.modulePath));if(sha256(bytes)!==p.sha256)fail('PROJECT_TRUSTED_PACKAGE_CHANGED');
   try{await publishImmutable(directory,filename,bytes);}catch(e){if(e.code!=='EEXIST')throw e;}
   if(!(await readModule(path)).equals(bytes))fail('PROJECT_TRUSTED_PACKAGE_CHANGED');
  }
  staged.push({path,sha256:p.sha256});
 }
 const plugins=[];
 for(const entry of staged){
  // Detect corrupt existing snapshots before import, including Node cache hits.
  if(sha256(await readModule(entry.path))!==entry.sha256)fail('PROJECT_TRUSTED_PACKAGE_CHANGED');
  const url=pathToFileURL(entry.path).href;registerSnapshot(url);
  const module=await import(url),plugin=module.default;
  if(!plugin||plugin.sourceUrl!==url||plugin.contentSha256!==entry.sha256)fail('PROJECT_TRUSTED_PACKAGE_DESCRIPTOR');
  plugins.push(plugin);
 }
 return plugins;
}
