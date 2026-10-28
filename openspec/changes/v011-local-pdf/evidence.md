# Evidence — v0.11 Local PDF

2026-10-28 initial plan. No implementation/test/publication completion is claimed. Dependency review and exact baseline comparison are recorded in the local engineering packet. Future entries must identify actual execution inputs and retain failures; do not relabel v0.10's historical 333 or 15-target receipts.

## 2026-10-28 focused implementation evidence

All cases used original synthetic PDF bytes, the installed production parser and Node v26.11.1 on Linux. Gateway transport was controlled/offline; no provider/model calls or visual/semantic qualification occurred. The original failing records remain in the engineering packet.

| Stage | Actual result | Boundary |
| --- | --- | --- |
| Initial parser/Artifact RED | 0/13, exit 1 | Missing implementation / unsupported binary Artifact |
| First parser GREEN attempt | 8/13, exit 1 | Upstream Buffer backing-offset behavior prevented real extraction |
| Exact-length adapter | 14/14, exit 0 | Production parser; prefix/suffix subarray regression |
| Delivery RED | 5/9, exit 1 | Missing CLI and stripped/tampered PDF provenance validation |
| Delivery GREEN | 23/23, exit 0 | Same Runtime → actual Gateway encoding → report/PDF readback |
| Post-commit cancel RED | 7/8, exit 1 | Original Artifact committed but absent from failure effects |
| Post-commit cancel GREEN | 24/24, exit 0 | Cancellation preserved with the actual committed effect |
| FIFO review correction | 25/25, exit 0 | Real FIFO with no writer rejected and closed without waiting |
| Source bracket-marker RED | 2/3, exit 1 | Source markers were misread as report citations |
| Display-only correction | 26/26, exit 0 | Fullwidth excerpt markers; original Source/Result/PDF unchanged |

The first 23-case pass predates the three version fields changing to 0.11.0; subsequent runs use 0.11.0. It is not fresh final full-suite evidence. Independent review, final locked install/build/full suite, source publication and coverage/article binding remain separate pending gates.

The adapter copies the selected Buffer into an exact-length backing allocation before calling upstream parseBuffer. No third-party library bytes were modified. The local path is opened nonblocking before the regular-file check so a FIFO cannot hang acquisition before parser timeout exists. These are application boundary fixes, not sandbox or hostile-document certification.

## Observation Log

| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-28 RED | EV-PDF-001 | PDF.1 | node --test --test-concurrency=1 test/pdf-input.test.mjs | failed: initial 0/13 before implementation | docs/verification/v011-observations.safe.json | red machine-recorded input digest | observed-run |
| 2026-10-28 GREEN | EV-PDF-002 | PDF.1 | node --test --test-concurrency=1 test/pdf-input.test.mjs | passed: 14/14 after exact backing-buffer correction | docs/verification/v011-observations.safe.json | parser-green2 machine-recorded input digest | observed-run |
| 2026-10-28 RED | EV-PDF-003 | PDF.2 | node --test --test-concurrency=1 test/pdf-delivery.test.mjs test/pdf-cli.test.mjs | failed: 5 passed and 4 failed before delivery corrections | docs/verification/v011-observations.safe.json | delivery-red machine-recorded input digest | observed-run |
| 2026-10-28 GREEN | EV-PDF-004 | PDF.2 | node --test --test-concurrency=1 test/pdf-input.test.mjs test/pdf-delivery.test.mjs test/pdf-cli.test.mjs | passed: final focused 26/26 with three review-derived corrections | docs/verification/v011-observations.safe.json | execution digest a55f5fc9 | observed-run |
| 2026-10-28 RED | EV-PDF-005 | PDF.3 | node --test --test-concurrency=1 --test-reporter=tap test/*.test.mjs | failed: 358/359, one existing durable recovery case, exit 1 | docs/verification/v011-observations.safe.json | execution digest a55f5fc9 | observed-run |

## Final regression blocker — retained WIP, 2026-10-28

The first final full suite used the [134 frozen inputs](../../../docs/verification/v011-inputs.json) without drift and ended 358/359, not a completed version. The failing existing saved-report recovery case was killed with a real hot rollback journal; a fresh child failed during the read-only Session schema probe with `SQLITE_READONLY_ROLLBACK` (776), before any new checkpoint.

Only two copies of that original synthetic database/journal were inspected in a separately authorized diagnostic. Readonly admission reproduced 776 without changing the copy. Native SQLite recovery on the other copy preserved schema2/application identity and the original result-committed save-one Artifact receipt; the original database and journal hashes did not change. This demonstrates an existing Session admission boundary, not a PDF parse failure. The exact interrupted transaction is not known. See [SQLite's error definition](https://www.sqlite.org/rescode.html#readonly_rollback) and [native hot-journal recovery](https://www.sqlite.org/lockingv3.html).

Session production code has not changed. Do not delete the journal, weaken assertions or use a successful rerun to erase this failure. Independent install/build and full publication remain paused until the separate Session boundary is resolved or honestly recorded as blocked. PDF.3/PDF.4 are not complete; this packet is a recoverable WIP, not stable main, a formal Release, or model/visual qualification.

## Independent PDF delivery check — 2026-10-28 01:21 UTC

After the initial WIP backup, the owner explicitly permitted the unaffected install/build/PDF readback gate while Session repair stays separate. [The new structured receipt](../../../docs/verification/v011-independent.safe.json) records one fresh-directory, fully offline locked installation of 96 packages with lifecycle scripts disabled, 61 byte-identical built source/fixture files, and successful default plus operator-selected PDF CLI runs. Each was read by a separate fresh process: physical page 3/3, all 2,423 original PDF bytes, source text hash and report hash matched. The default remained synthetic; the explicit operator selection did not acquire a synthetic claim. No selected absolute path entered the delivery records. All 134 execution inputs and seven controls stayed unchanged.

This check took 3.075 seconds on Node v26.11.1. It did not run the whole suite, Session recovery or a model/provider. The earlier independent-install pending statement is historical; this one narrow gate is now passed. The original 358/359 full failure and the open Session defect remain unchanged, so PDF.3/PDF.4 and stable v0.11 promotion remain incomplete. No new release, coverage pin, article or main promotion is implied.
