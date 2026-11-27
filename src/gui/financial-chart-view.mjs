// Browser-only adapter. Provide only a host-accepted read-only projection;
// never parse a model's answer, raw SVG, URL, or CSS into a chart.
const NS='http://www.w3.org/2000/svg';
const COLORS=['#1565c0','#00796b','#9c3364','#8a4d00','#5237ad','#725244','#407651','#396071'];
const fmt=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:6});
const number=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e9;
const safe=s=>typeof s==='string'&&s.length<=200&&!/[\p{C}]/u.test(s);
const candle=v=>v&&Object.keys(v).sort().join(',')==='close,high,low,open'&&[v.open,v.high,v.low,v.close].every(number)
 &&v.low>0&&v.low<=Math.min(v.open,v.close)&&v.high>=Math.max(v.open,v.close);
function valid(view){
 if(view?.schemaVersion!=='financial-chart-view@1'||typeof view.integrity!=='string'||!/^[a-f0-9]{64}$/.test(view.integrity)
  ||!['line','bar','pie','candlestick','stacked'].includes(view.chart)||![view.title,view.unit,view.basis].every(safe)
  ||!(safe(view.asOf)||view.asOf===null&&view.provenance==='user-supplied'&&['bar','stacked','pie'].includes(view.chart))||(view.periodStart!==null&&!safe(view.periodStart))
  ||!['synthetic','provider-reported','document-reported','user-supplied'].includes(view.provenance)
  ||!Array.isArray(view.keys)||view.keys.length<1||view.keys.length>(['line','candlestick'].includes(view.chart)?180:24)||!view.keys.every(safe)
  ||!Array.isArray(view.series)||!view.series.length||view.series.length>(['line','bar','stacked'].includes(view.chart)?4:1))return false;
 if(['line','candlestick'].includes(view.chart)&&!view.keys.every((x,i)=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&(i===0||x>view.keys[i-1])))return false;
 if(!view.series.every(s=>safe(s?.label)&&Array.isArray(s.values)&&s.values.length===view.keys.length&&
   s.values.every(v=>v===null||(view.chart==='candlestick'?candle(v):number(v)))))return false;
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
 const svg=svgEl('svg',{viewBox:'0 0 640 320',role:'img','aria-label':view.title});
 svg.append(svgEl('title',{},view.title),svgEl('desc',{},'下方表格列出原始数值、缺失项和口径。'));
 figure.append(svg);
 const marks=(name,attrs)=>svg.append(svgEl(name,attrs));
 const coordinate=(x,y)=>[x.toFixed(3),y.toFixed(3)].join(' ');
 if(view.chart==='pie'){
  let start=-Math.PI/2;
  const values=[...view.series[0].values,view.coverage.remainder], radius=120,cx=320,cy=160;
  values.forEach((value,i)=>{
   if(value===null||value<=0)return;
   const color=i===values.length-1?'#8a9099':COLORS[i%COLORS.length];
   if(value>=100){marks('circle',{cx,cy,r:radius,fill:color});return;}
   const end=start+value*Math.PI/50;
   const at=angle=>coordinate(cx+radius*Math.cos(angle),cy+radius*Math.sin(angle));
   marks('path',{d:'M '+coordinate(cx,cy)+' L '+at(start)+' A '+radius+' '+radius+' 0 '+(value>50?1:0)+' 1 '+at(end)+' Z',fill:color});
   start=end;
  });
 }else{
  const flattened=view.series.flatMap(s=>s.values.filter(v=>v!==null).flatMap(v=>typeof v==='number'?[v]:[v.low,v.high]));
  if(!flattened.length)throw new Error('Empty approved chart projection');
  const stacks=view.keys.map((_,j)=>view.series.reduce((pair,s)=>{
   const v=s.values[j];if(v!==null)pair[v<0?0:1]+=v;return pair;
  },[0,0]));
  if(view.chart==='stacked')flattened.push(...stacks.flat());
  if(['bar','stacked'].includes(view.chart))flattened.push(0);
  let lo=Math.min(...flattened),hi=Math.max(...flattened);
  if(lo===hi){const pad=Math.max(Math.abs(lo)*.08,.01);lo-=pad;hi+=pad;}
  const x0=66,x1=616,y0=18,y1=278,W=x1-x0;
  const y=v=>y1-(v-lo)/(hi-lo)*(y1-y0);
  const dateAxis=['line','candlestick'].includes(view.chart);
  const xValues=dateAxis?view.keys.map(k=>Date.parse(k)):null;
  const x=i=>dateAxis?(xValues.length===1?(x0+x1)/2:x0+W*(xValues[i]-xValues[0])/(xValues.at(-1)-xValues[0])):x0+W*(i+.5)/view.keys.length;
  marks('line',{x1:x0,y1:y0,x2:x0,y2:y1,stroke:'#68737b'});
  marks('line',{x1:x0,y1:0>=lo&&0<=hi?y(0):y1,x2:x1,y2:0>=lo&&0<=hi?y(0):y1,stroke:'#68737b'});
  for(const value of [lo,hi])svg.append(svgEl('text',{x:x0-6,y:y(value)+4,'text-anchor':'end',fill:'#293542','font-size':11},fmt.format(value)));
  const bases=view.keys.map(()=>[0,0]);
  view.series.forEach((s,i)=>{
   const color=COLORS[i];
   if(view.chart==='line'){
    let prior=null;
    s.values.forEach((v,j)=>{
     if(v===null){prior=null;return;}
     const point={x:x(j),y:y(v)};
     if(prior)marks('line',{x1:prior.x,x2:point.x,y1:prior.y,y2:point.y,stroke:color,'stroke-width':2});
     marks('circle',{cx:point.x,cy:point.y,r:2,fill:color});prior=point;
    });
   }else if(['bar','stacked'].includes(view.chart)){
    const stacked=view.chart==='stacked', slots=stacked?1:view.series.length;
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
   {x:x(i),y:307,'text-anchor':i===0?'start':'end',fill:'#293542','font-size':11},view.keys[i].slice(0,18))));
 }
 if(view.provenance==='user-supplied'){ const legend=html('p'); legend.setAttribute('aria-label','图例');legend.setAttribute('class','financial-chart-legend');
 const legendItems=view.chart==='pie'?[...view.keys,view.coverage.remainderLabel]:view.series.map(s=>s.label);
 legendItems.forEach((label,i)=>{
  const swatch=svgEl('svg',{viewBox:'0 0 10 10',width:10,height:10,'aria-hidden':'true'});
  swatch.append(svgEl('rect',{width:10,height:10,fill:view.chart==='pie'&&i===legendItems.length-1?'#8a9099':COLORS[i%COLORS.length]}));
  const item=html('span');item.append(swatch,html('span',label));legend.append(item);
 });
 figure.append(legend); }
 const details=html('details');details.append(html('summary','查看数字、口径和证据'));
 details.append(html('p','统计口径：'+view.basis+(view.periodStart?' · 开始 '+view.periodStart:'')));
 const table=html('table'), header=html('tr'), body=html('tbody'), rows=[...view.keys];
 ['项目',...view.series.map(s=>s.label)].forEach(label=>header.append(html('th',label)));
 const head=html('thead');head.append(header);table.append(head,body);
 if(view.chart==='pie')rows.push(view.coverage.remainderLabel);
 rows.forEach((key,i)=>{
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
