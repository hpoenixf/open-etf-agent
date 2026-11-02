# v0.16 teaching-capacity integration — local offline evidence

Execution commit: `fe4aec91417ca4610cbdd15614126ba851f386dd`, based on preserved clean `e2d503f739e41cab814a21bebdb85d640a673628`. Fixed 445-file manifest SHA-256: `f327f960dba6d9e2b57ba6014e9ee3a980e4e040dd589af2588f2038ed7cc99a`.

Seven original owners (Gateway, Stream, Report, Publication, Tools, Runtime, Session) receive compatible teaching capacity/default fixes. Protected profile remains fixture-only, explicitly requires Report and Publication, and preserves original authority/grant and schema-4 gates. Ordinary default `requireReport=false` does not enable protected live runs. Existing checkpoints and Host definitions are not automatically migrated or rewritten.

## Actual verification, not inherited results

- Targeted new coverage: 11/11 passed, 0 failed/skipped, 3.627 seconds. This preceded the final session-boundary test adjustment and scenario documentation.
- Final complete suite: 81 test files, **507/507 passed**, 0 failed/skipped, 67.927 seconds. Native ESM build then passed in 1.783 seconds; generated source/fixture bytes matched the manifest.
- Both full-suite/build owned processes exited 0 without timeout or orphan, stopped their owned groups and waited their leaders. All 445 manifest files remained unchanged after execution.
- Node 26.11.1, one test worker, 512 MiB old-space bound, owned 180-second suite and 10-second build timeouts. Synthetic local SQLite and owned loopback only; no provider calls or external network calls.
- Original `68dd43b06f39e34971b1761aa6a2cb655a1a2706` 488/488 is retained as historical evidence, not attributed to this candidate.

The protected-long-content scenario in `scenarios.md` maps a 256 KiB control-character body with maximum JSON escaping through original Report and Publication, separate read-only process verification, then revocation denial for future Publication and Reader GET/HEAD. This is not proof for every maximum-parameter combination, all 64-tool × 2 MiB combinations, overlapping concurrent stress, or physical withdrawal of content already disclosed. Immutable artifacts remain unchanged.

## Delivery boundary

The user paused paid fixes and requested v0.16/v0.17 work **without publication**. No paid calls, budget migration, remote ref/tag/release, site deployment or archive occurred. Fixed-version live qualification remains unexecuted and unsupported by this fixture-only profile. Independent review of the teaching integration found no current code blocker; the separate full-source/evidence review checkbox remains pending rather than overstating that review's coverage.

This document and `teaching-integration.safe.json`, plus the task-status addition, are documentation-only after the execution commit. No product or test bytes changed and no redundant rerun is claimed. Local evidence is recoverable from this candidate; it is not a verified remote backup.
