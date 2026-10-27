import { lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openSession } from './session.mjs';

const cases = ['durable-report', 'durable-publication', 'durable-child', 'durable-compaction', 'durable-memory', 'trusted-plugins'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
function argumentsFor(args) {
 const [action, ...rest] = args;
 if (!['start', 'resume', 'inspect', 'cancel', 'publication', 'publication-revisions', 'publication-event'].includes(action)) fail('INVALID_ARGUMENT');
 const options = { action }; const seen = new Set();
 for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i]; const value = rest[i + 1];
  if (!['--session', '--run', '--case', '--revision'].includes(key) || seen.has(key) || typeof value !== 'string' || !value || value.startsWith('--') || value.includes('\0')) fail('INVALID_ARGUMENT');
  seen.add(key); options[key.slice(2)] = value;
 }
 if (!options.session || options.session.length > 4096 || (action === 'start' ? options.run !== undefined : options.run === undefined)) fail('INVALID_ARGUMENT');
 if (options.run !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(options.run)) fail('INVALID_ARGUMENT');
 if (options.case !== undefined && (!cases.includes(options.case) || !['start', 'resume'].includes(action))) fail('INVALID_ARGUMENT');
 if (options.revision !== undefined && (action !== 'publication' || !/^[1-3]$/.test(options.revision))) fail('INVALID_ARGUMENT');
 options.session = resolve(options.session); return options;
}
async function existingSession(directory) {
 let info;
 try { info = await lstat(join(directory, 'session.sqlite')); }
 catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') fail('SESSION_NOT_FOUND'); throw error; }
 if (!info.isFile() || info.isSymbolicLink()) fail('UNSAFE_SESSION_FILE');
}
function resumeCase(state) {
 const binding = state?.definition?.bindings?.gateway;
 if (!binding || binding.mode !== 'fixture' || binding.provider !== 'synthetic' || binding.protocol !== 'fixture@1' || binding.version !== '1' || !cases.includes(binding.model) || Object.keys(binding).sort().join(',') !== 'mode,model,protocol,provider,version') fail('FIXTURE_BINDING_REQUIRED');
 return binding.model;
}
async function main(args) {
 const options = argumentsFor(args);
 if (options.action !== 'start') await existingSession(options.session);
 let caseId = options.case || 'durable-report';
 if (options.action !== 'start') {
  const store = await openSession({ directory: options.session });
  try {
   if (options.action.startsWith('publication')) {
    const value = options.action === 'publication' ? store.publication(options.run, options.revision === undefined ? undefined : Number(options.revision)) : options.action === 'publication-revisions' ? store.publicationRevisions(options.run) : store.publicationEvent(options.run);
    if (value === null) fail('PUBLICATION_NOT_FOUND');
    process.stdout.write(JSON.stringify(value, null, 2) + '\n'); return;
   }
   if (options.action === 'inspect' || options.action === 'cancel') {
    const state = options.action === 'inspect' ? store.inspect(options.run) : store.cancel(options.run);
    process.stdout.write(JSON.stringify(state, null, 2) + '\n'); return;
   }
   caseId = resumeCase(store.inspect(options.run));
   if (options.case !== undefined && options.case !== caseId) fail('CASE_MISMATCH');
  } finally { store.close(); }
 }
 const controller = new AbortController(); const cancel = () => controller.abort();
 process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
 try {
  // Control-only commands never load or call the fixture Gateway assembly.
  const { runDurableDemo } = await import('./durable-demo.mjs');
  const outcome = await runDurableDemo({ directory: options.session, caseId, runId: options.run, signal: controller.signal });
  process.stdout.write(JSON.stringify(outcome, null, 2) + '\n');
  if (outcome.status !== 'completed') process.exitCode = 1;
 } finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
}
try { await main(process.argv.slice(2)); }
catch (error) { process.stderr.write((error.code || 'SESSION_COMMAND_FAILED') + '\n'); process.exitCode = 2; }
