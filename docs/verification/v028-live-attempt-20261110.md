# v0.28 new ten-task attempt: stopped, not qualified

A newly authorized ten-task Review cohort used the unchanged executable candidate `fa4c77c90fee514d13af68db86d3f01d76d0e2d0`. The earlier offline evidence remains separate. The new task identities and complete synthetic input packets were frozen before execution, including separate source A/B identities and the actual [2] citation for R09. The exact stage SHA-256 is `ff1a629fe925789aa28bea80bc2d642b4ab0d92d7645183c61875d05be01cd43`.

## Original denominator and result

R01 ended failed/TIMEOUT with unknown Gateway settlement and one original model-request debit. R02–R10 were not run. Qualifying completion is **0/10**, not a model semantic score. There is no complete original model answer to assess; zero accepted findings is not a clean review. Shared stop and the original unknown Admission occupancy remain retained; no retry, replacement, budget refund or remote termination is claimed.

## Timeline and attribution

The original Session timeout is 60,000 ms, with deadline 15:01:00.905 UTC. Subtracting the timeout gives a budget-window start of 15:00:00.905. This is a derived timestamp, not a separately observed network invocation.

A durable pre-fetch intent was recorded at 15:00:47.498, 46.593 seconds into that window, leaving 13.407 seconds. Unknown was recorded at 15:01:00.910, 13.412 seconds after intent and 5 ms after deadline. These facts establish local deadline exhaustion. They do not establish how much of the first interval was queueing, nor how much of the second was network or model execution: separate queue-entry/admission/fetch-invocation timestamps were not recorded.

The original safe runner summary incorrectly called intent existence `providerDispatchObserved: true`. Its immutable record is retained, with an appended correction: **intent observed; actual fetch/provider receipt, completion and billing unknown**. Neither true dispatch nor non-dispatch can be concluded. The earlier pending semantic-assessment label is also superseded by unavailable-no-model-output. The runner preserved the original result and reported equal independent-process cold readback; an independent reviewer separately checked the original Session state and timestamps.

## Earlier protocol stop retained

Before this v0.28 task started, a separate shared request received HTTP 400 for missing session metadata and stopped both workflows. v0.28 had zero submitted Sessions and zero intents at that point. After checking the documented service requirement, the transport was amended only to include a stable identifier derived from its real root Run and an honest application User-Agent. The endpoint, model and request body were unchanged. The old stop/error and unknown billing record were archived, not erased. The later R01 timeout is a separate retained outcome.

## Remaining work

No release or useful-reviewer qualification follows from this attempt. Original unknown capacity must be handled through its existing owner and applicable policy, never bypassed with a new pool or route. Future scheduling should arrange exclusive access before starting a bounded task; the current R01 deadline and identity must not be rewritten. Any later authorized work requires a distinct prospective plan and honest accounting, with all original evidence preserved. No credentials, raw model traffic, database or private environment configuration is published here.
