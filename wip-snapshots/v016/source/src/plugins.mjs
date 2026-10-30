import { open, constants } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './source.mjs';
import { safeDirectory } from './storage-files.mjs';
import { createHookChain } from './hooks.mjs';

const phases = ['before', 'after', 'failure', 'release'];
const builtins = ['read_page', 'read_result', 'calculate_change', 'create_csv', 'save_report', 'read_note'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
const plain = value => value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const name = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
function freeze(value) { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; }
function jsonCopy(value) {
  function check(item, depth = 0) {
    if (depth > 16) fail('PLUGIN_INVALID_METADATA');
    if (item === null || typeof item === 'boolean' || typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))) return;
    if (!Array.isArray(item) && !plain(item)) fail('PLUGIN_INVALID_METADATA');
    for (const child of Object.values(item)) check(child, depth + 1);
  }
  check(value); const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded) > 65536) fail('PLUGIN_INVALID_METADATA');
  return JSON.parse(encoded);
}
function checkKeys(value, allowed, code) { if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(code); }
// A deliberately small, closed JSON Schema subset; a plugin must still validate every actual call.
function toolSchema(input) {
  const schema = jsonCopy(input);
  function check(value, depth = 0) {
    const keys = { object: ['properties', 'required', 'additionalProperties'], array: ['items', 'minItems', 'maxItems', 'uniqueItems'], string: ['enum', 'minLength', 'maxLength', 'pattern'], number: ['minimum', 'maximum'], integer: ['minimum', 'maximum'], boolean: [] };
    if (!plain(value) || depth > 8 || !Object.hasOwn(keys, value.type)) fail('PLUGIN_INVALID_TOOL_SCHEMA');
    checkKeys(value, ['type', 'description', ...keys[value.type]], 'PLUGIN_INVALID_TOOL_SCHEMA');
    if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length > 2000)) fail('PLUGIN_INVALID_TOOL_SCHEMA');
    if (value.type === 'object') {
      if (!plain(value.properties) || Object.keys(value.properties).length > 64 || value.additionalProperties !== false) fail('PLUGIN_INVALID_TOOL_SCHEMA');
      const required = value.required ?? [];
      if (!Array.isArray(required) || new Set(required).size !== required.length || required.some(key => typeof key !== 'string' || !Object.hasOwn(value.properties, key))) fail('PLUGIN_INVALID_TOOL_SCHEMA');
      for (const [key, child] of Object.entries(value.properties)) { if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) fail('PLUGIN_INVALID_TOOL_SCHEMA'); check(child, depth + 1); }
    }
    if (value.type === 'array') { check(value.items, depth + 1); if (value.uniqueItems !== undefined && typeof value.uniqueItems !== 'boolean') fail('PLUGIN_INVALID_TOOL_SCHEMA'); }
    for (const [minimum, maximum] of [['minItems', 'maxItems'], ['minLength', 'maxLength']]) {
      for (const key of [minimum, maximum]) if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > 1048576)) fail('PLUGIN_INVALID_TOOL_SCHEMA');
      if (value[minimum] !== undefined && value[maximum] !== undefined && value[minimum] > value[maximum]) fail('PLUGIN_INVALID_TOOL_SCHEMA');
    }
    for (const key of ['minimum', 'maximum']) if (value[key] !== undefined && !Number.isFinite(value[key])) fail('PLUGIN_INVALID_TOOL_SCHEMA');
    if (value.minimum !== undefined && value.maximum !== undefined && value.minimum > value.maximum) fail('PLUGIN_INVALID_TOOL_SCHEMA');
    if (value.enum !== undefined && (!Array.isArray(value.enum) || !value.enum.length || value.enum.length > 64 || value.enum.some(item => typeof item !== 'string') || new Set(value.enum).size !== value.enum.length)) fail('PLUGIN_INVALID_TOOL_SCHEMA');
    if (value.pattern !== undefined) { if (typeof value.pattern !== 'string' || value.pattern.length > 256) fail('PLUGIN_INVALID_TOOL_SCHEMA'); try { new RegExp(value.pattern); } catch { fail('PLUGIN_INVALID_TOOL_SCHEMA'); } }
  }
  check(schema); if (schema.type !== 'object') fail('PLUGIN_INVALID_TOOL_SCHEMA'); return schema;
}
async function checkContent(sourceUrl, expected) {
  if (typeof sourceUrl !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) fail('PLUGIN_INVALID_IDENTITY');
  let file;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'file:' || url.search || url.hash) fail('PLUGIN_INVALID_IDENTITY');
    const path = fileURLToPath(url); await safeDirectory(dirname(path));
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await file.stat(); if (!stat.isFile() || stat.size > 1048576) fail('PLUGIN_INVALID_SOURCE');
    const bytes = Buffer.alloc(1048577); let size = 0;
    while (size < bytes.length) { const { bytesRead } = await file.read(bytes, size, bytes.length - size); if (!bytesRead) break; size += bytesRead; }
    if (size > 1048576) fail('PLUGIN_INVALID_SOURCE');
    if (sha256(bytes.subarray(0, size)) !== expected) fail('PLUGIN_CONTENT_MISMATCH');
  } catch (error) {
    if (error.code?.startsWith('PLUGIN_')) throw error;
    fail('PLUGIN_INVALID_SOURCE');
  } finally { await file?.close(); }
}

