import {webFailure} from './web-policy.mjs';
export const WEB_TEXT_PAGE_BYTES=131072;
export const WEB_TEXT_MAX_PAGES=16;
const profiles=Object.freeze({'text/plain':['utf8-text@1','utf8-text-json-pages@2','utf8-text-json-pages@3'],'text/html':['static-html-parse5@8.1.0','static-html-parse5@8.1.0-json-pages@2','static-html-parse5@8.1.0-json-pages@3']});
export function webTextProfile(mediaType){return profiles[mediaType]?.[2];}
export function validWebTextProfile(profile,mediaType){return profiles[mediaType]?.includes(profile)===true;}
export function webTextPageLimit(profile){for(const family of Object.values(profiles)){const index=family.indexOf(profile);if(index!==-1)return [64000,65536,131072][index];}return 0;}
export function webTextPageSizes(text){const once=JSON.stringify(text);return [Buffer.byteLength(text),Buffer.byteLength(once)-2,Buffer.byteLength(JSON.stringify(once))-6];}
export function validWebTextPage(text,profile){
 if(typeof text!=='string'||!text)return false;
 const limit=webTextPageLimit(profile);if(!limit)return false;
 if(limit===64000)return Buffer.byteLength(text)<=64000;
 return text.isWellFormed()&&webTextPageSizes(text).every(n=>n<=limit);
}
export function paginateWebText(text){
 if(typeof text!=='string'||!text||!text.isWellFormed())throw webFailure('WEB_TEXT_INVALID');
 const pages=[];let current=[],sizes=[0,0,0];
 const finish=()=>{if(pages.length>=WEB_TEXT_MAX_PAGES)throw webFailure('WEB_PAGE_LIMIT');pages.push(current.join(''));current=[];sizes=[0,0,0];};
 for(const character of text){const cost=webTextPageSizes(character);if(sizes.some((n,i)=>n+cost[i]>WEB_TEXT_PAGE_BYTES))finish();current.push(character);sizes=sizes.map((n,i)=>n+cost[i]);}
 if(current.length)finish();return pages;
}
