import { readTimeline } from './observe.mjs';

const isIdentity = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,100}$/.test(value) ? value : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const logWarning = new Set(['LOG_WRITE_FAILED', 'LOG_CLOSE_FAILED']);
const runtimeStates = new Set(['completed', 'failed', 'cancelled', 'not-run']);
const reportHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null;
const artifactId = value => typeof value === 'string' && /^artifact:sha256:[0-9a-f]{64}$/.test(value) ? value : null;
const revisionId = value => typeof value === 'string' && /^revision:sha256:[0-9a-f]{64}$/.test(value) ? value : null;

async function summarize(run, reader) {
  if (run?.status === 'not-run') return {status: 'not-run'};
  if (!run || !isIdentity(run.runId) || !isIdentity(run.rootId) || typeof run.directory !== 'string') {
    return {status: 'unavailable', code: 'RUN_IDENTITY_UNAVAILABLE'};
  }
  let events;
  try { events = (await reader(run.directory)).entries; }
  catch (error) {
    return {status: 'unavailable', code: error.code === 'ENOENT' ? 'RUN_LOG_MISSING' : 'RUN_LOG_UNREADABLE'};
  }
  if (events.some(event => event.runId !== run.runId || event.rootId !== run.rootId)) {
    return {status: 'mismatch', code: 'TIMELINE_RUN_MISMATCH'};
  }
  const end = events.at(-1);
  const toolResults = events.filter(event => event.type === 'tool_result');
  const complete = events[0]?.type === 'run_started' && end?.type === 'run_finished'
    && end.settlementPhase === 'pre-settlement' && end.terminalAuthority === 'Runtime.return'
    && events.every((event, index) => event.sequence === index + 1)
    && events.filter(event => event.type === 'run_finished').length === 1;
  if (complete && (end.status !== run.status || end.code !== (run.code ?? null)
                   || end.toolsDispatched !== run.toolsDispatched)) {
    return {status: 'mismatch', code: 'TIMELINE_OUTCOME_MISMATCH'};
  }
  return {
    status: complete ? 'available' : 'incomplete',
    ...(!complete ? {code: 'TIMELINE_INCOMPLETE'} : {}),
    fixtureModelProposals: events.filter(event => event.type === 'model_proposal').length,
    toolResults: {
      total: toolResults.length,
      dispatched: toolResults.filter(event => event.dispatched === true).length,
      rejected: toolResults.filter(event => event.status === 'rejected').length,
      failed: toolResults.filter(event => event.status === 'failed').length,
      unknown: toolResults.filter(event => event.status === 'unknown').length,
      codes: [...new Set(toolResults.map(event => event.code).filter(safeCode))].sort(),
    },
    // This is the runtime's last observation before settlement, not a second
    // owner of the final outcome. The runtime return is carried separately.
    preSettlementSeen: complete,
  };
}

export async function buildEvalObservation(fixture, report, read = readTimeline) {
  const cases = [];
  for (const row of report.cases) {
    const run = fixture.cases.find(entry => entry.caseId === row.caseId);
    const evaluation = { status: row.status, code: safeCode(row.code) };
    const runtime = {
      status: runtimeStates.has(run?.status) ? run.status : 'unavailable',
      code: safeCode(run?.code),
      runId: isIdentity(run?.runId) ? run.runId : null,
      rootId: isIdentity(run?.rootId) ? run.rootId : null,
      rounds: count(run?.rounds),
      toolsDispatched: count(run?.toolsDispatched),
      logWarnings: (run?.logErrors ?? []).filter(code => logWarning.has(code)),
    };
    const receipt = run?.receipt;
    const observedReceipt = receipt ? {
      artifactId: artifactId(receipt.artifactId), revisionId: revisionId(receipt.revisionId), sha256: reportHash(receipt.sha256),
      verifiedByHttp: row.status === 'passed' && receipt.artifactId === row.artifactId
        && receipt.revisionId === row.revisionId && receipt.sha256 === row.sha256,
    } : null;
    cases.push({
      caseId: row.caseId, evaluation, runtime,
      receipt: observedReceipt,
      timeline: await summarize(run, read),
    });
  }
  return {schemaVersion: 'open-etf-eval-observation@1', transport: 'local-metadata', remoteTelemetry: false, cases};
}
