# First verifiable report (v0.1 only)

## Why and scope
Produce a real Markdown file whose source pages, calculations and save receipt can be reopened. A scripted model demonstrates mechanisms, not reasoning quality. CLI → bounded Runtime → one Gateway / Tool Host. Original synthetic two-version guides; read_page, calculate_change, save_report; unique local run directories containing immutable report, manifest and diagnostic JSONL. No DB, recovery, worker, MCP, plugin, RAG, memory, shell or website.

## Acceptance
Independent npm ci/build/test/demo commands, default offline; four fixed questions retain denominator 4. File bytes/SHA-256 match manifest; snapshots match actual read pages. Failed saves cannot yield delivery success. Budget, cancellation, incomplete calls, paths and symlinks have executable checks. One separately authorized live round trip remains a mandatory v0.1 exit condition, currently blocked.

## Public sources and provenance
Plan: hpoenixf/open-etf-agent PR #1 at c390eb2dd951b53b1dab2d64a9cd72d216fde8dc; main baseline 94dd4b08d3ce4ae49fad237e238184a862260a76. Read README and docs/plan/01,03,05,06,07 plus plan index.
Workflow format: hpoenixf/openspec-evidence-kit at db6ac2f43cc0319fa0f10b4f73d67521d5209c88, README, schema/evidence-driven/schema.yaml, docs/evidence-format.md. Kit not installed/executed; its MIT license does not license this project. No private implementation/data consulted.
Single protocol reference, read 2026-10-26: https://developers.openai.com/api/reference/resources/chat . Non-streaming function tools/text only. Complete finish_reason, JSON argument validation and tool_call_id pairing required; not a claim of all Provider compatibility.

## Stack and boundaries
Native ECMAScript modules, Node 26.11.1–26.x, node:test, zero runtime/dev dependencies. Runtime validation is necessary with or without TypeScript; JavaScript avoids an unnecessary compiler/install. Build checks syntax and stages files, not TypeScript types. package private/UNLICENSED is a publication guard pending actual license decision. No public push/merge/tag/release, live model, private fee-budget inheritance or third-party install. Only approved existing Node binary may be executed for bounded offline tests. Tests precede production code; stub exports only make real behavioral assertions discoverable.
