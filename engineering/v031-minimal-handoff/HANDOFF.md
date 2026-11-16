# v0.31 minimal BM25: main Agent validation handoff

WIP checkpoint, not release. Package metadata remains 0.30.0.

Continue this exact commit in hpoenixf/open-etf-agent. Approved product scope: selected text import, BM25 free queries, original sources. Do not add dynamic embeddings, new only/prefer controls, health, ResultRef or reports as required new features. Preserve existing APIs. Start with docs/local-knowledge.md or its Chinese counterpart.

## Receiving Agent instructions

1. Read repository instructions and relevant .agents/skills. Use Node 26.8.1–26.x and locked dependencies from environment-permitted sources. Verify every sourceFiles SHA256 in adjacent PLAN.safe.json. Freeze commit, model/config/settings, deadline rationale, limits and input hashes before any dispatch. Never discard dirty work or move old tags.
2. PLAN.safe.json contains ten new tasks B01–B10 and fictional non-private documents. All are not-run. This fixed tree differs from the earlier local candidate. Do not import old results or relabel outcomes. Recovering old task bodies is not a prerequisite.
3. Read docs/research-project.md and scripts/release-qualification.mjs. Use the supported live research workflow with knowledge capability and knowledge.algorithm="bm25". Local commands and fixture gateways do not count as real-provider runs. Use only capabilities needed for published-answer readback; do not expand product scope to fit the tests.
4. Verify an existing authorized provider/account/model, permitted route and bounded spending authority. Loopback HTTP worked in the prior environment; the external provider route was not permitted. Do not bypass any explicit refusal with another proxy/domain/tool. Do not create credentials/accounts, recharge or enable overage. A call allowance is not a monetary ceiling. If the receiving conversation gives no paid amount/provider bound, obtain it before paid dispatch.
5. Reconcile the current sole-owner budget. Historical snapshots are not a current balance. Preserve old unknown calls/costs and reservations separately, never reset/refund/replay them. Allocate conservatively before physical requests, including retries and subcalls. Stop on accounting, route or safety uncertainty.
6. Materialize only the plan's documents in an ignored local directory; import and retain manifest/source hashes. Freeze all ten questions and specified queries before sequential execution. Keep failure, timeout, cancellation, unknown and not-run in the original denominator; no sample substitution or retry-until-green.
7. Run actual model tasks through the application, read published outputs in a fresh process, record request counts, elapsed time, Runtime completion, source identity, delivery and unknown effects. Review prose separately. B09 must preserve exact query and scope no-match to the admitted collection. Local BM25 checks, mocks and hand-authored vectors cannot replace live evidence.
8. Require ten attempted tasks and at least nine eligible Runtime/delivery successes, no known unresolved Runtime defect, plus separate required safety evidence. scripts/release-qualification.mjs checks declarations only, not authenticity. Keep raw model responses/project state locally, publishing sanitized reviewed summaries only. Relevant executable/config changes require a newly frozen batch, retaining prior outcomes.
9. Complete final affected/broader regression, build, independent review and exact-head CI. This checkpoint is not a release. Main/tag/site publication requires its own authorized and verified completion.

## Verified engineering evidence

This fixed tree: 93/93 affected tests passed, zero skips, including local Reader HTTP; build and module-map check passed. Earlier 115/115 belongs to another local tree with additional unsubmitted changes, NOT this checkpoint. No real-provider task was executed here.

```sh
node --test --test-concurrency=2 test/project-sources.test.mjs test/knowledge*.test.mjs test/research-cli.test.mjs test/tools.test.mjs
node scripts/build.mjs
node scripts/sync-module-map.mjs --check
```

Existing live command shape, only after actual configuration and approvals:

```sh
node src/research-cli.mjs project init --project LOCAL_PROJECT --config REVIEWED_CONFIG_JSON
node src/research-cli.mjs source import --project LOCAL_PROJECT --files SELECTED_FILES_JSON
node src/research-cli.mjs run submit --project LOCAL_PROJECT --run B01 --question QUESTION_TEXT --manifest IMPORTED_SHA256 --approve-provider --approve-data --approve-cost
node src/research-cli.mjs run work --project LOCAL_PROJECT --run B01
node src/research-cli.mjs run inspect --project LOCAL_PROJECT --run B01
```

Placeholders are not defaults. Follow documented persisted-output readback for the chosen output type. Repeat only for original B02–B10 within verified budget, not automatic retries. Credentials belong only in the existing authorized environment, never CLI arguments, tracked config or Git.

## Additional local changes NOT included

- src/knowledge.mjs
- src/knowledge-evaluation.mjs
- test/knowledge-sparse-scope.test.mjs
- test/knowledge-hybrid-prefer-recovery.test.mjs
- test/knowledge-negative-evaluation.test.mjs
- docs/knowledge-retrieval-qualification.md
- docs/knowledge.md
- docs/knowledge.zh-CN.md
- openspec/changes/v031-knowledge-retrieval/proposal.md

Do not assume these increments are present. Existing remote versions remain unchanged. No blocked publication payload is retried here. Do not retrieve/publish absent increments through another route to bypass refusal. This independent checkpoint includes no credentials, dependencies, database, project state or raw model logs.
