import {parseArgs} from 'node:util';
import {diagnoseDeployment,versionPattern} from './deploy-doctor.mjs';

const usage='Usage: node src/deploy-doctor-cli.mjs [--json] [--root DIR] [--project DIR] [--mode offline|live] [--live-config FILE] [--port N] [--expect-version X.Y.Z] [--expect-node X.Y.Z]\n';
const labels={installation:'Installation',runtime:'Runtime',configuration:'Configuration',permissions:'Directory permissions',health:'Local health'};
if(process.argv.length===3&&process.argv[2]==='--help')process.stdout.write(usage);
else try{
  const strings=['root','project','mode','live-config','port','expect-node','expect-version'];
  const {values,tokens}=parseArgs({options:{...Object.fromEntries(strings.map(name=>[name,{type:'string'}])),json:{type:'boolean'}},tokens:true});
  if(new Set(tokens.map(token=>token.name)).size!==tokens.length||
    strings.some(name=>Object.hasOwn(values,name)&&!values[name])||
    !['offline','live'].includes(values.mode??'offline')||
    values['live-config']&&values.mode!=='live'||
    [values['expect-node'],values['expect-version']].some(v=>v!==undefined&&!versionPattern.test(v))||
    values.port&&(!/^\d{1,5}$/.test(values.port)||Number(values.port)<1||Number(values.port)>65535))throw new Error('INVALID_OPTIONS');
  const report=await diagnoseDeployment({root:values.root,mode:values.mode,projectDir:values.project,liveConfig:values['live-config'],
    port:values.port===undefined?undefined:Number(values.port),expectedNode:values['expect-node'],expectedVersion:values['expect-version']});
  if(values.json)process.stdout.write(JSON.stringify(report,null,2)+'\n');
  else{
    const lines=Object.entries(report.checks).map(([key,item])=>labels[key]+' ['+item.status+'/'+item.code+'] '+item.next);
    const {node,app,supportedRange}=report.checks.runtime;
    lines.push('Node '+node+' · App '+(app??'unknown')+' · Supported Node '+(supportedRange??'unknown'));
    process.stdout.write(lines.join('\n')+'\n');
  }
  process.exitCode=report.ok?0:1;
}catch{
  process.stderr.write(usage);
  process.exitCode=2;
}
