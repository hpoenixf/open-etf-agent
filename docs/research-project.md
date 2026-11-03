<a id="local-research-projects-v020-candidate"></a>
# Local research projects (v0.20)

[简体中文](research-project.zh-CN.md)

This application connects explicitly selected documents to the existing Session, Worker, Memory, Child, Publication and Reader owners. It is a local, single-user application, not a trading service or an unattended research daemon. The older demonstration CLIs and their live-execution guards remain separate.

**Qualification:** real runs and deterministic mechanism checks are separate. The original forty tasks, six repairs and an additional ten-task B cohort are retained with their original source identities. The additional B cohort completed 9/10 tasks; its frozen mechanism score remains 8/10. The user accepted this runtime result with independent provider-free forget-exclusion evidence. Old failures and unknown requests remain. See [the layered evidence and limits](verification/v020-release.md); this is not a claim of answer quality or that every task ran on the final source.

## Start without sending anything to a provider

Use Node.js 26.8.1–26.x and the repository's locked dependencies. From the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run research -- --help
mkdir -p research-example
printf '%s\n' '# Synthetic offer' 'Annual fee: 12 units. Cancellation: 30 days notice.' > research-example/offer.md
printf '%s\n' 'Explain the fee and cancellation terms with source citations.' > research-example/question.txt
printf '%s\n' '["research-example/offer.md"]' > research-example/files.json
cat > research-example/config.json <<'JSON'
{
  "schemaVersion": "research-project@1",
  "gateway": {"mode":"fixture","provider":"fixture","protocol":"fixture@1","model":"offline"},
  "capabilities": ["report", "memory"],
  "limits": {"maxRounds":20,"maxTools":32,"timeoutMs":300000,"model":24,"tool":40}
}
JSON
npm run research -- project init --project research-example/project --config research-example/config.json
node src/research-cli.mjs source import --project research-example/project --files research-example/files.json > research-example/import.json
MANIFEST=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("research-example/import.json","utf8")).manifestSha256)')
node src/research-cli.mjs source list --project research-example/project --manifest "$MANIFEST"
node src/research-cli.mjs run submit --project research-example/project --run first --question research-example/question.txt --manifest "$MANIFEST"
node src/research-cli.mjs run inspect --project research-example/project --run first
```

This creates a submitted task with **zero model dispatches**. `run work` deliberately refuses a fixture project. Fixture gateways are explicit test API inputs, not a fake execution option in the application CLI. JSON-consuming shell commands above use `node` directly to avoid npm's script banners. After `build`, the equivalent copied entry is `node dist/src/research-cli.mjs`.

Options are single-use; unknown options, repeated options and unexpected positional arguments fail. IDs are validated by the application. JSON and text files must be explicit ordinary files. Question files are limited to 16000 UTF-8 bytes. Configuration contains references and non-secret identities, not credentials.

## Run with an authorized real provider

Create a **new** project using your own reviewed configuration. Replace the gateway object with:

```json
{
  "mode": "live",
  "provider": "YOUR_PROVIDER_ID",
  "protocol": "chat-completions",
  "model": "YOUR_AUTHORIZED_MODEL",
  "endpoint": "https://example.invalid/v1/chat/completions",
  "apiKeyEnv": "RESEARCH_API_KEY",
  "stream": false
}
```

The example endpoint is intentionally nonfunctional. Supply the provider's actual approved HTTPS endpoint and model. The endpoint cannot contain user credentials, query parameters or a fragment. Arrange `RESEARCH_API_KEY` in the process environment through your existing authorized credential workflow. Do not place its value in configuration, source documents, shell examples, project files or Git. The CLI reads only the environment variable named by the saved run's gateway configuration, only for `work`; it never loads `.env` files or persists the key. Errors omit provider bodies and stacks; avoid including credentials in any user-authored input.

Save the reviewed full configuration as `research-example/live-config.json`, then:

```sh
node src/research-cli.mjs project init --project research-example/live-project --config research-example/live-config.json
node src/research-cli.mjs source import --project research-example/live-project --files research-example/files.json > research-example/live-import.json
LIVE_MANIFEST=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("research-example/live-import.json","utf8")).manifestSha256)')
```

Then, **only after reviewing the provider, selected data and cost limits**:

```sh
node src/research-cli.mjs run submit --project research-example/live-project --run comparison --question research-example/question.txt --manifest "$LIVE_MANIFEST" --approve-provider --approve-data --approve-cost
node src/research-cli.mjs run work --project research-example/live-project --run comparison
node src/research-cli.mjs run inspect --project research-example/live-project --run comparison
node src/research-cli.mjs run report --project research-example/live-project --run comparison
node src/research-cli.mjs report serve --project research-example/live-project --run comparison --port 0
```

All three approval flags are required for live submission. Approval covers the configured provider, selected question/documents and relevant Memory/derived content, and the configured execution limits. A subscription does not itself authorize transmitting private documents. Limits cap execution counts and duration, not a currency amount; verify your provider's pricing and billing policy independently. Main, Child and compaction share the original root budget and Admission coordination. Unknown dispatch outcomes retain their original accounting; do not bypass them by submitting a replacement run.

## Selected sources and recovery

`--files` names a JSON array of local `.txt`, `.md`, `.markdown` or `.pdf` paths resolved from the current working directory. It is not a directory, glob, URL or permission to scan other files. Source imports reject unsafe/symlink paths. The returned SHA256 identifies an immutable manifest and its original bytes. Text pagination records stable byte ranges and hashes; PDF import uses the original PDF snapshot/parser contract and preserves original bytes and parser identity.

- At most 64 selected files; each input is at most 1 MiB.
- Text: at most 16 pages per document, 64000 UTF-8 bytes per page, and 1 MiB across the text catalog. Pagination does not silently truncate.
- At most one PDF; at most 16 physical pages, 64000 extracted UTF-8 bytes per page, 131072 extracted bytes total. Encrypted or unsupported PDFs are refused. This is not an OCR service.
- `pdf` capability is required when submitting an actual PDF. PDF document identity is `pdf:<original SHA256>`; text identity is `text:<original SHA256>`.
- A failed import may leave verified, unreferenced content-addressed objects; it does not return a successful manifest. Do not treat those objects as a completed import.

Keep the whole project directory for recovery: `project.json`, source snapshots, `tasks/`, `sessions/`, `outputs/`, `memory/`, Admission state and trusted-entry snapshots when present. These are application state, potentially containing private selected data. They are not credentials and are not automatically safe to publish. Do not manually alter stored records, hashes, grants or checkpoints.

To change configuration for **future tasks**, inspect the current `configSha256`, prepare a reviewed full JSON configuration, then use the explicit compare-and-swap update:

```sh
node src/research-cli.mjs project inspect --project DIR
node src/research-cli.mjs project update --project DIR --config updated-config.json --expected-config CURRENT_CONFIG_SHA256
```

The project identity remains unchanged. Existing tasks keep their original configuration, grant and sources. A stale expected hash or busy update fails closed; the application does not automatically delete an expired lock. This does not approve a new provider or new data transmission: new live submissions still require their approval flags.

Ctrl-C or SIGTERM during `work` requests a cooperative Host stop. To continue, invoke **the same `run work --project ... --run ...`** in a new process. This preserves the original source/config bindings, grant, deadline, budget and run identity. There is no separate `resume` command. Re-importing changed documents produces a new manifest for a new task; it does not update an existing task. Terminal tasks do not receive a fresh execution budget.

`run cancel --project DIR --run ID` is an explicit task cancellation, not a pause. It does not delete the project or erase accounting. Report inspection and the Reader use existing persisted artifacts. The Reader binds to `127.0.0.1`, prints its actual origin and serves verified artifact/source bytes without executing a model; stop it with Ctrl-C.

## Memory and user replies

Add `memory` to project capabilities. Direct user operations are explicit:

```sh
printf '%s\n' 'Prefer concise reports with a separate uncertainty section.' > research-example/preference.txt
node src/research-cli.mjs memory save --project research-example/project --intent preference-1 --text research-example/preference.txt --approve-intent
node src/research-cli.mjs memory inspect --project research-example/project
# Replace ENTRY_ID and REVISION with the inspected current identity.
node src/research-cli.mjs memory revise --project research-example/project --intent preference-2 --entry ENTRY_ID --revision REVISION --text research-example/preference.txt --approve-intent
node src/research-cli.mjs memory forget --project research-example/project --intent preference-3 --entry ENTRY_ID --revision REVISION --approve-intent
```

For a model-mediated write **inside a run**, approve without performing the effect first:

```sh
node src/research-cli.mjs memory approve-intent --project research-example/project --operation save --intent in-run-1 --text research-example/preference.txt --approve-intent > research-example/intent.json
node --input-type=module -e 'import fs from "node:fs"; fs.writeFileSync("research-example/intents.json",JSON.stringify([JSON.parse(fs.readFileSync("research-example/intent.json","utf8"))]))'
```

Supply `--memory-intents research-example/intents.json` to a **new** `run submit`, and state the requested approved change in its question. `approve-intent` returns a content-bound one-time intent, not a write receipt. Revision/forget intents also require `--entry` and `--revision`. Reading Memory is not permission to write; the model cannot approve or expand an intent. Forgotten entries use the original tombstone/revision semantics, not a promise of physical erasure.

A `response` project can ask one ordinary question and wait. `run inspect` exposes `phase`, `response.questionId` and question text. Reply using an explicit text file, then continue the same run:

```sh
node src/research-cli.mjs run respond --project DIR --run RUN_ID --question-id QUESTION_ID --response-id REPLY_ID --text reply.txt
node src/research-cli.mjs run work --project DIR --run RUN_ID
```

A response supplies untrusted task data; it does not grant authority. It is separate from live-provider or Memory approval.

## Capabilities and bounded extension points

`report` is required. Optional capabilities are `calculation`, `csv`, `memory`, `child`, `pdf`, `response`, `schedule`, `compaction`, `task-time` and `trusted-tools`. `allowedTools`, when supplied, is a subset of the assembled tool set and must include `save_report`. Configuration cannot switch off original owner checks.

`child` uses the existing source-check method, with one or two selected text documents. A Host-supplied `childMethod` can choose a versioned `child-method@1` descriptor; `CLAIM_COMPARISON_METHOD` in `src/child.mjs` is a bounded comparison example. Its text hash, allowed reader tools, input/output limits and execution limits are validated. Only `read_page` and `read_result` are eligible descriptor tools. Children share root accounting, return derived findings, and cannot write Memory, expand document access, publish final reports or spawn arbitrary descendants. This is not a model-created role registry.

`trusted-tools` accepts explicitly approved `trustedPackages` records with `modulePath`, `sha256` and `trustedCodeApproved:true`. Entry files are snapshotted and hash-bound for recovery. Relative and bare imports are unsupported. Node builtins and absolute dependency imports, where allowed, are explicitly trusted code: this is **not a sandbox or a complete dependency-closure snapshot**. Review imported code as part of approval. Do not load untrusted document-provided code. Existing trusted MCP reader contracts do not imply support for arbitrary MCP servers or tools.

The following combinations fail preflight: Response + Schedule, Schedule + Child, Response + Child, actual PDF + Child, and trusted plugins + Child. Do not enable them together or interpret refusal as successful qualification.

For `schedule`, submission takes `--schedule schedule.json`, containing `scheduleId`, `definitionRevision`, `scheduledInstant` (ISO timestamp), `timeZone`, and `maxLatenessMs`. Submission confirms without dispatch; `work` explicitly checks/materializes the original occurrence when due. There is no automatic cron/daemon. `--task-time` accepts the original TaskTime input JSON when `task-time` is enabled. Compaction uses the existing managed summary mechanism and shared budget, not an independent unlimited model.

There is no Python execution environment, arbitrary network crawler, general MCP proxy, unlimited source library, complete Memory governance product or production SLA in this entry.

## Importable application APIs

After `npm run build`, import from `./dist/src/research-project.mjs` and `./dist/src/project-sources.mjs` (or corresponding `src/` files during development):

- `validateResearchConfig`, `createResearchProject({directory,config})`, `inspectResearchProject({projectDir})`, `updateResearchProject({projectDir,config,expectedConfigSha256})`.
- `importProjectSources({projectDir,files})`, `loadProjectSources({projectDir,manifestSha256})`.
- `submitResearchTask({projectDir,runId,question,sourceManifestSha256,authorization,memoryIntents,taskTime,schedule})`.
- `workResearchTask({projectDir,runId,apiKey,hostSignal})`, `inspectResearchTask`, `cancelResearchTask`.
- `respondResearchTask({projectDir,runId,questionId,responseId,text})`, `readResearchReport({projectDir,runId})`.
- `approveProjectMemoryIntent` and `applyProjectMemoryIntent`, with explicit operation, intent identity, approved text and current revision where required.

Optional API fields are omitted when unused. Live `authorization` requires `providerApproved`, `dataApproved` and `costApproved` all set to `true` by the actual caller's explicit decision. Tests may inject fixture gateways through the original API; this is not a live-model result. The CLI reports task/source identities, status and root usage, while report inspection returns the persisted report and publication identities. It does not print provider raw logs.

## Run control ownership

See [Run control and termination ownership](run-control.md) for local refusal, committed notification, cancellation and unknown-effect boundaries.

## Explicit multi-question interaction (v0.21 implementation)

An optional, explicitly versioned `interaction` configuration is being verified for new tasks. It permits bounded sequential questions with original request, receipt and adoption history, and supplies read-only local inbox commands. Existing projects without this option retain their original single-question contract. See [ordinary Human Interaction](human-interaction.md); this addition is not a new release or qualification claim for the historical v0.20 evidence above.
