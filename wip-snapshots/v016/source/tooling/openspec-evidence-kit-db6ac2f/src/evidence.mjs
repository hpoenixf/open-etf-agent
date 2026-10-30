import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const generatedMarker = '<!-- spec-evidence:generated@1 -->';
const inside = (root, target) => {
  const part = relative(root, target);
  return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
};

/** Resolve only caller-selected local files; real paths cannot escape that root. */
function localPath(root, value) {
  const target = resolve(root, value);
  if (!inside(root, target)) throw new Error('path is outside the selected root');
  for (let cursor = target; cursor !== root; cursor = dirname(cursor)) {
    if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('selected files must not traverse symlinks');
  }
  let ancestor = target;
  while (!existsSync(ancestor)) {
    if (lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('unresolved symlink');
    ancestor = dirname(ancestor);
  }
  if (!inside(realpathSync(root), realpathSync(ancestor))) throw new Error('path resolves outside the selected root');
  return target;
}

function readLocal(root, value, optional = false) {
  const file = localPath(root, value);
  if (!existsSync(file) && optional) return '';
  if (!lstatSync(file, { throwIfNoEntry: false }) || !inside(realpathSync(root), realpathSync(file))) throw new Error('missing or unsafe local file');
  if (!lstatSync(realpathSync(file)).isFile()) throw new Error('expected a local file');
  return readFileSync(file, 'utf8');
}

export function parseTasks(text) {
  const tasks = [];
  const taskIssues = [];
  const body = text.replace(/```[^\n]*\n[\s\S]*?```/g, '');
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    const match = /^- \[([ xX])\] ([A-Za-z0-9]+\.\d+)\s+(\S.*)$/.exec(line.trimEnd());
    if (match) tasks.push({ id: match[2], checked: match[1].toLowerCase() === 'x', description: match[3] });
    else if (/^\s*(?:[-*+]|\d+[.)])\s+\[[^\]]*\]/.test(line)) taskIssues.push(`malformed task at line ${index + 1}: expected - [ ] 1.1 Description`);
  }
  return { tasks, taskIssues };
}

function section(text, heading) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line => line.trim() === `## ${heading}`);
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^#{1,2} /.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}

