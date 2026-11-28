import { startGuestSite } from './guest-site.mjs';

let site;
try {
  const env=process.env;
  if (!/^\d+$/.test(env.ETF_GUEST_PORT??'')) throw new Error('GUEST_PORT_REQUIRED');
  site=await startGuestSite({
    origin:env.ETF_GUEST_ORIGIN,
    runtimeRoot:env.ETF_GUEST_RUNTIME_ROOT,
    phraseVerifier:env.ETF_GUEST_PHRASE_VERIFIER,
    provider:{provider:env.ETF_GUEST_PROVIDER,endpoint:env.ETF_GUEST_PROVIDER_ENDPOINT,model:env.ETF_GUEST_PROVIDER_MODEL},
    providerKey:env.ETF_GUEST_PROVIDER_KEY,
    port:Number(env.ETF_GUEST_PORT),
  });
  process.stdout.write(JSON.stringify({status:'guest-listening',port:site.port})+'\n');
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
} catch (error) {
  const code=/^GUEST_[A-Z_]+$/.test(error?.code??'')?error.code:'GUEST_START_FAILED';
  process.stderr.write(code+'\n');
  process.exitCode=1;
} finally { await site?.close(); }
