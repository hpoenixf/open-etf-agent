# Proposed scope amendment — 2026-10-27

## Accepted lineage correction — 2026-10-27 04:24 UTC

This subsection supersedes the implementation choices below, not their historical status. Review of the original ETF Agent Publication owner found that the expanded candidate used a new identity per revision and an append-only delivery event, which were not the original contract. This version is now a controlled text-only adaptation of the original owner, not publication of private source files or a full equivalent of the private system.

Retain one Host-assigned stable block per root Run, a stable delivery ordinal, explicit replacement CAS, exact body AND protected-binding no-op returning the original receipt, and independent durable commit before Run terminal. Later failure/cancellation must preserve an earlier committed body. Body version and current delivery slot change in one SQLite transaction. A revision audit is not a new appended answer event.

The closed loop is local input → preparation → durable commit → selected-Run/revision readback, with explicit bounded replacement and fresh-process receipt confirmation. Same Runtime integration publishes the sealed final body before terminal bookkeeping; its existing report requirement can still fail without erasing that body. No special atomic finish+publication convenience is needed.

No new packages, configuration platform, Worker, queue, browser, HTTP/SSE, global History or source/ACL service. The initial public payload is plain Markdown only; immutable Artifact reports remain independently owned and readable through v0.7 APIs, not reclassified as Publication receipts. Private citations, numeric handles, optional review and multiple blocks are not transplanted. Existing public capacity stays unchanged. Current root/grant isolation is not multi-account authentication.

Original failure cases are adapted to new synthetic tests, not counted as public validation. The prior expanded 298 cases and its browser blocker retain their original meaning. The superseded pre-lineage draft is recoverable in the engineering checkpoint inventory. The source/contract adaptation and exclusions are recorded separately from private local trace material.

## Earlier 2026-10-27 scope draft (historical; superseded where different)

Status: confirmed by the coordinating owner on 2026-10-27. The selected v0.7 base and expanded WIP archive are retained; exact whitelist extraction is recorded in the engineering checkpoint inventory. Publication-only qualification must be executed on this new combination.

The prior `v08-web-publication-worker` candidate reached 298 provider-free tests and independent real-process/HTTP/SSE delivery. Actual browser acceptance remained blocked. Those original contracts, observations and failures stay historical and unchecked where incomplete. This amendment does not retroactively pass them or rename synthetic client-state tests as browser tests.

The development policy now favors one real module per version, slower qualification, and CLI/API-first evidence. Preserve all original candidate source in a recoverable safe WIP checkpoint, then extract a smaller candidate after confirmation.

## Proposed v0.8: Publication only

Publication owns a bounded versioned Markdown body and immutable Artifact receipt references. It prepares and verifies references asynchronously through the existing Artifact owner, then commits a body revision and a typed `publication-committed` event in the same short SQLite transaction. Active Run fence/lease, revision CAS, idempotency and cancellation remain mandatory. The existing Runtime may atomically finish with a prepared Publication; no alternate execution loop.

Only the minimum Session adaptation belongs here: two Publication-owned tables, selected-Run publication/event reads and existing claim finalization. The queue/jobs, Research/Direct scheduling, public Run lifecycle projections, global History and continuation relations do not belong to this version. A persisted event is the atomic publication fact, not a network event stream.

Expose a local synthetic CLI demonstration and selected-Run inspect/read commands. Do not start an HTTP listener or browser; do not create credentials. No historical active-schema migration, semantic evaluation, external exactly-once, model call or formal release is implied.

The already-claimed Runtime entry existed for queue admission and need not enter this reduced version. The bounded asynchronous preparation plus atomic `claim.finish` path is the necessary Publication integration. Existing v0.7 functionality must retain its actual regression coverage.

## Proposed later modules, not promises or completed work

- v0.9: independent Research Worker and its indispensable durable queue, via CLI. Actual parent exit, lease/fence, crash recovery and graceful stop evidence.
- v0.10: read-only Publication HTTP/SSE transport. Stable cursor replay, selected immutable source/attachment reads, actual network tests; no browser application.
- A later optional Web Chat / interactive History version only when real browser acceptance is available.
- PDF and Python, if retained on the roadmap, each receive a separate future module/version rather than being bundled to meet a numerical deadline.
- v1.0 is the stable qualification of the modules actually shipped, not a basket into which all remaining features must be forced.

## Safe transition

No `git reset`, `git clean`, broad delete or loss of WIP history. After confirmation, compare the qualified pre-v0.8 checkpoint against the final large-candidate inventory, select the minimal Publication files and necessary edits, and retain excluded code in the WIP archive. Requalify the extracted source; the old 298-test result cannot automatically certify a different tree. Main remains the previously published stable v0.7 until the new smaller candidate is independently qualified and published by the sole remote publisher.
