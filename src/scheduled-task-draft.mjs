// A draft is pure input to owner confirmation, never a job or an email grant.
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MAX_DELAY = 365 * DAY;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const timeZoneFor = input => {
  if (typeof input !== 'string' || !/^[A-Za-z][A-Za-z_+/0-9-]{0,79}$/.test(input)) fail('SCHEDULE_DRAFT_TIME_ZONE');
  try { return new Intl.DateTimeFormat('en-US', { timeZone: input }).resolvedOptions().timeZone; }
  catch { fail('SCHEDULE_DRAFT_TIME_ZONE'); }
};
const duration = value => {
  if (!exact(value, ['amount', 'unit']) || !['minutes', 'hours', 'days'].includes(value.unit) ||
      !Number.isSafeInteger(value.amount) || value.amount < 1) fail('SCHEDULE_DRAFT_DURATION');
  const ms = value.amount * ({ minutes: MINUTE, hours: 60 * MINUTE, days: DAY }[value.unit]);
  if (!Number.isSafeInteger(ms) || ms > MAX_DELAY) fail('SCHEDULE_DRAFT_DURATION');
  return ms;
};
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail('SCHEDULE_DRAFT_INSTANT');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) fail('SCHEDULE_DRAFT_INSTANT');
  return ms;
}
export function validateScheduledTaskDraft(draft) {
  if (!exact(draft, ['question', 'start', 'repeat', 'timeZone', 'emailEnabled']) ||
      typeof draft.question !== 'string' || !draft.question.trim() || draft.question.includes('\0') ||
      Buffer.byteLength(draft.question) > 12_000 || Buffer.from(draft.question).toString('utf8') !== draft.question ||
      typeof draft.emailEnabled !== 'boolean') fail('SCHEDULE_DRAFT_INVALID');
  if (exact(draft.start, ['kind', 'after']) && draft.start.kind === 'delay') duration(draft.start.after);
  else if (exact(draft.start, ['kind', 'at']) && draft.start.kind === 'instant') instant(draft.start.at);
  else fail('SCHEDULE_DRAFT_START');
  if (draft.repeat !== null) duration(draft.repeat);
  return { question: draft.question.trim(), start: structuredClone(draft.start),
    repeat: structuredClone(draft.repeat), timeZone: timeZoneFor(draft.timeZone), emailEnabled: draft.emailEnabled };
}

// Recognize a narrow, unambiguous conversational form. Anything else stays in
// conversation, with no scheduler state change and no inferred mail permission.
export function draftScheduledTaskFromConversation(text, timeZone = 'Asia/Shanghai') {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 12_000) return null;
  const input = text.trim();
  const zh = /^(?:请)?(?:在)?(\d{1,3})\s*(分钟|小时|天)\s*后\s*(?:提醒我|帮我|执行|运行)[:：\s]*(.+)$/su.exec(input);
  const en = /^\s*(?:in\s+(\d{1,3})\s+(minutes?|hours?|days?),?\s+)(?:remind me to|run|execute)\s+(.+)$/isu.exec(input);
  const repeatZh = /^(?:请)?每隔\s*(\d{1,3})\s*(分钟|小时|天)\s*(?:提醒我|帮我|执行|运行)[:：\s]*(.+)$/su.exec(input);
  const repeatEn = /^every\s+(\d{1,3})\s+(minutes?|hours?|days?),?\s+(?:remind me to|run|execute)\s+(.+)$/isu.exec(input);
  const match = zh ?? en ?? repeatZh ?? repeatEn;
  if (!match) return null;
  const unitWord = match[2].toLowerCase();
  const unit = ({ '分钟': 'minutes', '小时': 'hours', '天': 'days' })[unitWord] ??
    (unitWord.endsWith('s') ? unitWord : unitWord + 's');
  const after = { amount: Number(match[1]), unit };
  try {
    return validateScheduledTaskDraft({ question: match[3], start: { kind: 'delay', after },
      repeat: repeatZh || repeatEn ? after : null, timeZone, emailEnabled: false });
  } catch (error) {
    if (error.code?.startsWith('SCHEDULE_DRAFT_')) return null;
    throw error;
  }
}

export function confirmScheduledTaskDraft(draft, { confirm, confirmedAtMs, emailAvailable = false } = {}) {
  if (confirm !== true) fail('SCHEDULE_EXPLICIT_CONFIRMATION_REQUIRED');
  if (!Number.isSafeInteger(confirmedAtMs) || confirmedAtMs < 0 || confirmedAtMs > 8.64e15 - MAX_DELAY) fail('SCHEDULE_CONFIRMATION_TIME');
  const approved = validateScheduledTaskDraft(draft);
  if (approved.emailEnabled && emailAvailable !== true) fail('SCHEDULE_EMAIL_NOT_CONFIGURED');
  const first = approved.start.kind === 'delay'
    ? confirmedAtMs + duration(approved.start.after) : instant(approved.start.at);
  if (first <= confirmedAtMs || first > confirmedAtMs + MAX_DELAY) fail('SCHEDULE_START_OUTSIDE_WINDOW');
  return { question: approved.question, timeZone: approved.timeZone,
    firstScheduledAt: new Date(first).toISOString(), repeatEveryMs: approved.repeat === null ? null : duration(approved.repeat),
    emailEnabled: approved.emailEnabled };
}
