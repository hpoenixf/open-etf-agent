# 0.32 release-readiness work — 2026-11-18

Original scope is retained. This is the current execution checklist, not a release
claim. The old stopped candidate is neither imported nor re-reviewed.

- [x] Recheck remote main and preserve other work: `6bc660b`, stable 0.31.0;
  continue the existing candidate branch/PR rather than create a competing publisher.
- [x] Implement a new explicit local-query task/Session profile (schema 7), with
  source manifest, page vectors, model/tokenizer manifest and limits bound at admission.
- [x] Reserve query slots and two local protocol stages atomically with original
  Session tool dispatch; keep physical-stage accounting separate from model calls.
- [x] Persist exact typed vector receipts before Host source ingestion; fence late
  writes and retain unknown reservations. No backend call in verify/reconcile.
- [x] Preserve missing-mode static tasks and reject incompatible Child/plugin/profile
  combinations, model/page-vector changes, corrupt receipts and missing records.
- [x] Add explicit CLI runtime mapping with a fixed offline worker; include that
  reviewed worker in the native build without redistributing weights/dependencies.
- [x] Verify five actual SIGKILL recovery boundaries with synthetic encoder/gateway:
  before backend, tokenizer, encoder, committed receipt before Host, consumed result.
  Lease ordering is test-controlled; the persisted Runtime deadline remains real.
- [x] Execute real E5 CPU dynamic query never prepared before admission; confirm its
  tokens/vector against AutoModel, stop after consumption, resume in a fresh process
  without an embedding runtime, and read the original output. Chat gateway is fixture,
  so this is separate from the mandatory real-provider ten-task cohort.
- [x] Independent review of the new implementation found no confirmed blocker;
  the identified atomicity concern was corrected and tested before proceeding.
- [x] Freeze final executable source/config/corpus/criteria for DeepSeek V4.1 Flash
  and execute all ten logical tasks. Keep the prior Luna batch independent.
- [x] Run one fresh full regression, build/docs/coverage and appropriate clean-install
  and compiled-runtime checks against fixed final inputs; preserve failures/skips.
- [x] Complete independent source/content/evidence review, original-scope gate and
  sensitive-object audit. Matching final PR CI and remote object readback are the
  separate publisher checks before the PR ready-for-review transition; their live
  status belongs to the PR, not this source checklist.
- [x] Prepare consistent 0.32 candidate metadata, bilingual README, module map and
  change notes from actual evidence. Keep historical releases and receipts intact.
- [x] Record local gate outcomes, strict content and original-scope implementation
  in the bilingual release-readiness evidence. Report matching remote CI separately
  after it completes. No tag/Release follows from the declaration checker.

Implementation checkpoint: `f742c3ac949d16e7706e2b6aa0707ad45e9817bd`.
Local execution details/raw diagnostics remain in ignored task-owned output;
only reviewed compact evidence and authored case/product outputs are publishable.

Final behavioral execution pin: `4238a6471c9f653c1e8cf3d3cd9a5f3b66694654`.
The first dynamic cohort remains 10/10 Runtime and 8/10 strict content. After the
versioned evidence-scope framing fix, the full prospective cohort is independently
10/10 Runtime and 10/10 strict content; it does not replace the first denominator.
Final regression: 1,487 passed / 4 optional historical-binary skips / 0 failed.
See `engineering/v032-dynamic-20261118/verification.safe.json` and both retained
qualification records. Package 0.32.0 metadata alone is not a released version.
