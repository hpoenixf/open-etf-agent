# Cancellation checkpoint capacity follow-up — 2026-11-02

Baseline public commit: `2ddd22221c899f7bbbc3dc17d927810f5e381e03`. This is a focused correction, not a version release or new paid qualification.

## Reproduced regression

The cancellation transition copied the full dispatched effect into `unknownEffects` while retaining another full `inFlight` copy. An admitted checkpoint below the original **3 MiB** limit could therefore exceed that unchanged limit during cancellation. The original Session transaction raised `JSON_BOUND` and rolled back the cancellation.

The provider-free counterexample uses the original Session's supported minimal checkpoint API, including a large complete effective argument. It is not labelled as a model-produced or Runtime-produced input. The original failure remains recorded; no failed evidence or ledger reservation is reset.

## Minimal correction

After retaining complete uncertainty in `unknownEffects`, remove only the redundant terminal `inFlight` pointer. Terminal recovery does not dispatch it again. Original effective arguments, other snapshot payload, definitions, budget usage and unknown identity remain exact across repeated cancellation and SQLite close/reopen. Non-null working input, results, proposal/history and receipts are not erased.

No capacity or codec is widened. This removes the newly introduced large duplication; it does not claim universal closure for pre-existing exactly-at-cap constant terminal-metadata growth. A broader admission-capacity protocol is outside this change.

## Evidence and scope

- Original fixed-source capacity counterexample: `JSON_BOUND`.
- Candidate focused suite: **31/31**, zero failures/skips.
- Additional original cancellation consumers: **9/9**, including ordinary response, publication and process-worker paths.
- The earlier 514-test receipt belongs to its original fixed baseline, not this focused change.
- Zero external provider/model requests; no release, live or semantic-quality claim.
- Machine-readable input and receipt hashes: [safe evidence](cancellation-capacity-followup-20261102.safe.json).
