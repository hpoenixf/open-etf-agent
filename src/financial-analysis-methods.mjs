import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createSkillCatalog} from './skills.mjs';
export const FINANCIAL_ANALYSIS_METHOD_TOOL='read_financial_analysis_method';
const ids=Object.freeze(['market-hotspot-analysis','long-horizon-analysis']);
export async function openFinancialAnalysisMethods(){
 const catalog=await createSkillCatalog({root:fileURLToPath(new URL('./owner-skills/',import.meta.url)),maxBytes:3000});
 const methods=new Map(await Promise.all(ids.map(async id=>[id,Object.freeze(await catalog.read(id))])));
 const version='financial-methods@1';
 const contentSha256=createHash('sha256').update(ids.map(id=>methods.get(id).sha256).join(':')).digest('hex');
 function read(args){
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==1||!methods.has(args.skillId))
   throw new Error('Unknown financial analysis method');
  return methods.get(args.skillId);
 }
 return {version,contentSha256,extension:{
  name:FINANCIAL_ANALYSIS_METHOD_TOOL,recoveryVersion:version,methodResult:true,
  description:'Optionally read a bundled analysis method: market-hotspot-analysis for a new catalyst, or long-horizon-analysis when durable thesis or risk matters. Not mandatory; does not grant permissions.',
  parameters:{type:'object',properties:{skillId:{type:'string',enum:[...ids]}},required:['skillId'],additionalProperties:false},
  validate:read,execute:async args=>read(args),reconcile:async args=>read(args),
  verifyResult:async(value,{call})=>{if(!isDeepStrictEqual(read(call.arguments),value))throw new Error('Financial analysis method receipt changed');},
 }};
}
