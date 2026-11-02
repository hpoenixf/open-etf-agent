import {readFile} from 'node:fs/promises';
import {sha256} from './source.mjs';
import {join} from 'node:path';
import {run} from './runtime.mjs';
import {openArtifactStore} from './artifacts.mjs';

const buckets=['dividend','overseas','bond','gold','ai','cash'];
const labels=['红利基金','海外基金','债券基金','黄金基金','AI主题基金','现金'];
const scope='Offline scripted synthetic fixture; fixed illustrative targets, not investment advice. No live model, market data, orders, fees, slippage, taxes or lot-size enforcement.';

// Presentation consumes actual Host results. It neither calculates replacement
// tool operands nor acquires authority for the original numeric records.
function presentation(calculations) {
  const total=calculations.reduce((sum,c)=>sum+c.inputs.baseline,0);
  const targetTotal=calculations.reduce((sum,c)=>sum+c.inputs.current,0);
  const sell=calculations.slice(0,5).reduce((sum,c)=>sum+Math.max(0,-c.difference),0);
  const buy=calculations.slice(0,5).reduce((sum,c)=>sum+Math.max(0,c.difference),0);
  const cash=calculations[5];
  if(total!==targetTotal||cash.inputs.baseline+sell-buy!==cash.inputs.current)throw new Error('Fixture cash conservation failed');
  const header=['bucket','classification','current_CNY','fixed_target_CNY','current_weight_pct','fixed_target_weight_pct','current_minus_target_pp','target_minus_current_CNY','calculationRef','sourceRef','source_sha256'];
  const rows=calculations.map((c,i)=>[
    buckets[i],i===5?'cash-reserve-change':c.difference<0?'illustrative-sell':c.difference>0?'illustrative-buy':'hold',
    c.inputs.baseline,c.inputs.current,c.inputs.baseline/total*100,c.inputs.current/total*100,-c.difference/total*100,c.difference,
    c.resultRef,c.binding.sourceRef,c.binding.contentHash
  ].map(String));
  const table=['| 基金类别 | 当前金额 CNY | 固定目标 CNY | 当前/目标权重 % | 超配/低配 pp | 示意变动 CNY |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',...calculations.map((c,i)=>`| ${labels[i]} | ${c.inputs.baseline} | ${c.inputs.current} | ${rows[i][4]} / ${rows[i][5]} | ${rows[i][6]} | ${c.difference} [C${i+1}] |`)];
  return {rows:[header,...rows],text:[
    '# 合成基金组合再平衡演示',scope,
    '## 输入与固定目标',
    '原始公开合成 JSON 包含每类的当前金额和人为固定目标金额；这些目标不是模型推荐，也不是由市场数据优化。所有金额属于同一合成快照。[1]',
    `组合总额：${total} CNY；目标总额：${targetTotal} CNY。`,
    '## 实际工具结果',table.join('\n'),
    '正数表示目标增加，负数表示目标减少。偏差是当前权重减固定目标权重，单位为百分点（pp），不是相对涨跌幅。',
    '## 现金守恒',
    `非现金类别示意卖出合计 ${sell} CNY；示意买入合计 ${buy} CNY。期初现金 ${cash.inputs.baseline} + 卖出 ${sell} - 买入 ${buy} = 留存现金 ${cash.inputs.current} CNY。现金行是储备变更，不是市场买单。`,
    '## 交付与边界',
    '同一 Run 的六份原生绑定 CSV 由 create_csv(calculationRef) 导出。另有一份汇总 CSV，仅为实际结果的派生展示，不冒充新的 Host 数值绑定；每行保留计算与来源引用。原报告 Owner 附加全部数字来源。',
    '这是离线脚本驱动的 Runtime 工程示例，不是已验证的投资方案。未评估适当性、市场风险、费用、税费、滑点、交易时段、最小交易单位或真实可成交性；没有提交交易。Artifact/Revision 回执不代表外部 Publication 已投递。'
  ].join('\n\n')};
}

