const fail=code=>{throw new Error(code);};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const identifier=v=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=128&&!/[\u0000-\u001f]/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const basisPoints=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000;
const round=v=>Number(v.toFixed(12));
const missing=(...fields)=>({status:'missing',value:null,missing:fields});
const incomparable=reason=>({status:'incomparable',value:null,missing:[],reason});

function validateWeights(value){
  if(value==null)return null;
  if(!record(value)||!identifier(value.classification)||!['complete','partial'].includes(value.coverage)||
    !Array.isArray(value.weights)||value.weights.length>10000)fail('INVALID_WEIGHTS');
  let sum=0;
  const ids=new Set();
  for(const row of value.weights){
    if(!record(row)||!identifier(row.id)||!basisPoints(row.bps)||ids.has(row.id))fail('INVALID_WEIGHT_ROW');
    ids.add(row.id);
    sum+=row.bps;
  }
  if(sum>10000||(value.coverage==='complete'&&sum!==10000))fail('INVALID_WEIGHT_TOTAL');
  return value;
}

function validateSnapshot(snapshot){
  if(!record(snapshot)||snapshot.schemaVersion!=='etf-snapshot@1'||!identifier(snapshot.fundId)||
     !identifier(snapshot.shareClassId)||typeof snapshot.currency!=='string'||!/^[A-Z]{3}$/.test(snapshot.currency))fail('INVALID_SNAPSHOT_IDENTITY');
  if(!date(snapshot.asOf))fail('INVALID_AS_OF');
  const {feeBps=null,feeBasis=null,series=null}=snapshot;
  if(feeBps!==null&&!basisPoints(feeBps)||feeBasis!==null&&!['annual-expense-ratio','annual-management-fee'].includes(feeBasis))fail('INVALID_FEE');
  if(series!==null){
    if(!record(series)||series.shareClassId!==snapshot.shareClassId||series.currency!==snapshot.currency)fail('INVALID_SERIES_IDENTITY');
    if(!['nav-price','total-return-index'].includes(series.basis)||!Array.isArray(series.values)||series.values.length>20000)fail('INVALID_SERIES');
    const seen=new Set();
    for(const row of series.values){
      if(!record(row)||!date(row.date)||row.date>snapshot.asOf||seen.has(row.date)||
         row.value!=null&&(typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<=0))fail('INVALID_SERIES_OBSERVATION');
      seen.add(row.date);
    }
  }
  return {fundId:snapshot.fundId,shareClassId:snapshot.shareClassId,currency:snapshot.currency,
    asOf:snapshot.asOf,feeBps,feeBasis,holdings:validateWeights(snapshot.holdings),sectors:validateWeights(snapshot.sectors),series};
}

function feeComparison(left,right){
  const absent=[];
  for(const [side,input] of [['left',left],['right',right]]){
    if(input.feeBps===null)absent.push(side+'.feeBps');
    if(input.feeBasis===null)absent.push(side+'.feeBasis');
  }
  if(absent.length)return missing(...absent);
  if(left.feeBasis!==right.feeBasis)return incomparable('fee-basis-mismatch');
  return {status:'ok',value:left.feeBps-right.feeBps,unit:'bps',basis:left.feeBasis,
    formula:'left annual fee bps - right annual fee bps',inputs:{left:left.feeBps,right:right.feeBps},missing:[]};
}

function weightComparison(left,right,key){
  const absent=[];
  for(const [side,input] of [['left',left],['right',right]]){
    if(!input)absent.push(side+'.'+key);
    else if(input.coverage!=='complete')absent.push(side+'.'+key+'.completeCoverage');
  }
  if(absent.length)return missing(...absent);
  if(left.classification!==right.classification)return incomparable('classification-mismatch');
  const rightWeights=new Map(right.weights.map(row=>[row.id,row.bps]));
  const inputs=left.weights.filter(row=>rightWeights.has(row.id)).map(row=>({id:row.id,left:row.bps,right:rightWeights.get(row.id)}));
  return {status:'ok',value:inputs.reduce((sum,row)=>sum+Math.min(row.left,row.right),0),unit:'bps',basis:left.classification,
    formula:'sum(min(left weight bps, right weight bps)) over matched identifiers',inputs,missing:[]};
}

function returnComparison(left,right,window){
  const absent=[];
  const inputs={};
  for(const [side,input] of [['left',left],['right',right]]){
    if(!input){absent.push(side+'.series');continue;}
    const observations=new Map(input.values.map(row=>[row.date,row.value]));
    inputs[side]={start:observations.get(window.start)??null,end:observations.get(window.end)??null};
    for(const endpoint of ['start','end'])if(inputs[side][endpoint]===null)absent.push(side+'.series.'+endpoint);
  }
  if(absent.length)return missing(...absent);
  if(left.basis!==right.basis)return incomparable('return-basis-mismatch');
  const lhs=inputs.left.end/inputs.left.start-1,rhs=inputs.right.end/inputs.right.start-1;
  if(![lhs,rhs,lhs-rhs].every(Number.isFinite))return incomparable('numeric-range');
  return {status:'ok',left:round(lhs),right:round(rhs),difference:round(lhs-rhs),unit:'decimal-return',basis:left.basis,
    formula:'end / start - 1 for each share class; difference = left return - right return',inputs,missing:[]};
}

