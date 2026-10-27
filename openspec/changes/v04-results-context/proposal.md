# v0.4: exact results outside the model window

Baseline: independently executable offline v0.3 candidate 26731bdd68d3420f80f68ecd848d0f37eb1885ca, with live/model-child/semantic/publication still unclosed. Public roadmap authority remains c390eb2dd951b53b1dab2d64a9cd72d216fde8dc. Design motivation and independent static critique are preserved in docs/evolution/v04-design-preparation.md.

Replace the Host's source Map with one ResultStore that owns acquired original bytes, immutable source identity and a minimal persistent content index. Add a separate Context projection and actual lexical candidate→read path. The stored original source, current working context and final report are different representations; only the ResultStore owns acquired-source truth. Method text and derived child summaries are not original pages.

Keep this increment dependency-free beyond the unchanged reviewed MCP lock. No database, vector service, summary generation, Memory, recovery/checkpoint, HTTP service or live provider. A content index supports post-exit readback, never resuming unfinished execution.
