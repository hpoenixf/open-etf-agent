import { resolve } from 'node:path';
import { startLocalGui } from './gui-server.mjs';

let gui;
try {
  const args = process.argv.slice(2);
  if (![2,4].includes(args.length) || args[0] !== '--project' || !args[1]
      || (args.length === 4 && (args[2] !== '--port' || !/^\d+$/.test(args[3])))) {
    throw new Error('Usage: npm run gui -- --project DIR [--port N]');
  }
  gui = await startLocalGui({ projectDir: resolve(args[1]), port: args.length === 4 ? Number(args[3]) : 0 });
  process.stdout.write(JSON.stringify({ origin:gui.origin, mode:'offline-demo', providerCalls:0 })+'\n');
  await new Promise(resolve => { process.once('SIGINT',resolve);process.once('SIGTERM',resolve); });
} catch (e) {
  process.stderr.write('GUI_START_FAILED: '+(e.code ?? 'Check project path and command options')+'\n');
  process.exitCode = 1;
} finally { await gui?.close(); }
