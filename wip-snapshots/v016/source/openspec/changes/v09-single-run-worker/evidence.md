# Evidence — single-Run Worker

The initial planning record on 2026-10-27 contained only contract research and design, no executed cases or completion record. Scope review at 05:47 UTC then permitted the single-module implementation. That history is not replaced by an inferred completion; the actual later observations follow.

- Public base: [phase v0.8](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1).
- Public lineage summary: [Worker adaptation](../../../docs/evolution/v09-worker-lineage.md). Private source pins remain restricted local research; no private source is copied into this candidate.
- Original historical code/test/package inputs: `docs/verification/v09-candidate-inputs.json`, 124 files, version 0.9.0, SHA-256 `80966655766966b504f48055c17d0aafce65263ec019b0bd3f59a80dc128fdea`.
- Actual runtime: Node 26.11.1, heap 512 MiB, serial; engine range is a support declaration, not every-version test evidence. Zero new packages and zero provider calls.

- Combined current-main rebind: `docs/verification/v09-combined-inputs.json`, 124 inputs, SHA-256 `445b5cfd2e2cf792b5d431546c4742f893fc66c38f7d033949e0109bcde5431f`; actual full-suite result is separate from the original 305.

## Observation Log
| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-27 RED | EV-901 | 9.1 | node --test --test-concurrency=1 test/worker.test.mjs test/worker-cli.test.mjs | failed: 10/11 expected seam/behavior failures; one pre-existing cancel-after-commit invariant passed | docs/verification/v09-worker-red.safe.json | pre-implementation v08 with new tests | observed-run |
| 2026-10-27 RED | EV-902 | 9.2 | same exact serial 11-case command | failed: host-stop was treated as completion or fallback user cancellation; absent submit/work seams are recorded separately | docs/verification/v09-worker-red.safe.json | pre-implementation v08 with new tests | observed-run |
| 2026-10-27 GREEN | EV-903 | 9.1 | node --test --test-concurrency=1 test/worker.test.mjs test/worker-cli.test.mjs test/worker-process.test.mjs | passed: 16/16 including explicit admission, no-dispatch submit and independent CLI execution | docs/verification/v09-worker-green.safe.json | first focused source/test hashes | observed-run |
| 2026-10-27 GREEN | EV-904 | 9.2 | same exact serial 16-case command | passed: actual SIGTERM, two SIGKILL boundaries, competing processes/cancel and original absolute deadline; no live model | docs/verification/v09-worker-green.safe.json | first focused source/test hashes | observed-run |
| 2026-10-27 CHECK | EV-905 | 9.3 | node --test --test-concurrency=1 test/*.test.mjs | passed: 305/305, no skips/cancellations; all 19 Worker cases and existing regressions; frozen 124 inputs unchanged | docs/verification/v09-observations.safe.json | v09-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-906 | 9.3 | offline locked npm ci then node scripts/build.mjs | passed: 95 unchanged dependencies, 61 independent non-test inputs and 55 exact built files; private and original MIT bytes retained | docs/verification/v09-independent-install.safe.json | v09-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-907 | 9.3 | eight independent built session CLI commands plus actual read-only Artifact owner | passed: zero-dispatch submit, separate work, original definition/deadline, terminal no-op, one receipt; retained v0.6 933 bytes unchanged | docs/verification/v09-independent-delivery.safe.json | v09-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-908 | 9.3 | original Kit lint plan/apply, frozen-input and public-only scan | passed: structural issues empty; 124 input hashes stable; package delta exactly three version fields; no selected sensitive-pattern hits | docs/verification/v09-scan.safe.json | v09-candidate-inputs | observed-run |

| 2026-10-27 CHECK | EV-909 | 9.3 | node --test --test-concurrency=1 test/*.test.mjs | passed: actual combined 309/309, zero failures/skips/cancellations; 124 frozen inputs and all 10 preserved maintenance paths unchanged | docs/verification/v09-combined-observations.safe.json | v09-combined-inputs | observed-run |
| 2026-10-27 CHECK | EV-910 | 9.3 | offline SHA-256 comparison of original and combined delivery inputs plus retained independent dist | passed: all 58 delivery inputs and 55 built src/fixture files identical; original install/eight CLI observations remain historical, not re-executed | docs/verification/v09-delivery-equivalence.safe.json | v09-combined-inputs | observed-run |

The original suite was run once on version 0.9.0, not inferred from v0.8's 286 or the archived expanded 298. The three cases added after the first focused GREEN have their first executed qualification in this final suite. Original private cases are scenario origins only. Independent installation/build and delivery now have actual receipts. The original Kit generates a separate structural view; it does not authenticate test execution or certify a release.

The preserved expanded Web/Worker WIP is not this design. Same-generator background, foreground chat concurrency, browser, HTTP/SSE product surface, full scheduling, semantic quality, new live calls, formal Release and remote publication are not claimed. Code/README/article/site maintenance states remain separate from local runtime qualification.

## Maintenance requalification — 2026-10-27

Base main is now `0cf4b99e77bb77aa2530734d011e7f37985d1897`. Only the already-published coverage checker/test changed among the 124 inputs. The new 309-case run qualifies that actual combination; the original 305-case receipt, input manifest, RED/GREEN, independent install/build and Kit snapshot remain unchanged historical artifacts. No new Worker behavior, dependency, Task/queue, service, model call or browser scope is added. The original 14-target receipt is preserved until a real v0.9 fixed commit permits the separately executed 15-target rebind. The Kit must regenerate its structural view for these authored observations; that does not execute Runtime tests.
