import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile, spawnSync} from 'node:child_process';
import {lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const past = '2000-11-25T09:00:00+08:00';
const future = '2099-11-26T09:00:00+08:00';
const cliArgs = (store, command, args) => ['src/research-cli.mjs', 'reminder', command, '--store', store, ...args];
const options = {encoding: 'utf8', timeout: 15000};

async function fixture(t) {
  await mkdir('test-output', {recursive: true});
  const root = await mkdtemp(resolve('test-output/a15-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}

function local(store) {
  const run = (command, ...args) => spawnSync(process.execPath, cliArgs(store, command, args), options);
  const json = (command, ...args) => {
    const result = run(command, ...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const reject = (code, command, ...args) => {
    const result = run(command, ...args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stderr.trim().split('\n').at(-1)).error, code);
  };
  return {json, reject};
}

test('A15 adds, lists, displays, defers and acknowledges across new CLI processes', async t => {
  const root = await fixture(t);
  const store = join(root, 'reminders');
  const progress = join(root, 'daily-progress.json');
  await writeFile(progress, '{"state":"unchanged"}');
  const {json, reject} = local(store);
  assert.deepEqual(json('due'), {items: []});
  await assert.rejects(lstat(store), {code: 'ENOENT'});

  const first = json('add', '--text', 'Recheck the synthetic disclosure', '--due', past, '--reference', 'fixture:report-1');
  assert.equal(first.due, '2000-11-25T01:00:00.000Z');
  assert.equal(first.reference, 'fixture:report-1');
  assert.equal(first.state, 'pending');
  assert.deepEqual(json('due'), {items: [first]});
  assert.deepEqual(json('due'), {items: [first]}, 'repeated reads do not record display');
  assert.deepEqual(json('list'), {items: [first]});

  const identity = ['--id', first.id, '--occurrence', String(first.occurrence)];
  const displayed = json('mark-shown', ...identity);
  assert.equal(displayed.state, 'displayed');
  assert.deepEqual(json('mark-shown', ...identity), displayed);
  assert.deepEqual(json('due'), {items: [displayed]});

  const pending = json('defer', ...identity, '--due', future);
  assert.equal(pending.occurrence, first.occurrence + 1);
  assert.equal(pending.state, 'pending');
  assert.deepEqual(json('due'), {items: []});
  reject('REMINDER_STALE_OCCURRENCE', 'mark-shown', ...identity);
  reject('REMINDER_STALE_OCCURRENCE', 'acknowledge', ...identity);
  const deferred = ['--id', first.id, '--occurrence', String(pending.occurrence)];
  reject('REMINDER_NOT_DUE', 'mark-shown', ...deferred);
  reject('REMINDER_DUE_NOT_LATER', 'defer', ...deferred, '--due', past);

  const acknowledged = json('acknowledge', ...deferred);
  assert.equal(acknowledged.state, 'acknowledged');
  assert.deepEqual(json('acknowledge', ...deferred), acknowledged);
  reject('REMINDER_ALREADY_ACKNOWLEDGED', 'defer', ...deferred, '--due', '2099-12-01T09:00:00Z');
  assert.deepEqual(json('list'), {items: [acknowledged]});
  assert.deepEqual(json('due'), {items: []});
  assert.equal(await readFile(progress, 'utf8'), '{"state":"unchanged"}');
  assert.deepEqual((await readdir(root)).sort(), ['daily-progress.json', 'reminders']);
});

test('A15 rejects invalid and ambiguous inputs without creating local state', async t => {
  const root = await fixture(t);
  const store = join(root, 'reminders');
  const {reject} = local(store);
  for (const due of ['2026-02-30T09:00:00Z', '2026-01-01T09:00:00', '2026-01-01T24:00:00Z', '2026-01-01T09:00:00-00:00']) {
    reject('REMINDER_INVALID_INSTANT', 'add', '--text', 'Synthetic follow-up', '--due', due);
  }
  reject('CLI_UNKNOWN_OPTION', 'due', '--unexpected', 'input');
  await assert.rejects(lstat(store), {code: 'ENOENT'});
});

test('A15 concurrent CLI additions survive and linked storage is refused', async t => {
  const root = await fixture(t);
  const store = join(root, 'reminders');
  const created = await Promise.all(['One', 'Two', 'Three'].map(async text => {
    const {stdout} = await exec(process.execPath, cliArgs(store, 'add', ['--text', text, '--due', past]), options);
    return JSON.parse(stdout);
  }));
  const ids = local(store).json('list').items.map(item => item.id).sort();
  assert.deepEqual(ids, created.map(item => item.id).sort());

  const linkedStore = join(root, 'linked');
  await mkdir(linkedStore);
  await symlink(join(store, 'action-reminders.sqlite'), join(linkedStore, 'action-reminders.sqlite'));
  local(linkedStore).reject('REMINDER_UNSAFE_STORE', 'list');
});
