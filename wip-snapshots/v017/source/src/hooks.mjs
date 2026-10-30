const phases = ['before', 'after', 'failure', 'release'];
function frozenCopy(value) {
  const copy = structuredClone(value);
  function freeze(item) { if (item && typeof item === 'object') { for (const value of Object.values(item)) freeze(value); Object.freeze(item); } }
  freeze(copy); return copy;
}
async function invoke(callback, input, timeoutMs, signal) {
  signal?.throwIfAborted(); const controller = new AbortController(); let timer; let cancel;
  const stopped = new Promise((_, reject) => {
    cancel = () => { controller.abort(signal.reason); reject(signal.reason); };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => { const error = new Error('Hook timeout'); controller.abort(error); reject(error); }, timeoutMs);
  });
  try { return await Promise.race([Promise.resolve().then(() => callback(frozenCopy(input), { signal: controller.signal })), stopped]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
export function createHookChain({ before = [], after = [], failure = [], release = [], aliases = {}, mutableFields = [], timeoutMs = 100 } = {}) {
  const callbacks = { before, after, failure, release };
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2000 || phases.some(p => !Array.isArray(callbacks[p]) || callbacks[p].length > 8 || callbacks[p].some(fn => typeof fn !== 'function'))) throw new Error('Invalid Hook configuration');
  if (!Array.isArray(mutableFields) || mutableFields.some(k => typeof k !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)) || !aliases || typeof aliases !== 'object' || Array.isArray(aliases) || Object.entries(aliases).some(([a,b]) => !/^[a-z][a-z0-9_]{0,63}$/.test(a) || typeof b !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(b))) throw new Error('Invalid Hook aliases or mutable fields');
  const allowed = new Set(mutableFields); const exactAliases = { ...aliases };
  for (const phase of phases) callbacks[phase] = [...callbacks[phase]];
  return {
    async before(call, { signal } = {}) {
      const original = structuredClone(call); let effective = structuredClone(call);
      for (const callback of callbacks.before) {
        const patch = await invoke(callback, { original, effective }, timeoutMs, signal);
        if (patch === undefined) continue;
        if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(k => !['name', 'arguments'].includes(k))) throw new Error('Invalid Hook patch fields');
        if (patch.name !== undefined) {
          if (!Object.hasOwn(exactAliases, effective.name) || exactAliases[effective.name] !== patch.name) throw new Error('Hook exact alias refused');
          effective.name = patch.name;
        }
        if (patch.arguments !== undefined) {
          if (!patch.arguments || typeof patch.arguments !== 'object' || Array.isArray(patch.arguments) || Object.keys(patch.arguments).some(k => !allowed.has(k) || !Object.hasOwn(effective.arguments, k))) throw new Error('Hook argument field refused');
          effective.arguments = { ...effective.arguments, ...structuredClone(patch.arguments) };
        }
      }
      return { original: frozenCopy(original), effective: frozenCopy(effective) };
    },
    async observe(phase, event, { signal } = {}) {
      if (!phases.includes(phase) || phase === 'before') throw new Error('Invalid observer phase');
      const errors = [];
      for (const callback of callbacks[phase]) {
        try { await invoke(callback, event, timeoutMs, signal); }
        catch (error) { errors.push({ phase, error: error?.message || 'Hook observation failed' }); }
      }
      return errors;
    }
  };
}
