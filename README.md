# Open ETF Agent — v0.2 offline candidate

Local development candidate, not a release. v0.1 remains frozen on its independent phase branch. v0.2 adds explicit Skill reads, real stdio MCP and complete model SSE assembly without another Runtime. Live/provider/data/cost, semantic review, project license and public publication remain separate open gates.

## Run independently

Node 26.11.1–26.x. First installation may fetch locked official npm artifacts; installation scripts are not needed:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
npm run demo -- --case skill-mcp
```

After caching, `npm ci --offline --ignore-scripts --no-audit --no-fund` also works. Demos run offline. Build syntax-checks native ESM and copies source/fixtures, including Skill resources; it does not compile TypeScript. `node dist/src/cli.mjs --case skill-mcp` runs the built copy. Tests run serially. The original fixture server is one short-lived Node child, not a daemon or OS sandbox.

## Actually demonstrated

- Four questions retain denominator 4 and semanticStatus unreviewed. Selecting T1–T4 marks other questions not-run instead of dropping them.
- skill-mcp lists Skill metadata, explicitly reads its body, acquires both source pages through an actual SDK process and saves through the same Host/Runtime budget. Discovery does not authorize the fixture's unapproved tool.
- Real report.md, manifest.json and run.jsonl retain source/method snapshots, version/page/hash, model-call versus SDK-request identity and save receipt. Tests reopen files after the CLI exits; the CLI does not claim the user opened them.
- Gateway supports text/function Chat Completions, non-streaming or bounded SSE. Tool arguments are not dispatched before valid finish and DONE. Injected offline streams prove mechanisms only; --live remains blocked before requests.

## Explicit limits

Skills support only plain name/description frontmatter, in that order, and bounded UTF-8 resources under explicit nonsymlink directories. No Skill scripts execute. Reading a method is not proof of semantic adoption.

MCP uses exact official SDK 1.32.2 and verified 2025-11-25 handshake, not the latest 2026 protocol. The first SDK v2 candidate failed strict stdout handling; [selection evidence](docs/dependencies/sdk-selection.md) records why and the dependency cost. Only the original allowlisted fixture server is launched; arbitrary third-party servers, OAuth and network transports are unsupported.

Local single-user roots only. Static symlinks are rejected; hostile same-user filesystem races are not an OS security boundary. Partial/unknown effects remain explicit; writes are not blindly retried. Files and JSONL are not recovery checkpoints. No plugins, hooks, workers, database, RAG, Memory or HTTP reader are added.

## Evidence

[v0.2 observations](docs/verification/v02-observations.md) retain RED results, the failed SDK experiment, fixes and actual process outcomes. [Article evidence index](docs/evolution/evidence-index.md) records design motivations rather than a premature success story. The pinned user-owned public Evidence Kit provides actual structural checks, separate from product tests and release approval.

Current regression: 49/49 offline tests plus independent install/build/default/skill-mcp commands passed. Later review may add corrections; use exact candidate inventories and observations rather than treating test count as maturity certification.
