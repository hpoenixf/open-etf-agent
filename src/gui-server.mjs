import {ownerToolCatalog} from './gui-tool-catalog.mjs';
import {isResearchSkillChoice} from './financial-analysis-methods.mjs';
import {INPUT_CHART_SKILL,INPUT_CHART_AUTO,hasSuppliedChartData} from './financial-chart-input.mjs';
import {dailyBriefLabel} from './conversation-daily-context.mjs';
import {CHART_COMPUTE_DATE_MODE,CHART_PDF_COMPUTE_CANONICAL,linkedChartComputeMode,chartComputeAvailable} from './financial-chart-compute.mjs';
import {AGENT_CHART_SKILL,agentChartChoice} from './financial-chart-agent.mjs';
import {OWNER_CHART_SKILL,OWNER_CHART_AUTO} from './financial-chart-owner.mjs';
import {readResearchIntent,isAutoResearchProfile,isDeepResearchProfile,readDeepResearchProgress} from './research-intent.mjs';
import { createServer } from 'node:http';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createConversation, inspectConversation, inspectConversationMessage, readDailyConversationBaseline, readConversationMessage, readConversationCharts, readConversationInput, listConversationCatalog, MAX_CONVERSATION_CATALOG_ENTRIES, titleForConversationInput, submitConversationMessage,
  workConversationMessage, cancelConversationMessage,
  readConversationBody, readConversationSources,
} from './conversation.mjs';
import { createResearchProject, dailyWatchConfigVersion, inspectResearchProject, inspectResearchTask, maintainOwnerGuiAdmission, readProjectJson, supportsOwnerFreeform, updateResearchProject, validateResearchConfig } from './research-project.mjs';
import { importProjectSources, importUploadedPdf, PROJECT_SOURCE_LIMITS } from './project-sources.mjs';
import { ensureSafeDirectory, publishImmutable, safeDirectory } from './storage-files.mjs';
import { OWNER_LINKED_PDF_REVISION, OWNER_LINKED_PDF_LOCAL_MISS, OWNER_LINKED_PDF_INDEXED_CELLS, prepareOwnerSearch } from './gui-owner-web.mjs';
import { prepareOwnerDailyDigest } from './gui-daily-digest-delivery.mjs';
import { prepareScheduledSmtp } from './scheduled-smtp.mjs';
import { createScheduledReportEmailHook, inspectScheduledEmailDelivery, prepareFullWatchEmail } from './scheduled-report-email.mjs';
import { openGuiDailyWatch, DAILY_TIME_ZONE } from './gui-daily-watch.mjs';
import { createSkillCatalog } from './skills.mjs';
import {offerReasoningEffort} from './gateway.mjs';
import { readGuiResearchProgress, readGuiReasoningEffort } from './gui-progress.mjs';
import { createGoHealth } from './go-health.mjs';
import { prepareGuiLiveConfig } from './gui-live-config.mjs';
import { prepareOwnerLangfuse } from './gui-langfuse.mjs';

const routeId = '[A-Za-z0-9_-]{1,48}';
const idPattern = new RegExp('^'+routeId+'$');
const conversationPath = new RegExp('^/api/conversations/('+routeId+')$');
const pdfPath = new RegExp('^/api/conversations/('+routeId+')/pdf$');
const pdfId = /^[a-f0-9]{64}$/;
const dailyPath = new RegExp('^/api/daily-watch(?:/(w[a-f0-9]{24}))?$');
const progressPath = new RegExp('^/api/conversations/('+routeId+')/messages/('+routeId+')/progress$');
const reportPath = new RegExp('^/api/conversations/('+routeId+')/messages/('+routeId+')/report[.]md$');
const bodyPath = new RegExp('^/api/conversations/('+routeId+')/messages/('+routeId+')/body$');
const sourcesPath = new RegExp('^/api/conversations/('+routeId+')/messages/('+routeId+')/sources$');
const actionPath = new RegExp('^/api/conversations/('+routeId+')/messages(?:/('+routeId+')/(work|cancel))?$');
const config = {
  schemaVersion: 'research-project@1',
  gateway: { mode: 'fixture', provider: 'fixture', protocol: 'fixture@1', model: 'gui-local-demo' },
  capabilities: ['report'],
};
const validatedConfig = validateResearchConfig({ ...config, contextBytes: 1048576 });
const seedFiles = [['etf-fees.md', 'ETF 费率样例'], ['etf-tracking.md', 'ETF 跟踪样例']];
const uiRoot = new URL('./gui/', import.meta.url);
const assets = new Map([['/', ['index.html', 'text/html']], ['/gui.mjs', ['gui.mjs', 'text/javascript']], ['/markdown.mjs', ['markdown.mjs', 'text/javascript']], ['/public-pdf-navigation.mjs', ['public-pdf-navigation.mjs', 'text/javascript']], ['/answer-image.mjs', ['answer-image.mjs', 'text/javascript']], ['/brand-mark.mjs', ['brand-mark.mjs', 'text/javascript']], ['/vendor/marked-16.4.2.mjs', ['vendor/marked-16.4.2.mjs', 'text/javascript']], ['/gui.css', ['gui.css', 'text/css']], ['/financial-chart-view.mjs',['financial-chart-view.mjs','text/javascript']]]);

