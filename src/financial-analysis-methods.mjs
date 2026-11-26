import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createSkillCatalog} from './skills.mjs';
export const FINANCIAL_ANALYSIS_METHOD_TOOL='read_research_skill';
export const FINANCIAL_METHODS_REVISION='financial-methods@1';
const ids=Object.freeze(['market-hotspot-analysis','long-horizon-analysis']);
export const isFinancialSkill=id=>ids.includes(id);
export async function openFinancialAnalysisMethods(){
 const catalog=await createSkillCatalog({root:fileURLToPath(new URL('./owner-skills/',import.meta.url)),maxBytes:3000});
 const methods=new Map(await Promise.all(ids.map(async id=>[id,Object.freeze(await catalog.read(id))])));
 const version=FINANCIAL_METHODS_REVISION;
 const contentSha256=createHash('sha256').update(ids.map(id=>methods.get(id).sha256).join(':')).digest('hex');
 function read(args){
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length!==1||!methods.has(args.skillId))
   throw new Error('Unknown financial analysis method');
  return methods.get(args.skillId);
 }
 return {version,contentSha256,read,extension:{
  name:FINANCIAL_ANALYSIS_METHOD_TOOL,recoveryVersion:version,methodResult:true,
  description:'Choose a bundled Skill by intent, only if useful: market-hotspot-analysis for an event or catalyst; long-horizon-analysis for durable thesis or risk. Skip if neither fits. This does not change research depth or access.',
  parameters:{type:'object',properties:{skillId:{type:'string',enum:[...ids]}},required:['skillId'],additionalProperties:false},
  validate:read,execute:async args=>read(args),reconcile:async args=>read(args),
  verifyResult:async(value,{call})=>{if(!isDeepStrictEqual(read(call.arguments),value))throw new Error('Financial analysis method receipt changed');},
 }};
}
