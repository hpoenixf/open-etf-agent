# v0.7 — trusted contributions and the same bounded Run after restart

Implement the fixed public roadmap PR #1 at c390eb2dd951b53b1dab2d64a9cd72d216fde8dc, `docs/plan/02-roadmap-research.md`, after the qualified v0.6 artifact reader. The original v07 preparation is design input, not evidence.

Add an explicit trusted local package contribution shape with atomic activation/release, two original packages, and optional built-in Node SQLite persistence. The existing Runtime remains the only model/tool loop. Persist immutable request/Grant/bindings/deadline, root resource reservations, sealed proposals, dispatch, committed results and consumption. Versioned Host, Child, adopted working-input and operation-scoped Memory adapters restore their own facts. Inspect/resume/cancel operate on the original Run; no new budget/deadline, automatic unknown retry or live-to-fixture substitution.

Qualification requires actual OS process termination followed by a different process against real SQLite. Plugin activation or reopening a saved report is not recovery. Dispatched effects without a committed result remain unknown. Fences protect DB commits, not arbitrary external systems. Local files and SQLite are not one transaction. Trusted in-process plugins are not a sandbox. Unsupported active schemas are refused; old immutable artifacts remain readable separately.

All execution here is synthetic/offline, Node 26.11.1 native SQLite, no new dependency/provider call/service. Runtime correctness only; semantic quality unreviewed. No license choice, tags, release, remote edits or background worker.
