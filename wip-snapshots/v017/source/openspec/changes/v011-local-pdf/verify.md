# Verification

<!-- spec-evidence:generated@1 -->
Input digest: sha256:b1b27e80c9b63b53f0426f67c0a7ea44ddc78e9bdca5bc361be370602697dc7d

Generated view for v011-local-pdf. No tests were executed by this command.
Semantic quality: unverified. Release: not-claimed. Observation labels are authored records, not execution authentication.

## Tasks

- [x] PDF.1 Establish original-owner adaptation, dependency/license review and focused failing tests for actual physical-page extraction and delivery.
- [x] PDF.2 Implement bounded one-file parsing and necessary existing Source/Artifact/Host/Runtime/CLI adaptations; preserve failure and provenance boundaries.
- [x] PDF.3 Freeze the candidate; independently review and qualify targeted cases, complete Runtime regression, clean locked install/build and fresh-process original-byte readback.
- [x] PDF.4 [check-only] Publish only qualified audited leaves through the sole publisher; bind actual source/coverage, minimally update existing paired PDF/intro articles and verify the canonical publication chain.

## Observations

| Task | Evidence | Date / phase | Command | Result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PDF.1 | EV-PDF-001 | 2026-10-28 RED | node --test --test-concurrency=1 test/pdf-input.test.mjs | failed: initial 0/13 before implementation | docs/verification/v011-observations.safe.json | red machine-recorded input digest | observed-run |
| PDF.1 | EV-PDF-002 | 2026-10-28 GREEN | node --test --test-concurrency=1 test/pdf-input.test.mjs | passed: 14/14 after exact backing-buffer correction | docs/verification/v011-observations.safe.json | parser-green2 machine-recorded input digest | observed-run |
| PDF.2 | EV-PDF-003 | 2026-10-28 RED | node --test --test-concurrency=1 test/pdf-delivery.test.mjs test/pdf-cli.test.mjs | failed: 5 passed and 4 failed before delivery corrections | docs/verification/v011-observations.safe.json | delivery-red machine-recorded input digest | observed-run |
| PDF.2 | EV-PDF-004 | 2026-10-28 GREEN | node --test --test-concurrency=1 test/pdf-input.test.mjs test/pdf-delivery.test.mjs test/pdf-cli.test.mjs | passed: final focused 26/26 with three review-derived corrections | docs/verification/v011-observations.safe.json | execution digest a55f5fc9 | observed-run |
| PDF.3 | EV-PDF-005 | 2026-10-28 RED | node --test --test-concurrency=1 --test-reporter=tap test/*.test.mjs | failed: 358/359, one existing durable recovery case, exit 1 | docs/verification/v011-observations.safe.json | execution digest a55f5fc9 | observed-run |
| PDF.3 | EV-PDF-006 | 2026-10-28 GREEN | Original final Runtime regression; integrated input-equivalence audit and independent locked install/build/fresh-process PDF readback | passed: original 373/373; unchanged execution code separately installed and original PDF bytes read back; not another full suite run | docs/verification/session-hot-journal-admission.safe.json | frozen input digest 73148a90; public integration5f42c338 | observed-run |
| PDF.4 | EV-PDF-007 | 2026-10-28 CHECK | Actual GitHub ref/tree/blob/body readback; existing fixed article/code checks; exact-commit CI and canonical publication verifier | passed: stable code,32 bilingual case bodies,31 localized locks and final canonical106 article editions plus2 homepages plus2 topic pages | docs/verification/v011-publication.safe.json | code b11f70e; article4db842f; blog258c868 | observed-run |

## Remaining Gates

Completion assessment and any live/release acceptance remain with the project owner.
