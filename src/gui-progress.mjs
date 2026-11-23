import { dirname, resolve } from 'node:path';
import { readTimeline } from './observe.mjs';
import {isReasoningEffort} from './gateway.mjs';
export async function readGuiReasoningEffort(projectDir,run,requested){
  if(!isReasoningEffort(requested))return undefined;
  const result={requested,serialized:null,providerAdoption:'unconfirmed'};
  if(typeof run?.directory!=='string'||dirname(resolve(run.directory))!==resolve(projectDir,'outputs')||run.definition?.config?.reasoningEffort!==requested)return result;
  try {
    const {entries}=await readTimeline(run.directory);
    if(entries.some(e=>e.type==='model_proposal'&&e.runId===run.runId&&e.rootId===run.rootId&&Number.isSafeInteger(e.sequence)&&e.reasoningEffort===requested))result.serialized=requested;
  }catch{/* No readable evidence is not proof of serialization. */}
  return result;
}

const TOOLS = Object.freeze({
  public_web_search:'公开网页搜索', public_web_search_deepseek:'DeepSeek 网页搜索',
  public_web_search_yuanbao:'腾讯元宝网页搜索', public_web_read:'读取公开网页',
  wind_fund_daily_close:'查询 Wind 基金日收盘价', read_page:'读取所选资料',
  read_pdf_page:'读取 PDF 文字', read_pdf_cell:'核对 PDF 表格',
  save_report:'保存报告', read_result:'读取已保存资料',
});
const TERMINAL = Object.freeze({completed:'回答已完成',failed:'本轮未完成',cancelled:'本轮已取消'});
const UNAVAILABLE = Object.freeze({schemaVersion:'gui-research-progress@1',status:'unavailable',steps:[]});

export async function readGuiResearchProgress(projectDir, run) {
  if (!run?.directory) return {...UNAVAILABLE,status:'pending'};
  // The caller selects the Run through the conversation journal, never by a
  // path or Run ID supplied by the browser. Reject a relocated or unsafe path.
  if (typeof run.directory !== 'string' || dirname(resolve(run.directory)) !== resolve(projectDir,'outputs')) return UNAVAILABLE;

  let entries;
  try { ({ entries } = await readTimeline(run.directory)); }
  catch (error) {
    // During active writes the file may not exist yet or contain a partial
    // final record. The next poll retries the read, never the underlying Run.
    return error.code==='ENOENT'&&run.status==='active' ? {...UNAVAILABLE,status:'pending'} : UNAVAILABLE;
  }
  const steps=[];
  const add=(code,label)=>steps.push({code,label});
  let found=false,started=false;
  for (const event of entries) {
    if (event.runId!==run.runId||event.rootId!==run.rootId||!Number.isSafeInteger(event.sequence)) continue;
    // The native log can repeat a sequence on recovery; source order remains
    // authoritative, so a sequence is never exposed or used as an identity.
    found=true;
    if(event.type==='run_started'||event.type==='run_resumed'){
      // The first durable Worker attaches to a pre-admitted Run, so its
      // initial open can be logged as resumed even without an interruption.
      add(started?'resumed':'started',started?'继续原任务':'开始处理问题');
      started=true;
    }
    if(event.type==='tool_proposal'&&Object.hasOwn(TOOLS,event.name)) add('tool_prepare','准备'+TOOLS[event.name]);
    if(event.type==='tool_result'&&Object.hasOwn(TOOLS,event.name)){
      const tool=TOOLS[event.name];
      // “Returned” is intentionally neutral: the Runtime may carry a typed
      // provider refusal in a successfully returned tool result.
      if(['succeeded','reused'].includes(event.status))add('tool_returned',tool+'已返回');
      if(['failed','rejected','cancelled','unknown'].includes(event.status))add('tool_unavailable',tool+'未完成');
    }
    if(event.type==='model_proposal'&&event.kind==='final')add('synthesis','已生成正文，正在确认交付');
    if(event.type==='worker_interrupted')add('interrupted','处理曾中断');
  }
  // run_finished is pre-settlement, not authoritative. Only the Session's
  // own terminal state is used here. Do not string-project any native fields.
  if(found&&Object.hasOwn(TERMINAL,run.status))add(run.status,TERMINAL[run.status]);
  const shown=steps.slice(-80);
  return {schemaVersion:'gui-research-progress@1',status:'available',steps:shown,omitted:steps.length-shown.length};
}
