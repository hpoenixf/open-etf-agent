import { mkdtemp, open } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { createToolHost, ensureSafeDirectory } from './tools.mjs';
import { createRootBudget } from './cooperation.mjs';
import { compactWorkingView } from './compaction.mjs';
import { projectMemory } from './memory-projection.mjs';
import { projectContext } from './context.mjs';

const failure = code => Object.assign(new Error(code), { code });
function validateProposal(p) {
  if (p?.kind === 'final' && typeof p.text === 'string' && p.text.length <= 64000) return;
  if (p?.kind !== 'calls' || !Array.isArray(p.calls) || !p.calls.length || p.calls.length > 16) throw failure('INVALID_PROPOSAL');
  for (const c of p.calls) if (!c || typeof c.id !== 'string' || !c.id || c.id.length > 200 || typeof c.name !== 'string' || !c.arguments || typeof c.arguments !== 'object' || Array.isArray(c.arguments)) throw failure('INVALID_CALL');
}
async function bounded(promise, signal) {
  signal.throwIfAborted();
  let cancel;
  const stopped = new Promise((_, reject) => { cancel = () => reject(signal.reason); signal.addEventListener('abort', cancel, { once: true }); });
  try { return await Promise.race([promise, stopped]); } finally { signal.removeEventListener('abort', cancel); }
}

