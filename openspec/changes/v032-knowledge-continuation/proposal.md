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
