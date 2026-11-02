# v0.14.1 — teaching capacity and Runtime repairs

This candidate preserves the original v0.14 owners and existing capabilities. It includes the verified null tool-ID continuation compatibility repair and local teaching-capacity adaptation, not a wholesale replacement with current main.

Report and final text use a 256 KiB UTF-8 budget; tool-argument JSON has a separate 2 MiB cap and provider response framing 16 MiB. Gateway default input is its previously supported 1 MiB ceiling. Runtime defaults are 24 rounds, 64 tools, 120 seconds, and optional report. Explicit report requirements, child/root/caller budgets and authorization still prevail. Checkpoint JSON is separately bounded at 12 MiB while generic Session JSON remains 3 MiB.

Original Publication identity and receipts remain unchanged; only text and serialized-body resource capacity are adjusted. Old active Runs retain their pinned executable/configuration; changed report definitions do not silently upgrade old snapshots. No result pagination or new provider/data permission is added.

## Verification status

The null repair has prior grouped parser and per-version Runtime compatibility evidence. The new local teaching adaptation and this version’s requested new ten-task paid batch are pending. Earlier version results are preserved with their original source identities, not relabelled as this candidate. No new model call has been made during preparation. Known historical mechanism gaps are not closed by increased capacity alone.
