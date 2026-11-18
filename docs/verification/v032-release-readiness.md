# 0.32 original-scope qualification and release preparation

[简体中文](v032-release-readiness.zh-CN.md)

**Fixed final cohort: 10/10 Runtime/delivery and 10/10 strict original-source content.**
The required threshold is 9/10. Knowledge now includes real local page preparation,
in-Run dynamic query encoding, atomic budgets and durable no-replay recovery.
Package metadata is 0.32.0 on the candidate branch. The latest formal Release is
still 0.31.0; this record does not create a tag or Release.

Behavioral execution source:
[`4238a6471c9f653c1e8cf3d3cd9a5f3b66694654`](https://github.com/hpoenixf/open-etf-agent/commit/4238a6471c9f653c1e8cf3d3cd9a5f3b66694654),
tree `ec2b0988761b8b2ff5700aa1a118f15e66ef69cf`.
[Fixed plan/input inventory](../../engineering/v032-dynamic-20261118/final/PLAN.safe.json) ·
[Config](../../engineering/v032-dynamic-20261118/final/config.json) ·
[Ten-task decision](../../engineering/v032-dynamic-20261118/final/QUALIFICATION.safe.json) ·
[Independent review](../../engineering/v032-dynamic-20261118/review.safe.json) ·
[Reproduction](../../engineering/v032-dynamic-20261118/REPRODUCE.md).

## Original scope, implemented and checked

Knowledge is the principal enhanced module. The original Session/Runtime owners
provide supporting adaptation, not a second billing platform. The new task profile
binds selected source/model/page-vector identities and token/query limits. Its
Session schema 7 atomically reserves an original tool use, one query and two local
operations before dispatch. Each physical local stage is marked before execution;
typed vector evidence is committed before Host consumption. Cross-Run tokens,
stale fences, altered models/sources/vectors, bad or missing receipts and
incompatible capabilities fail closed.

A complete receipt permits pure retrieval recovery without a tokenizer or encoder.
An incomplete/uncertain stage retains its reservation and ends unknown rather
than re-encoding. Original deadlines are retained. Five actual separate-process
SIGKILL boundaries pass: before backend work, after tokenizer dispatch, after
encoder dispatch, receipt committed before Host, and Host consumption. These use
synthetic chat/encoder fixtures and controlled lease ordering; the persisted
Runtime deadline remains real. They are distinct from real-model evidence.

Real `intfloat/multilingual-e5-small` CPU execution uses the fixed MIT model
revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`. A business query absent at
admission is encoded against reused page vectors; token IDs match independent
AutoModel reference and maximum vector difference is **0**. A fresh Node process
finishes after interruption without an embedding runtime, then cold-reads the
original output. The same path passes through the compiled `dist` runtime and
its exact copied Python worker. [Source CPU receipt](../../engineering/v032-dynamic-20261118/real-cpu.safe.json) ·
[Compiled CPU receipt](../../engineering/v032-dynamic-20261118/compiled-real-cpu.safe.json).
Chat in these CPU checks is fixture and is excluded from the real ten-task count.

## All ten final real tasks retained

Every task uses the literal query once at limit 4. The first uses the exact `only`
subset; the second uses `prefer` and expands within the admitted collection.
All ten business queries are absent from initial preparation. Each completes one
dynamic query, reserves/dispatches two local operations, has zero unsettled queries,
ends within its original 300-second deadline and cold-reads its original report or
ordinary persisted answer. All original source hashes and 427 frozen input hashes
were rechecked before packaging. There were no unknown effects or costs.

| Task | Original case | Strict content: pass | Model requests | Tokens | Added USD |
| --- | --- | --- | ---: | ---: | ---: |
| D232-01 | P01 | Cash/overnight; conditional bills; prohibitions preserved | 3 | 15851 | 0 |
| D232-02 | P05 | Current June/December rule; prefer expands | 3 | 19794 | 0 |
| D232-03 | P08 | Superseded quarter-end rule for historical backtests | 3 | 19216 | 0 |
| D232-04 | P10 | Saturday excluded via original weekend rule | 3 | 18709 | 0 |
| D232-05 | N01 | Subscription amount explicitly not specified; not zero | 3 | 18708 | 0 |
| D232-06 | N02 | Insufficient evidence for auditor identity | 2 | 10862 | 0 |
| D232-07 | N03 | Insufficient evidence for dated NAV | 2 | 10970 | 0 |
| D232-08 | N04 | Insufficient evidence for cake instructions | 2 | 10725 | 0 |
| D232-09 | N05 | Insufficient evidence for ticker | 2 | 10755 | 0 |
| D232-10 | N06 | Insufficient evidence for investor count | 2 | 11202 | 0 |

All **25 physical requests** requested and resolved `deepseek-v4.1-flash`
(advertised canonical `deepseek/deepseek-v4.1-flash-1017`), with Go billing and
**0 USD additional cost**. Usage is **138,517 prompt + 8,275 completion = 146,792
tokens**. No top-up, extra billing activation, alternate endpoint or retry occurred.
The global hard allowance was 30×$1.75; retained earlier allocations were $9,947.50,
so maximum cumulative holds stayed $10,000. The pinned metadata maximum at 2×
pricing is $0.7608/request, below that hold. Prior unknowns were not refunded.
The earlier dynamic batch used 25×$3.50 held; only its unused 15 slots were retired.
These holds are conservative accounting, not a claim about account cash balance.

## Failures retained and repaired

The first dynamic source `f742c3a` completed ten Runtime tasks but scored **8/10
strict content**. D032-04 and D032-06 made unsupported/ambiguous whole-collection
absence statements after 4/8-page retrieval. Its [decision and original outputs](../../engineering/v032-dynamic-20261118/first/QUALIFICATION.safe.json)
remain unchanged. The ordinary release declaration rejects that cohort.

The fix pins `source-faithful-local-query@1` only for new dynamic tasks, explicitly
requiring returned-page scope and consistency through the closing sentence of both
report and final answer. Legacy @6 questions and all ten old cold output hashes
were rechecked unchanged without inference. The final complete prospective cohort
retains the same questions, sources, expected content, limits and criteria. No
failing task was replaced; no relevance label or ranking threshold was changed.
The older [prepared Luna cohort](v032-live-20261117.md), original 401 and not-run
history are separate and do not supply this numerator. The stopped unpublished
candidate was not imported or its refused operation retried; no platform safeguard
was disabled. User authorization supported fresh development from public source.

N01 explicitly states that the fee amount is not specified in that source;
N02–N06 require abstention because returned evidence does not answer the question.
All six still return candidate pages. The old 16-query retrieval diagnostic and its
negative-return metric remain unchanged: candidate recall, sufficient original
support and final-answer correctness are three different observations.

## Regression and packaging boundaries

The fixed final behavioral source passes **1,487 tests**, zero failures and four
optional old-binary compatibility skips on actual Node **26.11.1 / macOS arm64**.
Six separate Python contract fixtures pass. The source/compiled real CPU checks
above are separate. An initial full-suite invocation with the host's noncanonical
macOS temporary path failed path admission and was stopped; that excluded run is
retained and is not the accepted denominator. No product path check was relaxed.
Build, docs, article-coverage declaration, OpenSpec, clean install and packaging
checks are recorded in [verification](../../engineering/v032-dynamic-20261118/verification.safe.json).
The current PR's final matching CI is a separate required remote check; old CI
results do not attest the new dynamic implementation.

Package/lock version metadata, README, reviewed module presentation and new evidence
follow the behavioral pin. Original runtime code and locked dependencies are
unchanged by packaging; the entire 427-file inventory is not claimed byte-identical
after those deliberate metadata/document edits. Generated maps use the sole
`sync-module-map.mjs` source. Stable v0.31 links and historical receipts remain.

No confirmed applicable Runtime defect remains from the source/independent reviews.
The result qualifies this bounded authored-data integration, not general financial
accuracy, semantic ranking superiority, live concurrency, browser behavior, remote
embedding services or full private A20 parity. Model/runtime environments must be
prepared explicitly. The reviewer is separate and read-only; its actual model
identity is unattested. Raw logs, credentials, databases and weights are excluded.
Article/site publication is separate: the existing paired retrieval/start articles
and topic were inspected read-only at article source `c95f6ad07cce340969900adb2eb1dccf4effa7eb`;
the start/topic still reference an older stable snapshot. No outside repository or
site was overwritten, and this is not a site-publication claim.
