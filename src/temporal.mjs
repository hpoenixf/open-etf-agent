// Task interpretation is independent of execution deadlines and evidence freshness.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

const fail = code => { throw Object.assign(new Error(code), {code}); };
const utcInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sessionInstant = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const dayMs = 86400000;
const maxCoverageDays = 366;

function dateStamp(date) {
  return Date.parse(date + 'T00:00:00.000Z');
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = dateStamp(value);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

function dateFormatter(timeZone, code = 'INVALID_TASK_TIME_ZONE') {
  if (typeof timeZone !== 'string' || timeZone.length > 100 ||
      !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(timeZone)) fail(code);
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone, calendar: 'iso8601', numberingSystem: 'latn',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  } catch {
    fail(code);
  }
}

function dateInZone(instant, formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
}

function day(date, offset) {
  const result = new Date(dateStamp(date) + offset * dayMs).toISOString().slice(0, 10);
  if (!validDate(result)) fail('INVALID_TASK_ANCHOR');
  return result;
}

function calendarInstant(value, date, formatter) {
  if (typeof value !== 'string' || !sessionInstant.test(value) ||
      !validDate(value.slice(0, 10)) || value.endsWith('-00:00')) fail('INVALID_MARKET_CALENDAR');
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp) || dateInZone(stamp, formatter) !== date) fail('INVALID_MARKET_CALENDAR');
  const normalized = new Date(stamp).toISOString();
  if (!utcInstant.test(normalized)) fail('INVALID_MARKET_CALENDAR');
  return normalized;
}

function normalizeRows(rows, {from, through}, formatter) {
  if (!Array.isArray(rows) || rows.length > maxCoverageDays) fail('INVALID_MARKET_CALENDAR');
  const dates = new Set();
  const normalized = rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('INVALID_MARKET_CALENDAR');
    const {date, status} = row;
    if (!validDate(date) || date < from || date > through || dates.has(date)) fail('INVALID_MARKET_CALENDAR');
    dates.add(date);
    const fields = Object.keys(row).sort().join(',');
    if (status === 'closed' && fields === 'date,status') return {date, status};
    if (status !== 'open' || fields !== 'close,date,open,status') fail('INVALID_MARKET_CALENDAR');
    const open = calendarInstant(row.open, date, formatter);
    const close = calendarInstant(row.close, date, formatter);
    if (open >= close) fail('INVALID_MARKET_CALENDAR');
    return {date, status, open, close};
  });
  return normalized.sort((left, right) => left.date.localeCompare(right.date));
}

function resolveCalendar(anchor, input) {
  const missing = {
    schemaVersion: 'trading-calendar@1', venue: null, timeZone: null, venueDate: null,
    status: 'unknown', reason: 'calendar-not-supplied', phase: 'unknown',
    sessionDate: null, sessionOpen: null, sessionClose: null, source: null
  };
  if (input === null) return missing;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'coverage,revision,rows,schemaVersion,timeZone,venue') fail('INVALID_MARKET_CALENDAR');
  const {schemaVersion, venue, timeZone, revision, coverage} = input;
  if (schemaVersion !== 'venue-calendar-input@1' || typeof venue !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(venue) || typeof revision !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(revision) || !coverage ||
      Object.keys(coverage).sort().join(',') !== 'from,through') fail('INVALID_MARKET_CALENDAR');
  const {from, through} = coverage;
  if (!validDate(from) || !validDate(through) || from > through ||
      (dateStamp(through) - dateStamp(from)) / dayMs >= maxCoverageDays) fail('INVALID_MARKET_CALENDAR');

  const formatter = dateFormatter(timeZone, 'INVALID_MARKET_CALENDAR');
  const rows = normalizeRows(input.rows, {from, through}, formatter);
  const normalized = {schemaVersion, venue, timeZone, revision, coverage: {from, through}, rows};
  const source = {
    revision, coverage: normalized.coverage, input: normalized,
    digest: createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
  };
  const venueDate = dateInZone(anchor, formatter);
  const unknown = {...missing, venue, timeZone, venueDate, reason: 'coverage-outside-venue-date', source};
  if (venueDate < from || venueDate > through) return unknown;

  const byDate = new Map(rows.map(row => [row.date, row]));
  const today = byDate.get(venueDate);
  let phase = 'unknown';
  if (today?.status === 'closed') phase = 'closed';
  if (today?.status === 'open') phase = anchor < today.open ? 'before-open' : anchor < today.close ? 'open' : 'after-close';

  // A gap between the venue date and the newest completed session prevents a
  // definite answer. Earlier and future gaps cannot alter that answer.
  const first = dateStamp(from);
  for (let day = dateStamp(venueDate); day >= first; day -= dayMs) {
    const row = byDate.get(new Date(day).toISOString().slice(0, 10));
    if (!row) return {...unknown, phase, reason: 'coverage-gap'};
    if (row.status === 'open' && row.close <= anchor) {
      return {
        ...unknown, status: 'known', reason: null, phase,
        sessionDate: row.date, sessionOpen: row.open, sessionClose: row.close
      };
    }
  }
  return {...unknown, phase, reason: 'no-completed-session-in-coverage'};
}