export function parseEvidence(text) {
  const observations = [];
  const issues = [];
  const body = section(text.replace(/```[^\n]*\n[\s\S]*?```/g, ''), 'Observation Log');
  for (const [index, line] of body.split('\n').entries()) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().split(/(?<!\\)\|/).slice(1, -1).map(cell => cell.replace(/\\\|/g, '|').replace(/`/g, '').trim());
    if (/^(?:date|日期)/i.test(cells[0] ?? '') || /^[-: ]+$/.test(cells[0] ?? '')) continue;
    if (cells.length !== 8 || cells.some(cell => !cell) || !/^EV-[A-Z0-9][A-Z0-9._:-]*(?:\s*[/,;]\s*EV-[A-Z0-9][A-Z0-9._:-]*)*$/i.test(cells[1] ?? '')) {
      issues.push(`Observation Log row ${index + 1}: expected eight nonempty cells and an Evidence ID`);
      continue;
    }
    const [datePhase, evidenceId, taskId, command, result, artifact, revision, origin] = cells;
    const match = /^(\d{4}-\d{2}-\d{2})\s+(RED|GREEN|CHECK|BASELINE|VERIFY)$/.exec(datePhase);
    if (!match || !Number.isFinite(Date.parse(match[1])) || new Date(match[1]).toISOString().slice(0, 10) !== match[1]) {
      issues.push(`Observation Log row ${index + 1}: invalid date or phase`);
      continue;
    }
    observations.push({ datePhase, phase: match[2], evidenceId, taskId, command, result, artifact, revision, origin });
  }
  return { observations, issues };
}

function load(options) {
  const root = realpathSync(resolve(options.root ?? '.'));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.change ?? '') || options.change === 'archive') throw new Error('invalid change name');
  const directory = localPath(root, join(options.changesDir ?? 'openspec/changes', options.change));
  if (!existsSync(directory) || !lstatSync(realpathSync(directory)).isDirectory()) throw new Error('unknown change directory');
  const tasksText = readLocal(root, join(directory, 'tasks.md'));
  const evidenceText = readLocal(root, join(directory, 'evidence.md'), true);
  return { root, directory, tasksText, evidenceText, ...parseTasks(tasksText), ...parseEvidence(evidenceText) };
}

function validate(data, stage) {
  const issues = [...data.taskIssues];
  if (!data.tasks.length) issues.push('no labeled tasks');
  for (const id of new Set(data.tasks.map(task => task.id))) {
    if (data.tasks.filter(task => task.id === id).length > 1) issues.push(`duplicate task ${id}`);
  }
  if (stage === 'plan') return issues;
  issues.push(...data.issues);
  for (const task of data.tasks) {
    if (!task.checked) {
      if (stage === 'verify') issues.push(`incomplete task ${task.id}`);
      continue;
    }
    const records = data.observations.filter(row => row.taskId === task.id && row.origin === 'observed-run'
      && !/<[^>]+>|pending|未采集/i.test([row.result, row.revision].join(' ')));
    const usable = records.filter(row => {
      try { return lstatSync(realpathSync(localPath(data.root, row.artifact))).isFile(); }
      catch { return false; }
    });
    const phases = task.description.includes('[check-only]') ? ['CHECK']
      : task.description.includes('[tests-after]') ? ['VERIFY']
      : task.description.includes('[baseline-green]') ? ['BASELINE', 'VERIFY'] : ['RED', 'GREEN'];
    let after = -1;
    for (const phase of phases) {
      const index = usable.findIndex((row, position) => position > after && row.phase === phase
        && (phase === 'RED' ? /^(?:failed|fail|失败)(?:\b|:|：|\s)/i : /^(?:passed|pass|通过)(?:\b|:|：|\s)/i).test(row.result));
      if (index < 0) { issues.push(`task ${task.id}: missing ordered ${phases.join('/')} observation with a local artifact`); break; }
      after = index;
    }
  }
  return issues;
}

function view(data, change) {
  const escape = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const digest = createHash('sha256').update(data.tasksText).update('\0').update(data.evidenceText).digest('hex');
  return ['# Verification', '', generatedMarker, `Input digest: sha256:${digest}`, '',
    `Generated view for ${change}. No tests were executed by this command.`,
    'Semantic quality: unverified. Release: not-claimed. Observation labels are authored records, not execution authentication.', '',
    '## Tasks', '', ...data.tasks.map(task => `- [${task.checked ? 'x' : ' '}] ${task.id} ${task.description}`), '',
    '## Observations', '', '| Task | Evidence | Date / phase | Command | Result | Artifact | Revision | Origin |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...data.observations.map(row => `| ${[row.taskId, row.evidenceId, row.datePhase, row.command, row.result, row.artifact, row.revision, row.origin].map(escape).join(' | ')} |`), '',
    '## Remaining Gates', '', 'Completion assessment and any live/release acceptance remain with the project owner.', ''
  ].join('\n');
}

export function lint(options) {
  const stage = options.stage ?? 'apply';
  if (!['plan', 'apply', 'verify'].includes(stage)) throw new Error('invalid stage');
  const data = load(options);
  const issues = validate(data, stage);
  if (stage === 'verify') {
    const prior = readLocal(data.root, join(data.directory, 'verify.md'), true);
    if (!prior) issues.push('missing verify.md');
    else if (prior.includes(generatedMarker) && prior !== view(data, options.change)) issues.push('stale generated verify.md');
  }
  return { change: options.change, stage, issues, structuralOnly: true, semanticQuality: 'unverified' };
}

export function verify(options) {
  const data = load(options);
  const issues = validate(data, 'verify');
  const target = localPath(data.root, join(data.directory, 'verify.md'));
  if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) issues.push('verify.md is a symlink');
  if (issues.length) return { status: 'refused', issues };
  const content = view(data, options.change);
  const prior = readLocal(data.root, target, true);
  if (options.check) return { status: prior === content || (prior && !prior.includes(generatedMarker)) ? 'current' : 'stale', generated: prior.includes(generatedMarker), rerun: false };
  if (prior && !prior.includes(generatedMarker)) return { status: 'refused', issues: ['handwritten verify.md preserved'] };
  if (prior === content) return { status: 'unchanged', rerun: false };
  const temporary = mkdtempSync(join(data.directory, '.verify-'));
  try {
    const file = join(temporary, 'verify.md');
    writeFileSync(file, content);
    renameSync(file, target);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  return { status: 'written', rerun: false };
}

export function status(options) {
  const data = load(options);
  const result = { change: options.change, tasks: { total: data.tasks.length, completed: data.tasks.filter(task => task.checked).length },
    completion: 'not-recorded', issues: validate(data, 'plan'), rerun: false, semanticQuality: 'unverified', release: 'not-claimed' };
  if (result.issues.length) return { ...result, completion: 'invalid-tasks' };
  const raw = readLocal(data.root, join(data.directory, 'completion.json'), true);
  if (!raw) return result;
  let record;
  try { record = JSON.parse(raw); } catch { return { ...result, completion: 'invalid-record', issues: ['completion.json is not valid JSON'] }; }
  const valid = record?.schemaVersion === 'spec-evidence-completion@1' && record.changeName === options.change
    && record.outcome === 'passed' && ['provider-free', 'diagnostic', 'formal'].includes(record.lane)
    && typeof record.revision === 'string' && record.revision.trim()
    && typeof record.observedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(record.observedAt) && Number.isFinite(Date.parse(record.observedAt))
    && Array.isArray(record.checks) && record.checks.length > 0
    && record.checks.every(check => typeof check?.name === 'string' && check.name.trim() && check.status === 'passed' && typeof check.artifact === 'string' && check.artifact.trim());
  if (!valid) return { ...result, completion: 'invalid-record', issues: ['invalid or unsuccessful completion record'] };
  if (!data.tasks.length || data.tasks.some(task => !task.checked)) return { ...result, completion: 'tasks-incomplete' };
  return { ...result, completion: 'recorded-complete', record };
}