/** Explicit, already imported, trusted local JavaScript only. This is not a sandbox or loader.
 * The content hash verifies the selected module bytes, not its dependency closure or closure state.
 * The caller owns each activation until its Run settles; release is not hot-unload of a live Run.
 */
export async function activateTrustedPlugins({ plugins, expectedBindings, signal } = {}) {
  if (!Array.isArray(plugins) || plugins.length > 8) fail('PLUGIN_INVALID_SELECTION');
  const packageIds = new Set(); const toolNames = new Set(builtins); const skillIds = new Set(); const skillNames = new Set();
  const hookCounts = Object.fromEntries(phases.map(phase => [phase, 0]));
  const staged = []; const extensions = []; const skills = []; const bindings = [];
  for (const plugin of plugins) {
    checkKeys(plugin, ['id', 'version', 'schemaVersion', 'sourceUrl', 'contentSha256', 'tools', 'skills', 'hooks', 'activate'], 'PLUGIN_INVALID_DESCRIPTOR');
    if (!name(plugin.id) || packageIds.has(plugin.id) || typeof plugin.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(plugin.version) || plugin.version.length > 64 || plugin.schemaVersion !== 'trusted-plugin@1') fail('PLUGIN_INVALID_IDENTITY');
    packageIds.add(plugin.id);
    if (plugin.activate !== undefined && typeof plugin.activate !== 'function') fail('PLUGIN_INVALID_ACTIVATION');
    const tools = plugin.tools ?? []; const methods = plugin.skills ?? [];
    if (!Array.isArray(tools) || tools.length > 16 || !Array.isArray(methods) || methods.length > 16) fail('PLUGIN_INVALID_CONTRIBUTIONS');
    for (const tool of tools) {
      checkKeys(tool, ['name', 'description', 'parameters', 'validate', 'execute', 'sourceResult', 'sourceResults', 'methodResult', 'memoryEffect', 'artifactEffects'], 'PLUGIN_INVALID_TOOL');
      if (typeof tool.name !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(tool.name) || typeof tool.description !== 'string' || !tool.description || tool.description.length > 2000 || !plain(tool.parameters) || typeof tool.validate !== 'function' || typeof tool.execute !== 'function') fail('PLUGIN_INVALID_TOOL');
      if (toolNames.has(tool.name)) fail('PLUGIN_TOOL_COLLISION'); toolNames.add(tool.name);
      for (const flag of ['sourceResult', 'sourceResults', 'methodResult', 'memoryEffect', 'artifactEffects']) if (tool[flag] !== undefined && typeof tool[flag] !== 'boolean') fail('PLUGIN_INVALID_TOOL');
      extensions.push(freeze({ ...tool, parameters: toolSchema(tool.parameters) }));
    }
    for (const skill of methods) {
      checkKeys(skill, ['id', 'name', 'description', 'text', 'sha256', 'version', 'mediaType'], 'PLUGIN_INVALID_SKILL');
      if (!name(skill.id) || !name(skill.name) || skillIds.has(skill.id) || skillNames.has(skill.name) || typeof skill.description !== 'string' || !skill.description || skill.description.length > 240 || typeof skill.text !== 'string' || Buffer.byteLength(skill.text) > 65536 || skill.sha256 !== sha256(skill.text) || skill.version !== 'sha256:' + skill.sha256 || skill.mediaType !== 'text/markdown; charset=utf-8') fail('PLUGIN_INVALID_SKILL');
      skillIds.add(skill.id); skillNames.add(skill.name); skills.push(freeze(jsonCopy(skill)));
    }
    let hooks;
    if (plugin.hooks !== undefined) {
      checkKeys(plugin.hooks, [...phases, 'aliases', 'mutableFields', 'timeoutMs'], 'PLUGIN_INVALID_HOOK');
      try { hooks = createHookChain(plugin.hooks); } catch { fail('PLUGIN_INVALID_HOOK'); }
      for (const phase of phases) { hookCounts[phase] += plugin.hooks[phase]?.length || 0; if (hookCounts[phase] > 8) fail('PLUGIN_INVALID_HOOK'); }
    }
    staged.push({ id: plugin.id, activate: plugin.activate, hooks, sourceUrl: plugin.sourceUrl, contentSha256: plugin.contentSha256 });
    bindings.push(freeze({ id: plugin.id, version: plugin.version, schemaVersion: plugin.schemaVersion, contentSha256: plugin.contentSha256 }));
  }
  if (extensions.length > 16 || skills.length > 16) fail('PLUGIN_INVALID_CONTRIBUTIONS');
  // Check every descriptor and byte identity before calling even the first activation.
  for (const plugin of staged) await checkContent(plugin.sourceUrl, plugin.contentSha256);
  if (expectedBindings !== undefined) {
    let expected;
    try { expected = jsonCopy(expectedBindings); } catch { fail('PLUGIN_BINDINGS_MISMATCH'); }
    if (!Array.isArray(expected) || expected.length !== bindings.length || expected.some((binding, index) => !plain(binding) || Object.keys(binding).sort().join(',') !== 'contentSha256,id,schemaVersion,version' || Object.keys(bindings[index]).some(key => binding[key] !== bindings[index][key]))) fail('PLUGIN_BINDINGS_MISMATCH');
  }
  const releases = []; let releasing;
  async function release() {
    releasing ??= Promise.resolve().then(async () => {
      const errors = [];
      for (const { packageId, callback } of [...releases].reverse()) {
        try { await callback(); } catch { errors.push({ packageId, code: 'PLUGIN_RELEASE_FAILED' }); }
      }
      return freeze({ status: errors.length ? 'release-failed' : 'released', errors });
    });
    return releasing;
  }
  try {
    for (const plugin of staged) {
      signal?.throwIfAborted(); let accepting = true;
      try {
        const result = await plugin.activate?.(Object.freeze({ signal, deferRelease(callback) {
          if (!accepting || typeof callback !== 'function' || releases.length >= 64) fail('PLUGIN_INVALID_RELEASE');
          releases.push({ packageId: plugin.id, callback });
        } }));
        if (result !== undefined) fail('PLUGIN_ACTIVATION_RETURNED_CONTRIBUTIONS');
      } finally { accepting = false; }
      signal?.throwIfAborted();
    }
  } catch {
    const result = await release();
    throw Object.assign(new Error('PLUGIN_ACTIVATION_FAILED'), { code: 'PLUGIN_ACTIVATION_FAILED', releaseErrors: result.errors });
  }
  const chains = staged.flatMap(plugin => plugin.hooks ? [plugin.hooks] : []);
  const hooks = chains.length ? Object.freeze({
    async before(call, options) {
      const original = freeze(structuredClone(call)); let effective = original;
      for (const chain of chains) effective = (await chain.before(effective, options)).effective;
      return { original, effective };
    },
    async observe(phase, event, options) {
      const errors = []; for (const chain of chains) errors.push(...await chain.observe(phase, event, options)); return errors;
    }
  }) : undefined;
  return Object.freeze({ bindings: freeze(bindings), extensions: freeze(extensions), skills: freeze(skills), hooks, release });
}
