# v0.2: methods and remote-shaped tools without a second loop

## Motivation
v0.1's three responsibilities already read sources and save real files. The next change is to obtain a comparison method on demand and read the same synthetic pages through an actual local stdio MCP process. Neither capability warrants a plugin manager, a new Runtime, or a database. Model SSE reception must wait for a complete response rather than dispatch parseable partial arguments.

## Scope and independent baseline
Baseline: local phase/v0.1 commit 1a787437c2a900c8a9fe27048e81aa86b703305b. Its full offline candidate remains independently runnable; its live/publication exit gates are still open. This worktree contains its own full source, fixtures and lockfile, not runtime imports from the previous worktree.

Increment: explicit local Skill subset and bounded resource reads; official SDK stdio handshake/discovery/call/close; bounded non-streaming and SSE Chat Completions through the same Gateway/Runtime contract. Keep default document-compare and add skill-mcp. Source snapshots and save receipts remain real. No remote OAuth, automatic third-party tool installation, Skill scripts, plugin lifecycle, background service, recovery, RAG or Memory.

## Dependency decision
Do not blindly choose the npm sdk/latest maintenance package. Official pinned v1 README identified it as the 2025-11-25 maintenance line. Official v2 documentation identifies the stable 2026-07-28 line; registry metadata confirms @modelcontextprotocol/client/server/core 2.4.0. The first candidate selected client/server 2.4.0 plus zod 4.6.7. Actual stdout-pollution testing then rejected that candidate: its transport suppresses SyntaxError. The final candidate deliberately selects the currently supported official maintenance SDK 1.32.2 and the 2025-11-25 protocol, retaining the failed v2 lock/audit. See docs/dependencies/sdk-selection.md. Lock all transitive artifacts, disable installation scripts, and inspect hooks/source before execution. Use distributed JavaScript from the official packages, not a TypeScript compiler or hand-written MCP substitute. Apache-2.0 dependency notices do not choose the application's license.

## Execution boundary
Only an original fixture server is launched from trusted assembly. One child at a time, no ports/network/secrets, explicit arguments and restricted environment. Close and verify exit after tests, including failures. A local process is not a code sandbox. No model/provider request occurs without separate data/cost authorization. Live and publication gates do not prevent local offline work, but remain necessary for stronger version claims.

## Evidence
Use the real pinned public Evidence Kit, not just its Markdown layout. Observe targeted RED before production changes. Preserve module/discovery errors separately from behavioral failures. Add article evidence only for actual design decisions, failures, fixes and measurements; no success-story placeholder.
