# v0.12 Temporal: one fixed task interpretation

## Scope and ownership

Temporal is the next independently delivered module (the former roadmap 1.2 candidate). Python remains unnumbered and deferred: the available environment did not execute its isolation probe successfully. No Python adapter or mock-only release is included.

`temporal.mjs` owns strict task-time construction/validation and the trusted message. Session owns persistence in the existing immutable Run definition (`config.taskTime`); Runtime owns first admission, reuse and Context projection. The existing Gateway encodes the original message and the existing Tool Host saves the report. No new time database, Scheduler, execution lifecycle or platform.

## Contract

- Opt in with `taskTime: {timeZone, anchorInstant?}`. Time zone is explicit, accepted by Node's IANA/UTC formatter; no host-zone default or user-text inference. A supplied instant must be exact `YYYY-MM-DDTHH:mm:ss.sssZ`, a real UTC instant, year 0002–9998. Local ambiguous/nonexistent wall times and offset inputs are rejected, not guessed.
- Omitted instant is sampled once for the winning admission. Persist `task-time@1`, original UTC instant, explicit zone, local `taskDate`, calendar `yesterday` and `tomorrow`. Calendar neighbors are not +/-24 hours in a zone and are not trading days.
- Repeated admission with omitted instant adopts the original; conflicting explicit time/zone fails before a model request. Resume may omit taskTime and always uses the saved definition. Legacy definitions remain unchanged; adding an anchor to an existing legacy Run is rejected.
- Original user text stays unchanged. Every temporal working view has the trusted message immediately after it, before ordinary history. Existing Context budgeting and Compaction must retain it or fail; checkpoint restore verifies it even when a forged working hash is internally consistent.
- Execution deadline, root budget and lease remain their existing independent clocks. A historical task anchor does not extend deadline or make source data fresh. Different host TZ and process restart cannot replace the admitted task dates. A timezone-data upgrade that disagrees with stored derivation is rejected explicitly (`INVALID_TASK_TIME`), not silently rewritten; broad cross-runtime tzdata migration is not supported.
- CLI fixture submit/work/read is an offline mechanism demonstration, not live model quality, market-calendar knowledge, arbitrary natural-language date parsing or a current-data claim. Work retains the existing 300-second admission deadline; read verifies completed results without another model invocation.

## Code and article qualification

Code delivery uses build, full Runtime suite, an independently installed CLI and original-byte report readback. Article source/receipt/backlink checks stay strict and unchanged, but run in a separate dispatchable `Article verification` workflow. The fixed article table is historical evidence, not current-code qualification. Temporal article synchronization is tracked independently and cannot hold up correct code delivery.

## Verification targets

`test/temporal.test.mjs`: opposing-zone calendar dates, spring gap/fall fold instants, leap/year boundaries, bad zone/instant, immutable repeat/resume, legacy refusal, real Gateway encoding with injected local transport (zero HTTP/model calls), context bound refusal, checkpoint tampering, actual SIGKILL/second-process recovery.

`test/temporal-cli.test.mjs`: distinct submission/execution/read processes under different host TZ, original report SHA-256 and repeated no-replay read/work, invalid-input no-storage effects.
