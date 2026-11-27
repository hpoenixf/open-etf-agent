import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinancialChartView} from '../src/gui/financial-chart-view.mjs';

function draw(chart, series, keys=['2026-01-01','2026-01-02','2026-01-09'], options={}){
 const nodes=[];
 let current=null;
 const make=tag=>{
  const n={tag,attrs:{},children:[],events:{},style:{},offsetWidth:185,offsetHeight:80,textContent:'',
   append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
   setAttribute(k,v){this.attrs[k]=String(v);},addEventListener(type,fn){this.events[type]=fn;},
   getBoundingClientRect(){return tag==='figure'?{left:8,top:100,width:220,height:210}:{left:16,top:147,width:204,height:102};},
   focus(){if(current&&current!==this)current.events.blur();current=this;this.events.focus();},
  };
  nodes.push(n);return n;
 };
 const shape={schemaVersion:'financial-chart-view@1',integrity:'0'.repeat(64),chart,title:'测试图',unit:'%',
  basis:'user-supplied',asOf:'2026-01-31',periodStart:null,provenance:'user-supplied',keys,series,...options};
 createFinancialChartView({createElement:make,createElementNS:(_,tag)=>make(tag)},shape);
 return {nodes,figure:nodes[0],tip:nodes.find(n=>n.attrs.class==='financial-chart-tooltip'),
  targets:nodes.filter(n=>n.attrs.tabindex!==undefined)};
}

test('every supported mark exposes a bounded floating readout with accurate units and NULL versus zero',()=>{
 const n={label:'精确值 <img onerror=x>',values:[1.234567891,null,0]};
 for(const [chart,series,extra,want] of [
  ...['line','bar','stacked','area'].map(chart=>[chart,[n],{},'精确值 <img onerror=x> 1.234567891 %']),
  ['multi-line',[n,{label:'二',values:[3,0,2]}],{},'二 3 %'],
  ['combo',[{...n,mark:'bar'},{label:'二',values:[3,0,2],mark:'line'}],{},'二（线） 3 %'],
  ['heatmap',[n,{label:'二',values:[3,0,2]}],{},'精确值 <img onerror=x> 1.234567891 %'],
  ['pie',[{label:'份额',values:[33.123456789,null,0]}],{coverage:{total:100,remainder:66.876543211,remainderLabel:'未知份额'}},'33.123456789 %'],
  ['candlestick',[{label:'交易',values:[{open:10.1111111,high:12.2222222,low:8.3333333,close:11.4444444},null,null]}],
   {kind:'financial-ohlc',unit:'CNY/share'},'收 11.4444444 CNY/share'],
 ]){
  const {nodes,tip,targets}=draw(chart,series,undefined,extra);
  assert.ok(tip.hidden,chart);
  assert.ok(targets.length>=2,chart);
  targets[0].events.pointerenter({pointerType:'mouse'});
  assert.equal(tip.hidden,false,chart);
  assert.equal(tip.children[0].textContent,'2026-01-01');
  assert.ok(tip.children.some(x=>x.textContent===want),chart);
  assert.ok(parseFloat(tip.style.left)>=6&&parseFloat(tip.style.left)<=29,chart);
  assert.ok(parseFloat(tip.style.top)>=6&&parseFloat(tip.style.top)<=124,chart);
  targets[0].events.pointerleave();
  assert.equal(tip.hidden,true,chart);
  targets[1].events.pointerenter({pointerType:'mouse'});
  assert.match(tip.children.map(n=>n.textContent).join(' '),chart==='pie'?/未知份额/:/缺失/,chart);
  if(['line','bar','stacked','area','multi-line','combo','heatmap'].includes(chart)){
   targets[2].events.pointerenter({pointerType:'mouse'});
   assert.match(tip.children.map(n=>n.textContent).join(' '),/ 0 %/,chart);
  }
  assert.ok(!nodes.some(n=>['img','script','foreignObject'].includes(n.tag)),chart);
 }
});

test('keyboard traverses uneven time buckets, Escape dismisses, and touch tap toggles without hover',()=>{
 const {tip,targets,figure}=draw('line',[{label:'净值',values:[1,null,2]}]);
 assert.deepEqual(targets.map(t=>t.attrs.tabindex),['0','-1','-1']);
 let prevented=0;
 const press=(el,key)=>el.events.keydown({key,preventDefault(){prevented++;}});
 targets[0].focus();
 assert.equal(tip.children[0].textContent,'2026-01-01');
 press(targets[0],'ArrowRight');
 assert.equal(targets[1].attrs.tabindex,'0');
 assert.equal(tip.children[0].textContent,'2026-01-02');
 assert.match(tip.children[1].textContent,/缺失/);
 press(targets[1],'End');
 assert.equal(tip.children[0].textContent,'2026-01-09');
 press(targets[2],'Escape');assert.equal(tip.hidden,true);
 assert.equal(prevented,3);
 targets[0].events.pointerenter({pointerType:'touch'});assert.equal(tip.hidden,true);
 const tap=()=>{targets[0].events.pointerdown({pointerType:'touch'});targets[0].events.click({});};
 tap();assert.equal(tip.hidden,false);
 tap();assert.equal(tip.hidden,true);
 tap();figure.events.click({target:figure});assert.equal(tip.hidden,true);
});

