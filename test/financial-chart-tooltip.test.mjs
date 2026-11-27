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
 assert.deepEqual(ticks,['0','1.23万','1.23','2.22万']);
 targets[1].events.focus();
 assert.equal(tip.children[0].textContent,'22222.987654');
 assert.equal(tip.children[1].textContent,'数字 12345.6789 %');
 assert.ok(nodes.some(n=>n.tag==='td'&&n.textContent==='12,345.6789'));
});
