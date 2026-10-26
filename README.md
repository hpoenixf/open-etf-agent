# Open ETF Agent — v0.5 offline candidate

v0.5 adds derived working notes and an explicitly selected Memory library. Original-source truth, preferences, derived notes and execution observations remain separate. Live validation is prepared but blocked on the exact reviewed configuration and this public project’s provider/data/cost grant.

An independently runnable local stage, not a release. The inherited v0.4 ResultStore, bounded Context projection, exact reread and scoped lexical retrieval remain available without enabling Memory or compaction. Earlier phase branches stay frozen; v0.2 has a separate maintenance patch preserving its old evidence. Provider/data/cost authorization, live/model-child semantics, project license and public publication remain open gates.

## Run

Node 26.11.1–26.x. Installation scripts are unnecessary; the official SDK dependency closure remains locked:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
npm run demo -- --case skill-mcp
npm run demo -- --case batch-read
npm run demo -- --case fixture-child
npm run demo -- --case retrieve-reread --query "offline editing"
npm run demo -- --case retrieve-reread --query "Markdown"
npm run demo -- --case compact-and-reread
npm run demo -- --case explicit-memory --memory-library runs/selected-synthetic-library
node src/cli.mjs --observe runs/<run-id>
```

Cached `npm ci --offline --ignore-scripts --no-audit --no-fund` works. Installation may access the registry; demos run offline after installation. The native-ESM build copies all source/fixtures and runs as `node dist/src/cli.mjs`. `--live` and `--case model-child` remain blocked before Run creation; a scripted fixture-child is not independent live model reasoning.

## v0.5 additions

- **Derived notes, not sources:** complete older successful groups can become a persisted `note:sha256:…` record after a bounded summary call, shared root reservation, exact basis/Memory-revision checks and actual net-byte reduction. Question/latest group and permission/failure facts remain. `read_note` is enabled only with explicit compaction; `read_result` still returns immutable original bytes. Projection-only call/result pairs are labeled `projectionOnly`, `status: projected`, `dispatched: false`, not fictitious tool executions.
- **Explicit Memory:** only `--case explicit-memory --memory-library PATH` opens the demonstrated library. Save/revise/forget require operator-bound, content/revision/library-scoped intents outside model arguments. A one-use intent is durably reserved before mutation. Partial consumption/publication facts reach Runtime output/logs without exposing arbitrary paths or text. A failed write is not silently retried.
- **Forget is a future-input boundary:** current recall hides a tombstone; typed old entries/search results, settled write arguments (including Hook copies) and dependent note text are removed from subsequent Gateway input. Historical revisions, execution history and existing reports remain intact. This is not general phrase erasure or anonymization.
- **Honest demonstrations:** the Memory case uses explicit original synthetic intents and three Runs, returning actual save/revise/forget receipts and a source-cited report. It does not record a real user's permanent preferences. The compaction case uses a scripted summarizer, persisted notes and actual original reread, not evidence of live summary quality or model adoption.
- **No silent scope expansion:** no global Memory path, vector store, automatic learning, database, scheduler or recovery manager. A local writer lock is not stolen; missing/corrupt state fails closed. Sensitive-pattern refusal is narrow defense in depth, not a comprehensive classifier.

## Retained v0.4 foundation

- **One original-source owner:** Host's source Map is removed. ResultStore owns immutable source records, typed calculation records and `content-index.json`. The index is a content lookup, not an execution checkpoint. Reports embed delivery copies read from the stored records plus exact ResultRefs, safe relative record paths and record hashes.
- **Identity is not just text:** the same sourceId cannot be rebound to another document/version/page/name even when text hashes match. A same-document newer version gets its own ref. Reopening the store reads the old bytes without fetching latest material. Unknown/corrupt refs and missing indexes over existing records fail explicitly.
- **Current observation versus stored provenance:** repeated acquisition of the same page keeps the original record/ref while returning that call's adapter receipt. `read_result` returns the stored acquisition's provenance, not a new MCP request. Raw `sourceAcquisition` on such a reread is historical provenance, not a fresh transport effect.
- **Context is a working view:** original history remains unchanged. Only complete settled call/result groups may be projected, preserving IDs/status/errors and the original question/latest group. Replacement requires a Host ResultRef, matching actual text hash and full intrinsic identity; lookalike tool objects are not promoted to sources. Exact reread remains an ordinary tool. The optional v0.5 note layer is separately derived and does not replace stored originals.
- **Local byte limits:** Context and final Chat request encoding have explicit UTF-8 byte bounds, including final schemas/wrappers. These are not Provider token-window claims. If mandatory material cannot fit, the request fails instead of silently dropping requirements.
- **Real candidate-driven reads:** query tokens rank only allowed synthetic pages with deterministic ties. The fixture then issues ordinary read_page calls from those candidates and read_result from the acquired ref. Markdown selects B page 1; offline editing selects page 2. Hits are not sources until read. One-sided results admit the gap; zero hits fail the required-report contract without reading or saving.
- **Citations:** numbered original-source citations and separately typed numeric derivations resolve to actual stored records. `[C1]` retains calculation inputs/units/current-versus-baseline convention/code identity; it is not a document page. Invalid markers reject before save.

## Retained mechanisms and boundaries

The four original questions retain denominator four, actual saved-file readback and semanticStatus unreviewed. Skills are bounded explicitly loaded data, not permission or executable scripts. Official SDK 1.32.2 uses verified protocol 2025-11-25, not the latest protocol; [dependency evidence](docs/dependencies/sdk-selection.md) records the rejected v2 behavior and maintenance boundary. MCP is a trusted original fixture process, not a sandbox.

Hook patches are narrow and revalidated; observation errors do not rewrite receipts. Fixed batch workers and one-level fixture-child share root reservations; Main owns the report. Child imports reread only granted original typed refs, not arbitrary paths or derived summaries. A readonly metadata view uses typed fields/token counters rather than raw provider usage objects; it is not general semantic anonymization.

Single-user local roots and one content-index writer are assumed. Static symlinks are rejected; hostile same-user filesystem races and power-loss transactions are not promised. Immutable-record publication and index replacement are separate operations: a failed index update can leave an unacknowledged orphan record, not a successful source receipt. No automatic blind retry or recovery follows. Summary deadlines stop waiting and clean up owned timers/listeners; a trusted callback that ignores cancellation is not forcibly terminated.

No database, Plugin, daemon, HTTP service, vector platform, arbitrary shell or paid calls are introduced. Earlier files remain readable, but none are executable Run checkpoints. Initialization-phase MCP cancellation remains specifically untested; active call/stream cancellation and call timeout have real checks.

## Evidence

[v0.5 observed failures/fixes](docs/verification/v05-observations.md), [artifact hashes](docs/verification/v05-evidence-provenance.json), [live preparation](docs/verification/v05-live-preparation.md) and [article evidence index](docs/evolution/evidence-index.md) distinguish stored receipts, future-input wiring and model semantics. The current source has passed 124 serial tests; independent cached installation/build/124-test regression and all seven demos also passed. Kit task 5.6 has not yet run for this freeze and remains open, alongside the separate live/semantic/license/release gate. The frozen v0.4 96-test evidence remains historical. No completion.json, formal release or semantic approval is claimed.
