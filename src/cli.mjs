import { readFile } from 'node:fs/promises';
import { run } from './runtime.mjs';
import { createFixtureGateway } from './fixture-gateway.mjs';

async function main(args) {
  const options = { case: 'document-compare', output: 'runs', live: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error('INVALID_ARGUMENT: duplicate option'); seen.add(arg);
    if (arg === '--live') { options.live = true; continue; }
    if (!['--case', '--output', '--observe', '--query', '--memory-library'].includes(arg) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('INVALID_ARGUMENT: --case and --output need values; only --live is a flag');
    options[arg.slice(2)] = args[++i];
  }
  if (options.live) throw new Error('LIVE_BLOCKED: provider/model, synthetic-data scope and fee authorization have not been approved for this public project; no network request was made');
  if (options.observe) {
    if (seen.has('--case') || seen.has('--output') || seen.has('--query') || seen.has('--memory-library')) throw new Error('INVALID_ARGUMENT: observe is read-only and cannot combine with case/output');
    const { readTimeline } = await import('./observe.mjs');
    process.stdout.write(JSON.stringify(await readTimeline(options.observe), null, 2) + '\n'); return;
  }
  if(seen.has('--memory-library')&&options.case!=='explicit-memory')throw new Error('INVALID_ARGUMENT: memory-library belongs to explicit-memory only');
  if(options.case==='explicit-memory'&&!options['memory-library'])throw new Error('INVALID_ARGUMENT: explicit Memory library --memory-library is required');
  if (seen.has('--query') && options.case !== 'retrieve-reread') throw new Error('INVALID_ARGUMENT: query belongs to retrieve-reread only');
  if (options.case === 'model-child') throw new Error('MODEL_CHILD_BLOCKED: no independent live model authorization/evidence; use fixture-child only for offline wiring');
  if (!['result-consumption','compact-and-reread','explicit-memory','retrieve-reread', 'batch-read', 'fixture-child', 'document-compare', 'artifact-table', 'skill-mcp', 'T1', 'T2', 'T3', 'T4'].includes(options.case)) throw new Error('INVALID_ARGUMENT: unsupported case');
  const definitions = JSON.parse(await readFile(new URL('../fixtures/cases.json', import.meta.url), 'utf8'));
  const controller = new AbortController(); const cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  if(['compact-and-reread','explicit-memory'].includes(options.case)){let result;try{const {runMemoryDemo,prepareCompactionDemo}=await import('./working-demo.mjs');if(options.case==='explicit-memory')result=await runMemoryDemo({libraryDirectory:options['memory-library'],outputRoot:options.output,signal:controller.signal});else{const prepared=prepareCompactionDemo();result={caseId:'compact-and-reread',...await run({question:'Compare original synthetic guides; use derived working notes without promoting them to original sources, reread and save.',...prepared,contextBytes:32000,outputRoot:options.output,signal:controller.signal})};}process.stdout.write(JSON.stringify(result,null,2)+'\n');}finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}if(options.case==='explicit-memory'?result.runs.some(run=>run.status!=='completed'):result.status!=='completed')process.exitCode=1;return;}
  if(options.case==='result-consumption'){
    try{
      const {prepareResultConsumption}=await import('./result-consumption-demo.mjs');
      const result=await run({question:'Resolve two exact original synthetic rows, calculate once, and deliver the same result in report and CSV.',...prepareResultConsumption(),outputRoot:options.output,signal:controller.signal});
      process.stdout.write(JSON.stringify({caseId:'result-consumption',mode:'fixture',...result},null,2)+'\n');
      if(result.status!=='completed')process.exitCode=1;
    }finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
    return;
  }
  if(options.case==='artifact-table'){try{const {createArtifactDemoGateway}=await import('./artifact-demo.mjs');const result=await run({question:'Generate an explicit synthetic CSV table and cited report through the ordinary tool chain.',gateway:createArtifactDemoGateway(),outputRoot:options.output,signal:controller.signal});process.stdout.write(JSON.stringify({caseId:'artifact-table',...result},null,2)+'\n');if(result.status!=='completed')process.exitCode=1;}finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}return;}
  if (options.case === 'retrieve-reread') {
    let result;
    try {
      const { prepareRetrieval } = await import('./retrieval-demo.mjs');
      const query = options.query || 'offline editing'; const prepared = prepareRetrieval({ query });
      result = await run({ question: 'Search the allowed synthetic pages for: ' + query + '. Read candidates, reread the exact stored version, and save a cited report if sources exist.', gateway: prepared.gateway, extensions: prepared.extensions, allowedDocuments: prepared.allowedDocuments, contextBytes: 8192, outputRoot: options.output, signal: controller.signal, requireReport: true });
      process.stdout.write(JSON.stringify({ caseId: 'retrieve-reread', query, ...result }, null, 2) + '\n');
    } finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
    if (result.status !== 'completed') process.exitCode = 1;
    return;
  }
  if (['batch-read', 'fixture-child'].includes(options.case)) {
    let result; let assembled;
    try {
      const { prepareCooperation } = await import('./cooperation-demo.mjs');
      assembled = prepareCooperation({ mode: options.case, outputRoot: options.output, signal: controller.signal });
      result = await run({ question: 'Compare the synthetic guides using ' + options.case + '; Main saves the cited report.', gateway: assembled.gateway, extensions: assembled.extensions, hooks: assembled.hooks, rootBudget: assembled.rootBudget, outputRoot: options.output, signal: controller.signal });
    } finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
    process.stdout.write(JSON.stringify({ caseId: options.case, ...result, observations: assembled.metadata }, null, 2) + '\n');
    if (result.status !== 'completed') process.exitCode = 1;
    return;
  }
  if (options.case === 'skill-mcp') {
    let assembled; let result; let closed;
    try {
      const { prepareSkillMcp } = await import('./extensions.mjs');
      assembled = await prepareSkillMcp({ signal: controller.signal });
      result = await run({ question: 'Read the comparison Skill, compare the two free-edition guides via MCP, and save a cited report.', gateway: assembled.gateway, extensions: assembled.extensions, outputRoot: options.output, requireReport: true, signal: controller.signal });
    } finally {
      try { closed = await assembled?.close(); }
      finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
    }
    process.stdout.write(JSON.stringify({ caseId: 'skill-mcp', ...result, mcp: closed, semanticStatus: 'unreviewed' }, null, 2) + '\n');
    if (result.status !== 'completed') process.exitCode = 1;
    return;
  }
  const cases = [];
  try {
    for (const c of definitions.cases) {
      if (options.case !== 'document-compare' && options.case !== c.id) {
        cases.push({ caseId: c.id, question: c.question, status: 'not-run', semanticStatus: 'unreviewed', httpDownload: 'not-applicable' }); continue;
      }
      if (controller.signal.aborted) {
        cases.push({ caseId: c.id, question: c.question, status: 'not-run', reason: 'cancelled', semanticStatus: 'unreviewed', httpDownload: 'not-applicable' }); continue;
      }
      try {
        const result = await run({ question: c.question, gateway: createFixtureGateway(c.id), outputRoot: options.output, requireReport: true, signal: controller.signal });
        cases.push({ caseId: c.id, question: c.question, expected: c.expected, mode: 'fixture', ...result, httpDownload: 'not-applicable' });
      } catch {
        cases.push({ caseId: c.id, question: c.question, status: 'failed', code: 'RUN_SETUP_FAILED', semanticStatus: 'unreviewed', httpDownload: 'not-applicable' });
      }
    }
  } finally { process.off('SIGINT', cancel); process.off('SIGTERM', cancel); }
  process.stdout.write(JSON.stringify({ mode: 'fixture', denominator: definitions.denominator, cases }, null, 2) + '\n');
  if (cases.some(c => c.status === 'failed' || c.status === 'cancelled') || controller.signal.aborted) process.exitCode = 1;
}
try { await main(process.argv.slice(2)); }
catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 2; }
