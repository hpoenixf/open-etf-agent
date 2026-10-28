# v0.13 ordinary-response verification

Implementation qualification and separately verified public release evidence. Node **26.11.1**, SQLite **3.53.4**, synthetic data only, zero paid/live model calls. The original Runtime and independent processes execute these tests; this is not model-understanding qualification.

## Preserved failures and fixes

1. Before implementation, the original loadable Runtime test failed behaviorally: expected `awaiting-response`, actually `failed`. No missing import or absent file was counted as RED.
2. The first affected regression found that eager schema admission had changed v2's existing malformed-JSON opening behavior. Admission was narrowed to reject new ordinary semantic markers only; existing v2 malformed-state rejection remains at readback. The affected **48/48** suite then passed without weakening its assertions.
3. Early independent static review identified four defects: a receipt arriving in the question callback could bypass the initial yield; working-input reply bytes could diverge from the receipt; no-fact consumed/dispatched ordinary calls could masquerade as legacy results; and the retained question marker was not checked after adoption. All four were fixed and have direct regression coverage.
4. First full run: **419 total, 418 passed, 1 failed**. A new process fixture used a 50 ms lease and expired under full-suite load before its post-claim read. The fixture now uses the existing default 1000 ms lease and explicitly waits for expiry after SIGKILL. Production lease rules were not changed or weakened. The successful full run includes two subsequently added cases.

## Qualified frozen input

- Focused new ordinary-response coverage: **37/37 passed**; original Runtime/Session/CLI/recovery affected regression: **48/48 passed**.
- Native ESM build passed. Full applicable provider-free regression: **421/421 passed**, zero failed/cancelled/skipped.
- Four actual SIGKILL boundaries: sealed proposal before question registration; committed question before yield acknowledgement; committed adoption before paired consumption; and post-adoption model reservation. The last resumes as `MODEL_OUTCOME_UNKNOWN` with no Gateway replay.
- Real concurrent resume processes cannot share the lease/adoption; the losing process makes no model dispatch. Two SQLite connections verify both cancel-first and reservation-first orderings; the admitted-before-cancel case actually invoked the fixture Gateway once, not a false promise of zero physical dispatch.
- v2 negative config/allowlist/binding/phase/result/fact cases, v3 identity/hash/working-input/no-profile/no-fact/DDL tampering and real v3 hot-journal recovery/refusal all pass. Rejected cold/hot inputs retain their original bytes. Existing external-reference and bounded recovery guards are unchanged.
- A clean ordinary-directory `npm ci --offline --ignore-scripts --no-audit --no-fund` used the existing official npm cache and empty npm configs. Separate build, start, receipt, resume, explicit fact read and read-only Artifact processes passed. Every built `src`/`fixtures` byte equals the independently installed input.
- The actual **840-byte** report contains the exact synthetic reply and independently reads back as SHA-256 `319a22541f23dfd68799ab30cd2512c91edcd380e6e8791170d668e2114dd8ee`.
- An actual original-v2 opener rejects the new v3 database without byte changes. A new synthetic v2 Publication/report was produced by the fixed original implementation, then read by the new Publication and Artifact consumers; no old/private database was accessed.

Structured commands, counts, hashes, input identity and independent readback are in [the qualification receipt](../../../docs/verification/v013-ordinary-response.safe.json). Final independent review is recorded below; actual public release is recorded in [release evidence](../../../docs/verification/v013-release.safe.json); article work is independent.

## Scope / release boundaries

No new scheduler, executor, manager, account/credential, permission model, Memory intent, Child composition, database migration or automatic retry. The sole new table lives in Session's existing SQLite transactions. Default v2 remains exact; new v3 is explicit. Prior tags/phase branches and `versions.json` pins are not moved. Article/site work is independent of code delivery and not asserted here. A published-release claim requires the actual new phase/main/tag/Release lineage, remote byte readback and exact-commit CI.

## Final independent review and structural archive disposition

Independent code review returned **Standards GO / Spec GO, zero required fixes**. All 140 frozen source/test entries matched; the reviewer read the frozen contract and relevant implementation paths, did not rerun tests, and did not modify files or remote state. Its [safe review record](../../../docs/verification/v013-review.safe.json) separates code-contract GO from publication authority. No executable/test input changed after the 421-case run, independent delivery or review.

The existing public Evidence Kit is used only for structural lint/verify/status checks. Code implementation, qualification, independent review and remote release verification are complete. Article work is outside the code-closure task denominator. Release facts come from actual remote reads, not local tests. Structural completion is recorded separately; no archive transition is inferred and prior public Specs remain in `openspec/changes`.

## Observation Log

| Date / phase | Evidence | Task | Command | Result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-28 RED | EV-1301 | 13.1 | node --test test/ordinary-response.test.mjs | failed: original Runtime returned failed instead of awaiting-response | docs/verification/v013-ordinary-response.safe.json | original runtime base 46c2822 | observed-run |
| 2026-10-28 GREEN | EV-1302 | 13.1 | node --test --test-concurrency=1 test/ordinary-response*.test.mjs | passed: 37/37 new cases | docs/verification/v013-ordinary-response.safe.json | frozen 0.13.0 source/test inputs | observed-run |
| 2026-10-28 CHECK | EV-1303 | 13.2 | node --test --test-concurrency=1 test/*.test.mjs; separate offline npm ci/build and 11-stage process readback | passed: 421/421 plus original840-byte report, oldv2 readback and old-opener v3 refusal | docs/verification/v013-ordinary-response.safe.json | frozen 0.13.0 qualification inputs | observed-run |
| 2026-10-28 CHECK | EV-1304 | 13.3 | independent read-only Standards/Spec review and 140 SHA-256 input comparison | passed: GO / GO, zero required fixes; no tests rerun by reviewer | docs/verification/v013-review.safe.json | frozen140 source/test inputs | observed-run |
| 2026-10-28 CHECK | EV-1305 | 13.4 | GitHub exact-commit Verify and ref/tree/24 body/phase/tag/Release readback | passed: public implementation and fixed release identities agree | docs/verification/v013-release.safe.json | 300f78f7066ab76fcc4e9efb54137ff021ecc278 | observed-run |
