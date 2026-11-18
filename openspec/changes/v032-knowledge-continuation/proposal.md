# A20 continuation after the scoped v0.31 release

Status: design and offline acquisition-port prototype; not released and not a claim
of real embeddings, end-to-end dynamic Runtime retrieval or Private parity.
Baseline: Open v0.31 `14be5d2fb29a537b75fcc36ac40774608e1393d8`.
User direction (2026-11-17): finish the scope cut from v0.31 before moving to A17.

## Scope and ordering

v0.31 delivered selected text import, BM25 arbitrary lexical queries and immutable
original-source readback. Its 9/10 Runtime qualification does not certify semantic
retrieval. Existing opt-in document only/prefer, health and frozen-hybrid code is
reused, not replaced. Historical adapter bindings and tool definitions stay intact.

1. Prepare real vectors for an explicitly admitted source snapshot and selected
   arbitrary query text, with a durable acquisition identity and no recovery replay.
2. Reuse existing frozen-evidence validation, cosine + BM25/RRF and source readback.
3. Integrate dynamic query acquisition through a new frozen task/tool profile and
   original effect/budget owners. Do not place online calls inside synchronous
   query verification: it recomputes results during recovery.
4. Qualify document only/prefer and channel health against original sources;
   establish meaningful no-evidence behavior and truthful lexical fallback.
5. Compare lexical/BM25/hybrid on a frozen manually reviewed corpus, then perform
   exact-source regression, cold recovery and a fresh real-model task cohort.

Reranking, domain taxonomy and general Private parity are later work unless an
actual consumer makes them necessary for this bounded loop. Do not force a new
HTTP service: an in-process local embedding adapter is a candidate, subject to
model/source/license/runtime qualification. No provider was downloaded or called.

## Prototype delivered here

`src/knowledge-acquisition.mjs` provides an experimental explicit preparation port.
It uses existing Source and immutable-file owners, claims an acquisition ID before
execution, syncs plan and attempt, invokes the supplied embedding port once, checks
vectors with the existing validator, then saves source-bound frozen evidence.
Readback never invokes the port. Duplicate/concurrent IDs cannot redispatch.
Loss of a response leaves unknown. Failure to persist a terminal record leaves the
original claim as an unresolved operation, not permission to retry.

The port is NOT a network transport, CLI, model downloader or production API.
Caller-supplied provider labels are not authenticated provenance. Synthetic test
vectors establish wiring, not semantic quality. One port invocation is NOT proof
of one physical provider request: a real adapter must enforce its own no-retry
contract and report physical outcomes through the existing budget ledger.
Different acquisition IDs do not yet share a global budget. Do not wire this port
to billable transport until that owner integration is implemented and reviewed.

Queries may be chosen freely before acquisition, but the result remains a finite
frozen snapshot (up to 16 exact queries). It is not yet a continuously dynamic
retriever. New query acquisition and reusable page-vector cache are remaining work.

## Required integration and release gates

- Select/verify an actual embedding backend, model revision, dimensions, license,
  token/input bounds and authorized data. Private's historical bge-m3/1024 shape
  is a compatibility clue, not permission or proof of an available service.
- Cache page vectors by original SourceID/text digest plus model revision without
  widening grants. New-query acquisition must preserve the same model identity.
- Bind global/shared request limits, deadline/cancel and unknown charge retention.
  No automatic retry of an ambiguous dispatched request under another ID.
- Persist exact response evidence before Host consumption and create a new profile;
  old v1/v2/BM25/hybrid task hashes remain unchanged.
- Test corrupt/missing records, crash phases, source/model change, cancellation,
  byte truncation, lexical fallback, no-evidence, and restricted collection scope.
- Label relevance manually. Report vector coverage separately; synthetic cosine or
  runtime correctness is not proof of financial answer correctness.
- Node 26.8.1–26.x full tests/build, independent review, exact-head CI and separate
  new real-provider cohort. Local Node 24 focused tests are diagnostic only.

`maxResults` may be explicitly configured for new tasks within existing 1–8
bounds (separate writer); preserve response byte caps and old admitted values.
It is a supporting usability choice, not the central next-version deliverable.

## Existing owner integration inspection

`session.mjs`'s fenced `claim.reserve` currently admits only `model` and `tool`.
It increments the root usage and checkpoints in one SQLite transaction. Runtime
reserves immediately before model dispatch or tool execution and records inFlight
before effects; recovery refuses unresolved model reservations. `admission.mjs`
is a capacity owner, not billing: its proof binds a model ordinal, active Session
fence and encoded chat/summary request. An embedding call has neither that message
shape nor the existing ordinal contract. It must not forge a chat reservation or
claim that a file-based acquisition record authorizes paid execution.

Two explicit integration options need independent review:
- Before task admission, a bounded explicit source/query preparation operation with
  a dedicated shared acquisition allowance; then task admission consumes only its
  immutable vector evidence. This is the narrow first end-to-end route.
- For model-generated query text inside a Run, add a versioned reservation purpose
  and deterministic input envelope to original Session/Runtime/Admission owners,
  preserving tool budget plus physical embedding attempts separately. Publish an
  immutable effect receipt before Host ResultRef consumption. Recovery reads that
  receipt and original bytes; no recomputation calls a provider.

Prefer the first route for initial real-backend qualification; it does not yet
complete arbitrary model-generated dynamic query support. A callback claiming
that it charged the budget is not adequate proof. No shared owner was modified
in this prototype. Timeout may stop waiting, never certify remote termination;
unknown capacity and cost cannot be refunded because a local timer elapsed.

