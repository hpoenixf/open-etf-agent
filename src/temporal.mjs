// Task interpretation is not an execution deadline or a market/data cutoff.
const fail = code => { throw Object.assign(new Error(code), { code }); };
const keys = ['schemaVersion', 'anchorInstant', 'timeZone', 'taskDate', 'yesterday', 'tomorrow'];
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function dateInZone(instant, timeZone) {
 if (typeof timeZone !== 'string' || timeZone.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(timeZone)) fail('INVALID_TASK_TIME_ZONE');
 let formatter;
 try { formatter = new Intl.DateTimeFormat('en-US', { timeZone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' }); }
 catch { fail('INVALID_TASK_TIME_ZONE'); }
 const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
 return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
}
function day(date, offset) {
 const value = new Date(`${date}T12:00:00.000Z`); value.setUTCDate(value.getUTCDate() + offset);
 const result = value.toISOString().slice(0, 10);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) fail('INVALID_TASK_ANCHOR');
 return result;
}
export function createTaskTime({ anchorInstant = new Date().toISOString(), timeZone } = {}) {
 if (typeof anchorInstant !== 'string' || !instantPattern.test(anchorInstant) || !Number.isFinite(Date.parse(anchorInstant)) || new Date(anchorInstant).toISOString() !== anchorInstant || anchorInstant.slice(0,4) < '0002' || anchorInstant.slice(0,4) > '9998') fail('INVALID_TASK_ANCHOR');
 const taskDate = dateInZone(anchorInstant, timeZone);
 return Object.freeze({ schemaVersion: 'task-time@1', anchorInstant, timeZone, taskDate, yesterday: day(taskDate, -1), tomorrow: day(taskDate, 1) });
}
export function validateTaskTime(value) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail('INVALID_TASK_TIME');
 const expected = createTaskTime(value);
 if (keys.some(key => value[key] !== expected[key])) fail('INVALID_TASK_TIME');
 return value;
}
export function taskTimeMessage(value) {
 validateTaskTime(value);
 return { role: 'system', content: 'Task time (trusted, fixed at admission; not current execution time or evidence freshness): ' + JSON.stringify(value) + '\nInterpret today/yesterday/tomorrow against these calendar dates. Do not infer a market session, business day, data cutoff, or scheduled trigger.' };
}
export function projectTaskTime(messages, value) {
 if (!value) return structuredClone(messages);
 return [structuredClone(messages[0]), taskTimeMessage(value), ...structuredClone(messages.slice(1))];
}
