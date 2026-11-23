# Publication workflow: ten real tasks, nine successes

**Current campaign override — 2026-11-03:** v0.7–v0.18 each require ten **fresh** real tasks, at least nine successes, and zero known unresolved applicable Runtime defects before advancing in version order. Old successes do not supply this campaign's numerator. [Scope, fixture-only boundaries and retained history](live-validation.md#fresh-v07-v18-campaign-20261103). The general inventory/reuse steps below apply outside this explicit fresh campaign; inventory still prevents accidental duplicate dispatch and preserves all prior evidence.

1. Confirm version scope, fixed execution inputs, existing writer and sole publisher. Read [current live policy](live-validation.md#release-qualification) and [dated decisions](verification/release-gate-20261102.md), not an older qualification boolean alone.
2. Inventory original plans, all outcomes, original output/readback and the shared ledger. Reuse valid ten-task evidence with applicable execution inputs. Do not redo history because a later sample has five tasks or a metadata SHA changed.
3. If genuinely missing, freeze a dated minimal backfill plan within existing authorization and budget. Exactly ten real tasks per version, at least nine successes. Keep failures, timeouts and unknowns; never replace failed samples or retry until green. Provider-free safety is separate.
4. Derive the current decision from immutable receipts and documented input equivalence. Run `node scripts/release-qualification.mjs DECISION.json`. Rejection/incompleteness blocks formal release. This declaration guard does not fabricate evidence, call models or grant permission.
5. Independently review required safety, install and original output/readback. Keep real-provider API, fixture CLI, semantic quality and unsupported scope distinct. A fixture-only profile has no live pass and is not a blanket version exemption.
6. Audit all newly reachable objects. The sole publisher uses authorized non-force writes, preserves remote content and verifies ref/tree/blob/actual bytes plus original CI. Tag/Release points to the actual final package, not merely a local/source hash.
7. After verifying a stable GitHub Release and its exact tag, proceed directly to the [production server rollout](#production-server-rollout-after-a-stable-release) as part of the same release workflow.
8. Update README, article mappings and deployment claims only to proved scope. Norm/metadata correction is not a product release. Historical tags and measurements remain unchanged.

## Production server rollout after a stable release

This is an operator step for the authorized production deployment, not an automatic GitHub trigger. A draft, prerelease or docs-only update does not trigger production rollout. Keep three outcomes distinct: **GitHub release**, **staging qualification**, and **production rollout**.

- [ ] **Pin the build.** Read back the GitHub Release and confirm its stable tag resolves to the final qualified commit. Prepare a separate installation from that commit and its dependency lock using the supported runtime; verify commit, lock and build before switching. Do not deploy moving `main` or substitute a staging checkout or state.
- [ ] **Check compatibility and rollback.** Follow the [operator upgrade checklist](upgrade-guide.md#operator-release-checklist). Retain the current known-good artifact, service configuration and recoverable backups. Stop new admissions and let old Runs finish on their original Runtime, or isolate that deployment and its data. Rehearse any required state migration and rollback in isolation before cutover. If active or unsettled work, state compatibility, or safe rollback cannot be established, leave production unchanged and record the rollout as blocked.
- [ ] **Switch and verify.** Use the existing authorized operator path. Preserve the production configuration, access controls, credentials and data; do not copy staging state. Verify the active service is running the tagged build, health checks pass, sign-in still works, and a previously saved answer can be reopened from History without replay. Verify scheduled work cannot run twice. Prefer provider-free checks and reuse valid staging evidence; do not rerun the live cohort in production.
- [ ] **Record the outcome.** Mark production complete only after those checks pass. On failure, stop new admissions, restore the previous known-good service when safe, and verify health, sign-in and History again. Preserve original Runs, committed outputs and uncertain effects; never restore a stale snapshot over newly committed work. Record the deployed or restored version and the blocker, without private infrastructure or user data in public evidence. A published tag remains published even if rollout is blocked or rolled back.

## Test completion includes evidence-preserving cleanup

After a test reaches a verified terminal state, follow the [cleanup discipline](live-validation.md#test-completion-and-cleanup-discipline) promptly: preserve original evidence first, retire only owned unused temporary state, and record measured space reclaimed. A test is not operationally finished merely because its assertions passed. Do not change pinned inputs while another cohort is running.

## Six-layer README synchronization

`docs/module-status.json` is the only source for the bilingual module map, accessible SVGs and detail pages. It describes reviewed public scope, not an acceptance score. Existing article coverage and immutable release evidence remain their own authorities.

Before changing `package.json` to a new version, review affected module rows, source links, boundaries and the version's actual evidence. Set `reviewedVersion`, `reviewedSource` and `evidence` to that reviewed scope, then run `npm run docs:sync`. Do not relabel old evidence as a new pass. New module ownership needs an explicit placement; file existence cannot decide maturity.

Normal `npm run build` regenerates both README sections and images from this reviewed source, so release preparation keeps them synchronized. `npm run docs:check` runs before CI build and rejects stale generated bytes or a package/reviewed-version mismatch. Commit generated files with the source, preserve existing remote content, and perform the usual remote readback. A passing declaration check does not prove the review was correct or publish anything.

This is build-time synchronization plus a CI gate, **not a GitHub Release listener or autonomous push service**. A release made outside the normal build/review process does not update main by itself. No write token, new scheduler, permission expansion or paid model call is required.
