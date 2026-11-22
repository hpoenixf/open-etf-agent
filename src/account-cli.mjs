import {resolve} from 'node:path';
import {readProjectJson} from './research-project.mjs';
import {accountProjectBasename, startAccountSite} from './account-site.mjs';
import {openBetterAuth, prepareAccountDatabase, provisionOfflineAccount} from './account-better-auth.mjs';

let app,auth,stop;
try{
  const [action,flag,path,...extra]=process.argv.slice(2);
  if(!['serve','migrate','provision'].includes(action)||flag!=='--config'||!path||extra.length)throw new Error('ACCOUNT_CLI_USAGE');
  const config=await readProjectJson(resolve(path),8192);
  const common=['origin','secretFile','stateDir'];
  const keys=action==='serve'?[...common,'projectRoot','port']:action==='provision'?[...common,'name','email','passwordFile']:common;
  if(!config||Object.keys(config).sort().join()!==keys.sort().join())throw new Error('ACCOUNT_CLI_CONFIG');
  if(action==='migrate'){
    await prepareAccountDatabase(config);process.stdout.write('Account database prepared.\n');
  }else if(action==='provision'){
    const {subject}=await provisionOfflineAccount(config);
    process.stdout.write(JSON.stringify({projectBasename:accountProjectBasename(subject)})+'\n');
  }else{
    if(![config.projectRoot,config.stateDir].every(p=>typeof p==='string'&&p!=='/'&&resolve(p)===p)||
      config.stateDir===config.projectRoot||config.stateDir.startsWith(config.projectRoot+'/')||
      config.projectRoot.startsWith(config.stateDir+'/'))throw new Error('ACCOUNT_CLI_CONFIG');
    auth=await openBetterAuth(config);
    app=await startAccountSite({origin:config.origin,projectRoot:config.projectRoot,port:config.port,auth});
    process.stdout.write(JSON.stringify({origin:app.origin,loopbackPort:app.port,mode:'fixture-accounts'})+'\n');
    await new Promise(resolve=>{
      stop=resolve;process.once('SIGTERM',stop);process.once('SIGINT',stop);
    });
  }
}catch(e){
  const safe=typeof e?.code==='string'&&/^ACCOUNT_[A-Z_]{3,64}$/.test(e.code)?e.code:
    ['ACCOUNT_CLI_USAGE','ACCOUNT_CLI_CONFIG'].includes(e?.message)?e.message:'ACCOUNT_OPERATION_FAILED';
  process.stderr.write(safe+'\n');process.exitCode=1;
}finally{
  if(stop){process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
  try{await app?.close();}finally{auth?.close();}
}