class RequestError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
function reject(status, code) { throw new RequestError(status, code); }
function exact(input, keys) {
  return input && !Array.isArray(input) && Object.keys(input).sort().join() === [...keys].sort().join();
}
async function readBody(req,limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) reject(413, 'INPUT_TOO_LARGE');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function inputFor(req) {
  if (req.headers['content-type']?.split(';',1)[0].trim() !== 'application/json') reject(415, 'JSON_REQUIRED');
  const bytes=await readBody(req,18432);
  try { return JSON.parse(bytes); }
  catch { reject(400, 'INVALID_JSON'); }
}
const readableDelivery=output=>Boolean(output?.answer||output?.report?.text);
function projectedOutput(output) {
  const answer = output.answer ?? output.publication?.content;
  return {
    kind: output.kind,
    publicationStatus: output.publicationStatus ?? null,
    answer: answer?.text ?? null,
    report: output.report ? {
      text: output.report.text, sha256: output.report.sha256, revisionId: output.revision.revisionId,
    } : null,
    sources: output.revision?.sources?.map(({ sourceId, text, sha256, page, pdf }) => ({ sourceId, text, sha256, ...(pdf?{pdfPage:page}: {}) })) ?? [],
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
    const {ownerConnectivity:oldConnectivity,ownerOpenAIResponses:oldOpenAI,ownerGeminiFree:oldGemini,...oldBase}=project.config;
    const {ownerConnectivity:nextConnectivity,ownerOpenAIResponses:nextOpenAI,ownerGeminiFree:nextGemini,...nextBase}=expectedConfig;
    // Only the trusted launch config can change connectivity on this existing
    // owner project. Other changes still fail closed. Old Run definitions
    // retain their original profile and historical readback.
    if(!freeform||!isDeepStrictEqual(oldBase,nextBase)||!nextConnectivity&&!oldConnectivity&&!oldOpenAI&&!nextOpenAI&&!oldGemini&&!nextGemini) {
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

// Trusted server composition only. An account host must authenticate and
// resolve its Project before mounting this listener-free handler.
export async function createLocalGuiWorkspace({ projectDir, origin: mountOrigin, liveConfig, env = process.env, fetchImpl, ownerWebTransport, ownerWindFetch, dailyClock, onDailyCompleted, smtpOptions, ownerDailyDigest, langfuseOptions } = {}) {
  const live = liveConfig === undefined ? null : prepareGuiLiveConfig(liveConfig,env);
  const mode = live?'live-research':'offline-demo';
  const goHealth=live?.openAIKey||live?.geminiFreeKey?createGoHealth({fetchImpl}):undefined;
  const telemetry=live?prepareOwnerLangfuse(env,langfuseOptions):null;
  let telemetryLoop;
  const expectedConfig=live?.config??validatedConfig;
  const wrongProject=live?'GUI_LIVE_PROJECT_REQUIRED':'GUI_DEMO_PROJECT_REQUIRED';
  const freeform=supportsOwnerFreeform(expectedConfig);
  const admissionMode=env.ETF_GUI_CONCURRENT_ADMISSION;
  if(admissionMode!==undefined&&!['0','1'].includes(admissionMode))reject(500,'GUI_ADMISSION_MODE_INVALID');
  if(admissionMode==='1'&&!freeform)reject(500,'GUI_ADMISSION_MODE_UNSUPPORTED');
  const ownerAdmission=admissionMode==='1',workerCapacity=ownerAdmission?5:1;
  const needsConsent=live&&!freeform;
  const reasoningEffort=offerReasoningEffort(expectedConfig);
  const connectivity=expectedConfig.ownerConnectivity??{};
  const chartAvailable=freeform;
  const agentChart=chartAvailable&&Boolean(live)&&env.ETF_GUI_AGENT_FINANCIAL_CHART==='1';
  const chartCompute=agentChart&&env.ETF_GUI_CHART_COMPUTE==='1'&&chartComputeAvailable();
  const chartAuto=chartAvailable&&connectivity.wind===true&&env.ETF_GUI_FINANCIAL_CHART_AUTO==='1';
  const ownerSearchSettings=Object.fromEntries([connectivity.search,...(connectivity.searchAlternates??[])].filter(Boolean).map(provider=>[provider,prepareOwnerSearch(provider,env)]));
  const ownerWindSettings=connectivity.wind?((await import('./gui-owner-wind.mjs')).prepareOwnerWind(true,env)):undefined;
  const demo = await guiProject(projectDir, expectedConfig, live, freeform);
  projectDir = demo.projectDir;
  const assetsByPath = new Map(await Promise.all([...assets].map(async ([route, [name,type]]) =>
    [route, { bytes: await readFile(new URL(name, uiRoot)), type }]
  )));
  const hostSignal = new AbortController();
  const dailyConfigVersion=freeform?dailyWatchConfigVersion(await inspectResearchProject({projectDir})):null;
  const labeledDailyBriefOnly=env.ETF_GUI_DAILY_WATCH_SKILL_SCOPE==='labeled';
  const dailyBriefSkill=freeform&&env.ETF_GUI_DAILY_AUTORUN==='1'&&env.ETF_GUI_DAILY_WATCH_SKILL==='daily-watch-brief'
    ?await (await createSkillCatalog({root:fileURLToPath(new URL('./owner-skills/',import.meta.url)),maxBytes:3000})).read('daily-watch-brief'):undefined;
  const daily=freeform?await openGuiDailyWatch(projectDir,{now:dailyClock}):null;
  let smtp,digestProfile,fullWatch;
  try {
    digestProfile=daily?(ownerDailyDigest??prepareOwnerDailyDigest(env,smtpOptions)):null;
    smtp=daily&&!digestProfile?prepareScheduledSmtp(env,smtpOptions):null;
    const watchContent=env.ETF_DAILY_WATCH_EMAIL_CONTENT??'text';
    if(!['text','full-report'].includes(watchContent))reject(500,'WATCH_FULL_EMAIL_MODE');
    if(daily&&watchContent==='full-report'){
      if(digestProfile||!smtp||onDailyCompleted)reject(500,'WATCH_FULL_EMAIL_MODE');
      fullWatch=prepareFullWatchEmail({recipient:smtp.resolveDestination(),origin:env.ETF_DAILY_WATCH_EMAIL_OWNER_ORIGIN});
    }
  }
  catch(error){daily?.close();throw error;}
  const ownerMailbox=fullWatch?.destination??smtp?.resolveDestination();
  // Bind owner confirmation to the provider's recipient+revision identity.
  const emailVersion=ownerMailbox?.version??(onDailyCompleted?'injected-owner-mail@1':null);
  const deliveryHook=onDailyCompleted??(smtp?createScheduledReportEmailHook({
    resolveConfirmedDestination:({watchId,date})=>daily.emailConfirmed(watchId,date,emailVersion,{fullWatchEmail:!!fullWatch})?ownerMailbox:null,
    transport:smtp.transport,fullReportOrigin:fullWatch?.ownerOrigin,
  }):undefined);
  const emailConsentToken=deliveryHook?randomUUID():null;
  const emailPreview=ownerMailbox?.address.replace(/^(.).*@/,'$1***@');
  const digestVersion=digestProfile?.version??null;
  const digestConsentToken=digestProfile?randomUUID():null;
  const dailyAutorun=!!daily&&env.ETF_GUI_DAILY_AUTORUN==='1';
  let dailyLoop=null,dailyFlight=null,digestFlight=null;
  const publicSources = demo.sources.map(({ id, title }) => ({ id, title }));
  let origin=mountOrigin;
  // Explicit owner-only launch opt-in. A conversation remains single-worker so
  // admission does not capture a racing/incomplete predecessor as history.
  const working=new Map(),submitting=new Set();
  let admissionLoop,admissionFlight;
  const sweepAdmission=()=>{
    if(!ownerAdmission||hostSignal.signal.aborted)return;
    if(!admissionFlight)admissionFlight=maintainOwnerGuiAdmission({projectDir}).catch(()=>{/* Keep unavailable evidence held. */}).finally(()=>{admissionFlight=null;});
    return admissionFlight;
  };
  const used=()=>new Set([...working.keys(),...submitting]).size;
  const reserve=key=>{
    if(submitting.has(key)||[...working.keys(),...submitting].some(other=>other!==key&&other.split('/')[0]===key.split('/')[0])
       ||(!working.has(key)&&used()>=workerCapacity))reject(409,'GUI_WORKER_BUSY');
    submitting.add(key);
  };
  function observedResearchRoute(input,run) {
    if(!run)return null;
    if(input.researchDepth==='auto'&&run.definition?.config?.researchControl==='research-control@1'&&isDeepResearchProfile(run.definition.config.researchProfile))return 'deep';
    if(input.researchDepth==='auto'&&isAutoResearchProfile(run.definition?.config?.researchProfile)){
      const adopted=readResearchIntent(run.snapshot?.messages??[]);
      return adopted!=='direct'?adopted:run.status==='completed'?'direct':null;
    }
    const mode=input.researchDepth, profile=run.definition?.config?.researchProfile;
    if(!(mode==='deep'&&isDeepResearchProfile(profile)||mode==='standard'&&profile==='standard-research@1'))return null;
    return run.status==='completed'||run.snapshot?.proposal||run.snapshot?.messages?.some(m=>m.role==='assistant'&&m.calls?.length)?mode:null;
  }
  function setOrigin(value) {
    if (origin !== undefined) throw new Error('GUI_ORIGIN_ALREADY_SET');
    origin = value;
  }
  const workKey = (conversationId, messageId) => conversationId + '/' + messageId;
  const sourceFor = id => demo.sources.find(s => s.id === id);

  async function detail(conversationId) {
    const c = await inspectConversation({ projectDir, conversationId });
    const messages = [];
    for (const m of c.messages) {
      const key = workKey(conversationId, m.messageId);
      const workerWasRunning = working.has(key);
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
      let chartViews=[];
      if(input.chartSkill&&status==='completed'){
        try{chartViews=await readConversationCharts({projectDir,conversationId,messageId:m.messageId});}
        catch{/* Invalid or missing committed chart data is never shown. */}
      }
      const effectiveResearchIntent=observedResearchRoute(input,run);
      const deepProgress=readDeepResearchProgress(run?.definition?.config?.researchProfile,run?.snapshot,{deliveryReadback:status==='completed'&&readableDelivery(output)});
      const effort=await readGuiReasoningEffort(projectDir,run,input.reasoningEffort);
      messages.push({
        id: m.messageId, runId: m.runId, status, phase: run?.snapshot?.phase ?? null,
        // A worker can finish during these reads. Keep polling an active snapshot.
        code: run?.snapshot?.code ?? null, working: status === 'active' && (workerWasRunning || working.has(key)),
        question: input.text, sourceId: input.sourceManifestSha256, ...(effort?{reasoningEffort:effort}:{}), ...(chartViews.length?{chartViews}:{}), ...(input.researchDepth===undefined?{}:{researchDepth:input.researchDepth}), ...(effectiveResearchIntent?{effectiveResearchIntent}:{}), ...(deepProgress?{deepProgress}:{}), ...(['research','deep'].includes(effectiveResearchIntent)&&output?{evidenceAssessment:'unreviewed'}:{}), ...(freeform&&input.sourceManifestSha256?{attachment:await pdfAttachment(conversationId,input.sourceManifestSha256)}:{}), output, error,
      });
    }
    return { id: c.conversationId, title: titleForConversationInput(messages[0]?.question), messages };
  }
  let uploading=false;
  const pdfDirectory=conversationId=>join(projectDir,'conversations',conversationId,'pdf-uploads');
  async function pdfAttachment(conversationId,id) {
    if(typeof id!=='string'||!pdfId.test(id)) return null;
    try {
      const {id:storedId,name,pages}=await readProjectJson(join(pdfDirectory(conversationId),id+'.json'),4096);
      if(storedId!==id||typeof name!=='string'||!Number.isSafeInteger(pages)||pages<1||pages>16) reject(500,'GUI_PDF_METADATA_INVALID');
      return {id,name,pages};
    } catch(e) { if(e.code==='ENOENT')return null; throw e; }
  }
  function begin(conversationId, messageId, sourceId) {
    const key = workKey(conversationId, messageId);
    if (working.has(key)) return;
    if (hostSignal.signal.aborted||working.size>=workerCapacity||[...working.keys()].some(other=>other.split('/')[0]===conversationId))reject(409,'GUI_WORKER_BUSY');
    const source = sourceFor(sourceId);
    if (!freeform&&!source) reject(409, 'GUI_SOURCE_UNKNOWN');
    const trace=telemetry?.start();
    const p = Promise.resolve().then(() =>
      workConversationMessage({ projectDir, conversationId, messageId,
        ...(live?{apiKey:live.apiKey,openAIKey:live.openAIKey,geminiFreeKey:live.geminiFreeKey,goHealth,fetchImpl,ownerWebTransport,ownerWindSettings,ownerSearchSettings,ownerWindFetch,ownerAdmission,observeGuiRun:trace?.observe}:{gateway:demoGateway(source)}), hostSignal: hostSignal.signal })
    ).catch(() => { /* Lifecycle and original execution evidence remain in Project. */ });
    if(trace)void p.then(async()=>{
      const turn=await inspectConversationMessage({projectDir,conversationId,messageId});
      if(!turn?.runId)return;
      const {run,definition}=await inspectResearchTask({projectDir,runId:turn.runId});
      if(!['completed','failed','cancelled'].includes(run?.status))return;
      // Use the same narrow persisted-body boundary as the GUI, never the bulk
      // History read, and never treat provider completion as delivery.
      let delivery='unavailable';
      try {
        const exact=await readConversationBody({projectDir,conversationId,messageId});
        if(exact.body?.text)delivery='publication';
        else {
          const {output}=await readConversationMessage({projectDir,conversationId,messageId});
          delivery=output?.kind==='report'?'report':'not-created';
        }
      } catch(error) {
        if(error?.code==='PROJECT_REPORT_NOT_READY')delivery='not-created';
      }
      trace.finish(projectDir,{runId:run.runId,status:run.status,code:run.snapshot.code,delivery,
        admittedAt:run.definition?.deadlineAt-run.definition?.limits?.timeoutMs,
        modelUsed:run.rootUsage.model,toolUsed:run.rootUsage.tool,modelLimit:definition.config.limits.model,toolLimit:definition.config.limits.tool});
    }).catch(()=>{});
    working.set(key,p);
    p.finally(() => { if (working.get(key)===p) working.delete(key); });
    return p;
  }
  async function sweepDailyEmail(){
    if((!digestProfile&&!deliveryHook)||hostSignal.signal.aborted)return;
    for(const previous of daily.pendingEmail()){
      // Rechecks and durable provider-attempt identity belong to the email
      // outbox. Running this projection again cannot restart research.
      if(hostSignal.signal.aborted)return;
      try{
        const delivery=await inspectScheduledEmailDelivery({directory:join(projectDir,'scheduled-email'),occurrenceId:previous.watchId+':'+previous.date});
        if(['accepted','unknown','not-dispatched'].includes(delivery.status)){daily.emailSettlement(previous,delivery.status);continue;}
        if(digestProfile){daily.emailSettlement(previous,'not-dispatched');continue;}
        if(!daily.emailConfirmed(previous.watchId,previous.date,emailVersion,{fullWatchEmail:!!fullWatch})){daily.emailSettlement(previous,'not-dispatched');continue;}
        const result=await deliveryHook({projectDir,...previous,signal:hostSignal.signal});
        if(result?.status==='not-started')continue;
        daily.emailSettlement(previous,result?.status==='not-configured'?'not-dispatched':result?.status??'unknown');
      }catch(error){
        if(error.code==='EMAIL_REPORT_NOT_VERIFIED')daily.emailSettlement(previous,'unavailable');
        if(error.code==='EMAIL_OCCURRENCE_BINDING_CHANGED')daily.emailSettlement(previous,'unknown');
        // Other storage failures retain the same pending outbox identity.
      }
    }
  }
  async function sweepDigest(){
    if(!digestProfile||digestFlight||hostSignal.signal.aborted)return;
    const work=(async()=>{
      for(const previous of daily.digest.pending()){
        // A killed sender might have durable acceptance in the outbox.
        // Settle the owner view if known, never replay a claimed day.
        try{
          const recovered=await digestProfile.inspect?.({projectDir,ownerId:demo.projectId,date:previous.date});
          if(['accepted','unknown','not-dispatched','unavailable'].includes(recovered?.status))daily.digest.settle(previous.date,recovered.status);
        }catch{ /* Hold ambiguous original identity. */ }
      }
      await sweepDailyEmail(); // Observe old per-watch receipts; never send them in digest mode.
      if(hostSignal.signal.aborted)return;
      const slot=daily.digest.claim(digestVersion,dailyConfigVersion,dailyAutorun);
      if(!slot)return;
      try{
        const result=await digestProfile.deliver({projectDir,ownerId:demo.projectId,...slot,signal:hostSignal.signal,
          confirmed:()=>!hostSignal.signal.aborted&&daily.digest.confirmed(slot.date,digestVersion)});
        daily.digest.settle(slot.date,['accepted','not-dispatched','unknown','unavailable','empty'].includes(result?.status)?result.status:result?.status==='not-configured'?'not-dispatched':'unknown');
      }catch(error){
        if(error.code==='DIGEST_ROWS_INVALID')daily.digest.settle(slot.date,'unavailable');
        // In absence of positive settlement, no new dispatch.
      }
    })();
    digestFlight=work;
    try{await work;}finally{if(digestFlight===work)digestFlight=null;}
  }
  async function sweepDaily(){
    if(!dailyAutorun||dailyFlight||hostSignal.signal.aborted)return;
    const work=(async()=>{
      for(const previous of daily.pending()){
        let runId=previous.runId;
        try{
          if(!runId){
            // Crash after original Conversation admission but before our index
            // recorded its ID: recover observation only, never restart work.
            const turn=await inspectConversationMessage({projectDir,conversationId:previous.conversationId,messageId:previous.messageId});
            if(['completed','failed','cancelled'].includes(turn.status))daily.settlement(previous,turn.status,turn.runId);
            else daily.settlement(previous,'submitted',turn.runId);
            continue;
          }
          const {run}=await inspectResearchTask({projectDir,runId});
          if(['completed','failed','cancelled'].includes(run.status))daily.settlement(previous,run.status,run.runId);
        }catch{ /* Missing or unreadable original evidence remains held/unknown. */ }
      }
      await sweepDailyEmail();
      if(used()||hostSignal.signal.aborted||!isDeepStrictEqual((await inspectResearchProject({projectDir})).config,expectedConfig)||used()||hostSignal.signal.aborted)return;
      const occurrence=daily.claim(dailyConfigVersion,{perWatchEmail:!digestProfile,fullWatchEmail:!!fullWatch,emailVersion});
      if(!occurrence)return;
      const {conversationId,messageId,question}=occurrence;
      const dailyKey=workKey(conversationId,messageId);
      reserve(dailyKey);
      let runId, runWork;
      try{
        await createConversation({projectDir,conversationId});
        let baseline=null;
        for(const candidate of daily.baselineCandidates(occurrence)){
          try{
            const previous=await readDailyConversationBaseline({projectDir,conversationId:candidate.conversationId,messageId:candidate.messageId,
              watchId:occurrence.watchId,date:candidate.date,revision:occurrence.revision,text:question,configSha256:dailyConfigVersion});
            if(previous.runId!==candidate.runId)continue;
            const {text:_historicalText,...ref}=previous;
            baseline=ref;break;
          }catch{
            // Missing or unreadable historical evidence is not authority.
            // Skip it; still answer today's question using current evidence.
          }
        }
        daily.freezeBaseline(occurrence,baseline);
        const turn=await submitConversationMessage({projectDir,conversationId,messageId,text:question,sourceManifestSha256:null,
          dailyResearch:{watchId:occurrence.watchId,date:occurrence.date,revision:occurrence.revision,baseline},
          dailyBrief:dailyBriefSkill&&(!labeledDailyBriefOnly||dailyBriefLabel(question))?{skill:dailyBriefSkill,asOf:new Date((dailyClock??Date.now)()).toISOString()}:undefined,
          authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
        runId=turn.runId;
        daily.settlement(occurrence,'submitted',runId);
        if(turn.status==='active'&&!hostSignal.signal.aborted)runWork=begin(conversationId,messageId,null);
      }catch{daily.settlement(occurrence,'unknown',runId);return;}finally{submitting.delete(dailyKey);}
      await runWork;
      const {run}=await inspectResearchTask({projectDir,runId});
      if(!['completed','failed','cancelled'].includes(run.status)){daily.settlement(occurrence,'unknown',runId);return;}
      daily.settlement(occurrence,run.status,runId);
      await sweepDailyEmail();
    })();
    dailyFlight=work;
    try{await work;}finally{if(dailyFlight===work)dailyFlight=null;}
  }
  async function handle(req, res) {
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
          schemaVersion: 'local-gui@1', mode, reasoningEffort,
          ...(live?.geminiFreeKey?{geminiFreePublicFallback:true}:{}),
          ...(freeform?{toolCatalog:ownerToolCatalog({connectivity,chartAvailable,chartAuto:chartAuto||agentChart,dailyBrief:Boolean(dailyBriefSkill)})}:{}),
          ...(live?{liveNotice:{...(ownerAdmission?{maxConcurrentRuns:workerCapacity}:{}),maxModelCallsPerRun:expectedConfig.limits.model,...(freeform?{freeform:true,connectivity:{web:connectivity.web===true,...(connectivity.linkedPdf===true?{linkedPdf:true}:{}),search:!!connectivity.search,...(connectivity.search?{searchProvider:connectivity.search}:{}),...(connectivity.searchAlternates?{searchAlternates:connectivity.searchAlternates}:{}),wind:connectivity.wind===true}}:{})}}:{}),
          capabilities: ['conversations','progress','reports','sources','read-web-sources',...(freeform?['pdf-attachment','daily-watch','deep-research','research-intent']:[]),...(chartAvailable?['financial-chart-skill']:[]),...(chartAuto||agentChart?['financial-chart-auto']:[])],
          projectId: demo.projectId, conversations: await listConversationCatalog({projectDir,titles:true}), sources: publicSources,
        });
        if(req.url==='/api/daily-watch'&&daily)return send(200,{timeZone:DAILY_TIME_ZONE,autorun:dailyAutorun,
          emailAvailable:!digestProfile&&!!deliveryHook,...(!digestProfile&&emailConsentToken?{emailConsentToken}:{}),...(!digestProfile&&emailPreview?{emailPreview}:{}),...(fullWatch?{emailContentMode:'full-report'}:{}),
          digest:{available:!!digestProfile,...daily.digest.describe(digestVersion),...(digestProfile?{consentToken:digestConsentToken,recipientPreview:digestProfile.recipientPreview,contentMode:digestProfile.contentMode??'links-only'}: {})},
          items:daily.list({emailVersion,configVersion:dailyConfigVersion,digestVersion})});
        const progressMatch=progressPath.exec(req.url);
        if(progressMatch){
          const [,conversationId,messageId]=progressMatch;
          const conversation=await inspectConversation({projectDir,conversationId});
          const turn=conversation.messages.find(entry=>entry.messageId===messageId);
          if(!turn)reject(404,'NOT_FOUND');
          const run=turn.status==='admission-pending'?null:(await inspectResearchTask({projectDir,runId:turn.runId})).run;
          const timeline=await readGuiResearchProgress(projectDir,run);
          const input=await readConversationInput({projectDir,conversationId,messageId});
          const researchIntent=observedResearchRoute(input,run);
          let deepProgress=readDeepResearchProgress(run?.definition?.config?.researchProfile,run?.snapshot);
          if(deepProgress?.phase==='delivery-unverified'){
            try{const view=await readConversationMessage({projectDir,conversationId,messageId});
              if(readableDelivery(projectedOutput(view.output)))deepProgress=readDeepResearchProgress(run.definition.config.researchProfile,run.snapshot,{deliveryReadback:true});
            }catch{/* A terminal Run by itself does not prove readable delivery. */}
          }
          return send(200,{...timeline,...(researchIntent&&researchIntent!=='direct'?{researchIntent}:{}),...(deepProgress?{deepProgress}:{})});
        }
        const bodyMatch=bodyPath.exec(req.url);
        if(bodyMatch){
          const [,conversationId,messageId]=bodyMatch;
          let result;
          try{result=await readConversationBody({projectDir,conversationId,messageId});}
          catch(error){
            if(['ENOENT','UNKNOWN_RUN','CONVERSATION_PROJECT_MISMATCH'].includes(error.code))return send(404,{error:'NOT_FOUND'});
            return send(503,{error:'BODY_READ_UNAVAILABLE'});
          }
          if(!result.body)return send(409,{error:'BODY_NOT_PUBLISHED',status:result.status});
          return send(200,result);
        }
        const sourcesMatch=sourcesPath.exec(req.url);
        if(sourcesMatch){
          const [,conversationId,messageId]=sourcesMatch;
          let result;
          try{result=await readConversationSources({projectDir,conversationId,messageId});}
          catch(error){
            if(['ENOENT','UNKNOWN_RUN','CONVERSATION_PROJECT_MISMATCH'].includes(error.code))return send(404,{error:'NOT_FOUND'});
            return send(503,{error:'SOURCES_READ_UNAVAILABLE'});
          }
          if(!result.published)return send(409,{error:'BODY_NOT_PUBLISHED',status:result.status});
          return send(200,result.view);
        }
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
      if(req.url==='/api/daily-digest'&&daily){
        const input=await inputFor(req);
        if(input?.enabled===true&&(!digestProfile||input.consentToken!==digestConsentToken))reject(409,'GUI_DIGEST_RECONFIRM');
        if(input&&Object.hasOwn(input,'consentToken'))delete input.consentToken;
        return send(200,daily.digest.save(input,digestVersion));
      }
      const dailyMatch=dailyPath.exec(req.url);
      if(dailyMatch&&daily){
        const input=await inputFor(req);
        if(input?.digestEnabled===true&&(!digestProfile||input.digestConsentToken!==digestConsentToken))reject(409,'GUI_DIGEST_RECONFIRM');
        if(input&&Object.hasOwn(input,'digestConsentToken'))delete input.digestConsentToken;
        if(input?.emailEnabled===true&&(digestProfile||!deliveryHook))reject(400,'GUI_DAILY_EMAIL_NOT_CONFIGURED');
        if(input?.emailEnabled===true&&input?.emailConsentToken!==emailConsentToken)reject(409,'GUI_DAILY_EMAIL_RECONFIRM');
        if(input&&Object.hasOwn(input,'emailConsentToken'))delete input.emailConsentToken;
        return send(dailyMatch[1]?200:201,daily.save(input,dailyMatch[1],{emailVersion,configVersion:dailyConfigVersion,digestVersion,fullWatchEmail:!!fullWatch}));
      }
      if (req.url === '/api/conversations') {
        if (!exact(await inputFor(req), [])) reject(400,'INVALID_CONVERSATION');
        if ((await listConversationCatalog({projectDir})).length >= MAX_CONVERSATION_CATALOG_ENTRIES) reject(409,'GUI_HISTORY_LIMIT');
        // IDs are minted on the server and monotonically group creation times for the list.
        const conversationId = 'c' + Date.now() + '-' + randomUUID().replaceAll('-','').slice(0,24);
        await createConversation({ projectDir, conversationId });
        return send(201, { id: conversationId });
      }
      const pdfMatch=pdfPath.exec(req.url);
      if(pdfMatch) {
        if(!freeform)reject(404,'NOT_FOUND');
        if(req.headers['content-type']!=='application/pdf'||req.headers['content-encoding']!==undefined)reject(415,'GUI_PDF_CONTENT_TYPE');
        if(Number(req.headers['content-length'])>PROJECT_SOURCE_LIMITS.originalBytes)reject(413,'INPUT_TOO_LARGE');
        if(uploading)reject(409,'GUI_PDF_UPLOAD_BUSY');
        uploading=true;
        try {
          const [,conversationId]=pdfMatch;
          await inspectConversation({projectDir,conversationId});
          let name;try{name=decodeURIComponent(req.headers['x-pdf-name']??'');}catch{reject(400,'GUI_PDF_NAME_INVALID');}
          const directory=await ensureSafeDirectory(pdfDirectory(conversationId));
          const bytes=await readBody(req,PROJECT_SOURCE_LIMITS.originalBytes);
          const source=await importUploadedPdf({projectDir,bytes,name,signal:hostSignal.signal});
          try{await publishImmutable(directory,source.id+'.json',Buffer.from(JSON.stringify(source)),hostSignal.signal);}
          catch(e){if(e.code!=='EEXIST'||!isDeepStrictEqual(await pdfAttachment(conversationId,source.id),source))throw e;}
          return send(201,source);
        }finally{uploading=false;}
      }
      const match = actionPath.exec(req.url);
      if (!match) reject(404,'NOT_FOUND');
      const [,conversationId,messageId,action] = match;
      if (!action) {
        const input = await inputFor(req);
        if (needsConsent && input?.approveLive!==true) reject(400,'GUI_LIVE_APPROVAL_REQUIRED');
        if (!exact(input, freeform?['messageId','question',...(Object.hasOwn(input??{},'approveGeminiPublic')?['approveGeminiPublic']:[]),...(Object.hasOwn(input??{},'attachmentId')?['attachmentId']:Object.hasOwn(input??{},'chartSkill')?['chartSkill']:[]),...(Object.hasOwn(input??{},'researchDepth')?['researchDepth']:[]),...(Object.hasOwn(input??{},'reasoningEffort')?['reasoningEffort']:[]),...(Object.hasOwn(input??{},'skillId')?['skillId']:[])]:needsConsent?['messageId','question','sourceId','approveLive']:['messageId','question','sourceId']) || typeof input.messageId !== 'string'
          || !idPattern.test(input.messageId) || typeof input.question !== 'string' || !input.question.trim()
          || (Object.hasOwn(input,'researchDepth')&&!['auto','standard','deep'].includes(input.researchDepth)) || Buffer.byteLength(input.question)>12000 || !freeform&&!sourceFor(input.sourceId)) reject(400,'INVALID_MESSAGE');
        if (Object.hasOwn(input,'reasoningEffort')&&!reasoningEffort.options.includes(input.reasoningEffort))reject(400,'GUI_REASONING_EFFORT_UNSUPPORTED');
        if (Object.hasOwn(input,'chartSkill')&&(!chartAvailable||input.chartSkill!==OWNER_CHART_SKILL))reject(400,'GUI_CHART_SKILL_UNAVAILABLE');
        if (Object.hasOwn(input,'skillId')&&(!freeform||!isResearchSkillChoice(input.skillId)))reject(400,'GUI_RESEARCH_SKILL_UNAVAILABLE');
        if(Object.hasOwn(input,'approveGeminiPublic')&&(!live?.geminiFreeKey||input.approveGeminiPublic!==true||
          input.attachmentId!==undefined||input.chartSkill!==undefined||input.skillId!==undefined))reject(400,'GUI_GEMINI_PUBLIC_SCOPE');
        const inputKey=workKey(conversationId,input.messageId);
        reserve(inputKey);
        try {
          if (!isDeepStrictEqual((await inspectResearchProject({projectDir})).config,expectedConfig)) reject(409,wrongProject);
          // A live replay acknowledges the same accepted intent. It does not restart work.
          let retry=false,priorInput;
          if (live) {
            try { priorInput=await readConversationInput({projectDir,conversationId,messageId:input.messageId}); retry=true; }
            catch (error) { if (error.code!=='ENOENT') throw error; }
          }
          const attachment=freeform&&Object.hasOwn(input,'attachmentId')?await pdfAttachment(conversationId,input.attachmentId):null;
          if(freeform&&Object.hasOwn(input,'attachmentId')&&!attachment) reject(400,'GUI_PDF_ATTACHMENT_UNKNOWN');
          const sourceId=freeform?(attachment?.id??null):input.sourceId;
          // Auto follows the launch policy only at initial admission. An exact
          // old replay cannot retroactively acquire the changed auto policy.
          const supplied=!attachment&&freeform&&hasSuppliedChartData(input.question);
          const explicit=input.chartSkill===OWNER_CHART_SKILL;
          const priorExplicit=agentChartChoice(priorInput?.chartSkill)?explicit:[OWNER_CHART_SKILL,INPUT_CHART_SKILL].includes(priorInput?.chartSkill);
          const chartSkill=input.approveGeminiPublic?undefined:retry&&explicit===priorExplicit?priorInput?.chartSkill:
           supplied?(explicit?INPUT_CHART_SKILL:INPUT_CHART_AUTO):
           freeform&&!attachment&&agentChart?(chartCompute?(env.ETF_GUI_PDF_CHART_CHAIN==='1'&&connectivity.linkedPdf===true?CHART_PDF_COMPUTE_CANONICAL:CHART_COMPUTE_DATE_MODE):AGENT_CHART_SKILL):
           explicit?(connectivity.wind?OWNER_CHART_SKILL:undefined):
           freeform&&!attachment&&input.researchDepth!=='standard'&&chartAuto?OWNER_CHART_AUTO:undefined;
          const m = await submitConversationMessage({ projectDir, conversationId, messageId: input.messageId,
            text: input.question, sourceManifestSha256: sourceId, skillId:input.skillId,approveGeminiPublic:input.approveGeminiPublic,
            ownerLinkedPdfRevision:retry?priorInput?.ownerLinkedPdfRevision:live&&freeform&&!attachment&&!input.approveGeminiPublic&&connectivity.linkedPdf===true?(linkedChartComputeMode(chartSkill)?OWNER_LINKED_PDF_INDEXED_CELLS:agentChartChoice(chartSkill)?OWNER_LINKED_PDF_LOCAL_MISS:OWNER_LINKED_PDF_REVISION):undefined,...(chartSkill?{chartSkill}:{}),...(input.researchDepth===undefined?{}:{researchDepth:input.researchDepth}),...(input.reasoningEffort===undefined?{}:{reasoningEffort:input.reasoningEffort}),
            ...(live?{authorization:{providerApproved:true,dataApproved:true,costApproved:true,...(goHealth&&!attachment?{openAIApproved:true}:{})}}:{}) });
          if (m.status === 'active' && !retry) begin(conversationId,input.messageId,sourceId);
          return send(202,{ id:m.messageId,runId:m.runId,status:m.status });
        } finally { submitting.delete(inputKey); }
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
      if (found.status !== 'active') reject(409,'RUN_NOT_ACTIVE');
      const retryKey=workKey(conversationId,messageId);
      reserve(retryKey);
      try {
      const { definition } = await inspectResearchTask({ projectDir,runId:found.runId });
      if (!isDeepStrictEqual(definition.config,expectedConfig)) reject(409,wrongProject);
      if (freeform&&definition.sourceManifestSha256!==null&&!(await pdfAttachment(conversationId,definition.sourceManifestSha256))) reject(409,'GUI_LIVE_LEGACY_RETRY_DISABLED');
      begin(conversationId,messageId,definition.sourceManifestSha256);
      return send(202, { id: messageId });
      } finally { submitting.delete(retryKey); }
    } catch (e) {
      const code = e.code==='CONVERSATION_CATALOG_LIMIT'?'GUI_HISTORY_LIMIT':e.status ? e.message : typeof e.code === 'string' && /^[A-Z0-9_]+$/.test(e.code) ? e.code : 'GUI_REQUEST_FAILED';
      const status = e.status ?? (code==='ENOENT'||code==='UNKNOWN_RUN'?404:(code==='GUI_HISTORY_LIMIT'||code.includes('ID_CONFLICT'))?409:code==='CONVERSATION_GEMINI_PUBLIC_SCOPE'?400:code==='PDF_LIMIT_BYTES'||code==='PDF_LIMIT_PAGES'||code==='PDF_LIMIT_TEXT'?413:code==='PROJECT_SOURCE_INVALID_INPUT'||code==='PDF_ENCRYPTED'||code==='PDF_PARSE_FAILED'||code==='PDF_INVALID_FORMAT'||code==='PDF_NO_TEXT_LAYER'||code==='PDF_TIMEOUT'?422:500);
      if (!res.headersSent && !res.destroyed) send(status,{ error:code });
    }
  }
  if(ownerAdmission){await sweepAdmission();admissionLoop=setInterval(sweepAdmission,5000);admissionLoop.unref?.();}
  if(telemetry?.sweep){
    // Initialize the telemetry horizon before this workspace can admit new runs.
    await telemetry.sweep(projectDir).catch(()=>{});
    telemetryLoop=setInterval(()=>{void telemetry.sweep(projectDir).catch(()=>{});},3600000);
    telemetryLoop.unref();
  }
  if(dailyAutorun||digestProfile){dailyLoop=setInterval(()=>{void sweepDaily().catch(()=>{});void sweepDigest().catch(()=>{});},15_000);dailyLoop.unref();}
  let closing;
  return {handle,setOrigin,mode,sweepDaily,sweepDigest,async close(){
    if(!closing){
      clearInterval(dailyLoop);clearInterval(telemetryLoop);clearInterval(admissionLoop);hostSignal.abort();
      closing=Promise.allSettled([...working.values(),dailyFlight,digestFlight,admissionFlight]).then(()=>daily?.close());
    }
    await closing;
  }};
}
export async function startLocalGui(options = {}) {
  const {port = 0} = options;
  if (!Number.isInteger(port) || port < 0 || port > 65535) reject(400, 'INVALID_GUI_PORT');
  const workspace=await createLocalGuiWorkspace({...options,origin:undefined});
  const server=createServer({maxHeaderSize:8192},workspace.handle);
  server.requestTimeout=10000;
  server.headersTimeout=8000;
  try{
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve();});
    });
  }catch(e){await workspace.close();throw e;}
  const origin='http://127.0.0.1:'+server.address().port;
  workspace.setOrigin(origin);
  let closing;
  return {origin,mode:workspace.mode,sweepDaily:workspace.sweepDaily,sweepDigest:workspace.sweepDigest,async close(){
    closing??=Promise.all([
      new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())),
      workspace.close(),
    ]);
    await closing;
  }};
}
