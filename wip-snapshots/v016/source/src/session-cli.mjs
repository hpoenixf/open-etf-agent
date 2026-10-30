import { lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openSession } from './session.mjs';
import { DOCUMENT_REVOCATION_PROFILE } from './source.mjs';

const cases = ['revocable-rag', 'durable-response', 'durable-report', 'durable-publication', 'durable-child', 'durable-compaction', 'durable-memory', 'trusted-plugins'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
function argumentsFor(args) {
 const [action, ...rest] = args;
 if (!['init-documents', 'revoke-document', 'start', 'submit', 'work', 'resume', 'inspect', 'cancel', 'publication', 'publication-revisions', 'publication-event', 'question', 'respond', 'response-status'].includes(action)) fail('INVALID_ARGUMENT');
 const options = { action }; const seen = new Set();
 for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i]; const value = rest[i + 1];
  if (!['--session', '--run', '--case', '--revision', '--question', '--response', '--text', '--profile', '--document', '--expected-revision'].includes(key) || seen.has(key) || typeof value !== 'string' || !value || (key !== '--text' && value.startsWith('--')) || value.includes('\0')) fail('INVALID_ARGUMENT');
  seen.add(key); options[key.slice(2)] = value;
 }
 if (!options.session || options.session.length > 4096 || (['start','init-documents','revoke-document'].includes(action) ? options.run !== undefined : options.run === undefined)) fail('INVALID_ARGUMENT');
 if (options.run !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(options.run)) fail('INVALID_ARGUMENT');
 if (options.case !== undefined && (!cases.includes(options.case) || !['start', 'submit', 'resume'].includes(action))) fail('INVALID_ARGUMENT');
 if (action === 'submit' && options.case !== 'durable-publication') fail('INVALID_ARGUMENT');
 if (options.revision !== undefined && (action !== 'publication' || !/^[1-3]$/.test(options.revision))) fail('INVALID_ARGUMENT');
 if(['question','respond'].includes(action)&&!options.question)fail('INVALID_ARGUMENT');
 if(action==='respond'&&(!options.response||!options.text))fail('INVALID_ARGUMENT');
 if(options.question!==undefined&&!['question','respond'].includes(action)||options.response!==undefined&&action!=='respond'||options.text!==undefined&&action!=='respond')fail('INVALID_ARGUMENT');
 const protectedMode=options.profile===DOCUMENT_REVOCATION_PROFILE;
 if(options.profile!==undefined&&!protectedMode)fail('INVALID_SESSION_PROFILE');
 if(protectedMode){
  const allowed={ 'init-documents':['session','profile'], 'revoke-document':['session','profile','document','expected-revision'],start:['session','profile','case'],resume:['session','profile','run','case'],inspect:['session','profile','run'],cancel:['session','profile','run'],publication:['session','profile','run','revision'],'publication-revisions':['session','profile','run'],'publication-event':['session','profile','run']}[action];
  if(!allowed||Object.keys(options).some(k=>k!=='action'&&!allowed.includes(k)))fail('INVALID_ARGUMENT');
  if(action==='start'&&options.case!=='revocable-rag'||options.case!==undefined&&options.case!=='revocable-rag')fail('CASE_MISMATCH');
  if(action==='revoke-document'&&(!['atlas-a','atlas-b'].includes(options.document)||options['expected-revision']!=='1'))fail('INVALID_ARGUMENT');
 }else if(['init-documents','revoke-document'].includes(action)||options.document!==undefined||options['expected-revision']!==undefined||options.case==='revocable-rag')fail('DOCUMENT_PROFILE_REQUIRED');
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
 const protectedMode=options.profile===DOCUMENT_REVOCATION_PROFILE;
 if(options.action==='init-documents'){const {initializeRevocableDemo}=await import('./durable-demo.mjs');const authority=await initializeRevocableDemo({directory:options.session});process.stdout.write(JSON.stringify({profile:options.profile,...authority})+'\n');return;}
 if (protectedMode||!['start', 'submit'].includes(options.action)) await existingSession(options.session);
 let caseId = options.case || 'durable-report';
 if (!['start', 'submit'].includes(options.action)) {
  const store = await openSession({ directory: options.session,...(protectedMode?{profile:options.profile,readOnly:options.action==='inspect'||options.action.startsWith('publication')}:{} ) });
  try {
   if(options.action==='revoke-document'){const authority=store.documentAuthority();const value=store.revokeDocument({authorityId:authority.authorityId,libraryId:authority.libraryId,documentId:options.document,expectedRevision:Number(options['expected-revision'])});process.stdout.write(JSON.stringify(value)+'\n');return;}
   if(['question','respond','response-status'].includes(options.action)){
    const value=options.action==='question'?store.response(options.run,options.question):options.action==='respond'?(store.receiveResponse({runId:options.run,questionId:options.question,responseId:options.response,text:options.text}),store.responseStatus(options.run)):store.responseStatus(options.run);
    if(!value)fail('UNKNOWN_QUESTION');process.stdout.write(JSON.stringify(value,null,2)+'\n');return;
   }
   if (options.action.startsWith('publication')) {
    const value = options.action === 'publication' ? store.publication(options.run, options.revision === undefined ? undefined : Number(options.revision)) : options.action === 'publication-revisions' ? store.publicationRevisions(options.run) : store.publicationEvent(options.run);
    if (value === null) fail('PUBLICATION_NOT_FOUND');
    process.stdout.write(JSON.stringify(value, null, 2) + '\n'); return;
   }
   if (options.action === 'inspect' || options.action === 'cancel') {
    const state = options.action === 'inspect' ? store.inspect(options.run) : store.cancel(options.run);
    process.stdout.write(JSON.stringify(protectedMode?{runId:state.runId,rootId:state.rootId,status:state.status,phase:state.snapshot.phase,rootUsage:state.rootUsage,deadlineAt:state.definition.deadlineAt}:store.schemaVersion===3?{runId:state.runId,rootId:state.rootId,status:state.status,phase:state.snapshot.phase,rootUsage:state.rootUsage,deadlineAt:state.definition.deadlineAt,response:store.responseStatus(options.run)}:state, null, 2) + '\n'); return;
   }
   caseId = resumeCase(store.inspect(options.run));
   if(protectedMode!== (caseId==='revocable-rag'))fail('DOCUMENT_PROFILE_REQUIRED');
   if (options.action === 'work' && caseId !== 'durable-publication') fail('WORKER_PROFILE_REQUIRED');
   if (options.case !== undefined && options.case !== caseId) fail('CASE_MISMATCH');
  } finally { store.close(); }
 }
 const controller = new AbortController(); const cancel = () => controller.abort();
 process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
 try {
  // Control-only commands never load or call the fixture Gateway assembly.
  const { runDurableDemo, submitDurableDemo, workDurableDemo } = await import('./durable-demo.mjs');
  const execute = options.action === 'submit' ? submitDurableDemo : options.action === 'work' ? workDurableDemo : runDurableDemo;
  const outcome = await execute({ directory: options.session, caseId, runId: options.run, ...(options.action === 'work' ? { hostSignal: controller.signal } : { signal: controller.signal }) });
  process.stdout.write(JSON.stringify(protectedMode?{runId:outcome.runId,rootId:outcome.rootId,status:outcome.status,code:outcome.code,rounds:outcome.rounds,toolsDispatched:outcome.toolsDispatched,rootUsage:outcome.rootUsage}:outcome, null, 2) + '\n');
  if (options.action === 'work' ? outcome.workerStatus !== 'settled' || outcome.run.status !== 'completed' : options.action !== 'submit' && !['completed','awaiting-response'].includes(outcome.status)) process.exitCode = 1;
 } finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
}
try { await main(process.argv.slice(2)); }
catch (error) { process.stderr.write((error.code || 'SESSION_COMMAND_FAILED') + '\n'); process.exitCode = 2; }
