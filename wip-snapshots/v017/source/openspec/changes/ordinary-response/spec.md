# v0.13 ordinary responses — implemented bounded contract

The contract was frozen on 2026-10-28, implemented as bounded v0.13, and independently reviewed. Decisions A/B/C include all three review corrections. [Evidence](evidence.md) records provider-free qualification; [tasks](tasks.md) separates code/release gates from independent article work. Remote publication status is recorded separately and is not inferred from local tests.

## Exact interfaces and ownership

- New Session creation: `openSession({directory, profile: 'ordinary-response@1'})`. Omitted profile creates exact v2; existing v2/v3 files are admitted by exact version + complete DDL + corresponding semantic validation. Supplying the new profile against v2 rejects, never migrates it.
- Runtime: `run({...originalOptions, ordinaryResponse: true, durable: {..., bindings: {..., adapters: [..., {id:'ordinary-response',version:'1'}]}}})`. Fixture Gateway only in this version. No plugins, hooks, extensions, Child, Memory/compaction, Worker submit/work, or live profile combination. Existing `run` with the original Run ID is the only continuation executor.
- Tool: one sole-call proposal `ask_response({question})`. One question per Run. Host only exposes its definition and verifies its Session-owned result; generic Host execution cannot implement the response transaction.
- `claim.askResponse(expectedCheckpoint)` checks the entire current checkpoint, active Run/root, lease/fence, deadline and original budgets in one transaction. It creates the question, increments root tool usage once, and commits `awaiting-response`. Runtime **always yields after this commit**, even when a receipt arrives before its callback returns.
- `store.receiveResponse({runId,questionId,responseId,text})` is receipt-only, takes no execution lease and writes no checkpoint. `claim.adoptResponse(expectedCheckpoint)` checks the same authoritative state and atomically writes adoption plus `result-committed`. No tool unit is charged again. The normal paired `result-consumed` path follows; the next model reservation uses the existing root budget and absolute deadline.
- `store.response(runId,questionId)` is an explicit local full-fact read. `responseStatus(runId)` returns identities, hashes, timestamps, status and reason without bodies. `confirmResponse(runId,call,result)` validates the exact adopted original before Host consumption, including terminal readback.
- After claim, Runtime re-reads state through `claim.read()` and revalidates it. Claim-preflight observations cannot overwrite a newer checkpoint.

## Exact storage and hashes

Schema v2 remains its original four DDL statements, `application_id=0x4f455446`, `user_version=2`. V3 has exactly those four statements plus:

```sql
CREATE TABLE ordinary_responses (run_id TEXT PRIMARY KEY REFERENCES runs(run_id), question_id TEXT NOT NULL UNIQUE, response_id TEXT UNIQUE, fact TEXT NOT NULL) STRICT
```

V3 uses `user_version=3`. Unknown tables, indexes, triggers, altered DDL, cross-profile bindings/config/checkpoints/results or mismatched facts are rejected. Hot-journal recovery runs these same checks on its isolated recovered copy before opening the original writable. V2's existing unrelated malformed-state behavior remains deferred to its original readback checks; only new ordinary-response semantic markers are excluded at admission.

A fact contains only `schemaVersion,runId,rootId,questionId,call,questionHash,createdAt,deadlineAt,receipt,adoption`. Receipt is null or `{responseId,text,responseHash,receivedAt}`; adoption is null or `{adoptedAt,checkpointHash}`. Text remains exact, well-formed Unicode, nonblank and at most 8000 UTF-8 bytes. IDs use bounded 1–200-character local identifiers; URLs and extra authorization fields are rejected. Text hashes use SHA-256 over original UTF-8 bytes.

`adoption.checkpointHash` binds the canonical adoption projection—not the entire mutable snapshot: `{phase:'result-committed', proposal:{kind:'calls',calls:[originalCall]}, cursor:0, result:originalResponseResult, questionId}`. The result binds original Run/root/call/question/response IDs, question/reply hashes and exact reply text. Canonical JSON sorts object keys. Current history, pending result, persistent question marker **and working-input projection** must agree with this fact. Recomputing a tampered working hash is not enough.

## Cancellation and uncertainty

Cancellation and reservation linearize by SQLite commit order. Cancel-first forbids a new reservation and dispatch; reservation-first is already admitted and may physically dispatch before cancellation reaches the in-memory signal. Preserve the original stop/unknown rules, never claim instantaneous physical revocation, exactly-once external effects, automatic retry, refreshed budget or revived terminal state. Receipt can survive without adoption; adoption is not proof of a later report/Artifact/Publication effect.

## Operational boundary

`session start --case durable-response` uses a 300-second original deadline. The operator supplies all Session/Run/question/response IDs to `respond`; no current-conversation inference or automatic wake-up exists. `inspect` and `response-status` are safe metadata; explicit `question` can display local question and receipt bodies. Ordinary logs contain no question/reply body. Replies are untrusted data, not Memory intent, grants, source permission, trading authorization or a new deadline. Existing temporal task anchors are preserved independently of receipt/adoption timestamps.

Finish old active Runs in their original fixed version. Qualification includes old v2 terminal Artifact/Publication reads and actual old-v2 opener rejection of v3, not general active-run migration. All new Gateway behavior is synthetic and provider-free; no real model understanding is certified.