export async function run({ question, gateway, outputRoot = 'runs', requireReport = true, signal, limits = {}, extensions = [], hooks, rootBudget, allowedTools, allowedDocuments, taskId = null, contextBytes, workingInput }) {
  if (typeof question !== 'string' || !question.trim() || Buffer.byteLength(question) > 16000 || typeof gateway?.next !== 'function') throw failure('INVALID_INPUT');
  const budget = { maxRounds: 12, maxTools: 12, timeoutMs: 30000, ...limits };
  for (const [key, value] of Object.entries(budget)) if (!['maxRounds', 'maxTools', 'timeoutMs'].includes(key) || !Number.isSafeInteger(value) || value < 1 || value > (key === 'timeoutMs' ? 300000 : 1000)) throw failure('INVALID_LIMIT');
  if (contextBytes !== undefined && (!Number.isSafeInteger(contextBytes) || contextBytes < 1 || contextBytes > 1048576)) throw failure('INVALID_CONTEXT_LIMIT');
  if(workingInput!==undefined&&(!workingInput||typeof workingInput!=='object'||Object.keys(workingInput).some(key=>!['memoryLibrary','compaction'].includes(key))))throw failure('INVALID_WORKING_INPUT');
  if(workingInput?.memoryLibrary&&(typeof workingInput.memoryLibrary.libraryId!=='string'||typeof workingInput.memoryLibrary.state!=='function'))throw failure('INVALID_MEMORY_LIBRARY');
  if(workingInput?.compaction&&(typeof workingInput.compaction.summarize!=='function'||!Number.isSafeInteger(workingInput.compaction.thresholdBytes)||workingInput.compaction.thresholdBytes<1||workingInput.compaction.thresholdBytes>1048576))throw failure('INVALID_COMPACTION');
  rootBudget ??= createRootBudget({ model: budget.maxRounds, tool: budget.maxTools });
  const root = await ensureSafeDirectory(outputRoot);
  const directory = await mkdtemp(join(root, 'run-')); const runId = basename(directory);
  const host = await createToolHost({ directory, extensions, hooks, allowedTools, allowedDocuments, enableNotes:!!workingInput?.compaction });
  const controller = new AbortController();
  const cancel = () => controller.abort(failure('CANCELLED'));
  signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(failure('TIMEOUT')), budget.timeoutMs);
  const messages = [{ role: 'user', content: question }];
  const usedIds = new Set(); const logErrors = []; const hookErrors = [];
  let toolsDispatched = 0; let rounds = 0; let answer = ''; let status = 'failed'; let code = null; let log;
  let sourceSnapshots = []; let resultRefs = [];
  let corrections = 0;
  let inFlight = null; const unknownEffects = []; const partialEffects = [];
  async function record(type, data = {}) {
    try { await log.write(JSON.stringify({ runId, rootId: rootBudget.rootId, taskId, sequence: ++record.sequence, type, ...data }) + '\n'); }
    catch { logErrors.push('LOG_WRITE_FAILED'); throw failure('LOG_WRITE_FAILED'); }
  }
  record.sequence = 0;
  try {
    log = await open(join(directory, 'run.jsonl'), 'wx', 0o600);
    await record('run_started', { mode: gateway.mode || 'test', question, limits: budget });
    for (; rounds < budget.maxRounds;) {
      controller.signal.throwIfAborted();
      const workingMessages = workingInput?.memoryLibrary ? await projectMemory({messages,lookupState:ref=>{if(ref.libraryId!==workingInput.memoryLibrary.libraryId)throw failure('MEMORY_SCOPE_MISMATCH');return workingInput.memoryLibrary.state(ref.id);}}) : structuredClone(messages);
      let requestMessages = contextBytes === undefined ? workingMessages : await projectContext({ messages:workingMessages, maxBytes: contextBytes, lookupSource: host.resolveSource });
      if(workingInput?.compaction&&Buffer.byteLength(JSON.stringify(requestMessages))>=workingInput.compaction.thresholdBytes){const compacted=await compactWorkingView({messages:workingMessages,maxBytes:contextBytes??262144,lookupSource:host.resolveSource,canCompactHistory:host.canCompactHistory,lookupMemoryState:workingInput.memoryLibrary?ref=>{if(ref.libraryId!==workingInput.memoryLibrary.libraryId)throw failure('MEMORY_SCOPE_MISMATCH');return workingInput.memoryLibrary.state(ref.id);}:undefined,rootBudget,summarize:workingInput.compaction.summarize,saveNote:host.persistWorkingNote,signal:controller.signal,summaryTimeoutMs:workingInput.compaction.summaryTimeoutMs});requestMessages=compacted.messages;await record('working_note',{...compacted.observation,noteRef:compacted.noteRef});}
      rootBudget.claim('model'); rounds++; const modelStart = performance.now();
      const proposal = await bounded(Promise.resolve().then(() => gateway.next({ messages: requestMessages, tools: structuredClone(host.definitions), signal: controller.signal })), controller.signal);
      controller.signal.throwIfAborted(); validateProposal(proposal);
      await record('model_proposal', { kind: proposal.kind, callIds: proposal.calls?.map(c => c.id) || [], usage: proposal.usage ?? null, cost: null, durationMs: performance.now() - modelStart });
      if (proposal.kind === 'final') {
        answer = proposal.text;
        if (requireReport && !host.receipt) throw failure('REPORT_REQUIRED');
        status = 'completed'; break;
      }
      const groupIds = new Set();
      for (const c of proposal.calls) { if (usedIds.has(c.id) || groupIds.has(c.id)) throw failure('DUPLICATE_CALL_ID'); groupIds.add(c.id); }
      if (toolsDispatched + proposal.calls.length > budget.maxTools) throw failure('TOOL_LIMIT');
      messages.push({ role: 'assistant', calls: proposal.calls });
      for (const call of proposal.calls) {
        controller.signal.throwIfAborted(); usedIds.add(call.id);
        await record('tool_proposal', { callId: call.id, name: call.name });
        controller.signal.throwIfAborted();
        const result = await bounded(host.execute(call, { signal: controller.signal, onDispatch: ({ original, effective }) => { rootBudget.claim('tool'); toolsDispatched++; inFlight = { callId: effective.id, name: effective.name, ...(effective.name !== original.name ? { originalName: original.name } : {}) }; } }), controller.signal);
        const effectiveName = result.effective?.name || call.name;
        inFlight = null; hookErrors.push(...(result.hookErrors || []));
        if (result.callId !== call.id) throw failure('CALL_PAIR_MISMATCH');
        const partialPaths = (result.partialPaths || []).filter(path => ['report.md', 'manifest.json'].includes(path));
        if (partialPaths.length) partialEffects.push({ callId: call.id, name: effectiveName, ...(effectiveName !== call.name ? { originalName: call.name } : {}), partialPaths });
        if(result.memoryEffect)partialEffects.push({callId:call.id,name:effectiveName,memoryEffect:structuredClone(result.memoryEffect)});
        messages.push({ role: 'tool', callId: call.id, result });
        await record('tool_result', { callId: call.id, name: effectiveName, status: result.status, dispatched: result.dispatched, partialPaths, memoryEffect:result.memoryEffect, durationMs: result.durationMs, resultRef: result.value?.resultRef, sourceAcquisition: result.value?.mcp ? { serverName: result.value.mcp.serverName, protocolVersion: result.value.mcp.protocolVersion, protocolRequestId: result.value.mcp.protocolRequestId, modelCallId: result.value.mcp.modelCallId } : undefined, original: result.original, effective: result.effective, hookErrors: result.hookErrors || [], ...(result.status==='rejected'?{rejectionCode:result.error,...(result.validation?{validation:result.validation}:{})}:{}) });
        if (effectiveName === 'save_report' && result.status === 'succeeded') await record('file_saved', { receipt: result.value });
        if (result.status !== 'succeeded') {
          controller.signal.throwIfAborted();
          const correctable=!hooks&&effectiveName===call.name&&proposal.calls.length===1&&call.name==='calculate_change'&&result.status==='rejected'&&result.dispatched===false&&result.validation?.schemaVersion==='builtin-calculation-validation@1'&&result.validation.repairable===true&&['CALC_REQUIRED_FIELD_MISSING','CALC_NUMBER_TYPE','CALC_UNIT_FORMAT'].includes(result.validation.code)&&!partialEffects.length&&!unknownEffects.length;
          if(!correctable)throw failure(result.dispatched?'TOOL_FAILED':'TOOL_REJECTED');
          if(corrections>=1)throw failure('CORRECTION_LIMIT');
          corrections++;await record('validation_correction_offered',{callId:call.id,code:result.validation.code,remainingRounds:budget.maxRounds-rounds});
        }
      }
    }
    if (status !== 'completed') throw failure('ROUND_LIMIT');
  } catch (error) {
    code = error.code || 'EXECUTION_FAILED';
    status = code === 'CANCELLED' ? 'cancelled' : 'failed';
    if (inFlight) unknownEffects.push({ ...inFlight, status: 'unknown', dispatched: true });
  } finally {
    if (allowedTools) {
      try { sourceSnapshots = await host.getSources(); resultRefs = await host.getResultRefs(); }
      catch { status = 'failed'; code = 'RESULT_READBACK_FAILED'; }
    }
    clearTimeout(timer); signal?.removeEventListener('abort', cancel);
    if (log) {
      try { await record('run_finished', { status, code, toolsDispatched, receipt: host.receipt, unknownEffects, partialEffects }); } catch { if (status === 'completed') { status = 'failed'; code = 'LOG_WRITE_FAILED'; } }
      await log.close().catch(() => { logErrors.push('LOG_CLOSE_FAILED'); });
    }
    if (hooks) hookErrors.push(...await hooks.observe('release', { runId, rootId: rootBudget.rootId, taskId, status, code, logErrors: [...logErrors], receipt: host.receipt }));
  }
  return { runId, rootId: rootBudget.rootId, directory: resolve(directory), status, code, answer, receipt: host.receipt, toolsDispatched, rounds, logErrors, unknownEffects, partialEffects, hookErrors, rootUsage: rootBudget.snapshot(), taskId, ...(allowedTools ? { sources: sourceSnapshots, resultRefs } : {}), semanticStatus: 'unreviewed' };
}
