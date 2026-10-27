const fail=()=>{throw Object.assign(new Error('LIVE_ARGUMENTS'),{code:'LIVE_ARGUMENTS'});};
export function parseLiveOptions(argv) {
 const fields=new Set(['--version','--baseline','--config','--ledger','--output','--base-url','--model','--max-total-cny']);const grants=new Set(['--confirm-provider','--confirm-synthetic-data','--confirm-cost']);const values=new Map();
 for(let i=0;i<argv.length;i++){const key=argv[i];if(values.has(key)||(!fields.has(key)&&!grants.has(key)))fail();if(grants.has(key)){values.set(key,true);continue;}const value=argv[++i];if(typeof value!=='string'||!value||value.startsWith('--')||/[\u0000-\u001f\u007f]/.test(value))fail();values.set(key,value);}
 if([...fields,...grants].some(key=>!values.has(key)))fail();const budget=Number(values.get('--max-total-cny'));if(!Number.isFinite(budget)||budget<100||budget>100000||!/^v0[1-5]$/.test(values.get('--version')))fail();
 return {version:values.get('--version'),baselineDirectory:values.get('--baseline'),configPath:values.get('--config'),ledgerDirectory:values.get('--ledger'),outputRoot:values.get('--output'),expected:{baseUrl:values.get('--base-url'),model:values.get('--model')},authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true,maxTotalCny:budget}};
}
