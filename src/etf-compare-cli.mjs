import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {extname} from 'node:path';
import {parseArgs} from 'node:util';
import {compareEtfSnapshots,parseEtfSnapshot} from './etf-compare.mjs';

const usage='Usage: node src/etf-compare-cli.mjs --left FILE --right FILE --start YYYY-MM-DD --end YYYY-MM-DD\n';
async function load(path){
  const max=2*1024*1024;
  const handle=await open(path,constants.O_RDONLY|constants.O_NONBLOCK);
  try{
    const {size}=await handle.stat().then(stat=>{if(!stat.isFile()||stat.size>max)throw new Error('INVALID_INPUT_FILE');return stat;});
    const buffer=Buffer.alloc(size+1);
    let offset=0;
    while(offset<buffer.length){
      const {bytesRead}=await handle.read(buffer,offset,buffer.length-offset,offset);
      if(!bytesRead)break;
      offset+=bytesRead;
    }
    if(offset!==size)throw new Error('INPUT_SIZE_CHANGED');
    return parseEtfSnapshot(new TextDecoder('utf8',{fatal:true}).decode(buffer.subarray(0,offset)),extname(path).slice(1).toLowerCase());
  }finally{await handle.close();}
}
if(process.argv.length===3&&process.argv[2]==='--help')process.stdout.write(usage);
else try{
  const {values,tokens}=parseArgs({options:{left:{type:'string'},right:{type:'string'},start:{type:'string'},end:{type:'string'}},tokens:true});
  if(tokens.length!==4||Object.keys(values).length!==4||!Object.values(values).every(Boolean))throw new Error('INVALID_OPTIONS');
  const [left,right]=await Promise.all([load(values.left),load(values.right)]);
  process.stdout.write(JSON.stringify(compareEtfSnapshots(left,right,values),null,2)+'\n');
}catch(error){
  process.stderr.write((/^[A-Z_]{3,60}$/.test(error.message)?error.message:'ETF_COMPARISON_FAILED')+'\n'+usage);
  process.exitCode=1;
}
