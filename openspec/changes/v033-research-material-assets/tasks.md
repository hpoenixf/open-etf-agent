# v0.33 implementation gates

- [x] Fix current Open and Private baselines and resolve superseded version order.
- [x] Inspect current source import, restoration and task-manifest owners.
- [x] Define durable registry transaction/version policy and explicit limits.
- [x] Add synthetic RED tests for lifecycle, idempotence, failed replacement,
      concurrency, cancellation, restart, corruption and unsafe paths.
- [x] Implement registry using original immutable source owner, not new parsing.
- [x] Add CLI list/register/replace/remove and exact-version selection.
- [x] Exercise selected version through real existing task submission/readback;
      prove old task bindings do not change when current selection changes.
- [x] Run affected original regressions, full Node 26 suite/build and review.
- [x] Freeze and attempt a fresh ten-task real-model acceptance cohort with
      explicit Go authorization, synthetic inputs and separate request accounting.
- [ ] Reach the real-model acceptance threshold in a fresh, authorized cohort.
      The first cohort retained eight successes, one timeout, and one unsent task.
- [ ] Obtain stable-version publication direction; no version bump/tag/release in this candidate.