export function preparePortfolioRebalance() {
  const extensions=[{
    name:'read_portfolio_fixture',description:'Read the single fixed public synthetic fund portfolio snapshot; no real holdings or external data.',
    parameters:{type:'object',properties:{},additionalProperties:false},sourceResult:true,
    validate(args){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw new Error('No arguments accepted');},
    async execute(){
      const text=await readFile(new URL('../fixtures/portfolio-rebalance.json',import.meta.url),'utf8');
      return {sourceId:'synthetic-fund-portfolio@1:p1',documentId:'synthetic-fund-portfolio',name:'Synthetic fund portfolio: current and fixed illustrative target',version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
    }
  }];
  let step=0;
  const gateway={mode:'fixture',async next({messages}){
    const results=messages.filter(m=>m.role==='tool').map(m=>m.result);
    if(results.some(r=>r.status!=='succeeded'||r.value?.available===false))throw new Error('Portfolio fixture tool unavailable');
    const values=results.map(r=>r.value);
    const call=(name,args,suffix='')=>({id:`portfolio-${step}-${suffix}`,name,arguments:args});
    step++;
    if(step===1)return {kind:'calls',calls:[call('read_portfolio_fixture',{})]};
    const source=values.find(v=>v?.sourceId==='synthetic-fund-portfolio@1:p1');
    if(!source?.resultRef)throw new Error('Portfolio original unavailable');
    if(step===2)return {kind:'calls',calls:buckets.map((_,i)=>call('calculate_change',{resultRef:source.resultRef,selection:{offset:0,limit:12},baselineRow:i*2,currentRow:i*2+1},String(i)))};
    const calculations=values.filter(v=>v?.calculation==='calculate_change@1');
    if(calculations.length!==6||calculations.some((c,i)=>c.binding?.sourceRef!==source.resultRef||c.binding?.baseline.rowId!==buckets[i]+'-current'||c.binding?.current.rowId!==buckets[i]+'-target'))throw new Error('Portfolio bound calculations unavailable');
    const view=presentation(calculations);
    if(step===3)return {kind:'calls',calls:[...calculations.map((c,i)=>call('create_csv',{calculationRef:c.resultRef},String(i))),call('create_csv',{rows:view.rows},'summary')]};
    const csv=values.filter(v=>v?.format==='csv'&&v?.artifactId);
    if(csv.length!==7)throw new Error('Portfolio CSV artifacts unavailable');
    if(step===4)return {kind:'calls',calls:[call('save_report',{text:view.text,sourceIds:[source.sourceId],attachmentIds:csv.map(c=>c.artifactId)})]};
    return {kind:'final',text:'Offline synthetic fund rebalance report and seven CSV artifacts saved in this Run. Fixed illustrative targets; no investment advice or trades; semantic quality unreviewed.'};
  }};
  return {gateway,extensions,allowedTools:['read_portfolio_fixture','calculate_change','create_csv','save_report'],limits:{maxRounds:5,maxTools:16}};
}

export async function runPortfolioRebalance({outputRoot,signal}={}) {
  const result=await run({question:'Compare this synthetic fund portfolio with fixed illustrative targets, calculate changes from original rows, and save a report with CSV evidence. Do not recommend investments or place trades.',...preparePortfolioRebalance(),outputRoot,signal});
  if(result.status!=='completed')return {caseId:'portfolio-rebalance',mode:'fixture',...result};
  const store=await openArtifactStore({directory:result.directory,readOnly:true});
  const revision=await store.readRevision(result.receipt.revisionId);
  const summary=await store.read(revision.attachmentIds[6]);
  return {caseId:'portfolio-rebalance',mode:'fixture',...result,preview:{
    report:join(result.directory,'report.md'),summaryCsv:join(result.directory,summary.contentPath),
    summaryScope:'derived presentation; six original bound calculation CSVs are evidence attachments',
    evidence:join(result.directory,'manifest.json'),revisionId:revision.revisionId
  }};
}
