// Browser-only adapter. Provide only a host-accepted read-only projection;
// never parse a model's answer, raw SVG, URL, or CSS into a chart.
const NS='http://www.w3.org/2000/svg';
const COLORS=['#1565c0','#00796b','#9c3364','#8a4d00','#5237ad','#725244','#407651','#396071'];
const fmt=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:6});
const tickFmt=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2,useGrouping:false});
const compactTick=new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:2});
const scientificTick=new Intl.NumberFormat('zh-CN',{notation:'scientific',maximumFractionDigits:2});
const tick=v=>Math.abs(v)>=1e4?compactTick.format(v):v!==0&&Math.abs(v)<.01?scientificTick.format(v):tickFmt.format(v);
const keyTick=(key,max)=>/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(key)&&Number.isFinite(Number(key))
 ?tick(Number(key)):key.slice(0,max);
const number=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e9;
const safe=s=>typeof s==='string'&&s.length<=200&&!/[\p{C}]/u.test(s);
const candle=v=>v&&Object.keys(v).sort().join(',')==='close,high,low,open'&&[v.open,v.high,v.low,v.close].every(number)
 &&v.low>0&&v.low<=Math.min(v.open,v.close)&&v.high>=Math.max(v.open,v.close);
const timeCharts=['line','candlestick','multi-line','area'];
const newCharts=['heatmap','combo','multi-line','area'];
const seriesBounds=chart=>chart==='heatmap'?[2,12]:chart==='combo'?[2,2]:chart==='multi-line'?[2,4]:
 ['line','bar','stacked'].includes(chart)?[1,4]:[1,1];
function valid(view){
 const [min,max]=seriesBounds(view?.chart);
 if(view?.schemaVersion!=='financial-chart-view@1'||typeof view.integrity!=='string'||!/^[a-f0-9]{64}$/.test(view.integrity)
  ||!['line','bar','pie','candlestick','stacked',...newCharts].includes(view.chart)||![view.title,view.unit,view.basis].every(safe)
  ||!(safe(view.asOf)||view.asOf===null&&view.provenance==='user-supplied'&&['bar','stacked','pie'].includes(view.chart))||(view.periodStart!==null&&!safe(view.periodStart))
  ||!['synthetic','provider-reported','document-reported','user-supplied'].includes(view.provenance)
  ||!Array.isArray(view.keys)||view.keys.length<(newCharts.includes(view.chart)?2:1)||view.keys.length>(timeCharts.includes(view.chart)?180:view.chart==='heatmap'?12:24)||!view.keys.every(safe)
  ||!Array.isArray(view.series)||view.series.length<min||view.series.length>max)return false;
 if(timeCharts.includes(view.chart)&&!view.keys.every((x,i)=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&(i===0||x>view.keys[i-1])))return false;
 if(!view.series.every(s=>safe(s?.label)&&Array.isArray(s.values)&&s.values.length===view.keys.length&&
   s.values.every(v=>v===null||(view.chart==='candlestick'?candle(v):number(v)))))return false;
 if(newCharts.includes(view.chart)&&(view.provenance!=='user-supplied'||view.basis!=='user-supplied'||
  new Set(view.keys).size!==view.keys.length||new Set(view.series.map(s=>s.label)).size!==view.series.length||
  view.series.some(s=>!s.values.some(number))))return false;
 if(view.chart==='combo'&&(view.series[0].mark!=='bar'||view.series[1].mark!=='line'))return false;
 if(view.chart==='candlestick'&&view.provenance==='user-supplied'&&view.kind!=='financial-ohlc')return false;
 if(view.kind==='financial-ohlc'&&(view.chart!=='candlestick'||view.basis!=='user-supplied'||view.provenance!=='user-supplied'||
    !['CNY/share','USD/share','HKD/share'].includes(view.unit)||!view.series[0].values.some(candle)))return false;
 if(view.chart==='pie'){
  const c=view.coverage;
  return c?.total===100&&number(c.remainder)&&c.remainder>=0&&c.remainder<=100&&safe(c.remainderLabel)&&
    view.series[0].values.every(x=>x===null||x>=0)&&
    Math.abs(view.series[0].values.reduce((a,b)=>a+(b??0),0)+c.remainder-100)<1e-6;
 }
 return true;
}

