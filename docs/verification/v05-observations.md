# v0.5 observed engineering evidence

## EV-501 — native behavioral RED

On 2026-10-26 the frozen 14-case pre-implementation suite ran with the existing official Node v26.11.1, a 512 MB heap cap, one test worker and a 60-second external limit. It ended normally with exit 1: 0 passed, 14 failed, no skipped/cancelled tests, approximately 246 ms. All tests loaded and reached behavioral assertions; these are expected interface-scaffold failures, not a regression in the frozen v0.4 candidate.

Command: `node --test --test-concurrency=1 test/memory.test.mjs test/memory-projection.test.mjs test/compaction.test.mjs`.

The 60-file input inventory was checked before execution; inventory SHA-256 `f09d833b9c831066eaac6a5edce8a0371149427a70ac8f60eff246ca7156da60`. Actual raw log SHA-256 `9d6e26f41c02e701e3ce8e4d9985222d5b0a273a21270ca95a6294034d8f7b80`; raw logs remain local ignored artifacts, not public attachments.

Failures concern missing persisted revision/receipt and writer/intent denial, future typed text still present, no derived note or budget accounting, and absent stale/cancel/no-net-saving behavior. No v0.5 GREEN, integration, live or release conclusion is implied by this record.

## EV-502–504 — minimal implementation and reviewer negatives

EV-502: the same fourteen cases passed (14/14, exit 0, approximately 307 ms). This proves only the isolated implemented interfaces, not actual Host/Gateway integration or persisted ResultStore notes.

EV-503: two independent static findings became actual negative assertions: an uncooperative pending summary exceeded the test watchdog instead of its configured deadline, and a simulated initial writer-lock write failure left the just-created lock. Both cases failed as expected (0/2, exit 1, approximately 360 ms). The lock test modifies only the local test worker's filesystem method binding and restores it in `finally`; it does not change OS security settings.

EV-504: a bounded summary race now clears its timer/abort listeners; lock cleanup compares the still-owned inode identity rather than requiring a partially written token JSON to parse. The combined sixteen cases passed (16/16, exit 0, approximately 465 ms). Raw-log hashes are in the adjacent provenance file. These outcomes do not establish live summary quality, actual future Gateway forgetting, comprehensive sensitive-data detection, crash recovery or release completion.

## EV-505–510 — actual ownership and future-input integration

Four integration assertions first failed (0/4): model-supplied intent was not denied by the interface scaffold; typed note persistence was absent; the actual next Gateway input retained forgotten typed data; and Memory changed during persistence without invalidating adoption. The minimal implementation then passed all four. A separate Runtime note-adoption/reread case failed before wiring. Its first related regression ended 32/33: rereading a derived note exposed its source descriptors being mistaken for raw source payloads during the next projection. That failure was retained and fixed by handling the note's typed references explicitly. A further negative showed that a derived note could bypass a narrower document scope; it now rechecks every original-source grant. The resulting related suite passed 34/34 (approximately 896 ms).

## EV-511–514 — CLI and final review negatives

Three CLI acceptance cases failed before implementation, then passed: missing explicit Memory library refused before output creation; real save/revise/forget receipts and retained revisions; and persisted derived notes plus post-exit original reread. Final independent review identified three more real integration gaps. Four assertions reproduced them: Hook original/effective copies leaked old write text; the actual subsequent Gateway input therefore retained it; consumed Memory intents lost their partial-effect metadata at the Host/Runtime boundary; and observe rejected the new working_note event. All four failed before the fixes. Typed redaction/effect/event projection then passed the related 15-case suite. Arbitrary paths, note text and provider objects are not exposed by these metadata projections.

## EV-515–516 — current offline candidate

The current 66-file source/test/fixture/build/package/example inventory has SHA-256 `35e26cb8a36a8d3eee2ed9fca838bc4639235aa8104fe423644e4d2dfd75fea4`; its files are listed in `v05-candidate-inputs.sha256`. The unchanged audited 95-package dependency closure installed from the existing cache with `npm ci --offline --ignore-scripts --no-audit --no-fund`. No install hooks or network/provider request ran.

The full serial suite passed 124/124 (exit 0, approximately 14.105 seconds). A separate local project directory, without inherited node_modules, then independently passed cached installation, build, all 124 tests, and seven complete demos: original four-question comparison, Skill/MCP, batch reads, fixture child, lexical retrieval/reread, compaction/reread and explicit Memory. Each stage exited 0 under a 120-second command cap. Ten report receipts across those demos were independently read after process exit and their SHA-256 values checked. Portable receipts are in `v05-demo-receipts.json`; raw logs remain local ignored artifacts and their hashes remain in `v05-evidence-provenance.json`.

The final v0.5 Kit stage has not yet run at this freeze; tasks 5.6 and 5.7 remain open. This local offline candidate is being frozen for authorized backup before live configuration or formal release. The actual environment file is not included. No live request, semantic approval, project license choice or release closure follows from the offline result.

## EV-517 — Kit after the publication freeze

The immutable offline backup freeze remains local commit `d8b5554130fc3d333d0e181edf92a51e9030f20c`. After that freeze, actual pinned Kit plan/apply/status commands all exited 0; verify --check exited 1 and accurately refused then-incomplete tasks 5.6 and 5.7. Only ignored local logs were written during publication, so no frozen branch drift occurred. The parent publisher subsequently confirmed all six remote stage refs, including the v0.5 content-equivalent remote commit abbreviated `05c0dd2`; local and remote commit ancestry differ, and their tree content was independently checked. Code backup publication is not a project license decision, live semantic approval or formal release.

This later documentation-only change records the real Kit observation and marks only 5.6; 5.7 remains unfinished. The 124-test/7-demo source inventory is unchanged, and no additional source-validation claim is made by a document update.

EV-518: after recording 5.6, actual Kit apply/status again exited 0, with 6/7 tasks checked; verify --check exited 1 solely for incomplete 5.7. No completion record was written and no source tests were rerun for these documentation-only changes.
