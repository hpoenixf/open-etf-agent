import {fileURLToPath} from 'node:url';
import {validateActualClaim} from './authorization.mjs';
import {runActual} from './runner.mjs';
// Only the unique parent launcher may supply the already-authorized key reader.
// No default key path, env fallback, account discovery or allocation creation.
export async function launchActual({claimPath,expectedClaimSha256,readKey}={}){
 if(typeof readKey!=='function')throw new Error('ROOT_KEY_READER_REQUIRED');
 const token=await validateActualClaim({claimPath,expectedClaimSha256});
 return runActual({token,readKey});
}
if(process.argv[1]===fileURLToPath(import.meta.url))throw new Error('NO_DEFAULT_LIVE_ENTRY_ROOT_IMPORT_REQUIRED');
