const MODEL_URL='https://api.openai.com/v1/models/gpt-6.1-terra';
const unavailability=new Set([500,502,503,504]);
export async function terraRouteUnavailable({apiKey,signal,fetchImpl=globalThis.fetch}={}){
 signal?.throwIfAborted();
 if(!apiKey)return true;
 const deadline=AbortSignal.timeout(1250);
 const requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;
 let response;
 try {
  response=await fetchImpl(new URL(MODEL_URL),{
   method:'GET',redirect:'manual',signal:requestSignal,headers:{authorization:'Bearer '+apiKey}
  });
  signal?.throwIfAborted();
 }catch(error){
  signal?.throwIfAborted();
  const code=error?.cause?.code??error?.code;
  return deadline.aborted||['ECONNRESET','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET'].includes(code);
 }
 if(response.body)void response.body.cancel().catch(()=>{});
 return unavailability.has(response.status);
}
