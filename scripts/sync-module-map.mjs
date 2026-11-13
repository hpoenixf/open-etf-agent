// Offline presentation generator. Never infers verification from source existence.
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const begin='<!-- module-map:start -->',end='<!-- module-map:end -->';
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function validate(m,version){
 if(m.schemaVersion!==2||m.reviewedVersion!==version)throw Error('Module map needs scope review for package version '+version);
 if(!/^[a-f0-9]{40}$/.test(m.reviewedSource)||!/^https:\/\/github.com\/hpoenixf\/eff-agent-article\/blob\/[a-f0-9]{40}\//.test(m.articleSource))throw Error('Fixed public source required');
 if(m.layers?.map(x=>x.id).join(',')!=='L1,L2,L3,L4,L5,L6')throw Error('Exactly six unique ordered layers required');
 for(const l of m.layers){
  for(const key of ['title','guide'])for(const lang of ['en','zh'])if(typeof l[key]?.[lang]!=='string'||!l[key][lang]||/[\r\n]/.test(l[key][lang]))throw Error('Missing bilingual '+key);

 }
 const groups=new Set(m.groups?.map(g=>g.id)),ids=new Set();
 if(groups.size!==7||m.groups.length!==7||!m.cards?.length)throw Error('Seven unique groups and module cards required');
 for(const c of m.cards){if(ids.has(c.id)||!groups.has(c.group)||!m.layers.some(l=>l.id===c.layer)||!['bounded','enhanced'].includes(c.status)||!['module','call-site'].includes(c.kind)||!c.name||c.name.length>23)throw Error('Invalid module identity, owner or status');ids.add(c.id);for(const lang of ['en','zh'])if(!c.summary?.[lang]||!c.boundary?.[lang]||c.summary[lang].length>37||c.boundary[lang].length>39)throw Error('Module card text exceeds layout');}
 for(const p of [m.evidence,...m.cards.map(c=>c.source),...m.layers.flatMap(l=>Object.values(l.guide))])if(!/^(src|docs)\/[\w./-]+$/.test(p)||p.includes('..'))throw Error('Unsafe repository path');
}
const wrap=(s,n)=>{let lines=[''];for(const word of s.split(' ')){const i=lines.length-1;if(lines[i].length+word.length>n)lines.push(word);else lines[i]+=(lines[i]?' ':'')+word;}return lines;};
export function svg(m,lang){
 const zh=lang==='zh',W=2240,left=230,cw=276,gap=8,cardH=78,step=88;
 const colors=['#3976b6','#258b80','#7958b3','#7958b3','#a9792c','#25869a','#b05280'];
 const counts=m.layers.map(l=>Math.max(1,...m.groups.map(g=>m.cards.filter(c=>c.layer===l.id&&c.group===g.id).length)));
 const heights=counts.map(n=>n*step+20),H=230+heights.reduce((a,b)=>a+b,0)+100;
 const text=(x,y,s,size=18,fill='#17324d',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${xml(s)}</text>`;
 let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc"><title id="title">${zh?'Open ETF Agent 六层模块职责矩阵':'Open ETF Agent six-layer module responsibility matrix'}</title><desc id="desc">${xml(m.cards.map(c=>`${c.layer} ${c.name}: ${c.summary[lang]}; ${c.boundary[lang]}`).join('. '))}</desc><rect width="${W}" height="${H}" rx="20" fill="#f5f8fc"/><path d="M20 0h2200q20 0 20 20v86H0V20Q0 0 20 0" fill="#10243e"/><g font-family="system-ui, sans-serif">`;
 out+=text(32,43,`Open ETF Agent · v${m.reviewedVersion} | ${zh?'六层职责 × 模块现状':'Six responsibilities × module status'}`,30,'#fff',700);
 out+=text(32,80,zh?'逐模块定位：任务身份、持续执行、Main / Child、工具边界、原始证据与交付回读。':'Module-level ownership: task identity, durable execution, Main / Child, tool boundaries, original evidence and delivery readback.',20,'#c5d9ed');
 out+=text(32,138,zh?`浅色实线 = 有界公开实现　紫色填充 + 版本标记 = 本版增强　空白 = 未映射职责；不等于缺陷或完成率。`:`Light = bounded public implementation   Purple fill + version badge = this release’s enhancement   Empty = no mapped role, not a completion score.`,18,'#315778',600);
 m.groups.forEach((g,i)=>{const x=left+i*(cw+gap);out+=`<rect x="${x}" y="158" width="${cw}" height="57" rx="7" fill="#edf3fa" stroke="#b8cbe0" stroke-dasharray="4 3"/><rect x="${x}" y="158" width="${cw}" height="4" fill="${colors[i]}"/>`+text(x+12,194,g.title[lang],22,'#17324d',700);});
 let y=226;
 m.layers.forEach((l,li)=>{const height=heights[li];out+=`<rect x="16" y="${y}" width="2208" height="${height-8}" rx="10" fill="${li%2?'#eaf0f8':'#ffffff'}"/><rect x="26" y="${y+8}" width="190" height="${height-24}" rx="8" fill="#e3edf9"/>`+text(40,y+38,l.id,27,'#2868a9',700);
 wrap(l.title[lang],18).forEach((s,j)=>out+=text(40,y+69+j*25,s,18,'#17324d',700));
 m.groups.forEach((g,gi)=>{const x=left+gi*(cw+gap),cards=m.cards.filter(c=>c.layer===l.id&&c.group===g.id);cards.forEach((c,k)=>{const cy=y+10+k*step,hot=c.status==='enhanced',color=hot?'#7958b3':colors[gi];out+=`<a href="https://github.com/hpoenixf/open-etf-agent/blob/${m.reviewedSource}/${c.source}" target="_blank"><title>${xml(c.name+': '+c.summary[lang]+'; '+c.boundary[lang])}</title><rect x="${x+6}" y="${cy}" width="${cw-12}" height="${cardH}" rx="7" fill="${hot?'#eee8fa':'#f8fbff'}" stroke="${hot?color:'#b9cadb'}" stroke-width="${hot?2:1.2}" ${c.kind==='call-site'?'stroke-dasharray="5 3"':''}/><rect x="${x+6}" y="${cy}" width="5" height="${cardH}" rx="3" fill="${hot?color:'#9db3c8'}"/>`+text(x+17,cy+24,c.name,19,color,700)+text(x+17,cy+47,c.summary[lang],14.5,'#284963',500)+text(x+17,cy+67,c.boundary[lang],13,'#5c6f85');if(hot)out+=text(x+cw-60,cy+23,`v${m.reviewedVersion.replace(/\.0$/,'')}`,12,color,700);out+='</a>';});});y+=height;});
 out+=text(32,y+24,zh?'范围：虚线卡是同一 Owner 的调用位置，不另算模块；空白不代表未实现。固定源码可点开，验证结论另读证据。':'Scope: dashed cards are owner call-sites, not extra modules. Empty cells are not missing features. Fixed-source links are separate from qualification.',18,'#35516e',600);
 out+=text(32,y+54,zh?'未交付承诺：完整产品 Web UI / 浏览器交互验收、常驻周期调度、隔离 Python、PDF OCR、实时金融数据或生产认证。':'Not claimed: full product Web UI / browser qualification, resident recurring scheduling, isolated Python, PDF OCR, live financial data or production certification.',17,'#5c6f85');
 return out+'</g></svg>\n';
}
export function flowSvg(lang){
 const zh=lang==='zh';const rows=zh?[['01 输入','问题 + 合成资料'],['02 研究','Runtime ⇄ 工具 / 原始来源'],['03 交付','报告 + 引用 + 原字节回读']]:[['01 INPUT','Question + synthetic sources'],['02 RESEARCH','Runtime ⇄ tools / originals'],['03 DELIVERY','Report + citations + byte readback']];
 return `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="280" viewBox="0 0 660 280" role="img" aria-labelledby="title desc"><title id="title">${zh?'从输入到可回读报告':'From input to a readable report'}</title><desc id="desc">${rows.flat().join(' → ')}</desc><rect width="660" height="280" rx="18" fill="#10243e"/><g font-family="system-ui,sans-serif">${rows.map((r,i)=>`<text x="24" y="${42+i*72}" fill="#79d7c1" font-size="19" font-weight="700">${r[0]}</text><text x="175" y="${42+i*72}" fill="white" font-size="20">${r[1]}</text>${i<2?`<path d="M42 ${54+i*72}v28m-5-5 5 5 5-5" fill="none" stroke="#819ab5" stroke-width="2"/>`:''}`).join('')}<text x="24" y="253" fill="#c5d9ed" font-size="16">${zh?'模型提议，代码核权执行；默认示例无需模型密钥。':'The model proposes; code checks authority. Default demo: no model key.'}</text></g></svg>\n`;
}
export function block(m,lang){const zh=lang==='zh',suffix=zh?'.zh-CN':'';
 return `${begin}\n<a id="module-map"></a>\n## ${zh?'现在有哪些模块，做到哪了？':'What is here, and how far does it go?'}\n\n[![${zh?'六层地图：输入、身份上下文、决策运行、工具、交付、界面；每层列出公开模块与限制':'Six layers: inputs, identity/context, execution, tools, delivery and interfaces, with public modules and limits'}](docs/assets/module-map${suffix}.svg)](docs/assets/module-map${suffix}.svg)\n\n[${zh?'打开原尺寸模块矩阵（可放大）':'Open full-size module matrix (zoomable)'}](docs/assets/module-map${suffix}.svg) · [${zh?'逐模块文字与源码索引':'Per-module text and source index'}](docs/module-status${suffix}.md)\n\n**${zh?'当前地图':'Current map'}: v${m.reviewedVersion}** · [${zh?'模块、源码与证据':'Modules, source & evidence'}](docs/module-status${suffix}.md) · [${zh?'六层文章原文':'Six-layer article (Chinese original)'}](${m.articleSource})\n\n${zh?'图中是公开实现范围，不是全功能完成率。真实模型验证只覆盖[各版记录](docs/verification/README.md)中的指定路径；金融语义、生产与浏览器体验不因此获得认证。':'This maps public implementation, not completion percentages. Live-model evidence qualifies only the paths in [version records](docs/verification/README.md), not financial accuracy, production or browser experience.'}\n${end}`;
}
export async function sync({check=false,root=ROOT}={}){
 const safe=async p=>{let current=root;for(const part of p.split('/')){current=resolve(current,part);try{if((await lstat(current)).isSymbolicLink())throw Error('Refuse symlink: '+p);}catch(e){if(e.code==='ENOENT')break;throw e;}}};
 const read=async p=>{await safe(p);return readFile(resolve(root,p),'utf8');}; const m=JSON.parse(await read('docs/module-status.json'));validate(m,JSON.parse(await read('package.json')).version);
 for(const p of new Set([m.evidence,...m.cards.map(c=>c.source),...m.layers.flatMap(l=>Object.values(l.guide))]))await read(p);
 const outputs=new Map();
 for(const lang of ['en','zh']){const zh=lang==='zh',suffix=zh?'.zh-CN':'',name=`README${suffix}.md`;let text=await read(name);if(text.split(begin).length!==2||text.split(end).length!==2||text.indexOf(end)<text.indexOf(begin))throw Error('Missing or repeated generation markers: '+name);text=text.slice(0,text.indexOf(begin))+block(m,lang)+text.slice(text.indexOf(end)+end.length);outputs.set(name,text);outputs.set(`docs/assets/module-map${suffix}.svg`,svg(m,lang));outputs.set(`docs/assets/report-path${suffix}.svg`,flowSvg(lang));
 let doc=`# ${zh?'六层模块状态':'Six-layer module status'}\n\n[${zh?'English':'简体中文'}](module-status${zh?'':'.zh-CN'}.md) · [README](../${name}#module-map)\n\n${zh?'审阅版本':'Reviewed version'}: **v${m.reviewedVersion}**. [${zh?'固定代码基线':'Fixed code baseline'}](https://github.com/hpoenixf/open-etf-agent/tree/${m.reviewedSource}) · [${zh?'本版验证范围与限制':'Version evidence and limits'}](${m.evidence.replace('docs/','')}).\n\n${zh?'实现、离线检查、真实任务、发布和部署是不同事实。下表不是逐模块验收通过清单；模块可参与多层。':'Implementation, offline checks, live workflows, release and deployment are different facts. This is not a per-module qualification checklist; modules can span layers.'}\n\n`;
 for(const l of m.layers){doc+=`## ${l.id} · ${l.title[lang]}\n\n`;for(const c of m.cards.filter(c=>c.layer===l.id))doc+=`### ${c.name} · ${c.status==='enhanced'?(zh?`v${m.reviewedVersion} 增强`:`v${m.reviewedVersion} enhanced`):(zh?'有界公开实现':'Bounded public implementation')}\n\n${c.summary[lang]}. **${c.boundary[lang]}**. ${c.kind==='call-site'?(zh?'这是既有 Owner 的调用位置，不另算独立模块。':'This is an existing owner’s call-site, not another independent module.'):''} [${zh?'固定源码':'Fixed source'}](https://github.com/hpoenixf/open-etf-agent/blob/${m.reviewedSource}/${c.source}) · [${zh?'范围导读':'Scope guide'}](${l.guide[lang].replace('docs/','')})\n\n`;}
 doc+=`[${zh?'全部历史版本':'All historical versions'}](module-guide${suffix}.md#versions) · [${zh?'独立文章覆盖资格':'Independent article coverage qualification'}](articles-and-code${suffix}.md)\n\n${zh?'维护：只修改 module-status.json，执行 npm run docs:sync。新版本先核范围与证据再更新 reviewedVersion，不能只改版本号。':'Maintenance: edit module-status.json, then run npm run docs:sync. Review scope and evidence before updating reviewedVersion; never merely relabel an old snapshot.'}\n`;outputs.set(`docs/module-status${suffix}.md`,doc);
 }
 for(const [p,text] of outputs){if(check){if(await read(p)!==text)throw Error('Stale generated documentation: '+p+'; run npm run docs:sync');}else{await safe(p);await mkdir(dirname(resolve(root,p)),{recursive:true});await writeFile(resolve(root,p),text);}}
 return [...outputs.keys()];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))sync({check:process.argv.includes('--check')}).then(paths=>console.log(JSON.stringify({mode:process.argv.includes('--check')?'check':'sync',files:paths}))).catch(e=>{console.error(e.message);process.exitCode=1;});
