import { createServer } from 'node:http';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createConversation, inspectConversation, readConversationMessage, readConversationInput, readConversationTitle, titleForConversationInput, submitConversationMessage,
  workConversationMessage, cancelConversationMessage,
} from './conversation.mjs';
import { createResearchProject, inspectResearchProject, inspectResearchTask, supportsOwnerFreeform, updateResearchProject, validateResearchConfig } from './research-project.mjs';
import { importProjectSources } from './project-sources.mjs';
import { safeDirectory } from './storage-files.mjs';
import { prepareGuiLiveConfig } from './gui-live-config.mjs';

const routeId = '[A-Za-z0-9_-]{1,48}';
const idPattern = new RegExp('^'+routeId+'$');
const conversationPath = new RegExp('^/api/conversations/('+routeId+')$');
const reportPath = new RegExp('^/api/conversations/('+routeId+')/messages/('+routeId+')/report[.]md$');
const actionPath = new RegExp('^/api/conversations/('+routeId+')/messages(?:/('+routeId+')/(work|cancel))?$');
const config = {
  schemaVersion: 'research-project@1',
  gateway: { mode: 'fixture', provider: 'fixture', protocol: 'fixture@1', model: 'gui-local-demo' },
  capabilities: ['report'],
};
const validatedConfig = validateResearchConfig({ ...config, contextBytes: 1048576 });
const seedFiles = [['etf-fees.md', 'ETF 费率样例'], ['etf-tracking.md', 'ETF 跟踪样例']];
const uiRoot = new URL('./gui/', import.meta.url);
const assets = new Map([['/', ['index.html', 'text/html']], ['/gui.mjs', ['gui.mjs', 'text/javascript']], ['/gui.css', ['gui.css', 'text/css']]]);

class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
function reject(status, code) { throw new RequestError(status, code); }
function exact(input, keys) {
  return input && !Array.isArray(input) && Object.keys(input).sort().join() === [...keys].sort().join();
}
async function inputFor(req) {
  if (req.headers['content-type']?.split(';',1)[0].trim() !== 'application/json') reject(415, 'JSON_REQUIRED');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 18432) reject(413, 'INPUT_TOO_LARGE');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks)); }
  catch { reject(400, 'INVALID_JSON'); }
}
function projectedOutput(output) {
  const answer = output.answer ?? output.publication?.content;
  return {
    kind: output.kind,
    publicationStatus: output.publicationStatus ?? null,
    answer: answer?.text ?? null,
    report: output.report ? {
      text: output.report.text, sha256: output.report.sha256, revisionId: output.revision.revisionId,
    } : null,
    sources: output.revision?.sources?.map(({ sourceId, text, sha256 }) => ({ sourceId, text, sha256 })) ?? [],
    warning: output.deliveryWarning ?? output.answer?.warning ?? null,
  };
}
function demoGateway(source) {
  const proposed = (name, args) => ({ kind: 'calls', calls: [{ id: name, name, arguments: args }] });
  return {
    mode: 'fixture',
    async next({ messages }) {
      const results = messages.filter(m => m.role === 'tool').map(m => m.result.value);
      if (!results.length) return proposed('read_page', { documentId: source.documentId, page: 1 });
      if (!results[0]?.sourceId || typeof results[0].text !== 'string') throw new Error('Fixture source unavailable');
      if (results.length === 1) return proposed('save_report', {
        text: ['# 离线演练报告', '', '这份演练报告由固定脚本生成，不是模型对问题的分析。', '', results[0].text.trim(), '', '来源：[1]'].join('\n'),
        sourceIds: [results[0].sourceId],
      });
      return { kind: 'final', text: '演练报告已保存。' };
    },
  };
}
async function guiProject(projectDir, expectedConfig, live, freeform) {
  let project;
  try { project = await inspectResearchProject({ projectDir }); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    project = await createResearchProject({ directory: projectDir, config:expectedConfig });
  }
  if (!isDeepStrictEqual(project.config, expectedConfig)) {
    const {ownerConnectivity:oldConnectivity,...oldBase}=project.config;
    const {ownerConnectivity:nextConnectivity,...nextBase}=expectedConfig;
    // Only the trusted launch config can change connectivity on this existing
    // owner project. Other changes still fail closed. Old Run definitions
    // retain their original profile and historical readback.
    if(!freeform||!isDeepStrictEqual(oldBase,nextBase)||!nextConnectivity&&!oldConnectivity) {
      reject(400, live?'GUI_LIVE_PROJECT_REQUIRED':'GUI_DEMO_PROJECT_REQUIRED');
    }
    project=await updateResearchProject({projectDir,config:expectedConfig,expectedConfigSha256:project.configSha256});
  }
  projectDir = await safeDirectory(projectDir);
  const sources = freeform?[]:await Promise.all(seedFiles.map(async ([name, title]) => {
    const { manifestSha256, catalog } = await importProjectSources({ projectDir, files: [fileURLToPath(new URL(name, uiRoot))] });
    return { id: manifestSha256, title, documentId: catalog.documents[0].id };
  }));
  return { projectDir, sources, projectId: project.projectId };
}

