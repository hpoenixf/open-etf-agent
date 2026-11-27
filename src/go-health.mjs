import { OPENCODE_GO_CURRENT_ENDPOINT, PROVIDER_IDLE_CODE } from './gateway.mjs';
const badStatus=new Set([500,502,503,504,520,521,522,523,524]);
// An outage signal chooses the provider only for a new, not-yet-dispatched root.
// The original failed request remains on its original ticket and never replays.
export function createGoHealth({fetchImpl=fetch, now=Date.now}={}){
  let outageUntil=0, checkedUntil=0, pending;
  const noteOutage=()=>{outageUntil=now()+30_000;};
  return Object.freeze({
    observe({code,status,connectivityFailure}){
      if(code===PROVIDER_IDLE_CODE||status==='http-error'&&badStatus.has(Number(/^PROVIDER_HTTP_(\d+)$/.exec(code??'')?.[1]))||
         status==='unknown'&&connectivityFailure===true)noteOutage();
    },
    async outage(signal){
      signal?.throwIfAborted();
      if(now()<outageUntil)return true;
      if(now()<checkedUntil)return false;
      // HEAD on the pinned origin sends no prompt, key or generation request.
      // A reachable 405 is expected and is not an outage; no redirect following.
      pending??=(async()=>{
        try{
          const r=await fetchImpl(new URL(OPENCODE_GO_CURRENT_ENDPOINT),{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(1100)});
          if(badStatus.has(r.status))noteOutage();else checkedUntil=now()+15_000;
        }catch(error){
          if(error instanceof TypeError||error?.name==='TimeoutError')noteOutage();else throw error;
        }finally{pending=undefined;}
        return now()<outageUntil;
      })();
      const choice=await pending;
      signal?.throwIfAborted();
      return choice;
    }
  });
}
