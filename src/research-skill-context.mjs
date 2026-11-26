// Apply only the explicitly selected, bundled method. Ordinary depth and
// permission decisions continue to come from their original owners.
export function selectedResearchSkillContext(method){
 if(!method)return '';
 return '\n\nUser-selected research Skill: '+method.id+'. Apply it when relevant without changing research depth or tool permissions.\n'+method.text;
}
