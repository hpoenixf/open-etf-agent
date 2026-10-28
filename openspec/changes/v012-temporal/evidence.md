# v0.12 Temporal verification

Candidate evidence, not yet a remote delivery claim. Node 26.11.1; provider-free synthetic inputs; zero paid/model calls. No private repository code, data or credentials are copied.

- Initial focused run found one test-construction error: Gateway options used names not supported by its existing API (`LIVE_BLOCKED`). The test setup was corrected to use the existing injected-transport API; no network request occurred.
- Focused Temporal + Context + durable Runtime run: 24 passed, 0 failed.
- Additional actual SIGKILL recovery and adopted-context tampering cases, plus article separation assertions: 28 passed, 0 failed.
- Review found explicit `anchorInstant:null` was accidentally treated as omitted on resume; fixed to distinguish undefined from invalid null. A concurrent-admission fallback now adopts the winning original when the caller omitted its instant. Final evidence below supersedes preliminary focused counts, not historical failures.

- First complete Runtime run: 384 tests, 383 passed, 1 failed. The unchanged Host protocol compatibility test detected an extra Session `inspect` introduced by Temporal (3 versus the original 2). Runtime now reuses its post-activation admitted view; the compatibility test is not weakened. Affected Host + Temporal run then passed 22/22.
- Independent ordinary-directory install/build and four distinct CLI/Artifact processes passed with original report SHA-256 `e178d9a53644b32835d812aa10ff0405126e7bc9eddaa6217a5679f83dc6cd2a`. This preceded the final Session-read reuse correction and is refreshed for final source below.

## Final candidate qualification

- Final native ESM build passed on Node 26.11.1.
- Final complete applicable Runtime suite: **384/384 passed, zero failed/skipped**. This includes Temporal's 10 tests, original Runtime/Session/Host recovery and strict article-checker unit contracts. No existing correctness assertion was removed.
- Final independent ordinary directory: locked official-cache `npm ci --offline --ignore-scripts --no-audit --no-fund`, fresh build, separate submit/work/read and separate read-only Artifact verification all passed (six stages). Every built `src`/`fixtures` file matches the installed input. Original 659-byte report SHA-256 remains `e178d9a53644b32835d812aa10ff0405126e7bc9eddaa6217a5679f83dc6cd2a`.
- Independent review's invalid-null and concurrent first-admission findings are fixed and regression-tested; final Session read-reuse delta separately reviewed. Snapshot inputs and sanitized observations are in [the code qualification receipt](../../../docs/verification/v012-temporal.safe.json).
- Public main publication/readback is the publisher's separate final step, not claimed by this pre-publication receipt. Fixed version lineage can be recorded only after that commit exists. Article publication is separate and pending synchronization; no full article/site freshness pass is claimed.
