import {isDeepStrictEqual} from 'node:util';
import {createSkillCatalog} from './skills.mjs';

const schemaVersion='skill-preflight@1';
const token=value=>typeof value==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(value);
const boundedText=value=>typeof value==='string'&&value.trim().length>0&&value.length<=1000;
const list=(value,valid)=>Array.isArray(value)&&value.length<=32&&new Set(value).size===value.length&&value.every(valid);
const caseKeys=['expectedBodyIncludes','expectedSuggestedTools','hostTools','input','resources','schemaVersion','skillId'];
const invalid=message=>{throw new Error(message);};

// This optional authoring convention is advisory; the catalog exposes only
// name and description. General mentions in comments/prose are not a schema.
function suggestedTools(text){
  const names=new Set();
  let inSection=false, fence=null;
  for(const line of text.split(/\r?\n/)){
    const boundary=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if(boundary){
      if(!fence)fence=boundary[1];
      else if(boundary[1][0]===fence[0]&&boundary[1].length>=fence.length&&!boundary[2].trim())fence=null;
      continue;
    }
    if(fence)continue;
    if(/^#{1,2}\s/.test(line))inSection=line.trim()==='## Suggested tools';
    if(!inSection)continue;
    const item=/^[-*] `([a-z][a-z0-9_-]{0,63})`\s*$/.exec(line);
    if(item)names.add(item[1]);
  }
  return [...names];
}

export async function preflightSkill({root,skillId,fixture}){
  if(fixture!==undefined){
    if(!fixture||typeof fixture!=='object'||!isDeepStrictEqual(Object.keys(fixture).sort(),caseKeys)||
      fixture.schemaVersion!=='skill-preflight-case@1'||!token(fixture.skillId)||!boundedText(fixture.input)||
      !list(fixture.expectedSuggestedTools,token)||!list(fixture.hostTools,token)||
      !list(fixture.expectedBodyIncludes,boundedText)||!list(fixture.resources,boundedText))invalid('Invalid synthetic case shape');
    skillId=fixture.skillId;
  }
  const catalog=await createSkillCatalog({root});
  const skills=catalog.list();
  const selection={mode:'on-demand',automaticInjection:false,requires:['host selects this catalog','host calls read_skill with the directory ID']};
  if(skillId===undefined)return {schemaVersion,skills,selection};
  const method=await catalog.read(skillId);
  const suggestions=suggestedTools(method.text);
  const tools={declared:[],suggested:suggestions,authority:'host'};
  const preview={schemaVersion,selection,method,tools};
  if(!fixture)return preview;
  if(!isDeepStrictEqual(suggestions,fixture.expectedSuggestedTools))invalid('Synthetic case suggested-tools assertion failed');
  if(!fixture.expectedBodyIncludes.every(fragment=>method.text.includes(fragment)))invalid('Synthetic case body assertion failed');
  const resources=[];
  for(const path of fixture.resources){
    try{
      const resource=await catalog.resource(skillId,path);
      resources.push({path,sha256:resource.sha256});
    }catch{invalid('Synthetic case resource unavailable');}
  }
  return {schemaVersion,selection,skillId,input:fixture.input,passed:true,methodSha256:method.sha256,resources,
    tools:{...tools,missingInSampleHost:suggestions.filter(name=>!fixture.hostTools.includes(name))}};
}
