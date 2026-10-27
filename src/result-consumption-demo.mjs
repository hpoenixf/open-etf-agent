import {readFile} from 'node:fs/promises';
import {sha256} from './source.mjs';

// One fixed original synthetic fixture through the existing Source/Result Host
// extension seam. No arbitrary path, input importer or second execution loop.
export function prepareResultConsumption() {
  const extensions=[{
    name:'read_comparison', description:'Acquire the fixed original synthetic same-snapshot table; no external data.',
    parameters:{type:'object',properties:{},additionalProperties:false},sourceResult:true,
    validate(args){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw new Error('No arguments accepted');},
    async execute(){
      const text=await readFile(new URL('../fixtures/comparison-table.json',import.meta.url),'utf8');
      return {sourceId:'synthetic-comparison@1:p1',documentId:'synthetic-comparison',name:'Synthetic same-snapshot comparison',version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
    }
  }];
  let step=0;
  const gateway={mode:'fixture',async next({messages}){
    step++;
    const results=messages.filter(m=>m.role==='tool').map(m=>m.result);
    if(results.some(r=>r.status!=='succeeded'))throw new Error('Fixture observed failed tool');
    const values=results.map(r=>r.value);
    const call=(name,args)=>({kind:'calls',calls:[{id:'comparison-'+step,name,arguments:args}]});
    if(step===1)return call('read_comparison',{});
    const source=values.find(v=>v?.sourceId);
    if(step===2)return call('calculate_change',{resultRef:source.resultRef,selection:{offset:0,limit:3},baselineRow:0,currentRow:2});
    const calculation=values.find(v=>v?.calculation);
    if(step===3){if(!calculation?.binding)throw new Error('Fixture comparison unavailable');return call('create_csv',{calculationRef:calculation.resultRef});}
    const csv=values.find(v=>v?.format==='csv'&&v?.artifactId);
    if(step===4){if(!csv)throw new Error('Fixture CSV unavailable');return call('save_report',{
      text:'# Selected original input to delivery\n\nScripted synthetic fixture, not live model or financial-quality evidence. The Host numeric section and CSV use the same stored calculation; the selected stored rows do not establish complete upstream holdings. [1] [C1]',
      sourceIds:[source.sourceId],attachmentIds:[csv.artifactId]
    });}
    return {kind:'final',text:'Original synthetic report and bound CSV saved with actual receipts; semantic quality unreviewed.'};
  }};
  return {gateway,extensions,allowedTools:['read_comparison','calculate_change','create_csv','save_report']};
}
