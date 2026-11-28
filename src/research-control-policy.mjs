const evidence=Object.freeze({kind:'evidence',debit:true});
const metered=Object.freeze({kind:'metered',debit:true});
const local=Object.freeze({kind:'bounded-local',debit:false});
const delivery=Object.freeze({kind:'delivery',debit:false});
const toolPolicies=new Map([
 ...['search_pages','read_page','mcp_read_page','read_pdf_page','read_pdf_cell',
  'public_web_search','public_web_search_deepseek','public_web_search_yuanbao','public_web_search_yuanbao_mcp',
  'public_web_read','public_web_continue','public_web_linked_pdf_page','wind_fund_daily_close','knowledge_query',
  'memory_search','memory_read'].map(name=>[name,evidence]),
 ...['compute_chart_formula','calculate_change','update_research_needs','select_research_intent',
  'request_deep_research','read_research_skill'].map(name=>[name,local]),
 ...['render_financial_chart','save_report'].map(name=>[name,delivery]),
 ...['read_result','read_note','read_skill','read_skill_resource','list_skills','ask_response','create_csv'].map(name=>[name,metered]),
]);
export const researchToolPolicy=name=>toolPolicies.get(name)??metered;
export function omitsToolDebit(active,proposed,effective=proposed){
 return active===true&&proposed===effective&&!researchToolPolicy(proposed).debit;
}
export function evidenceUsage(messages){
 const calls=new Map(),counted=new Set(),groups=new Set();
 for(const frame of messages){
  if(frame.role==='assistant'&&Array.isArray(frame.calls))for(const call of frame.calls){
   calls.set(call.id,{name:call.name,group:frame});
  }
  if(frame.role!=='tool')continue;
  const entry=calls.get(frame.callId),result=frame.result;
  if(!entry||counted.has(frame.callId)||result?.callId!==frame.callId||result.dispatched!==true||
    researchToolPolicy(result.effective?.name??entry.name).kind!=='evidence')continue;
  counted.add(frame.callId);groups.add(entry.group);
 }
 return {calls:counted.size,rounds:groups.size};
}
export const MILESTONES=Object.freeze([20,50,80]);
const guidance={
 20:'Check which evidence gaps matter to the question.',
 50:'Start synthesizing verified evidence. Prioritize material gaps.',
 80:'Stop broadening the search. Check only a gap that could change the conclusion, then write and deliver from existing evidence.',
};
export function evidenceMilestone(messages,{maxRounds,maxTools}){
 if(!Number.isSafeInteger(maxRounds)||maxRounds<1||!Number.isSafeInteger(maxTools)||maxTools<1)return 0;
 const {calls,rounds}=evidenceUsage(messages);
 return MILESTONES.filter(level=>calls*100>=level*maxTools||rounds*100>=level*maxRounds).at(-1)??0;
}
export const evidenceAdvisory=level=>MILESTONES.includes(level)?'Evidence acquisition advisory: '+level+'% of the acquisition allowance used. '+guidance[level]+' This is not task progress and does not grant more budget.':null;

export const RESEARCH_CONTROL='research-control@1';
export function complexFiling(text){
 if(typeof text!=='string')return false;
 const ownerRequest=text.slice(0,2000);
 return /财报|财务报告|年报|季报|financial (?:report|statements?)|earnings (?:report|release)|annual report|quarterly results|10-[qk]/iu.test(ownerRequest)&&
  /解读|分析|多图|尽可能多|复算|比较|多季度|多期|analysis|deep dive|multiple charts|as many charts|recalculat|compare .*quarters/iu.test(ownerRequest);
}

// Once a filing has readable original evidence, a long search phase must
// leave time for chart composition as well as the final answer. Short task
// budgets still reserve only their existing final turn.
export function closeFilingAcquisition({ filing, originalsRead, acquisitionCalls, slots, modelLimit }) {
 return filing===true&&originalsRead>0&&(acquisitionCalls>=10||(modelLimit>4&&slots<=4));
}
