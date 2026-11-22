import { validateResearchConfig } from './research-project.mjs';
import { directDeepSeekProfile, OPENCODE_GO_CURRENT_ENDPOINT, OPENCODE_GO_OWNER_PROVIDER } from './gateway.mjs';

const shape = (value, allowed) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => allowed.includes(key));
function fail(code) { throw Object.assign(new Error(code), { code }); }

export function prepareGuiLiveConfig(input, env) {
  // The file selects only the existing Chat Completions adapter and native per-Run limits.
  // The trusted launcher passes an environment reference, not a credential in this file.
  if (!shape(input, ['gateway','limits','connectivity','toolAccounting']) ||
      !shape(input.gateway, ['provider','endpoint','model','apiKeyEnv','stream']) ||
      !shape(input.limits, ['model','tool','maxRounds','maxTools','timeoutMs']) ||
      !Object.hasOwn(input.limits, 'model')) fail('GUI_LIVE_CONFIG_INVALID');
  const config = validateResearchConfig({
    schemaVersion:'research-project@1',
    gateway:{ ...input.gateway, mode:'live', protocol:'chat-completions' },
    capabilities:['report'],
    contextBytes:1048576,
    limits:input.limits,
    ...(input.toolAccounting===undefined?{}:{ownerToolAccounting:input.toolAccounting}),
    ...(input.connectivity===undefined?{}:{ownerConnectivity:input.connectivity}),
  });
  const { endpoint, provider, model, apiKeyEnv } = config.gateway;
  const identity=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(value)&&!value.includes('://');
  if (!identity(provider)||!identity(model)||apiKeyEnv!=='ETF_GUI_PROVIDER_KEY') fail('GUI_LIVE_CONFIG_INVALID');
  const url=new URL(endpoint);
  const host=url.hostname.toLowerCase().replace(/\.+$/,'');
  // Reserve the current official Go endpoint for the sole-owner preview
  // profile. The existing gateway provides its own client and Root identity.
  if (provider===OPENCODE_GO_OWNER_PROVIDER) {
    if (endpoint!==OPENCODE_GO_CURRENT_ENDPOINT) fail('GUI_GO_OWNER_PROFILE_INVALID');
  } else if (host==='opencode.ai'||host.endsWith('.opencode.ai')||/open[-_ ]?code/i.test(provider)) {
    fail('GUI_GO_OWNER_PROFILE_REQUIRED');
  }
  if (/[?#]/.test(endpoint)||!url.pathname.endsWith('/chat/completions')) fail('GUI_LIVE_CONFIG_INVALID');
  directDeepSeekProfile(config.gateway);
  const apiKey=Object.hasOwn(env,apiKeyEnv)?env[apiKeyEnv]:null;
  if (typeof apiKey!=='string'||!apiKey.trim()||/[\r\n]/.test(apiKey)) fail('GUI_LIVE_API_KEY_ENV_REQUIRED');
  return {config,apiKey};
}
