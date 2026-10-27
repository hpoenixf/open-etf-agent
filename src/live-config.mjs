import {open,constants} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {safeDirectory} from './storage-files.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function loadLiveConfig({path,expected,authorization}={}){
  if(!authorization?.providerApproved||!authorization?.syntheticDataApproved||!authorization?.costApproved||!Number.isFinite(authorization.maxTotalCny)||authorization.maxTotalCny<=0||authorization.maxTotalCny>100000)fail('LIVE_BLOCKED');
  if(typeof path!=='string'||typeof expected?.baseUrl!=='string'||typeof expected?.model!=='string')fail('CONFIG_SCOPE');
  let handle,bytes;
  try{
    const file=resolve(path);await safeDirectory(dirname(file));handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>8192||(typeof process.getuid==='function'&&stat.uid!==process.getuid()))fail('CONFIG_FILE_UNSAFE');
    const buffer=Buffer.alloc(8193);let at=0;while(at<buffer.length){const{bytesRead}=await handle.read(buffer,at,buffer.length-at);if(!bytesRead)break;at+=bytesRead;}if(at>8192)fail('CONFIG_SIZE');bytes=buffer.subarray(0,at);
  }catch(error){if(error.code?.startsWith('CONFIG_'))throw error;fail('CONFIG_FILE_UNSAFE');}finally{await handle?.close();}
  let values;
  try{
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const keys=[];
    for(const line of text.split(/\r?\n/)){if(!line.trim()||line.trimStart().startsWith('#'))continue;const match=/^\s*([A-Z_]+)\s*=/.exec(line);if(!match)fail('CONFIG_ASSIGNMENT');keys.push(match[1]);}
    if(keys.length!==3||new Set(keys).size!==3||keys.some(key=>!['CHAT_BASE_URL','CHAT_API_KEY','CHAT_MODEL'].includes(key)))fail('CONFIG_KEYS');values=parseEnv(text);
    if(Object.keys(values).length!==3||Object.values(values).some(value=>typeof value!=='string'||!value.trim()||/[\u0000-\u001f\u007f]/.test(value)))fail('CONFIG_VALUES');
  }catch(error){if(error.code?.startsWith('CONFIG_'))throw error;fail('CONFIG_PARSE');}finally{bytes.fill(0);}
  if(values.CHAT_BASE_URL!==expected.baseUrl||values.CHAT_MODEL!==expected.model)fail('CONFIG_SCOPE');
  let url;try{url=new URL(values.CHAT_BASE_URL);}catch{fail('CONFIG_SCOPE');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('CONFIG_SCOPE');
  if(!url.pathname.endsWith('/chat/completions'))url.pathname=url.pathname.replace(/\/$/,'')+'/chat/completions';
  const config={endpoint:url.href,model:values.CHAT_MODEL,maxTotalCny:authorization.maxTotalCny};Object.defineProperty(config,'apiKey',{value:values.CHAT_API_KEY,enumerable:false});return Object.freeze(config);
}