export async function startLocalGui({ projectDir, port = 0, liveConfig, env = process.env, fetchImpl, ownerWebTransport } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) reject(400, 'INVALID_GUI_PORT');
  const live = liveConfig === undefined ? null : prepareGuiLiveConfig(liveConfig,env);
  const mode = live?'live-research':'offline-demo';
  const expectedConfig=live?.config??validatedConfig;
  const wrongProject=live?'GUI_LIVE_PROJECT_REQUIRED':'GUI_DEMO_PROJECT_REQUIRED';
  const freeform=supportsOwnerFreeform(expectedConfig);
  const needsConsent=live&&!freeform;
  const connectivity=expectedConfig.ownerConnectivity??{};
  const ownerWindSettings=connectivity.wind?((await import('./gui-owner-wind.mjs')).prepareOwnerWind(true,env)):undefined;
  const demo = await guiProject(projectDir, expectedConfig, live, freeform);
  projectDir = demo.projectDir;
  const assetsByPath = new Map(await Promise.all([...assets].map(async ([route, [name,type]]) =>
    [route, { bytes: await readFile(new URL(name, uiRoot)), type }]
  )));
  const hostSignal = new AbortController();
  const publicSources = demo.sources.map(({ id, title }) => ({ id, title }));
  let origin, working = null, submitting = null;
  const workKey = (conversationId, messageId) => conversationId + '/' + messageId;
  const sourceFor = id => demo.sources.find(s => s.id === id);

  async function list({ titles = false } = {}) {
    let entries;
    try { entries = await readdir(join(projectDir, 'conversations'), { withFileTypes: true }); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    if (entries.length > 128) reject(409, 'GUI_HISTORY_LIMIT');
    const rows = entries.filter(e => e.isDirectory() && idPattern.test(e.name))
      .map(e => ({ id: e.name }))
      .sort((a,b) => b.id.localeCompare(a.id));
    if (titles) {
      // Keep the number of concurrent filesystem reads bounded.
      for (let i=0;i<rows.length;i+=8) await Promise.all(rows.slice(i,i+8).map(async row=>{
        try { row.title=await readConversationTitle({projectDir,conversationId:row.id}); }
        catch { row.title=null; } // One unreadable entry must not hide all other conversations.
      }));
    }
    return rows;
  }
  async function detail(conversationId) {
    const c = await inspectConversation({ projectDir, conversationId });
    const messages = [];
    for (const m of c.messages) {
      const key = workKey(conversationId, m.messageId);
      const workerWasRunning = working?.key === key;
      let run, output = null, error = null;
      const input = await readConversationInput({ projectDir, conversationId, messageId: m.messageId });
      if (m.status !== 'admission-pending') {
        ({ run } = await inspectResearchTask({ projectDir, runId: m.runId }));
        try {
          const view = await readConversationMessage({ projectDir, conversationId, messageId: m.messageId });
          output = projectedOutput(view.output);
        } catch (e) {
          if (e.code !== 'PROJECT_REPORT_NOT_READY') error = 'OUTPUT_READ_FAILED';
        }
      }
      const status = run?.status ?? m.status;
      messages.push({
        id: m.messageId, runId: m.runId, status, phase: run?.snapshot?.phase ?? null,
        // A worker can finish during these reads. Keep polling an active snapshot.
        code: run?.snapshot?.code ?? null, working: status === 'active' && (workerWasRunning || working?.key === key),
        question: input.text, sourceId: input.sourceManifestSha256, output, error,
      });
    }
    return { id: c.conversationId, title: titleForConversationInput(messages[0]?.question), messages };
  }
  function begin(conversationId, messageId, sourceId) {
    const key = workKey(conversationId, messageId);
    if (working?.key === key) return;
    if (working) reject(409, 'GUI_WORKER_BUSY');
    const source = sourceFor(sourceId);
    if (freeform?sourceId!==null:!source) reject(409, 'GUI_SOURCE_UNKNOWN');
    const p = Promise.resolve().then(() =>
      workConversationMessage({ projectDir, conversationId, messageId,
        ...(live?{apiKey:live.apiKey,fetchImpl,ownerWebTransport,ownerWindSettings}:{gateway:demoGateway(source)}), hostSignal: hostSignal.signal })
    ).catch(() => { /* Lifecycle and original execution evidence remain in Project. */ });
    working = { key, p };
    p.finally(() => { if (working?.p === p) working = null; });
  }
  const server = createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    const headers = {
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-origin',
    };
    const send = (status, content, type, extraHeaders = {}) => {
      const bytes = Buffer.isBuffer(content) ? content : Buffer.from(JSON.stringify(content));
      res.writeHead(status, { ...headers, 'content-type': type ?? 'application/json; charset=utf-8', 'content-length': bytes.length, ...extraHeaders });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    };
    try {
      if (!origin || req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) reject(403,'GUI_ORIGIN_REQUIRED');
      if (!['GET','HEAD','POST'].includes(req.method)) reject(405,'METHOD_NOT_ALLOWED');
      if (req.method === 'POST' && (req.headers.origin !== origin || req.headers['sec-fetch-site']==='cross-site')) reject(403,'GUI_ORIGIN_REQUIRED');
      if (req.method !== 'POST') {
        const asset = assetsByPath.get(req.url);
        if (asset) return send(200, asset.bytes, asset.type+'; charset=utf-8');
        if (req.url === '/api/workspace') return send(200, {
          schemaVersion: 'local-gui@1', mode,
          ...(live?{liveNotice:{maxModelCallsPerRun:expectedConfig.limits.model,...(freeform?{freeform:true,connectivity:{web:connectivity.web===true,search:connectivity.search==='exa-public-preview',wind:connectivity.wind===true}}:{})}}:{}),
          capabilities: ['conversations','progress','reports','sources'],
          projectId: demo.projectId, conversations: await list({titles:true}), sources: publicSources,
        });
        const reportMatch = reportPath.exec(req.url);
        if (reportMatch) {
          const [,conversationId,messageId] = reportMatch;
          const { output } = await readConversationMessage({projectDir,conversationId,messageId});
          if (!output.report) reject(404,'NOT_FOUND');
          return send(200,Buffer.from(output.report.text), 'text/markdown; charset=utf-8', {
            'content-disposition': 'attachment; filename="etf-report-'+messageId+'.md"',
          });
        }
        const match = conversationPath.exec(req.url);
        if (match) return send(200, await detail(match[1]));
        reject(404,'NOT_FOUND');
      }
      if (req.url === '/api/conversations') {
        if (!exact(await inputFor(req), [])) reject(400,'INVALID_CONVERSATION');
        if ((await list()).length >= 128) reject(409,'GUI_HISTORY_LIMIT');
        // IDs are minted on the server and monotonically group creation times for the list.
        const conversationId = 'c' + Date.now() + '-' + randomUUID().replaceAll('-','').slice(0,24);
        await createConversation({ projectDir, conversationId });
        return send(201, { id: conversationId });
      }
      const match = actionPath.exec(req.url);
      if (!match) reject(404,'NOT_FOUND');
      const [,conversationId,messageId,action] = match;
      if (!action) {
        const input = await inputFor(req);
        if (needsConsent && input?.approveLive!==true) reject(400,'GUI_LIVE_APPROVAL_REQUIRED');
        if (!exact(input, freeform?['messageId','question']:needsConsent?['messageId','question','sourceId','approveLive']:['messageId','question','sourceId']) || typeof input.messageId !== 'string'
          || !idPattern.test(input.messageId) || typeof input.question !== 'string' || !input.question.trim()
          || Buffer.byteLength(input.question)>12000 || !freeform&&!sourceFor(input.sourceId)) reject(400,'INVALID_MESSAGE');
        if (submitting || (working && working.key !== workKey(conversationId,input.messageId))) reject(409,'GUI_WORKER_BUSY');
        submitting = workKey(conversationId,input.messageId);
        try {
          if (!isDeepStrictEqual((await inspectResearchProject({projectDir})).config,expectedConfig)) reject(409,wrongProject);
          // A live replay acknowledges the same accepted intent. It does not restart work.
          let retry=false;
          if (live) {
            try { await readConversationInput({projectDir,conversationId,messageId:input.messageId}); retry=true; }
            catch (error) { if (error.code!=='ENOENT') throw error; }
          }
          const sourceId=freeform?null:input.sourceId;
          const m = await submitConversationMessage({ projectDir, conversationId, messageId: input.messageId,
            text: input.question, sourceManifestSha256: sourceId,
            ...(live?{authorization:{providerApproved:true,dataApproved:true,costApproved:true}}:{}) });
          if (m.status === 'active' && !retry) begin(conversationId,input.messageId,sourceId);
          return send(202,{ id:m.messageId,runId:m.runId,status:m.status });
        } finally { submitting = null; }
      }
      const actionInput=await inputFor(req);
      if (needsConsent && action==='work' && actionInput?.approveLive!==true) reject(400,'GUI_LIVE_APPROVAL_REQUIRED');
      if (!exact(actionInput,needsConsent&&action==='work'?['approveLive']:[])) reject(400,'INVALID_ACTION');
      const m = await inspectConversation({ projectDir, conversationId });
      const found = m.messages.find(x => x.messageId === messageId);
      if (!found || found.status === 'admission-pending') reject(404,'NOT_FOUND');
      if (action === 'cancel') {
        const result = await cancelConversationMessage({ projectDir, conversationId, messageId });
        return send(200, { status: result.status ?? 'cancel-requested' });
      }
      if (submitting || found.status !== 'active') reject(409,'RUN_NOT_ACTIVE');
      const { definition } = await inspectResearchTask({ projectDir,runId:found.runId });
      if (!isDeepStrictEqual(definition.config,expectedConfig)) reject(409,wrongProject);
      if (freeform&&definition.sourceManifestSha256!==null) reject(409,'GUI_LIVE_LEGACY_RETRY_DISABLED');
      begin(conversationId,messageId,definition.sourceManifestSha256);
      return send(202, { id: messageId });
    } catch (e) {
      const code = e.status ? e.message : typeof e.code === 'string' && /^[A-Z0-9_]+$/.test(e.code) ? e.code : 'GUI_REQUEST_FAILED';
      const status = e.status ?? (code==='ENOENT'||code==='UNKNOWN_RUN'?404:code.includes('ID_CONFLICT')?409:500);
      if (!res.headersSent && !res.destroyed) send(status,{ error:code });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 8000;
  await new Promise((resolve,reject) => {
    server.once('error', reject);
    server.listen(port,'127.0.0.1',() => { server.off('error',reject); resolve(); });
  });
  origin = 'http://127.0.0.1:' + server.address().port;
  let closing;
  return { origin, mode, async close() {
    if (!closing) {
      hostSignal.abort();
      closing = new Promise((resolve,reject) => server.close(e => e ? reject(e) : resolve()));
    }
    await Promise.all([closing,working?.p]);
  } };
}
