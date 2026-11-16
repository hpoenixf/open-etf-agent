# 2026-11-16 minimal release boundary

The v0.31 release uses one Knowledge input → BM25 query → original-source readback loop. Selected text import, unrestricted new lexical query values and immutable original text are the delivered scope. Existing public APIs remain available.

The original proposal and earlier A20/hybrid experiments remain historical WIP, not retroactively completed acceptance. Dynamic embeddings, new only/prefer controls, health and ResultRef/report features are not required additions for this simplified release. No absent local increment is imported or claimed.

The fixed original handoff is `a18317f5067873df1c50bd9cbeb2ef571e977147`; its affected 93-test result is distinct from an earlier local 115-test tree. The repaired execution source is `18af35f3f84eb962e83f7eff7c48befc79e316f9`. See [the Runtime decision and retained failures](../../../docs/verification/v031-release.md). The 9/10 Runtime gate and separate model-quality record do not certify the broader original proposal or private parity.
