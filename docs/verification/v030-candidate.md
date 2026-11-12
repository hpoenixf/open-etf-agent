# v0.30 candidate qualification

Not released or qualified. The original candidate is `005d36e2840974da3cf25902f208d6df51c86c83`.

## Fixed-candidate offline checks

Build passed. Frozen full regression: 1,351 passed, zero failed, four skipped. Targeted tests cover independent cancellation, immutable observations, original source handoff, parent drain, cold recovery and noncooperative effects. These are synthetic checks, not provider acceptance.

## Original real-provider batch

Ten workflows were frozen. Two completed the full Child spawn/inspect/source-backed-report contract. The third failed with `ADMISSION_QUEUE_TIMEOUT`; seven were not run. The batch stopped with 23 request reservations: 22 confirmed subscription/zero-cost responses and one unknown. Unknown work and all reservations remain retained; there was no retry-to-green, refund, or completion claim.

The two completed reports are synthetic-data exercises, not real investment research or evidence of semantic correctness. Their source use and durable delivery passed the mechanical checks; independent semantic review is separate.

## Discovered scheduling problem

Main and Child correctly shared one endpoint slot. However, the original project adapter limited local waiting to 30 seconds even when an admitted Child still had time under its original deadline. Main timed out, and its cleanup cancelled the in-flight Child. A longer local waiting window for the asynchronous contract must preserve capacity one, FIFO, cancellation, the original deadlines, unknown accounting and non-replay. This is not permission to increase provider concurrency or renew a task.

Any corrected candidate requires separate fixed-version validation. This original batch remains unsuccessful and must not be relabeled by later results.


## Corrected-candidate qualification update

Separate candidate `2bfe816` now passed the frozen ten-workflow Runtime cohort, 89 zero-extra-cost requests and no new unknown. Earlier candidate statements above remain historical. [Qualification and semantic limits](v030-release.md). This update does not itself assert tag/Release publication.