test('numeric axis labels use at most two fractional digits; table and tooltip retain source labels',()=>{
 const {nodes,targets,tip}=draw('bar',[{label:'数字',values:[.00123456,12345.6789]}],['1.234567','22222.987654']);
 const ticks=nodes.filter(n=>n.tag==='text').map(n=>n.textContent);
 assert.deepEqual(ticks,['0','5000','1万','1.5万','1.23','2.22万']);
 targets[1].events.focus();
 assert.equal(tip.children[0].textContent,'22222.987654');
 assert.equal(tip.children[1].textContent,'数字 12345.6789 %');
 assert.ok(nodes.some(n=>n.tag==='td'&&n.textContent==='12,345.6789'));
});


const axisLabels=nodes=>nodes.filter(n=>n.tag==='text'&&n.attrs.x==='60').map(n=>n.textContent);
const geometryFits=nodes=>{
 const points=nodes.filter(n=>n.tag==='circle'&&n.attrs.cy!==undefined).map(n=>Number(n.attrs.cy));
 assert.ok(points.every(y=>Number.isFinite(y)&&y>=18&&y<=278));
 return points;
};
test('vertical range fits lines and complete OHLC; zero-based charts retain sign, zero and stack sums',()=>{
 const series=values=>[{label:'合成',values}];
 let v=draw('line',series([97.2,99.5,100.1]));
 assert.deepEqual(axisLabels(v.nodes),['97','98','99','100','101']);
 assert.equal(geometryFits(v.nodes).length,3);
 v=draw('candlestick',series([{open:99,high:104,low:95,close:101},null,{open:103,high:105,low:97,close:102}]),
  undefined,{kind:'financial-ohlc',unit:'CNY/share'});
 assert.deepEqual(axisLabels(v.nodes),['90','95','100','105','110']);
 v=draw('bar',series([-3,-9,-7]));
 assert.deepEqual(axisLabels(v.nodes),['-10','-7.5','-5','-2.5','0']);
 v=draw('area',series([-5,5,10]));
 assert.deepEqual(axisLabels(v.nodes),['-5','0','5','10']);
 v=draw('stacked',[{label:'一',values:[-3,6,2]},{label:'二',values:[-7,4,-5]}]);
 assert.deepEqual(axisLabels(v.nodes),['-10','-5','0','5','10']);
 v=draw('bar',series([0,0,0]));
 assert.equal(axisLabels(v.nodes)[0],'0');
 assert.ok(axisLabels(v.nodes).length>=3);
});

test('constant and tight large series have distinct scale labels and precise original tooltip values',()=>{
 const make=values=>draw('line',[{label:'合成',values}]);
 let v=make([12.34,12.34,12.34]);
 assert.deepEqual(axisLabels(v.nodes),['12.2','12.3','12.4','12.5']);
 assert.equal(new Set(geometryFits(v.nodes)).size,1);
 assert.ok(axisLabels(v.nodes).length>=3);
 v=make([999999999.100001,999999999.100002,999999999.100004]);
 const ticks=axisLabels(v.nodes);
 assert.ok(v.nodes.some(n=>n.textContent.startsWith('纵轴基准：999999999.100001')));
 assert.equal(new Set(ticks).size,ticks.length);
 assert.equal(new Set(geometryFits(v.nodes)).size,3);
 assert.ok(ticks.every(label=>!/\.\d{3}/.test(label)));
 v.targets[2].events.focus();
 assert.equal(v.tip.children[1].textContent,'合成 999999999.100004 %');
 v=make([Number.MIN_VALUE,Number.MIN_VALUE*2,Number.MIN_VALUE*3]);
 const micro=axisLabels(v.nodes);
 assert.equal(new Set(micro).size,micro.length);
 assert.equal(geometryFits(v.nodes).length,3);
});

test('undated agent category data still renders without a fabricated date caption',()=>{
 const v=draw('bar',[{label:'Growth',values:[null,10,10]}],['Q1','Q2','Q3'],
  {basis:'agent-supplied',provenance:'agent-supplied',asOf:null});
 assert.equal(v.nodes.find(n=>n.tag==='figcaption').textContent,'测试图 · % · 未提供日期');
 assert.equal(v.targets.length,3);
});
