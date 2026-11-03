# Publication workflow: ten real tasks, nine successes

**Current campaign override — 2026-11-03:** v0.7–v0.18 each require ten **fresh** real tasks, at least nine successes, and zero known unresolved applicable Runtime defects before advancing in version order. Old successes do not supply this campaign's numerator. [Scope, fixture-only boundaries and retained history](live-validation.md#fresh-v07-v18-campaign-20261103). The general inventory/reuse steps below apply outside this explicit fresh campaign; inventory still prevents accidental duplicate dispatch and preserves all prior evidence.

1. Confirm version scope, fixed execution inputs, existing writer and sole publisher. Read [current live policy](live-validation.md#release-qualification) and [dated decisions](verification/release-gate-20261102.md), not an older qualification boolean alone.
2. Inventory original plans, all outcomes, original output/readback and the shared ledger. Reuse valid ten-task evidence with applicable execution inputs. Do not redo history because a later sample has five tasks or a metadata SHA changed.
3. If genuinely missing, freeze a dated minimal backfill plan within existing authorization and budget. Exactly ten real tasks per version, at least nine successes. Keep failures, timeouts and unknowns; never replace failed samples or retry until green. Provider-free safety is separate.
4. Derive the current decision from immutable receipts and documented input equivalence. Run `node scripts/release-qualification.mjs DECISION.json`. Rejection/incompleteness blocks formal release. This declaration guard does not fabricate evidence, call models or grant permission.
5. Independently review required safety, install and original output/readback. Keep real-provider API, fixture CLI, semantic quality and unsupported scope distinct. A fixture-only profile has no live pass and is not a blanket version exemption.
6. Audit all newly reachable objects. The sole publisher uses authorized non-force writes, preserves remote content and verifies ref/tree/blob/actual bytes plus original CI. Tag/Release points to the actual final package, not merely a local/source hash.
7. Update README, article mappings and deployment claims only to proved scope. Norm/metadata correction is not a product release. Historical tags and measurements remain unchanged.

## Test completion includes evidence-preserving cleanup

After a test reaches a verified terminal state, follow the [cleanup discipline](live-validation.md#test-completion-and-cleanup-discipline) promptly: preserve original evidence first, retire only owned unused temporary state, and record measured space reclaimed. A test is not operationally finished merely because its assertions passed. Do not change pinned inputs while another cohort is running.
