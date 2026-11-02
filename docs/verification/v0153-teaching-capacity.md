# v0.15.3 — teaching capacity and defaults

This independent change follows v0.15.2; old release tags remain unchanged.

Complete report and answer text can occupy 256 KiB of UTF-8. Serialized tool arguments allow 2 MiB; provider response framing allows 16 MiB. Checkpoint JSON allows 12 MiB only on checkpoint paths; ordinary Session JSON limits remain unchanged. These are local resource budgets, not extra provider token capacity or permission.

Default ordinary Runtime budgets become 24 rounds, 64 tools and 120 seconds, with a report optional unless explicitly required. Gateway default input becomes its existing 1 MiB supported ceiling. Explicit caller budgets, report requirements, root/Child budgets, cancellation, authorization and real-cost controls still take precedence. Source scope, immutable artifacts, tool identities and publication verification are unchanged.

The save-report schema changes Host definitions identity. Existing active Runs must finish using their pinned executable/configuration; they are not automatically upgraded. Old readers are not promised support for new oversized data. Result pagination is not included.

## Evidence

The independent capacity candidate retained 63 passing targeted cases and corrected only two fixture/readback setup cases, which then passed. Four teaching-default cases passed separately. This is not a single full-suite result. The exact integrated source `cbee212ab92553a6936547e8361dbb21eefa2e59` passed all 10 focused capacity/default cases and the original build (1.972 seconds and 1.724 seconds, both clean). This is targeted evidence, not a current full-suite claim. No new paid trial has been run for this release. v0.15.2 real-trial results are not relabelled as v0.15.3 results.
