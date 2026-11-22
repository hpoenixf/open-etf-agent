import { resolve } from 'node:path';
import { startLocalGui } from './gui-server.mjs';
import { readProjectJson } from './research-project.mjs';

let gui;
try {
  const args = process.argv.slice(2), options=new Map();
  if (args.length%2!==0) throw new Error('INVALID_OPTIONS');
  for (let i=0;i<args.length;i+=2) {
    const [flag,value]=args.slice(i,i+2);
    if (!['--project','--port','--live-config'].includes(flag)||options.has(flag)||!value||value.startsWith('--')) throw new Error('INVALID_OPTIONS');
    options.set(flag,value);
  }
  if (!options.has('--project')||(options.has('--port')&&!/^\d+$/.test(options.get('--port')))) throw new Error('INVALID_OPTIONS');
  const liveConfig=options.has('--live-config')?await readProjectJson(options.get('--live-config'),16384):undefined;
  gui = await startLocalGui({
    projectDir: resolve(options.get('--project')),
    port: options.has('--port')?Number(options.get('--port')):0,
    liveConfig,
  });
  process.stdout.write(JSON.stringify({ origin:gui.origin, mode:gui.mode, providerCalls:0 })+'\n');
  await new Promise(resolve => { process.once('SIGINT',resolve);process.once('SIGTERM',resolve); });
} catch (e) {
  const code=typeof e?.code==='string'&&/^[A-Z][A-Z0-9_]{1,80}$/.test(e.code)?e.code:null;
  process.stderr.write('GUI_START_FAILED: '+(code??'Usage: npm run gui -- --project DIR [--port N] [--live-config FILE]')+'\n');
  process.exitCode = 1;
} finally { await gui?.close(); }
