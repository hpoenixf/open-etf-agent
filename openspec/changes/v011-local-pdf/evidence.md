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


## Integrated qualification — 2026-10-28 07:32 UTC

The preceding blockers are retained historical observations, not the current state. The audited PDF leaves and bounded Session repair are published together at [fixed WIP source `5f42c33892d57ed05e8cd09cad48573e6901995b`](https://github.com/hpoenixf/open-etf-agent/tree/5f42c33892d57ed05e8cd09cad48573e6901995b). Actual ref, both public parents, tree and all 35 changed file bodies were independently read back. No private local Git ancestors were pushed. Package/lock already contain 0.11.0; no new numbering change is needed.

- **Required original Runtime regression:** the [Session repair receipt](../../../docs/verification/session-hot-journal-admission.safe.json) records the actual final 373/373 execution, including the original crash/Worker/PDF tests, under input digest `73148a908096545de29a30842c81255338011ae524d056ef8175a9cdff078828`. All 138 runtime/test/fixture/package/build inputs have the same path set and SHA-256 bytes in the integrated source. This is reused execution evidence, not a new 373-case run. The earlier PDF 358/359 and Session 370/371 failures remain recorded.
- **Changed maintenance consumers:** six non-Runtime maintenance inputs differ from that execution. The original 15 provider-free targets were executed once against the fixed 137-entry source inventory; the four affected consumer-test files separately passed 55/55. [Maintenance qualification](../../../docs/verification/integrated-maintenance.safe.json) and [that 15-target receipt](../../../docs/verification/history/article-coverage-receipts-5f42-15targets-20261028T072744.json) do not manufacture another full-suite pass or expand article coverage.
- **Independent current delivery:** [fresh installation/build/readback receipt](../../../docs/verification/integrated-install-pdf.safe.json) records a new ordinary directory, an offline locked installation of 96 packages from the official npm cache with lifecycle scripts disabled, and newly built source/fixture bytes. Default page 1 and explicitly selected synthetic page 3 were produced by separate CLI processes and reopened by fresh read-only Artifact processes. All 2,423 original PDF bytes and the Source/report hashes matched; all 345 copied inputs remained unchanged. [Input inventory](../../../docs/verification/integrated-install-inputs.safe.json) separates this qualification from the earlier pre-repair install.

The Session correction belongs to the existing storage admission contract exposed by regression, not a second new module. No active PDF durable profile is enabled. No real model, OCR/visual review, real financial document, cloud deployment, browser acceptance or formal GitHub Release is qualified. Existing `tool-host@1` upgrade restrictions remain in the [upgrade guide](../../../docs/upgrade-guide.md).

PDF.3's required code-validation gates are satisfied by these distinct records and independent reviews; this is not whole-version closure. PDF.4 remains open for the sole publisher's final candidate/readback plus the separately verified existing bilingual PDF/intro article and canonical-site chain. Do not archive the change or call article/publication work complete from this local document.


## Narrow PDF coverage amendment — 2026-10-28 10:35 UTC

The PDF article now has one **narrow local text-layer case**, not qualification of its full OCR/image/layout/multimodal scope. The existing checker has an atomic bounded receipt, so adding the sixteenth exact target required a complete 16-target execution; no hand-merged receipt was manufactured. The first such run at source `5f42c33` passed, but consumers failed 54/55 because an old test hardcoded that PDF was absent. That failure and both preceding 15/16-target receipts are preserved.

The smallest maintenance correction retains the absent-capability assertion against the actually unmapped Web article and adds exact PDF `since=0.11`, original commit/tree, test/blob/selector and text-only scope assertions. Its sole changed source leaf was published and read back at [verification source `e0a6a29`](https://github.com/hpoenixf/open-etf-agent/tree/e0a6a29b7474a19c18b169c0e4a7eb0eb614504d). The introduction stays `5f42c33`; it is not rewritten to the newer verification point. [Dated qualification](../../../docs/verification/pdf-coverage-qualification.safe.json) records the new atomic 16-target pass, 56/56 changed-consumer pass and final non-executing `--check`.

Only `test/article-coverage.test.mjs` differs among the prior 138 runtime/test/fixture/package/build inputs. The remaining 137 are exact; original 373 execution and independent install/build/PDF readback remain historical evidence for unchanged code, not new runs on e0a6. No full-suite count is relabeled. PDF.4's final publication and paired-article/canonical-site steps remain separate and open.
