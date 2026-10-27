# v0.3: local cooperation without another execution engine

Baseline: v0.2 offline candidate commit 2e5c21166f61f772e9738bc52782d10fbadfb662. Public roadmap authority: docs/plan/01-roadmap-foundations.md and 03-architecture-contracts.md at c390eb2dd951b53b1dab2d64a9cd72d216fde8dc in hpoenixf/open-etf-agent. v0.1/v0.2 live and release gates remain open; they do not block independent local development.

The next need is narrow deterministic interception and bounded read cooperation. Explicit callback arrays suffice: no Plugin or manager. A synchronous root-budget counter allocates before any awaited dispatch, preventing two concurrent workers from each spending the last unit. Main retains the final report effect.

Batch workers are fixed read actions in one process, not independent model agents. A separate one-level child harness may reuse the existing Runtime and an explicitly supplied Gateway with a restricted read-only Host. Its offline scripted trace tests local wiring only; actual independent model reasoning remains blocked until provider/data/cost authorization. No child inherits an entire independent root budget, arbitrary tools, or permission to save/publish.

Introduce only Hook callbacks, shared root accounting, bounded batch reading and one-level child assembly. No additional dependency. Do not add Plugin, persistence/recovery, database, HTTP service, recursion, RAG or Memory.
