# Evidence — Result / Reference consumption

Initial planning and scope review preceded implementation. The published six-document plan at `21c1b9f0cd53487ff9b31fe16db37b97113c2f89` was not a feature release. This record adds the later local observations without replacing that history.

- Current frozen execution inputs: [133 inputs](../../../docs/verification/result-consumption-inputs.json), SHA-256 `4704f6d92356d125c6d8db56d128492efb0364005bb781439f38e1c50ebf046d`, plus five unchanged checker/control inputs.
- Actual runtime: Node 26.11.1, heap 512 MiB, serial. Package and lock remain 0.9.0/private and 95 original dependency entries, byte-identical to the public base. Paused Web/UI/dependency candidates are not included.
- Structured actual observations: [RED/GREEN and final suite](../../../docs/verification/result-consumption-observations.safe.json); [independent locked installation and delivery](../../../docs/verification/result-consumption-independent.safe.json).
- Independent static review of final source manifest `f03e1ead6482e0f597df2252575f181343102634c2176e7762b026b61c5e39ec`: 11/11 leaf hashes matched, Standards and Spec PASS. The reviewer did not execute tests.

## Observation Log

| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-27 RED | EV-RC-001 | RC.1 | node --test --test-concurrency=1 test/result-consumption.test.mjs | failed: 7/8 before selection/binding implementation; unbound legacy arithmetic passed | docs/verification/result-consumption-observations.safe.json | source-red recorded test SHA | observed-run |
| 2026-10-27 GREEN | EV-RC-002 | RC.1 | node --test --test-concurrency=1 test/result-consumption.test.mjs | passed: 8/8 original source/window/binding cases | docs/verification/result-consumption-observations.safe.json | source-green recorded source/test SHA | observed-run |
| 2026-10-27 RED | EV-RC-003 | RC.2 | node --test --test-concurrency=1 test/result-consumption-delivery.test.mjs | failed: 4/4 before same-ref CSV/report and unavailable recovery adaptation | docs/verification/result-consumption-observations.safe.json | delivery-red recorded test SHA | observed-run |
| 2026-10-27 GREEN | EV-RC-004 | RC.2 | node --test --test-concurrency=1 test/result-consumption.test.mjs test/result-consumption-delivery.test.mjs test/result-consumption-cli.test.mjs | passed: first 18/18; not acceptance for subsequently found review counterexamples | docs/verification/result-consumption-observations.safe.json | source manifest 2de065f7 | observed-run |
| 2026-10-27 RED | EV-RC-005 | RC.2 | selected malformed-reference and recovered-call tests | failed: 3/3 actual counterexamples from independent review | docs/verification/result-consumption-observations.safe.json | review-red recorded source/test SHA | observed-run |
| 2026-10-27 GREEN | EV-RC-006 | RC.2 | original three-file related regression | passed: 21/21; later effective-name gate finding remained to fix | docs/verification/result-consumption-observations.safe.json | source manifest c72d3bab | observed-run |
| 2026-10-27 RED | EV-RC-007 | RC.2 | selected Hook alias-mode test | failed: effective binding name bypassed request digest validation | docs/verification/result-consumption-observations.safe.json | alias-red recorded source/test SHA | observed-run |
| 2026-10-27 RED | EV-RC-008 | RC.2 | selected Host protocol-boundary test | failed: v1 was not explicitly refused before implementing the reviewed v2 boundary | docs/verification/result-consumption-observations.safe.json | protocol-red recorded source/test SHA | observed-run |
| 2026-10-27 RED | EV-RC-009 | RC.2 | selected v2 Hook reconciliation test | failed: existing reconciliation success lacked the new request binding | docs/verification/result-consumption-observations.safe.json | reconcile-red recorded source/test SHA | observed-run |
| 2026-10-27 GREEN | EV-RC-010 | RC.2 | original three-file related regression | passed: 24/24, zero input drift; malformed refs, alias/strip, v1 refusal, v2 resume/reconcile and original bytes | docs/verification/result-consumption-observations.safe.json | final source manifest f03e1ead | observed-run |
| 2026-10-27 RED | EV-RC-011 | RC.3 | node --test --test-concurrency=1 test/result-consumption-delivery.test.mjs | failed: same actual 4-case delivery RED as EV-RC-003, not another execution | docs/verification/result-consumption-observations.safe.json | delivery-red recorded test SHA | observed-run |
| 2026-10-27 GREEN | EV-RC-012 | RC.3 | original three-file related regression | passed: same final 24-case run as EV-RC-010, not another execution | docs/verification/result-consumption-observations.safe.json | final source manifest f03e1ead | observed-run |
| 2026-10-27 CHECK | EV-RC-013 | RC.3 | node --test --test-concurrency=1 --test-reporter=tap test/*.test.mjs | passed: actual 333/333 in 40.932s, no skips/failures/cancellations, all frozen inputs unchanged | docs/verification/result-consumption-observations.safe.json | execution digest 4704f6d9 | observed-run |
| 2026-10-27 CHECK | EV-RC-014 | RC.3 | offline locked npm ci; build; built result-consumption CLI; separate readback process | passed: 95 original packages, 57 built files match, 1366-byte report and 743-byte CSV retain one original calculation/source identity | docs/verification/result-consumption-independent.safe.json | execution digest 4704f6d9 | observed-run |

## Interpretation and limits

The first RED used the initial coverage-field name; before the first GREEN it was clarified to `storedTableComplete` so it cannot imply complete upstream holdings. Each actual receipt preserves its own input/test identity. The initial 18/21 passes did not cover all later independent-review findings; those counterexamples and their actual failures remain visible. RED stops at the first failing assertion in a case, so it does not claim that every later negative assertion in that case was reached.

The actual production Gateway encoder was exercised with a controlled injected transport. This proves the outgoing encoded result/metadata and the next synthetic response path, **not** a real provider's receipt, model reasoning or financial meaning. New model calls: zero; prior live evidence is not expanded to this increment. The CLI and readback were separate real processes; SQLite protocol/body tests used real local synthetic files. No browser or new network-service acceptance is claimed.

The independent install first failed before package installation because the harness supplied the same empty file as npm user/global config. Its actual exit is preserved. Two separate empty process-local config files corrected only the harness; the next offline installation/build/readback passed. No product source, dependency lock or full-suite rerun was used to hide that failure.

## Compatibility and completion

`tool-host@2` is an explicit execution-resumption boundary. Finish old active Runs before upgrading; v1 snapshots are rejected with `UNSUPPORTED_HOST_SNAPSHOT_VERSION`, without migration or a missing-hash bypass. Original result/artifact/publication read interfaces retain their formats. The protocol test uses a synthetic v1 checkpoint, verifies unchanged Session facts/database bytes/original files and zero activation/model calls on refusal, then verifies v2 resumption. A controlled version change between inspections verifies the second pre-claim check; this is not proof of atomic migration under arbitrary concurrent changes.

RC.1–RC.3 are locally qualified. RC.4 (fixed-source publication, coverage/README/article maintenance) is not complete. No numbered release, remote feature promotion, formal Release or complete four-state maintenance archive is asserted. The Kit is a structural view of authored evidence, not an executor or a fictional `spec:close` command.

Actual [Kit structure checks](../../../docs/verification/result-consumption-kit.safe.json): plan/apply pass; status is 3/4 tasks, not-recorded. `verify --check` correctly refuses only incomplete RC.4. This expected publication boundary is retained, not relabeled as a full Kit close.
