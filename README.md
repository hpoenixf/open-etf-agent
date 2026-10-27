# Open ETF Agent — v0.7 candidate

A small, incrementally developed research Runtime using original synthetic documents. v0.7 adds explicit trusted packages and optional real SQLite checkpoints to the **same Runtime loop**. Sealed proposals and committed results can continue after a new process claims the original Run; dispatched work with no durable result stays unknown. The v0.6 immutable report reader and actual HTTP checks remain available.

The project acceptance scope is Runtime correctness: faithful inputs and sources, bounded lawful execution or refusal, explicit partial effects and real saved bytes. Model-answer quality is not an acceptance gate. Earlier frozen phases and their real-model observations remain separate; a basic live T1 does not prove every later mechanism. Source branches are public backups, not license selection, tags or formal releases.

## Run independently

Use Node 26.8.1–26.x. Local qualification uses 26.11.1; the user reported v0.6 tests passing on 26.8.1, not a local v0.7 minimum-version test. The native SQLite APIs used here predate that floor; [toolchain evidence](docs/verification/v07-observations.md) separates compatibility rationale from actual executions. The pinned SDK is the only runtime dependency family; installation hooks are unnecessary.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
npm run demo -- --case artifact-table
```

With a populated official registry cache, `npm ci --offline --ignore-scripts --no-audit --no-fund` also works. Installation may require network; default demos/tests do not require a provider, key or private service. Build output runs as `node dist/src/cli.mjs`.

## Read and check actual files

```sh
mkdir -p runs
node src/cli.mjs --case document-compare --output runs > runs/comparison.json
npm run evaluate -- --input runs/comparison.json
# Select one actual directory printed in comparison.json:
npm run serve -- --run runs/run-YOUR_ID
```

`serve` prints its `http://127.0.0.1:PORT` origin and stops on Ctrl-C. It only reads the selected Run's already registered artifacts. The index links stable revision and report IDs; source windows, attachment metadata and downloads are revision-bound. No authentication or public-network hosting is promised. HTML/SVG are **downloads only**, not executed in the reader page. Treat downloaded active documents as untrusted when opening them elsewhere.

`evaluate` starts and closes its own short loopback readers and retains the four-case denominator, including not-run or failed rows. It checks report hashes/media types, complete original-source identities and bytes, and unique attachment identities/bytes through real HTTP. It does not judge prose or recover an unfinished Run.

## Existing optional mechanisms

```sh
npm run demo -- --case skill-mcp
npm run demo -- --case batch-read
npm run demo -- --case fixture-child
npm run demo -- --case retrieve-reread --query "offline editing"
npm run demo -- --case compact-and-reread
npm run demo -- --case explicit-memory --memory-library runs/selected-synthetic-library
node src/cli.mjs --observe runs/run-YOUR_ID
```

Skill and MCP, Hook/Child budgets, immutable original ResultRefs, bounded Context projection, derived notes and explicit one-use Memory intents remain opt-in. A fixture-child is not live independent reasoning. A derived note is not an original source. Forgetting changes future typed inputs, not historical reports. Trusted packages and opt-in SQLite recovery are described below. No background worker, Web Chat, general external exactly-once or automatic retry of unknown work is implemented.

## Optional durable execution

```sh
npm run session -- start --session runs/durable-example --case durable-report
# Use the Run ID printed by start:
npm run session -- inspect --session runs/durable-example --run run-YOUR_ID
npm run session -- resume --session runs/durable-example --run run-YOUR_ID
npm run session -- cancel --session runs/durable-example --run run-YOUR_ID
node --test --test-concurrency=1 test/durable-runtime.test.mjs
```

Additional original fixture cases: `trusted-plugins`, `durable-child`, `durable-compaction`, `durable-memory`. Use a separate session directory for each demonstration. Memory's synthetic intent is deliberately one-use; starting it again is not fresh authorization. A terminal `resume` rereads the settled outcome and actual artifacts; it does not rerun research. The process tests actually kill a child, await its exit, then start a different PID. They are the recovery evidence, not merely the successful terminal readback command.

The selected Run keeps its original question, Grant, bindings, deadline and consumed root budget. One SQLite lease/fence controls DB writes; it does not fence arbitrary external services. A committed Child handoff is reconciled without running the child again. Adopted notes retain their exact next-input identity. Memory writes close the original file owner before returning; a stale writer lock is refused, never stolen. Existing report bytes/revisions are reread, not regenerated. Unsupported active checkpoint schemas are refused; older immutable artifacts remain separately readable.

Trusted packages are explicitly imported local JavaScript with process privileges, **not a sandbox**. Full contribution validation precedes activation; failed activation releases staged resources in reverse order. Their content hashes bind the selected module file, not a magical dependency/closure attestation. The simple explicit-function path remains usable. Provider credentials do not belong in checkpoint bindings. CLI recovery accepts only its pinned synthetic profiles; it never replaces an actual live provider with a fixture. No v0.7 live recovery is claimed.

File/DB effects are not one transaction. An interrupted uncommitted operation remains unknown; any files it left require inspection, not blind replay or automatic deletion. We do not promise a generic orphan collector or arbitrary external reconciliation. See [v0.7 contracts and evidence](openspec/changes/v07-trusted-recovery/evidence.md).

## Artifact boundaries

The ordinary `save_report` Host binding delegates to one Report/Artifact owner; it does not maintain an alternate publishing engine. The legacy `report.md`/manifest remain readable. Artifact IDs bind bytes and format; revisions bind report, attachments and validated original snapshots. A later revision never overwrites an older ID. `create_csv` uses bounded structured strings, correct CSV quoting and an apostrophe display transform for formula-leading cells. It is not arbitrary file execution or an agent shell.

Markdown is the normal report format. The local Artifact API also accepts a declared bounded HTML/SVG subset for attachment-only delivery; it is not a general HTML/XML parser or sanitizer. The optional standalone Python exercise from the roadmap is not implemented and is not needed for this phase's Node-only demos.

## Real-model and evidence boundaries

The default CLI's `--live` remains closed; use the separate [explicit bounded live entry](docs/live-validation.md), with your own reviewed provider/data/cost scope and budget. `.env.example` contains only placeholders. Never commit a real key or copy unrelated app configuration.

[Five frozen versions' real first-batch evidence](docs/verification/live-v01-v05-first-batch.md) records lawful outcomes, file receipts and actual subscription billing separately. Those runs used their original adapters and are not new v0.6 live evidence. [Next Runtime-focused live cases](docs/verification/live-runtime-next-cases.md) remain a plan, not an execution record.

[v0.6 Spec and evidence](openspec/changes/v06-artifact-reader/evidence.md) preserves actual RED/GREEN, review fixes and qualification results. The Evidence Kit's generated view is a structural check, not test execution authentication or license/release approval. The separately vendored Kit retains its own license. Historical evidence may record the earlier unresolved license gate; that history is not the current license.

## License

Original project code and documentation are licensed under [MIT](LICENSE), copyright 2026 Huang Pengfei. Third-party components retain their own licenses and notices; the vendored Evidence Kit's MIT license is preserved. `private: true` prevents accidental npm publication; it does not revoke the source license.
