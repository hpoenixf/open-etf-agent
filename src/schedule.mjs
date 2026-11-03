import { createHash } from 'node:crypto';
import { createTaskTime } from './temporal.mjs';
import { PUBLICATION_BINDING } from './publication.mjs';

export const SCHEDULE_PROFILE = 'schedule-occurrence@1';
const fail = code => { throw Object.assign(new Error(code), { code }); };
export const scheduleCanonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash('sha256').update(scheduleCanonical(value)).digest('hex');
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(value) && !value.includes('://');
function fields(value, keys) {
 if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail('INVALID_SCHEDULE');
}
export function validateSchedule(value) {
 fields(value, ['scheduleId', 'definitionRevision', 'scheduledInstant', 'timeZone', 'maxLatenessMs']);
 if (typeof value.scheduledInstant !== 'string' || typeof value.timeZone !== 'string' || !identifier(value.scheduleId) || !Number.isSafeInteger(value.definitionRevision) || value.definitionRevision < 1 || !Number.isSafeInteger(value.maxLatenessMs) || value.maxLatenessMs < 1) fail('INVALID_SCHEDULE');
 createTaskTime({ anchorInstant: value.scheduledInstant, timeZone: value.timeZone });
 return structuredClone(value);
}
export function scheduleRunId(value) {
 const { scheduleId, definitionRevision, scheduledInstant } = validateSchedule(value);
 return 'schedule-' + hash({ scheduleId, definitionRevision, scheduledInstant });
}
export function validateScheduleReference(value) {
 fields(value, ['schemaVersion', 'scheduleId', 'confirmationHash']);
 if (value.schemaVersion !== SCHEDULE_PROFILE || !identifier(value.scheduleId) || typeof value.confirmationHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.confirmationHash)) fail('INVALID_SCHEDULE_REFERENCE');
 return structuredClone(value);
}
// A confirmed envelope is an original Runtime definition + initial checkpoint,
// not a second executor's job format. Session also applies its original codecs.
export function prepareSchedule(schedule, definition, snapshot) {
 validateSchedule(schedule);
 const anchor = Date.parse(schedule.scheduledInstant);
 if (schedule.maxLatenessMs >= definition.limits.timeoutMs || definition.deadlineAt !== anchor + definition.limits.timeoutMs || !Number.isSafeInteger(definition.deadlineAt)) fail('INVALID_SCHEDULE_WINDOW');
 const config = definition.config;
 if (scheduleCanonical(config.taskTime) !== scheduleCanonical(createTaskTime({ anchorInstant: schedule.scheduledInstant, timeZone: schedule.timeZone })) || config.requireReport !== true || config.publication !== 'publication@1' || config.workingInput !== undefined || config.ordinaryResponse !== undefined || config.documentProtection !== undefined || scheduleCanonical(config.allowedTools) !== scheduleCanonical(['read_page', 'save_report']) || scheduleCanonical(config.allowedDocuments) !== scheduleCanonical(['atlas-a', 'atlas-b']) || definition.bindings.plugins.length || definition.bindings.adapters.length !== 2 || !definition.bindings.adapters.some(item => scheduleCanonical(item) === scheduleCanonical(PUBLICATION_BINDING)) || !definition.bindings.adapters.some(item => item.id === 'schedule-public-synthetic' && item.version === '1' && /^[a-f0-9]{64}$/.test(item.contentSha256))) fail('SCHEDULE_SCOPE_UNSUPPORTED');
 if (snapshot.phase !== 'ready' || snapshot.rounds !== 0 || snapshot.toolsDispatched !== 0 || snapshot.messages.length !== 1 || snapshot.usedIds.length || snapshot.unknownEffects.length || snapshot.partialEffects.length || snapshot.host !== null || snapshot.working !== null || snapshot.proposal !== null || snapshot.result !== null) fail('INVALID_SCHEDULE_CHECKPOINT');
 const envelope = { schemaVersion: SCHEDULE_PROFILE, schedule: structuredClone(schedule), definition: structuredClone(definition), snapshot: structuredClone(snapshot) };
 return { envelope, reference: { schemaVersion: SCHEDULE_PROFILE, scheduleId: schedule.scheduleId, confirmationHash: hash(envelope) }, runId: scheduleRunId(schedule) };
}
