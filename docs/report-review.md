# Explicit report review

Review a finished report without rewriting it. v0.28 adds an independent advisory workflow after v0.26 Web evidence and v0.27 specialist synthesis. It checks a frozen report and its original source text, records the original result, and supports cold readback and cancellation through the existing Runtime/Session owners.

**Scope:** Markdown Artifact revisions only, at most **48,000 UTF-8 bytes for the entire serialized request**, including report, source snapshots and metadata. Oversized reports are rejected, never truncated. The nested serialized question must additionally fit 60,000 bytes within the existing 65,536-byte Session definition. The existing host-results@3 projection and 131,072-byte context budget also enforce actual encoded Gateway capacity before dispatch. This remains narrower than the general report writer. Binary/CSV/PDF attachments are not semantically reviewed. Web static extraction retains its original provenance but does not imply visual or dynamic-page inspection. Protected Artifact roots are refused until a document-authorization-preserving integration exists.

## Offline CLI

Use Node 26.8.1–26.x. The source can be a report produced by the research or specialist workflow. Replace the directory and exact revision ID with those from its original receipt.

```sh
node src/report-review-cli.mjs prepare --session output/review --source output/original-run --revision revision:sha256:HASH --request review-001
node src/report-review-cli.mjs run --session output/review --run review-review-001
node src/report-review-cli.mjs read --session output/review --run review-review-001
node src/report-review-cli.mjs cancel --session output/review --run review-review-001
```

`prepare` reads the original Artifact store, verifies the complete revision and attachment identities, freezes its report/source snapshots and submits without a model call. Default `run` is a clearly labelled synthetic lifecycle fixture: it returns no findings and says semantic review was not performed. It is not a useful model opinion or successful semantic acceptance.

The same request ID cannot be rebound to changed content. Repeated runs/readbacks of terminal work do not call a model again. Process loss after dispatch remains unknown; do not create a replacement request to hide the original uncertainty. `cancel` uses Session cancellation; it cannot prove an already dispatched provider request has stopped. Cancellation and unknown settlement are separately visible.

## Real Gateway integration

The API supports real Gateway execution through the existing shared Admission owner. The host must verify provider/data authorization and its cumulative cost/request budget before supplying that Gateway. Shared Admission protects concurrency; it is **not** a financial spending ledger. This module never reconstructs a missing ledger or grants spending permission.

- `prepareReportReview({sourceDirectory, revisionId, requestId})`
- `submitReportReview({directory, request, gatewayBinding})`
- `executeReportReview({directory, runId, gatewayFactory, gatewayBinding, signal})`
- `readReportReview({directory, runId})`
- `cancelReportReview({directory, runId})`

The CLI can use a trusted local ESM integration via `--gateway-module /absolute/path/host-gateway.mjs` on both `prepare` and `run`. It exports `gatewayBinding` (the normal Session Gateway identity) and `createGateway({session, directory, runId})`, returning `{gateway, close}`. The factory wraps the existing `createChatGateway` with `createSharedAdmission(...).wrap(..., {session, runId})`, wraps the exact supplied Session object (not a separately opened connection), uses the host's existing approved transport/budget owner, and closes its own resources. The binding must match the frozen request. No factory is called during preparation. `read` and `cancel` reject this option and never import a module.

**A Gateway module is executable, trusted host configuration, not a sandbox or untrusted model input.** Importing it executes its top-level code. Keep provider calls inside the admitted Gateway, never module initialization. Do not put secrets in bindings or packets. The default synthetic path has no network capability. The API rejects non-fixture Gateways without the existing shared-admission contract.

## Results and trust

Records include the original model answer, original Runtime outcome, exact report/revision/packet hashes, original resource usage, cancellation/unknown facts, schema-checked findings and unchecked scope. Invalid JSON, invented source references or incorrect report quote offsets fail review parsing while preserving the original answer. No accepted findings are exposed for failed/cancelled/unknown work.

Each finding distinguishes material support from citation correspondence, and facts from inference or advice. UTF-16 offsets identify report spans; SHA-256 hashes UTF-8 bytes. Source quotes are checked against the named frozen source. These checks establish locations, **not semantic truth**. A model can still be mistaken. There is no global score or “verified” badge, and an empty findings list does not certify anything.

`prepare` checks the original Artifact store at that time. The exported packet can also be supplied directly by a trusted host. Its self-consistent hashes do not authenticate an originating Run, publisher, public source or current permission. Cold readback validates the frozen request and original Session facts; it does not reread the source directory, refetch a URL, or add new authority. Review findings never become original evidence or a repair/publication command.

## Verification

`test/report-review*.test.mjs` exercises the actual Runtime/Session/Gateway/Artifact composition. `fixtures/report-review-cases.json` contains ten synthetic report/source input seeds and expected human checks: supported claim, numeric error, risk inversion, wrong period, wrong currency, omitted condition, missing evidence, Unicode, citation mismatch and prompt injection. Scripted expected outputs are explicitly not model results. These seeds are not a frozen executable live cohort: Gateway configuration, task identities and original budget reservations remain unspecified. R09 places A/B in one text; it does not construct two independently bound source identities and does not establish citation-correspondence coverage. A future live harness must create separate original sources and exact citation mappings before freezing that case.

Live semantic acceptance has **not run**: the complete cumulative budget ledger was unavailable. Do not interpret offline passes as real reviewer effectiveness or full release qualification. The original private post-hoc review owner informed this adaptation; automatic in-research Reviewer cadence and private authorization-lineage features are not claimed as implemented.

### Cross-version owner integration

`test/report-review-owner-integration.test.mjs` also runs the actual Web acquisition owner (robots/selected-page acquisition, extraction and immutable source admission) using the existing bounded synthetic network fixture. It then selects a persisted v0.27 specialist profile, submits the original task, removes the current profile, executes the frozen selected Child, saves the original-source report, and reviews that exact Artifact revision. Original report bytes, task bytes, revision list, acquired source manifest and Web request count remain unchanged through review/readback. This tests the composed owners, not a manually fabricated Web provenance envelope or only the legacy specialist demo.

A separate regression creates an unknown Gateway settlement in one process, exits, reads it through a fresh CLI process, then attempts execution through another CLI process. The terminal unknown record and original model debit remain unchanged; the supplied Gateway factory is never invoked. It is an injected lost-settlement fixture, not evidence of a real provider failure or a remote cancellation.

All these transports and model replies are synthetic. **Real external Web access and real-provider semantic review remain unverified.** Passing the composed workflow does not certify the scripted finding or remove the live budget/admission gate.
