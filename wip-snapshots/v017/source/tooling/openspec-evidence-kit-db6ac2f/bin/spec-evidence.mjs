#!/usr/bin/env node
import { lint, status, verify } from '../src/evidence.mjs';

const help = `spec-evidence <lint|verify|status> --change <name> [options]

  --root <directory>        Selected project root (default: current directory)
  --changes-dir <relative>  Change directory (default: openspec/changes)
  --stage <plan|apply|verify>  Lint stage (default: apply)
  --check                   Inspect verification drift without writing
  --help                    Show this help

All commands return JSON. Exit 0: requested check passed; 1: diagnostic/error.
Checks are structural. No model, test runner, database or network is invoked.
`;

try {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) { console.log(help); }
  else {
    const command = args.shift();
    if (!['lint', 'verify', 'status'].includes(command)) throw new Error('unknown command');
    const options = {};
    const names = { '--root': 'root', '--change': 'change', '--changes-dir': 'changesDir', '--stage': 'stage' };
    for (let index = 0; index < args.length; index++) {
      const key = args[index];
      const name = key === '--check' ? 'check' : Object.hasOwn(names, key) ? names[key] : undefined;
      if (!name || Object.hasOwn(options, name)) throw new Error(`unknown or duplicate option: ${key}`);
      if (key === '--check') options.check = true;
      else {
        const value = args[++index];
        if (!value || value.startsWith('--')) throw new Error(`missing value: ${key}`);
        options[name] = value;
      }
    }
    if (options.check && command !== 'verify') throw new Error('--check applies to verify only');
    if (options.stage && command !== 'lint') throw new Error('--stage applies to lint only');
    const result = ({ lint, verify, status })[command](options);
    console.log(JSON.stringify(result, null, 2));
    if (result.issues?.length || ['refused', 'stale'].includes(result.status)) process.exitCode = 1;
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