export function compareEtfSnapshots(left,right,{start,end}){
  left=validateSnapshot(left);
  right=validateSnapshot(right);
  if(!date(start)||!date(end)||start>=end)fail('INVALID_RETURN_WINDOW');
  const mismatch=left.currency!==right.currency?'currency-mismatch':left.asOf!==right.asOf?'snapshot-date-mismatch':null;
  const snapshots=[left,right].map(({fundId,shareClassId,currency,asOf,feeBasis,holdings,sectors,series})=>({
    fundId,shareClassId,currency,asOf,feeBasis,holdingsClassification:holdings?.classification??null,
    sectorsClassification:sectors?.classification??null,returnBasis:series?.basis??null,
  }));
  return {schemaVersion:'etf-comparison@1',snapshots,window:{start,end},
    fees:mismatch?incomparable(mismatch):feeComparison(left,right),
    holdings:mismatch?incomparable(mismatch):weightComparison(left.holdings,right.holdings,'holdings'),
    sectors:mismatch?incomparable(mismatch):weightComparison(left.sectors,right.sectors,'sectors'),
    returns:mismatch?incomparable(mismatch):returnComparison(left.series,right.series,{start,end}),
  };
}

// Fixed three-column CSV, with quoted cells and conventional escaped quotes.
function csvRows(text){
  const rows=[];
  let row=[],field='',quoted=false,closed=false;
  function pushField(){row.push(field);field='';closed=false;}
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted){
      if(char==='"'){
        if(text[index+1]==='"'){field+='"';index++;}
        else{quoted=false;closed=true;}
      }else field+=char;
    }else if(char===',')pushField();
    else if(char==='\r'||char==='\n'){
      if(char==='\r'&&text[++index]!=='\n')fail('INVALID_CSV_NEWLINE');
      pushField();
      rows.push(row);
      row=[];
    }else if(closed)fail('INVALID_CSV_QUOTE');
    else if(char==='"'){
      if(field)fail('INVALID_CSV_QUOTE');
      quoted=true;
    }else field+=char;
  }
  if(quoted)fail('INVALID_CSV_QUOTE');
  if(row.length||closed||field){pushField();rows.push(row);}
  if(rows.shift()?.join(',')!=='kind,key,value'||rows.some(item=>item.length!==3))fail('INVALID_CSV_COLUMNS');
  return rows;
}

const csvNumber=value=>{
  if(value==='')return null;
  if(!/^\d+(?:\.\d+)?$/.test(value))fail('INVALID_CSV_NUMBER');
  return Number(value);
};
const metadataKeys=new Set(['fundId','shareClassId','currency','asOf','feeBasis','feeBps','holdingsClassification',
  'holdingsCoverage','sectorsClassification','sectorsCoverage','seriesShareClassId','seriesCurrency','seriesBasis']);

export function parseEtfSnapshot(text,format){
  if(format==='json')return JSON.parse(text);
  if(format!=='csv')fail('INVALID_SNAPSHOT_FORMAT');
  const meta=new Map(),holdings=[],sectors=[],values=[];
  for(const [kind,key,value] of csvRows(text)){
    switch(kind){
      case 'meta':
        if(!metadataKeys.has(key)||meta.has(key))fail('INVALID_CSV_METADATA');
        meta.set(key,value);
        break;
      case 'holding': holdings.push({id:key,bps:csvNumber(value)});break;
      case 'sector': sectors.push({id:key,bps:csvNumber(value)});break;
      case 'observation': values.push({date:key,value:csvNumber(value)});break;
      default: fail('INVALID_CSV_KIND');
    }
  }
  const group=(name,weights)=>weights.length||meta.has(name+'Classification')||meta.has(name+'Coverage')?
    {classification:meta.get(name+'Classification'),coverage:meta.get(name+'Coverage'),weights}:null;
  const series=values.length||['seriesShareClassId','seriesCurrency','seriesBasis'].some(key=>meta.has(key))?
    {shareClassId:meta.get('seriesShareClassId'),currency:meta.get('seriesCurrency'),basis:meta.get('seriesBasis'),values}:null;
  return {schemaVersion:'etf-snapshot@1',fundId:meta.get('fundId'),shareClassId:meta.get('shareClassId'),
    currency:meta.get('currency'),asOf:meta.get('asOf'),feeBasis:meta.get('feeBasis')||null,feeBps:csvNumber(meta.get('feeBps')??''),
    holdings:group('holdings',holdings),sectors:group('sectors',sectors),series};
}