export function createFinancialChartView(doc,view){
 if(!valid(view))throw new Error('Invalid approved chart projection');
 const html=(name,text)=>{const el=doc.createElement(name);if(text!==undefined)el.textContent=text;return el;};
 const svgEl=(name,attrs={},text)=>{
  const el=doc.createElementNS(NS,name);
  for(const [key,val] of Object.entries(attrs))el.setAttribute(key,String(val));
  if(text!==undefined)el.textContent=text;
  return el;
 };
 const figure=html('figure'), caption=html('figcaption',view.title+' · '+view.unit+(view.asOf===null?' · 未提供日期':' · 截至 '+view.asOf));
 figure.setAttribute('class','financial-chart-figure');
 figure.append(caption,html('p',view.provenance==='synthetic'?'合成样例，不是实时数据。':
  view.provenance==='user-supplied'?'用户提供的数据，未独立核验。':'按来源报告的数据，不代表独立验证或实时行情。'));
 const svg=svgEl('svg',{viewBox:'0 0 640 320',role:'group','aria-label':view.title});
 svg.append(svgEl('title',{},view.title),svgEl('desc',{},'下方表格列出原始数值、缺失项和口径。'));
 figure.append(svg);
 const marks=(name,attrs)=>{const node=svgEl(name,attrs);svg.append(node);return node;};
 const tooltip=html('div');
 tooltip.setAttribute('class','financial-chart-tooltip');
 tooltip.setAttribute('aria-hidden','true'); // Each focusable target carries the equivalent accessible label.
 tooltip.hidden=true;
 figure.append(tooltip);
 const targets=[];
 let hovered=null,focused=null,pinned=null,updateGuide=()=>{};
 const exact=value=>value===null?'缺失':String(value)+' '+view.unit;
 function update(){
  const active=hovered??focused??pinned;
  tooltip.hidden=active===null;
  updateGuide(active);
  if(active===null)return;
  tooltip.replaceChildren(html('strong',active.heading),...active.rows.map(row=>html('span',row)));
  if(!tooltip.style||!figure.getBoundingClientRect||!svg.getBoundingClientRect)return;
  const frame=figure.getBoundingClientRect(),plot=svg.getBoundingClientRect();
  if(!plot.width||!plot.height)return;
  const anchorX=plot.left-frame.left+active.x*plot.width/640;
  const anchorY=plot.top-frame.top+active.y*plot.height/320;
  const width=tooltip.offsetWidth,height=tooltip.offsetHeight;
  const x=Math.max(6,Math.min(frame.width-width-6,anchorX+10));
  const above=anchorY-height-10;
  // Place above the data when possible; stay within the figure on mobile.
  const y=above>=6?above:Math.max(6,Math.min(frame.height-height-6,anchorY+10));
  tooltip.style.left=x+'px';tooltip.style.top=y+'px';
 }
 function interactive(node,heading,rows,x,y){
  const entry={node,heading,rows,x,y};
  let directPointer=false;
  targets.push(entry);
  node.setAttribute('tabindex',targets.length===1||view.chart==='combo'?'0':'-1');
  node.setAttribute('aria-label',heading+'：'+rows.join('；'));
  node.addEventListener?.('pointerenter',e=>{if(e?.pointerType!=='touch'){hovered=entry;update();}});
  node.addEventListener?.('pointerleave',()=>{if(hovered===entry){hovered=null;update();}});
  node.addEventListener?.('pointercancel',()=>{if(hovered===entry)hovered=null;if(pinned===entry)pinned=null;update();});
  node.addEventListener?.('focus',()=>{focused=entry;update();});
  node.addEventListener?.('blur',()=>{if(focused===entry){focused=null;update();}});
  node.addEventListener?.('pointerdown',e=>{directPointer=e?.pointerType==='touch'||e?.pointerType==='pen';});
  node.addEventListener?.('click',e=>{
   if(!directPointer&&e?.pointerType!=='touch'&&e?.pointerType!=='pen')return;
   directPointer=false;hovered=focused=null;pinned=pinned===entry?null:entry;update();
  });
  node.addEventListener?.('keydown',e=>{
   if(e.key==='Escape'){hovered=focused=pinned=null;update();e.preventDefault();return;}
   if(e.key==='Enter'||e.key===' '){
    if(!tooltip.hidden){hovered=focused=pinned=null;}else focused=entry;
    update();e.preventDefault();return;
   }
   const at=targets.indexOf(entry),step=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:
    (e.key==='ArrowDown'||e.key==='ArrowUp')?(e.key==='ArrowDown'?1:-1)*(view.chart==='heatmap'?view.keys.length:1):0;
   const next=e.key==='Home'?targets[0]:e.key==='End'?targets.at(-1):step?targets[at+step]:null;
   if(next){
    if(view.chart!=='combo'){node.setAttribute('tabindex','-1');next.node.setAttribute('tabindex','0');}
    hovered=pinned=null;
    next.node.focus?.();e.preventDefault();
   }
  });
 }
 figure.addEventListener?.('click',e=>{if(!targets.some(t=>t.node===e.target)){pinned=null;update();}});
 const coordinate=(x,y)=>[x.toFixed(3),y.toFixed(3)].join(' ');
 if(view.chart==='pie'){
  let start=-Math.PI/2;
  const values=[...view.series[0].values,view.coverage.remainder], radius=120,cx=320,cy=160;
  values.forEach((value,i)=>{
   if(value===null||value<=0)return;
   const color=i===values.length-1?'#8a9099':COLORS[i%COLORS.length];
   const label=i===values.length-1?view.coverage.remainderLabel:view.keys[i];
   if(value>=100){interactive(marks('circle',{cx,cy,r:radius,fill:color}),label,[exact(value)],cx,cy);return;}
   const end=start+value*Math.PI/50;
   const at=angle=>coordinate(cx+radius*Math.cos(angle),cy+radius*Math.sin(angle));
   const mark=marks('path',{d:'M '+coordinate(cx,cy)+' L '+at(start)+' A '+radius+' '+radius+' 0 '+(value>50?1:0)+' 1 '+at(end)+' Z',fill:color});
   const midpoint=(start+end)/2;
   interactive(mark,label,[exact(value)],cx+radius*.65*Math.cos(midpoint),cy+radius*.65*Math.sin(midpoint));
   start=end;
  });
 }else if(view.chart==='heatmap'){
  const flat=view.series.flatMap(s=>s.values).filter(number);
  const lo=Math.min(...flat),hi=Math.max(...flat),extent=Math.max(Math.abs(lo),Math.abs(hi));
  const mix=(start,end,t)=>'rgb('+start.map((v,i)=>Math.round(v+(end[i]-v)*t)).join(' ')+')';
  const neutral=[241,245,249],blue=[21,101,192],red=[177,37,57],spread=hi>lo?hi-lo:0;
  const color=v=>v===null?'#dfe5ea':lo<0&&hi>0?mix(neutral,v<0?red:blue,Math.abs(v)/extent):
   mix(neutral,blue,spread?(v-lo)/spread:.65);
  const x0=132,y0=50,w=482/view.keys.length,h=212/view.series.length;
  view.keys.forEach((key,j)=>svg.append(svgEl('text',{x:x0+(j+.5)*w,y:36,'text-anchor':'middle','font-size':10},keyTick(key,view.keys.length>8?4:8))));
  view.series.forEach((s,i)=>{
   svg.append(svgEl('text',{x:x0-8,y:y0+(i+.5)*h+4,'text-anchor':'end','font-size':11},s.label.slice(0,14)));
   s.values.forEach((v,j)=>{
    const rect=svgEl('rect',{x:x0+j*w,y:y0+i*h,width:w,height:h,fill:color(v),stroke:'#fff'});
    rect.append(svgEl('title',{},s.label+' / '+view.keys[j]+'：'+(v===null?'缺失':fmt.format(v)+' '+view.unit)));
    svg.append(rect);
    interactive(rect,view.keys[j],[s.label+' '+exact(v)],x0+(j+.5)*w,y0+(i+.5)*h);
    if(v===null)svg.append(svgEl('text',{x:x0+(j+.5)*w,y:y0+(i+.5)*h+4,'text-anchor':'middle','font-size':10,'pointer-events':'none'},'—'));
   });
  });
  const scale=lo===hi?[lo]:lo<0&&hi>0?[-extent,0,extent]:[lo,hi];
  scale.forEach((v,i)=>{
   const sx=x0+i*138;
   marks('rect',{x:sx,y:281,width:26,height:13,fill:color(v)});
   svg.append(svgEl('text',{x:sx+31,y:292,'font-size':11},tick(v)));
  });
  svg.append(svgEl('text',{x:510,y:292,'font-size':11},'灰色：缺失'));
 }else{
  const flattened=view.series.flatMap(s=>s.values.filter(v=>v!==null).flatMap(v=>typeof v==='number'?[v]:[v.low,v.high]));
  if(!flattened.length)throw new Error('Empty approved chart projection');
  const stacks=view.keys.map((_,j)=>view.series.reduce((pair,s)=>{
   const v=s.values[j];if(v!==null)pair[v<0?0:1]+=v;return pair;
  },[0,0]));
  if(view.chart==='stacked')flattened.push(...stacks.flat());
  if(['bar','stacked','combo','area'].includes(view.chart))flattened.push(0);
  let lo=Math.min(...flattened),hi=Math.max(...flattened);
  if(lo===hi){const pad=Math.max(Math.abs(lo)*.08,.01);lo-=pad;hi+=pad;}
  const x0=66,x1=616,y0=18,y1=278,W=x1-x0;
  const y=v=>y1-(v-lo)/(hi-lo)*(y1-y0);
  const dateAxis=timeCharts.includes(view.chart);
  const xValues=dateAxis?view.keys.map(k=>Date.parse(k)):null;
  const x=i=>dateAxis?(xValues.length===1?(x0+x1)/2:x0+W*(xValues[i]-xValues[0])/(xValues.at(-1)-xValues[0])):x0+W*(i+.5)/view.keys.length;
  marks('line',{x1:x0,y1:y0,x2:x0,y2:y1,stroke:'#68737b'});
  marks('line',{x1:x0,y1:0>=lo&&0<=hi?y(0):y1,x2:x1,y2:0>=lo&&0<=hi?y(0):y1,stroke:'#68737b'});
  for(const value of [lo,hi])svg.append(svgEl('text',{x:x0-6,y:y(value)+4,'text-anchor':'end',fill:'#293542','font-size':11},tick(value)));
  const bases=view.keys.map(()=>[0,0]);
  view.series.forEach((s,i)=>{
   const color=COLORS[i];
   if(view.chart==='area'){
    let points=[];
    const flush=()=>{
     if(points.length>1)marks('polygon',{points:[coordinate(points[0][0],y(0)),...points.map(([px,py])=>coordinate(px,py)),coordinate(points.at(-1)[0],y(0))].join(' '),
      fill:color,'fill-opacity':0.22});
     if(points.length>1)marks('polyline',{points:points.map(([px,py])=>coordinate(px,py)).join(' '),fill:'none',stroke:color,'stroke-width':2});
     for(const [cx,cy] of points)marks('circle',{cx,cy,r:2,fill:color});
     points=[];
    };
    s.values.forEach((v,j)=>{if(v===null)flush();else points.push([x(j),y(v)]);});flush();
   }else if(['line','multi-line'].includes(view.chart)||view.chart==='combo'&&s.mark==='line'){
    let prior=null;
    s.values.forEach((v,j)=>{
     if(v===null){prior=null;return;}
     const point={x:x(j),y:y(v)};
     if(prior)marks('line',{x1:prior.x,x2:point.x,y1:prior.y,y2:point.y,stroke:color,'stroke-width':2});
     marks('circle',{cx:point.x,cy:point.y,r:2,fill:color});prior=point;
    });
   }else if(['bar','stacked','combo'].includes(view.chart)){
    const stacked=view.chart==='stacked', slots=stacked||view.chart==='combo'?1:view.series.length;
    const width=Math.min(25,W/view.keys.length*.75/slots);
    s.values.forEach((v,j)=>{
     if(v===null||v===0)return;
     const b=stacked?bases[j][v<0?0:1]:0;
     if(stacked)bases[j][v<0?0:1]+=v;
     marks('rect',{x:x(j)+(stacked?-width/2:(i-slots/2)*width),y:Math.min(y(b),y(b+v)),width,
      height:Math.abs(y(b)-y(b+v)),fill:color});
    });
   }else{
    const width=Math.max(1,Math.min(10,W/view.keys.length*.6));
    s.values.forEach((v,j)=>{
     if(v===null)return;
     const cx=x(j),up=v.close>=v.open,stroke=up?'#02714a':'#b72234';
     marks('line',{x1:cx,x2:cx,y1:y(v.high),y2:y(v.low),stroke});
     marks('rect',{x:cx-width/2,y:Math.min(y(v.open),y(v.close)),width,height:Math.max(1,Math.abs(y(v.open)-y(v.close))),
      fill:up?'#fff':stroke,stroke});
    });
   }
  });
  [0,view.keys.length-1].filter((x,i,a)=>a.indexOf(x)===i).forEach(i=>svg.append(svgEl('text',
   {x:x(i),y:307,'text-anchor':i===0?'start':'end',fill:'#293542','font-size':11},keyTick(view.keys[i],18))));
  const combo=view.chart==='combo';
  const help='将鼠标移到某期或用 Tab 选中，查看同一时期的柱值和线值。';
  let readout,guide;
  if(combo){
   readout=html('p',help);readout.setAttribute('aria-live','polite');
   readout.setAttribute('class','financial-chart-combo-readout');figure.append(readout);
   guide=marks('line',{x1:x0,x2:x0,y1:y0,y2:y1,stroke:'#374151','stroke-dasharray':'4 3',visibility:'hidden','pointer-events':'none','aria-hidden':'true'});
   updateGuide=active=>{
    guide.setAttribute('visibility',active?'visible':'hidden');
    if(active){guide.setAttribute('x1',active.x);guide.setAttribute('x2',active.x);}
    readout.textContent=active?active.heading+'：'+active.rows.join('；'):help;
   };
  }
  view.keys.forEach((heading,j)=>{
   // Midpoints grant the nearest period even with uneven dates; include full plot edges.
   const cx=x(j),left=j===0?x0:(x(j-1)+cx)/2,right=j===view.keys.length-1?x1:(cx+x(j+1))/2;
   const rows=view.series.flatMap(s=>{
    const value=s.values[j];
    if(view.chart==='candlestick'&&value!==null)return [['开',value.open],['高',value.high],['低',value.low],['收',value.close]].map(([label,v])=>label+' '+exact(v));
    const role=combo?(s.mark==='bar'?'（柱）':'（线）'):'';
    return [s.label+role+' '+exact(value)];
   });
   const available=view.series.map(s=>s.values[j]).filter(v=>v!==null);
   const markerY=available.length?Math.min(...available.map(v=>y(typeof v==='number'?v:v.high))):(y0+y1)/2;
   const hit=combo?marks('rect',{x:left,y:y0,width:right-left,height:y1-y0,fill:'transparent',class:'financial-chart-period-hit'}):
    marks('path',{d:'M '+coordinate(left,y0)+' H '+right+' V '+y1+' H '+left+' Z',fill:'transparent',class:'financial-chart-period-hit'});
   interactive(hit,heading,rows,cx,markerY);
  });
 }
 if(view.provenance==='user-supplied'&&view.chart!=='heatmap'){ const legend=html('p'); legend.setAttribute('aria-label','图例');legend.setAttribute('class','financial-chart-legend');
 const legendItems=view.chart==='pie'?[...view.keys,view.coverage.remainderLabel]:view.series.map(s=>s.label+(s.mark==='bar'?'（柱）':s.mark==='line'?'（线）':''));
 legendItems.forEach((label,i)=>{
  const swatch=svgEl('svg',{viewBox:'0 0 10 10',width:10,height:10,'aria-hidden':'true'});
  swatch.append(svgEl('rect',{width:10,height:10,fill:view.chart==='pie'&&i===legendItems.length-1?'#8a9099':COLORS[i%COLORS.length]}));
  const item=html('span');item.append(swatch,html('span',label));legend.append(item);
 });
 figure.append(legend); }
 const details=html('details');details.append(html('summary','查看数字、口径和证据'));
 details.append(html('p','统计口径：'+view.basis+(view.periodStart?' · 开始 '+view.periodStart:'')));
 const table=html('table'), header=html('tr'), body=html('tbody'), rows=[...view.keys];
 const matrix=view.chart==='heatmap';
 ['项目',...(matrix?view.keys:view.series.map(s=>s.label))].forEach(label=>header.append(html('th',label)));
 const head=html('thead');head.append(header);table.append(head,body);
 if(view.chart==='pie')rows.push(view.coverage.remainderLabel);
 if(matrix)view.series.forEach(s=>{
  const row=html('tr');row.append(html('th',s.label));
  s.values.forEach(v=>row.append(html('td',v===null?'缺失':fmt.format(v))));
  body.append(row);
 });
 else rows.forEach((key,i)=>{
  const row=html('tr');row.append(html('th',key));
  view.series.forEach(s=>{
   const value=i===view.keys.length?view.coverage.remainder:s.values[i];
   const text=value===null?'缺失':typeof value==='number'?fmt.format(value):
    '开 '+fmt.format(value.open)+'；高 '+fmt.format(value.high)+'；低 '+fmt.format(value.low)+'；收 '+fmt.format(value.close);
   row.append(html('td',text));
  });
  body.append(row);
 });
 const tableWrap=html('div');tableWrap.setAttribute('class','financial-chart-table');tableWrap.append(table);details.append(tableWrap);
 details.append(html('p','证据回执：'+view.series.map(s=>typeof s.receiptId==='string'&&/^chart-evidence:sha256:[a-f0-9]{64}$/.test(s.receiptId)?s.receiptId:'不可用').join('、')));
 const sourceIds=[...new Set(view.series.flatMap(s=>Array.isArray(s.originReceiptIds)?s.originReceiptIds.slice(0,8):[]))]
  .filter(x=>typeof x==='string'&&/^(?:result|calculation|artifact|typed-source):sha256:[a-f0-9]{64}$/.test(x));
 details.append(html('p','上游来源回执：'+(sourceIds.join('、')||'不可用')));
 figure.append(details);
 return figure;
}
