import {projectArtifactEffects} from './artifacts.mjs';
import { projectMemoryEffect } from './memory-effects.mjs';
import { open, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { safeDirectory } from './tools.mjs';
export async function readTimeline(directory) {
  const root = await safeDirectory(directory); const file = await open(join(root, 'run.jsonl'), constants.O_RDONLY | constants.O_NOFOLLOW);
  let text;
  try {
    const stat = await file.stat(); if (!stat.isFile() || stat.size > 2097152) throw new Error('Timeline file exceeds supported bounds');
    const buffer = Buffer.alloc(2097153); let at = 0;
    while (at < buffer.length) { const { bytesRead } = await file.read(buffer, at, buffer.length - at); if (!bytesRead) break; at += bytesRead; }
    if (at > 2097152) throw new Error('Timeline file exceeds supported bounds');
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, at));
  } finally { await file.close(); }
  const lines = text.split('\n').filter(Boolean); if (lines.length > 10000) throw new Error('Timeline entry limit');
  const identity = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const checks = {
    runId: identity, rootId: identity, taskId: value => value === null || identity(value),
    sequence: value => count(value) && value > 0,
    type: value => ['run_started', 'run_resumed', 'run_yielded', 'model_proposal', 'tool_proposal', 'tool_result', 'file_saved', 'run_finished','working_note'].includes(value),
    kind: value => ['calls', 'final'].includes(value), callId: identity,
    callIds: value => Array.isArray(value) && value.length <= 16 && value.every(identity),
    name: value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value),
    status: value => ['awaiting-response', 'completed', 'failed', 'cancelled', 'succeeded', 'rejected', 'unknown','applied','no-eligible-group','no-backed-material','budget-exhausted','summary-failed','summary-timeout','stale','memory-stale','invalid-summary','no-net-saving','persistence-failed','invalid-note-receipt'].includes(value),
    code: value => value === null || (typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,100}$/.test(value)),
    dispatched: value => typeof value === 'boolean', durationMs: finite, toolsDispatched: count
  };
  const entries = lines.map(line => {
    const event = JSON.parse(line);
    if (!event || typeof event !== 'object' || Array.isArray(event) || !checks.type(event.type)) throw new Error('Malformed or unsupported timeline event');
    const entry = {};
    for (const [key, valid] of Object.entries(checks)) if (Object.hasOwn(event, key) && valid(event[key])) entry[key] = event[key];
    if (event.type === 'model_proposal') {
      const usage = {};
      if (event.usage && typeof event.usage === 'object' && !Array.isArray(event.usage)) {
        for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) if (count(event.usage[key])) usage[key] = event.usage[key];
      }
      entry.usage = Object.keys(usage).length ? usage : null;
      entry.cost = finite(event.cost) ? event.cost : null;
    }
    if(event.type==='working_note'){for(const key of ['beforeBytes','afterBytes'])if(count(event[key]))entry[key]=event[key];for(const key of ['noteRef','persistedNoteRef'])if(event[key]===null||typeof event[key]==='string'&&/^note:sha256:[a-f0-9]{64}$/.test(event[key]))entry[key]=event[key];}
    if(event.type==='tool_result'){const artifacts=projectArtifactEffects(event.artifactEffects);if(artifacts)entry.artifactEffects=artifacts;if(typeof event.artifactId==='string'&&/^artifact:sha256:[a-f0-9]{64}$/.test(event.artifactId))entry.artifactId=event.artifactId;const effect=projectMemoryEffect(event.memoryEffect);if(effect)entry.memoryEffect=effect;}
    return entry;
  });
  return { schemaVersion: 'readonly-metadata@1', replayable: false, entries };
}
