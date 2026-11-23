// Read the guest access phrase from a private pipe/terminal, never command arguments.
// Store the returned verifier in the guest service secret store only.
import {randomBytes,scryptSync} from 'node:crypto';
const chunks=[]; let total=0;
for await(const chunk of process.stdin) {
  total+=chunk.length;
  if(total>514) throw new Error('GUEST_VERIFIER_INPUT');
  chunks.push(chunk);
}
const input=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)).replace(/\r?\n$/,'');
if(!input.trim()||Buffer.byteLength(input)>512)throw new Error('GUEST_VERIFIER_INPUT');
const salt=randomBytes(16);
process.stdout.write('scrypt-v1:'+salt.toString('hex')+':'+scryptSync(input,salt,32).toString('hex')+'\n');
