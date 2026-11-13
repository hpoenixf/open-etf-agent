// Offline presentation generator. Never infers verification from source existence.
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const begin='<!-- module-map:start -->',end='<!-- module-map:end -->';
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function validate(m,version){
 if(m.schemaVersion!==1||m.reviewedVersion!==version)throw Error('Module map needs scope review for package version '+version);
 if(!/^[a-f0-9]{40}$/.test(m.reviewedSource)||!/^https:\/\/github.com\/hpoenixf\/eff-agent-article\/blob\/[a-f0-9]{40}\//.test(m.articleSource))throw Error('Fixed public source required');
 if(m.layers?.map(x=>x.id).join(',')!=='L1,L2,L3,L4,L5,L6')throw Error('Exactly six unique ordered layers required');
 for(const l of m.layers){
  for(const key of ['title','summary','boundary','guide'])for(const lang of ['en','zh'])if(typeof l[key]?.[lang]!=='string'||!l[key][lang]||/[\r\n]/.test(l[key][lang]))throw Error('Missing bilingual '+key);
  if(l.summary.en.length>67||l.summary.zh.length>35||l.boundary.en.length>120||l.boundary.zh.length>35)throw Error('Map text exceeds readable layout; shorten summary or boundary');
  if(typeof l.modules!=='string'||!l.modules||l.modules.length>57||!Array.isArray(l.sources)||!l.sources.length)throw Error('Missing module sources');
 }
 for(const p of [m.evidence,...m.layers.flatMap(l=>[...l.sources,...Object.values(l.guide)])])if(!/^(src|docs)\/[\w./-]+$/.test(p)||p.includes('..'))throw Error('Unsafe repository path');
}
const wrap=(s,n)=>{let lines=[''];for(const word of s.split(' ')){const i=lines.length-1;if(lines[i].length+word.length>n)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}return lines;};
export function svg(m,lang){
 const zh=lang==='zh',colors=['#2868a9','#257d78','#6b58a2','#246f88','#a76625','#506779'];
 let out=`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="1040" viewBox="0 0 660 1040" role="img" aria-labelledby="title desc"><title id="title">${zh?'Open ETF Agent 六层模块现状':'Open ETF Agent six-layer module map'}</title><desc id="desc">${xml(m.layers.map(l=>l.id+' '+l.title[lang]+': '+l.modules+'. '+l.boundary[lang]).join('; '))}</desc><rect width="660" height="1040" rx="20" fill="#f5f8fc"/><path d="M20 0h620q20 0 20 20v95H0V20Q0 0 20 0" fill="#10243e"/><g font-family="system-ui, sans-serif"><text x="24" y="39" fill="white" font-size="24" font-weight="700">Open ETF Agent · v${xml(m.reviewedVersion)}</text><text x="24" y="73" fill="#c5d9ed" font-size="18">${zh?'六层职责地图 · 公开实现，不等于全面验收':'Six responsibilities · implementation ≠ qualification'}</text>`;
 m.layers.forEach((l,i)=>{const y=128+i*142;out+=`<rect x="16" y="${y}" width="628" height="132" rx="12" fill="white" stroke="#d7e1ed"/><rect x="16" y="${y}" width="7" height="132" rx="3" fill="${colors[i]}"/><text x="34" y="${y+29}" fill="${colors[i]}" font-size="21" font-weight="700">${l.id} · ${xml(l.title[lang])}</text>`;wrap(l.modules,57).forEach((line,j)=>out+=`<text x="34" y="${y+56+j*23}" fill="#142d48" font-size="18">${xml(line)}</text>`); out+=`<text x="34" y="${y+80}" fill="#274b64" font-size="16">${xml(l.summary[lang])}</text>`; const lines=zh?[l.boundary.zh]:wrap(l.boundary.en,63);lines.forEach((line,j)=>out+=`<text x="34" y="${y+101+j*21}" fill="#52657b" font-size="16">${xml(line)}</text>`);});
 return out+`<text x="24" y="1014" fill="#52657b" font-size="16">${zh?'职责可跨层；不是每次任务必经的六个服务。':'Responsibilities overlap; not six mandatory sequential services.'}</text></g></svg>\n`;
}
export function flowSvg(lang){
 const zh=lang==='zh';const rows=zh?[['01 输入','问题 + 合成资料'],['02 研究','Runtime ⇄ 工具 / 原始来源'],['03 交付','报告 + 引用 + 原字节回读']]:[['01 INPUT','Question + synthetic sources'],['02 RESEARCH','Runtime ⇄ tools / originals'],['03 DELIVERY','Report + citations + byte readback']];
 return `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="280" viewBox="0 0 660 280" role="img" aria-labelledby="title desc"><title id="title">${zh?'从输入到可回读报告':'From input to a readable report'}</title><desc id="desc">${rows.flat().join(' → ')}</desc><rect width="660" height="280" rx="18" fill="#10243e"/><g font-family="system-ui,sans-serif">${rows.map((r,i)=>`<text x="24" y="${42+i*72}" fill="#79d7c1" font-size="19" font-weight="700">${r[0]}</text><text x="175" y="${42+i*72}" fill="white" font-size="20">${r[1]}</text>${i<2?`<path d="M42 ${54+i*72}v28m-5-5 5 5 5-5" fill="none" stroke="#819ab5" stroke-width="2"/>`:''}`).join('')}<text x="24" y="253" fill="#c5d9ed" font-size="16">${zh?'模型提议，代码核权执行；默认示例无需模型密钥。':'The model proposes; code checks authority. Default demo: no model key.'}</text></g></svg>\n`;
}
export function block(m,lang){const zh=lang==='zh',suffix=zh?'.zh-CN':'';
 return `${begin}\n<a id="module-map"></a>\n## ${zh?'现在有哪些模块，做到哪了？':'What is here, and how far does it go?'}\n\n[![${zh?'六层地图：输入、身份上下文、决策运行、工具、交付、界面；每层列出公开模块与限制':'Six layers: inputs, identity/context, execution, tools, delivery and interfaces, with public modules and limits'}](docs/assets/module-map${suffix}.svg)](docs/module-status${suffix}.md)\n\n**${zh?'当前地图':'Current map'}: v${m.reviewedVersion}** · [${zh?'模块、源码与证据':'Modules, source & evidence'}](docs/module-status${suffix}.md) · [${zh?'六层文章原文':'Six-layer article (Chinese original)'}](${m.articleSource})\n\n${zh?'图中是公开实现范围，不是全功能完成率。真实模型验证只覆盖[各版记录](docs/verification/README.md)中的指定路径；金融语义、生产与浏览器体验不因此获得认证。':'This maps public implementation, not completion percentages. Live-model evidence qualifies only the paths in [version records](docs/verification/README.md), not financial accuracy, production or browser experience.'}\n${end}`;
}
export async function sync({check=false,root=ROOT}={}){
 const safe=async p=>{let current=root;for(const part of p.split('/')){current=resolve(current,part);try{if((await lstat(current)).isSymbolicLink())throw Error('Refuse symlink: '+p);}catch(e){if(e.code==='ENOENT')break;throw e;}}};
 const read=async p=>{await safe(p);return readFile(resolve(root,p),'utf8');}; const m=JSON.parse(await read('docs/module-status.json'));validate(m,JSON.parse(await read('package.json')).version);
 for(const p of new Set([m.evidence,...m.layers.flatMap(l=>[...l.sources,...Object.values(l.guide)])]))await read(p);
 const outputs=new Map();
 for(const lang of ['en','zh']){const zh=lang==='zh',suffix=zh?'.zh-CN':'',name=`README${suffix}.md`;let text=await read(name);if(text.split(begin).length!==2||text.split(end).length!==2||text.indexOf(end)<text.indexOf(begin))throw Error('Missing or repeated generation markers: '+name);text=text.slice(0,text.indexOf(begin))+block(m,lang)+text.slice(text.indexOf(end)+end.length);outputs.set(name,text);outputs.set(`docs/assets/module-map${suffix}.svg`,svg(m,lang));outputs.set(`docs/assets/report-path${suffix}.svg`,flowSvg(lang));
 let doc=`# ${zh?'六层模块状态':'Six-layer module status'}\n\n[${zh?'English':'简体中文'}](module-status${zh?'':'.zh-CN'}.md) · [README](../${name}#module-map)\n\n${zh?'审阅版本':'Reviewed version'}: **v${m.reviewedVersion}**. [${zh?'固定代码基线':'Fixed code baseline'}](https://github.com/hpoenixf/open-etf-agent/tree/${m.reviewedSource}) · [${zh?'本版验证范围与限制':'Version evidence and limits'}](${m.evidence.replace('docs/','')}).\n\n${zh?'实现、离线检查、真实任务、发布和部署是不同事实。下表不是逐模块验收通过清单；模块可参与多层。':'Implementation, offline checks, live workflows, release and deployment are different facts. This is not a per-module qualification checklist; modules can span layers.'}\n\n`;
 for(const l of m.layers)doc+=`## ${l.id} · ${l.title[lang]}\n\n**${l.modules}**\n\n${l.summary[lang]}. ${l.boundary[lang]}.\n\n[${zh?'使用与边界':'Usage and limits'}](${l.guide[lang].replace('docs/','')}) · ${l.sources.map(p=>`[${p.split('/').pop()}](../${p})`).join(' · ')}\n\n`;
 doc+=`[${zh?'全部历史版本':'All historical versions'}](module-guide${suffix}.md#versions) · [${zh?'独立文章覆盖资格':'Independent article coverage qualification'}](articles-and-code${suffix}.md)\n\n${zh?'维护：只修改 module-status.json，执行 npm run docs:sync。新版本先核范围与证据再更新 reviewedVersion，不能只改版本号。':'Maintenance: edit module-status.json, then run npm run docs:sync. Review scope and evidence before updating reviewedVersion; never merely relabel an old snapshot.'}\n`;outputs.set(`docs/module-status${suffix}.md`,doc);
 }
 for(const [p,text] of outputs){if(check){if(await read(p)!==text)throw Error('Stale generated documentation: '+p+'; run npm run docs:sync');}else{await safe(p);await mkdir(dirname(resolve(root,p)),{recursive:true});await writeFile(resolve(root,p),text);}}
 return [...outputs.keys()];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))sync({check:process.argv.includes('--check')}).then(paths=>console.log(JSON.stringify({mode:process.argv.includes('--check')?'check':'sync',files:paths}))).catch(e=>{console.error(e.message);process.exitCode=1;});
