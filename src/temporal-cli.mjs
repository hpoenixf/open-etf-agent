import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { temporalDemo } from './temporal-demo.mjs';
import { createTaskTime } from './temporal.mjs';
const fail = code => { throw Object.assign(new Error(code), { code }); };
async function readCalendar(path) {
 let fd;
 try { fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
 catch (error) { if (['ELOOP', 'ENXIO', 'EISDIR'].includes(error.code)) fail('INVALID_MARKET_CALENDAR'); throw error; }
 try {
  const stat = await fd.stat(); if (!stat.isFile() || stat.size > 262144) fail('INVALID_MARKET_CALENDAR');
  const bytes = Buffer.alloc(262145); let offset = 0;
  while (offset < bytes.length) { const { bytesRead } = await fd.read(bytes, offset, bytes.length - offset, offset); if (!bytesRead) break; offset += bytesRead; }
  if (offset > 262144) fail('INVALID_MARKET_CALENDAR');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset)));
 } catch { fail('INVALID_MARKET_CALENDAR'); } finally { await fd.close(); }
}
async function main(args) {
 const [operation, ...rest] = args, options = {};
 if (!['submit', 'work', 'read'].includes(operation)) fail('INVALID_ARGUMENT');
 for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i], value = rest[i + 1];
  if (!['--session', '--run', '--time-zone', '--anchor', '--calendar'].includes(key) || Object.hasOwn(options, key) || !value || value.startsWith('--') || value.includes('\0')) fail('INVALID_ARGUMENT');
  options[key] = value;
 }
 if (!options['--session'] || options['--session'].length > 4096 || !/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(options['--run'] || '')) fail('INVALID_ARGUMENT');
 if (operation === 'submit' ? !options['--time-zone'] : options['--time-zone'] !== undefined || options['--anchor'] !== undefined || options['--calendar'] !== undefined) fail('INVALID_ARGUMENT');
 const directory = resolve(options['--session']);
 let taskTime;
 if (operation === 'submit') {
  taskTime = { timeZone: options['--time-zone'], ...(options['--anchor'] ? { anchorInstant: options['--anchor'] } : {}) };
  if (options['--calendar']) {
   taskTime.marketCalendar = await readCalendar(resolve(options['--calendar']));
  }
  createTaskTime(taskTime); // Reject bad input before creating storage; Runtime owns sampling/persistence.
 } else {
  let stat; try { stat = await lstat(join(directory, 'session.sqlite')); } catch (e) { if (['ENOENT', 'ENOTDIR'].includes(e.code)) fail('SESSION_NOT_FOUND'); throw e; }
  if (!stat.isFile() || stat.isSymbolicLink()) fail('UNSAFE_SESSION_FILE');
 }
 const controller = new AbortController(), stop = () => controller.abort();
 process.on('SIGINT', stop); process.on('SIGTERM', stop);
 try {
  const value = await temporalDemo({ directory, runId: options['--run'], operation, taskTime, signal: controller.signal });
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  if (operation === 'work' && (value.workerStatus !== 'settled' || value.run.status !== 'completed')) process.exitCode = 1;
 } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop); }
}
try { await main(process.argv.slice(2)); } catch (e) { process.stderr.write((e.code || 'TEMPORAL_COMMAND_FAILED') + '\n'); process.exitCode = 2; }
