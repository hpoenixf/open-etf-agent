# Open ETF Agent — v0.4 offline candidate

An independently runnable local stage, not a release. v0.4 adds one immutable Research Result owner, bounded Context projection, exact reread and real scoped lexical retrieval. Earlier phase branches stay frozen; v0.2 has a separate maintenance patch preserving its old evidence. Provider/data/cost authorization, live/model-child semantics, project license and public publication remain open gates.

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
node src/cli.mjs --observe runs/<run-id>
```

Cached `npm ci --offline --ignore-scripts --no-audit --no-fund` works. Installation may access the registry; demos run offline after installation. The native-ESM build copies all source/fixtures and runs as `node dist/src/cli.mjs`. `--live` and `--case model-child` remain blocked before Run creation; a scripted fixture-child is not independent live model reasoning.

## What changed

- **One original-source owner:** Host's source Map is removed. ResultStore owns immutable source records, typed calculation records and `content-index.json`. The index is a content lookup, not an execution checkpoint. Reports embed delivery copies read from the stored records plus exact ResultRefs, safe relative record paths and record hashes.
- **Identity is not just text:** the same sourceId cannot be rebound to another document/version/page/name even when text hashes match. A same-document newer version gets its own ref. Reopening the store reads the old bytes without fetching latest material. Unknown/corrupt refs and missing indexes over existing records fail explicitly.
- **Current observation versus stored provenance:** repeated acquisition of the same page keeps the original record/ref while returning that call's adapter receipt. `read_result` returns the stored acquisition's provenance, not a new MCP request. Raw `sourceAcquisition` on such a reread is historical provenance, not a fresh transport effect.
- **Context is a working view:** original history remains unchanged. Only complete settled call/result groups may be projected, preserving IDs/status/errors and the original question/latest group. Replacement requires a Host ResultRef, matching actual text hash and full intrinsic identity; lookalike tool objects are not promoted to sources. Exact reread remains an ordinary tool. No generated summary exists at this stage.
- **Local byte limits:** Context and final Chat request encoding have explicit UTF-8 byte bounds, including final schemas/wrappers. These are not Provider token-window claims. If mandatory material cannot fit, the request fails instead of silently dropping requirements.
- **Real candidate-driven reads:** query tokens rank only allowed synthetic pages with deterministic ties. The fixture then issues ordinary read_page calls from those candidates and read_result from the acquired ref. Markdown selects B page 1; offline editing selects page 2. Hits are not sources until read. One-sided results admit the gap; zero hits fail the required-report contract without reading or saving.
- **Citations:** numbered original-source citations and separately typed numeric derivations resolve to actual stored records. `[C1]` retains calculation inputs/units/current-versus-baseline convention/code identity; it is not a document page. Invalid markers reject before save.

## Retained mechanisms and boundaries

The four original questions retain denominator four, actual saved-file readback and semanticStatus unreviewed. Skills are bounded explicitly loaded data, not permission or executable scripts. Official SDK 1.32.2 uses verified protocol 2025-11-25, not the latest protocol; [dependency evidence](docs/dependencies/sdk-selection.md) records the rejected v2 behavior and maintenance boundary. MCP is a trusted original fixture process, not a sandbox.

Hook patches are narrow and revalidated; observation errors do not rewrite receipts. Fixed batch workers and one-level fixture-child share root reservations; Main owns the report. Child imports reread only granted original typed refs, not arbitrary paths or derived summaries. A readonly metadata view uses typed fields/token counters rather than raw provider usage objects; it is not general semantic anonymization.

Single-user local roots and one content-index writer are assumed. Static symlinks are rejected; hostile same-user filesystem races and power-loss transactions are not promised. Immutable-record publication and index replacement are separate operations: a failed index update can leave an unacknowledged orphan record, not a successful source receipt. No automatic blind retry or recovery follows. Callback cancellation is cooperative.

No database, Plugin, daemon, HTTP service, model summary/Memory, vector platform, arbitrary shell or paid calls are introduced. Earlier files remain readable, but none are executable Run checkpoints. Initialization-phase MCP cancellation remains specifically untested; active call/stream cancellation and call timeout have real checks.

## Evidence

[Observed failures/fixes](docs/verification/v04-observations.md), [artifact hashes](docs/verification/v04-evidence-provenance.json) and [article evidence index](docs/evolution/evidence-index.md) distinguish mechanisms from semantics. Current source passed 96 serial tests, independent cached install/build/test and all five demos. The actual pinned public Evidence Kit reports 6/7 structural tasks and refuses the remaining live/semantic/license/publication gate. No completion.json, formal release or semantic approval is claimed.