export function createTaskTime({anchorInstant = new Date().toISOString(), timeZone, marketCalendar} = {}) {
  if (typeof anchorInstant !== 'string' || !utcInstant.test(anchorInstant) ||
      !Number.isFinite(Date.parse(anchorInstant)) || new Date(anchorInstant).toISOString() !== anchorInstant ||
      anchorInstant.slice(0, 4) < '0002' || anchorInstant.slice(0, 4) > '9998') fail('INVALID_TASK_ANCHOR');
  const taskDate = dateInZone(anchorInstant, dateFormatter(timeZone));
  return Object.freeze({
    schemaVersion: 'task-time@1', anchorInstant, timeZone, taskDate,
    yesterday: day(taskDate, -1), tomorrow: day(taskDate, 1),
    ...(marketCalendar === undefined ? {} : {tradingCalendar: resolveCalendar(anchorInstant, marketCalendar)})
  });
}

export function resolveTradingCalendar({anchorInstant, timeZone, marketCalendar = null} = {}) {
  return createTaskTime({anchorInstant, timeZone, marketCalendar});
}

export function taskTimeInput(value) {
  return {
    anchorInstant: value.anchorInstant, timeZone: value.timeZone,
    ...(Object.hasOwn(value, 'tradingCalendar') ? {marketCalendar: value.tradingCalendar?.source?.input ?? null} : {})
  };
}

export function validateTaskTime(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !isDeepStrictEqual(value, createTaskTime(taskTimeInput(value)))) fail('INVALID_TASK_TIME');
  return value;
}

export function taskTimeMessage(value) {
  validateTaskTime(value);
  if (!value.tradingCalendar) {
    // Keep the bytes used to authenticate existing durable working checkpoints.
    return {role: 'system', content: 'Task time (trusted, fixed at admission; not current execution time or evidence freshness): ' + JSON.stringify(value) + '\nInterpret today/yesterday/tomorrow against these calendar dates. Do not infer a market session, business day, data cutoff, or scheduled trigger.'};
  }
  const {schemaVersion, anchorInstant, timeZone, taskDate, yesterday, tomorrow, tradingCalendar} = value;
  const {venue, timeZone: venueTimeZone, venueDate, status, reason, phase, sessionDate, sessionOpen, sessionClose, source} = tradingCalendar;
  const provenance = source ? {revision: source.revision, digest: source.digest, coverage: {from: source.coverage.from, through: source.coverage.through}} : null;
  const summary = {
    taskTime: {schemaVersion, anchorInstant, timeZone, taskDate, yesterday, tomorrow},
    tradingCalendar: {venue, timeZone: venueTimeZone, venueDate, status, reason, phase, sessionDate, sessionOpen, sessionClose, source: provenance}
  };
  return {
    role: 'system',
    content: 'Task time and caller-supplied venue calendar (fixed at admission; not current execution time or evidence freshness): ' +
      JSON.stringify(summary) + '\nInterpret today/yesterday/tomorrow against task-local dates. Use the resolved venue session for the latest completed trading day. If the session is unknown, say so. Do not infer sessions, weekends, holidays, or hours.'
  };
}

export function projectTaskTime(messages, value) {
  if (!value) return structuredClone(messages);
  return [structuredClone(messages[0]), taskTimeMessage(value), ...structuredClone(messages.slice(1))];
}
