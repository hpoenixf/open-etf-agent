# Open ETF Agent — v0.3 offline candidate

An independent local stage, not a release. v0.1 and v0.2 remain frozen on their phase branches. v0.3 adds explicit bounded Hooks, root-budgeted fixed read workers, a one-level **fixture-child** and a read-only metadata view. Actual independent-model reasoning, semantic review, live/provider/data/cost, project license and publication gates remain open.

## Run

Node 26.11.1–26.x; exact official registry dependencies are locked. Installation scripts are unnecessary:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
npm run demo -- --case skill-mcp
npm run demo -- --case batch-read
npm run demo -- --case fixture-child
node src/cli.mjs --observe runs/<run-id>
```

Cached `npm ci --offline --ignore-scripts --no-audit --no-fund` is supported. Installation may require registry access; every default demo runs offline after installation. Build syntax-checks/copies native ESM and original fixtures; built CLI uses `node dist/src/cli.mjs`. `--live` and `--case model-child` explicitly refuse unsupported live claims before starting a run.

## What is actually implemented

- Original four questions retain denominator four, independent file readback and semanticStatus unreviewed. Every saved report has actual page/version/hash snapshots and a file receipt.
- Skill metadata, actual body reads and adoption are separate; explicit supported frontmatter/resources never execute scripts or confer authority.
- The original stdio fixture uses exact official SDK 1.32.2 and verified protocol 2025-11-25. It is not the latest protocol or an OS sandbox. [SDK selection](docs/dependencies/sdk-selection.md) preserves the failed v2 experiment and dependency cost.
- Complete bounded model SSE waits for supported finish plus DONE; partial parseable arguments never reach dispatch. Offline fragmented streams do not prove a provider's reasoning.
- Explicit Hook arrays receive copied/frozen records. Only configured fields/exact aliases may be proposed before ordinary Host revalidation. after means returned result, not general persistence. Observer errors cannot rewrite receipts.
- Fixed batch-read workers run in one process with concurrency at most two, paired task IDs, explicit partial failures and shared root reservations. They are not model agents.
- fixture-child calls the same Runtime with a separate local message list, narrow document/read_page subset, no save tool and no recursive child capability. Main imports validated original sources and owns the final report. A scripted child demonstrates plumbing, not independent model reasoning.
- rootUsage counts consumed model/tool reservations, not billed tokens or money. Concurrent workers cannot each spend the last unit; child counts do not duplicate the root allowance. Metadata links root/run/task/call identity, durations and returned usage; missing usage/cost remain null.
- --observe reads only bounded run.jsonl metadata fields from an explicitly selected safe directory. It projects typed identity/event fields and three explicit safe token counters, omitting prompt, argument and source-text fields and never executes models/tools or resumes a Run.

## Lifecycle and limits

Before-Hook failure/timeout rejects before dispatch. after/failure observation errors are returned. release sees the Runtime's final log-write/close **attempts**, final status/code/logErrors; it does not assert every external resource is released. CLI-owned MCP closes later, and log close can fail. Release hookErrors are returned, not claimed retrospectively persisted.

Callbacks and cancellation are cooperative trusted in-process code, not isolation from malicious JavaScript. Resource roots are local single-user directories; static symlinks are rejected, but same-user hostile filesystem races are outside the claimed boundary. Partial/unknown effects are retained, never blindly retried. Effective tool identity is used for effects; an alias preserves the original proposal rather than hiding it.

No Plugin, database, checkpoints/recovery, daemon, HTTP service, RAG, Memory, arbitrary shell or paid calls are introduced. Earlier artifacts remain readable but are not executable recovery state. Initialization-phase MCP cancellation has not been specifically verified; active call cancellation/timeout and active SSE cancellation have actual tests.

## Evidence, not maturity by test count

[Observations](docs/verification/v03-observations.md) preserve real RED stages, first-run failures and fixes. The candidate passed 71 serial offline tests, independent npm build/test and all four demos; no model semantics were inferred. [Article evidence index](docs/evolution/evidence-index.md) records motivations and failure stories. The final actual pinned public Evidence Kit run, after both review fixes and 71 tests, reports 6/7 structural tasks and refuses the remaining live/semantic/release gate. No completion.json or formal release is claimed. Metadata projection is typed filtering, not a general semantic privacy guarantee.
