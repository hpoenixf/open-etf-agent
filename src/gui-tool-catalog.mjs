import {OWNER_CHART_SKILL} from './financial-chart-owner.mjs';
import {isResearchSkillChoice} from './financial-analysis-methods.mjs';

const skillRows = [
 {id:'market-hotspot-analysis',label:'热点解读'},
 {id:'long-horizon-analysis',label:'长期视角分析'},
].filter(({id})=>isResearchSkillChoice(id));
const providers = {
 'exa-public-preview':'Exa 预览',
 'deepseek-search':'DeepSeek',
 'yuanbao-search':'腾讯元宝',
 'yuanbao-mcp':'腾讯元宝 MCP',
};

// Only user-facing, launch-authorized capabilities. This is not an execution
// registry: the Worker still admits tools for each Run and enforces its budget.
export function ownerToolCatalog({connectivity,chartAvailable,chartAuto,dailyBrief}) {
 const skills=[{id:'auto',label:chartAuto?'自动（按意图使用 Skill 或图表）':'自动（按意图使用 Skill）'},...skillRows,
  ...(chartAvailable?[{id:OWNER_CHART_SKILL,label:connectivity.wind?'金融图表（用户数据或获授权的场内日收盘价）':'金融图表（用户提供的数据）'}]:[])];
 const tools=[{label:'PDF 附件阅读',note:'上传 PDF 后可用；按文档能力提供页码和表格单元读取。'}];
 if(connectivity.web){
  tools.push({label:'公开网页阅读',note:'读取并回查公开 HTTPS 原文。'});
  if(connectivity.linkedPdf)tools.push({label:'公开 PDF 链接阅读',note:'先读取包含链接的原网页。'});
  for(const [i,id] of [connectivity.search,...(connectivity.searchAlternates??[])].entries()){
   if(!id||!Object.hasOwn(providers,id))continue;
   const paid=id!=='exa-public-preview';
   tools.push({label:'公开网页搜索 · '+providers[id],note:i?'补充搜索：仅在 Exa 成功且证据有缺口时可用，可能计费。':paid?'按需调用，可能计费。':'按需搜索公开网页。'});
  }
 }
 if(connectivity.wind)tools.push({label:'Wind 基金日收盘价',note:'按需使用已获授权的数据源。'});
 if(dailyBrief)tools.push({label:'每日跟踪简报',note:'仅由已配置的每日跟踪任务使用，不在聊天中手动选择。'});
 return {skills,tools};
}