## 2026-11-17 local real-model diagnostic amendment

Starting only from remote `61fd7e8a1297276d3c181e7a094a930792f15264`, this
increment acquired pinned public MIT multilingual E5 safetensors and hash-verified
PyPI wheels. Real CPU tokenizer/document/query encoding, page-vector reuse and
frozen-evidence cold readback now execute. The bounded tokenizer-size and auxiliary
prompt-probe fixes do not modify Session/Runtime authorization or retrieval/task
identities. The previously interrupted local candidate remains excluded.

A separate agent adjudicated the 8-passage, 16-query authored diagnostic before
rankings. BM25 and hybrid each score Recall@4/MRR@4 1.0 on ten positives, but all
three profiles return sources for all six no-answer cases (100% false positives).
This fails meaningful no-evidence quality; vector coverage 16/16 is not semantic
acceptance. [Provenance, exact receipts and remaining gates](../../../docs/verification/next-real-local-embedding.md).
The prepared-query route stays experimental; in-Run dynamic-query authorization
remains closed. No new release or extension of paid-call authority follows.

## 2026-11-17 follow-up: evidence layers and blocked live admission

Remote main `6bc660b595f0a7050bc49322e9b047a426b0d095` contains the reviewed
offline preparation increment; stable metadata remains 0.31.0. This follow-up
does not import or re-review the stopped dynamic-authorization candidate.
The original scope and dynamic/shared-budget gates above remain required.

Retrieval evaluator v3 accepts explicit supplied answerability annotations and
distinguishes candidate return, retrieval of labelled supporting sources, and
unmeasured generated-answer quality. Legacy v1/v2 results and labels stay intact.
An after-ranking source-text audit records N01's explicit missing fee amount and
P08's omitted second supporting passage separately; it is not a blind relabelled
benchmark or a new qualification score. No ranking threshold changed.

The official existing Go model-directory access check returned HTTP 401 before
inference. That route was stopped without alternate endpoints or credentials.
The new ten-task gate is incomplete, with zero tasks dispatched. Real local E5
and provider-free tests cannot replace it. See the [dated follow-up evidence and
remaining decisions](../../../docs/verification/v032-progress-20261117.md).

## 2026-11-17 restored-Go continuation: prepared cohort only

The user explicitly replaced the local Go credential after the historical 401.
Official directory and minimal-inference checks returned HTTP 200 with
`gpt-6-luna` and Go billing. A dated activation record keeps the original source,
questions, data, project configuration and ten-task acceptance contract unchanged;
it lifts only that obsolete provider-access checkpoint. The original 401/not-run
records are retained, and the stopped dynamic candidate remains excluded.

All ten original prepared-path tasks completed with exact queries, cold output
readback and 25 real Go model requests (0 USD additional cost). The separate
single-request key probe is not a task in that denominator. The first two tasks
exercise only/prefer, all ten consume real frozen E5 query vectors, and the five
insufficient-evidence tasks do not invent answers. Detailed content assessment is
separate from Runtime completion. No general semantic/financial qualification,
dynamic acquisition, physical embedding budget, crash/fence recovery or full
0.32 release follows. See the [dated live record](../../../docs/verification/v032-live-20261117.md).

## 2026-11-18 user authorization and block clarification

The user authorizes continued project work and requests removal of the reported
block. General project permission is no longer an outstanding decision. Source
inspection found no existing dynamic-query feature switch to enable: the current
Run consumes frozen evidence, while in-Run acquisition, physical-attempt budget
ownership and durable dynamic recovery still need implementation and verification.

The earlier handoff records a refused/interrupted review of another unpublished
candidate; the original refusal output and exact reason were not recovered in
this inspection. Preserve that record and do not retry/import the stopped operation
as a workaround. Do not turn that historical event into a blanket claim that all
future feature development is prohibited. User authorization is not represented as
overriding platform safeguards. No code gate was removed and no new capability is
claimed enabled by this dated clarification; the original release scope remains.

## 2026-11-18 original-scope implementation and qualification

The new implementation starts from the reviewed public source, not the stopped
candidate. Knowledge is the principal module; original Session/Runtime owners
supply atomic query/two-operation reservation, fences and typed durable receipts.
The local-only worker is explicitly mapped at work time. No additional embedding
service or new billable transport was introduced. Missing/uncertain receipts retain
unknown reservations and never re-encode on recovery. Legacy static tasks and
report@6 question bytes are preserved.

`f742c3a` completed 10/10 real DeepSeek Runtime/delivery tasks but only 8/10 strict
content checks. Partial-result absence wording in two answers was too broad.
`4238a64` fixes new-task framing with a separately frozen local-query instruction
version. Its independent full ten-task cohort is 10/10 Runtime/delivery and 10/10
strict source review, with 25 DeepSeek V4.1 Flash requests and zero additional cost.
No old sample was replaced, no ranking threshold changed and no original label was
rewritten. The old results remain independently navigable.

Real E5 CPU reference equality, actual process-kill recovery boundaries, the
compiled worker and complete regression are recorded separately in
[release-readiness evidence](../../../docs/verification/v032-release-readiness.md).
The package candidate is 0.32.0; stable release remains 0.31.0 until an actual
merge/tag/Release. This amendment records current facts; it does not retroactively
alter the earlier dated design, rejection/access history or their scope.
