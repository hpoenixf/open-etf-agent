# Open ETF Agent — v0.6 candidate

A small, incrementally developed research Runtime using original synthetic documents. v0.6 adds immutable report artifacts, deterministic CSV attachments, a **loopback-only read service** and actual HTTP byte/source checks. Refreshing or downloading a saved result does not run a model.

The project acceptance scope is Runtime correctness: faithful inputs and sources, bounded lawful execution or refusal, explicit partial effects and real saved bytes. Model-answer quality is not an acceptance gate. Earlier frozen phases and their real-model observations remain separate; a basic live T1 does not prove every later mechanism. Source branches are public backups, not license selection, tags or formal releases.

## Run independently

Use Node 26.11.1–26.x. The pinned SDK is the only runtime dependency family; installation hooks are unnecessary.

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

Skill and MCP, Hook/Child budgets, immutable original ResultRefs, bounded Context projection, derived notes and explicit one-use Memory intents remain opt-in. A fixture-child is not live independent reasoning. A derived note is not an original source. Forgetting changes future typed inputs, not historical reports. No plugin lifecycle, database, background worker, Web Chat or cold recovery is implemented in this phase.

## Artifact boundaries

The ordinary `save_report` Host binding delegates to one Report/Artifact owner; it does not maintain an alternate publishing engine. The legacy `report.md`/manifest remain readable. Artifact IDs bind bytes and format; revisions bind report, attachments and validated original snapshots. A later revision never overwrites an older ID. `create_csv` uses bounded structured strings, correct CSV quoting and an apostrophe display transform for formula-leading cells. It is not arbitrary file execution or an agent shell.

Markdown is the normal report format. The local Artifact API also accepts a declared bounded HTML/SVG subset for attachment-only delivery; it is not a general HTML/XML parser or sanitizer. The optional standalone Python exercise from the roadmap is not implemented and is not needed for this phase's Node-only demos.

## Real-model and evidence boundaries

The default CLI's `--live` remains closed; use the separate [explicit bounded live entry](docs/live-validation.md), with your own reviewed provider/data/cost scope and budget. `.env.example` contains only placeholders. Never commit a real key or copy unrelated app configuration.

[Five frozen versions' real first-batch evidence](docs/verification/live-v01-v05-first-batch.md) records lawful outcomes, file receipts and actual subscription billing separately. Those runs used their original adapters and are not new v0.6 live evidence. [Next Runtime-focused live cases](docs/verification/live-runtime-next-cases.md) remain a plan, not an execution record.

[v0.6 Spec and evidence](openspec/changes/v06-artifact-reader/evidence.md) preserves actual RED/GREEN, review fixes and qualification results. The Evidence Kit's generated view is a structural check, not test execution authentication or license/release approval. The project root remains `UNLICENSED` pending an explicit project-license decision; the separately vendored Kit retains its own license.
