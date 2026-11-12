# Explicit research conversations (v0.29 candidate)

[简体中文](conversations.zh-CN.md)

Conversation owns message identity, explicit relationships and frozen context. Project, Session, Worker, Interaction, Result and Publication still own execution, permissions, budgets and output. This candidate is not a release.

## Start and read

Create an existing [research project](research-project.md), import original sources and obtain the exact manifest hash.

```sh
node src/conversation-cli.mjs create --project PROJECT --conversation fees
node src/conversation-cli.mjs submit --project PROJECT --conversation fees --input first.json
node src/conversation-cli.mjs work --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs read --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs list --project PROJECT --conversation fees
```

first.json:
```json
{"messageId":"first","text":"Compare the original fees and save a report.","sourceManifestSha256":"EXACT_IMPORTED_SHA256"}
```
Live admission additionally requires explicit authorization with providerApproved, dataApproved and costApproved all true, only when actually authorized. Work reads the original configured credential environment variable, never a .env file. Submit/list/read do not call models. CLI fixture execution is not a live test.

## Three different relationships

1. **Ordinary follow-up:** add parent: {"messageId":"first","start":0,"end":120}. These are JavaScript UTF-16 offsets in a completed original output, not values to copy blindly. The selected bytes and original hash are frozen. It is a new question, not inherited execution authority.
2. **Persisted clarification:** with the original response/interaction capability, the Runtime saves a real question. Query it with questions --message first or question --message first --question QUESTION_ID. respond --input reply.json accepts messageId, questionId, caller-chosen stable responseId and text. Received is not adopted; explicitly work the original message to adopt it in the same Run without resetting budget/deadline. The hashed ID in the underlying receipt is not a replacement caller ID.
3. **Explicit Continue:** use continuationOfMessageId instead of parent/review. It preserves the root user goal across multiple hops and binds the previous task/source/output. It creates a new Run/grant and requires fresh live approval. Capability/tool subsets and lower limits are permitted; other configuration and the source manifest must remain unchanged. Historical text is untrusted context, not current source evidence or tool permission.

Optional review: {"directory":"REVIEW_DIRECTORY","runId":"REVIEW_RUN"} is available only with an ordinary parent that has a real report revision. The completed Review must match its exact revision/hash. Findings remain advisory.

## Resume versus owner-level handoff

resume --message first resumes only an original active safe checkpoint, under unchanged current configuration. Session keeps its original grant, deadline, accounting and lease.

An explicit Continue can hand off an interrupted parent at a safe checkpoint. The original Session transaction checks exact definition/checkpoint hashes, leases, in-flight/unknown effects and Child state, freezes the parent, and records one unique target Run. A pending clarification cannot be skipped through handoff. Ordinary cancellation, failure, revocation and unknown outcomes do not grant continuation eligibility.

A complete prepared request is durable before freezing. Restart may finish the same input/target under unchanged or narrower authority. Conflicting parents competing for one message cannot freeze the losing parent.

Continue refuses configured trusted packages because this module cannot prove their effects read-only or deduplicated across Runs. It must not silently repeat successful external writes. Original safe same-Run recovery remains available; an explicit new question is a separate intent. No private historical-result lineage is fabricated.

## Explicit execution revocation

```sh
node src/conversation-cli.mjs revoke --project PROJECT --conversation fees --input revoke.json
```

Supply messageId, stable revocationId, original expectedDigest and reason. Session cancellation/fencing and the control receipt commit atomically. Calls not yet reserved are refused. Already reserved or dispatched requests cannot be physically recalled and retain unknown/accounting facts. Published answers are never deleted or turned blank. Repeating the same intent returns its original fact.

Changing project configuration is not this operation: it normally affects future admissions. Conversation checks configuration at execution entry, not as a magical in-flight network recall.

## Persistence and boundaries

- Stable IDs are idempotency keys. Changed text, parent, continuation or source selection conflicts; no unknown replay.
- Published answers without a report artifact remain readable and can be selected as explicitly unverified historical text. No fabricated revision or citation certification.
- Messages: 12,000 UTF-8 bytes; contextual question: 16,000 bytes; replies: 8,000 bytes. Oversized context refuses rather than silently truncates. Handoff reserves extra context headroom before freezing.
- IDs use at most 48 ASCII letters, digits, underscores or hyphens; listing is bounded to 1,024 message files.
- Schedule projects, automatic follow-ups, daemons, permission expansion and semantic correctness guarantees are excluded.
- Only the first explicit revoke/handoff installs the strictly validated Session control-facts table. Read-only access never migrates; failed transactions roll back. New code reads old sessions. Old binaries reject controlled sessions with UNSUPPORTED_SESSION_SCHEMA; do not downgrade and continue writing.
- Control receipts retain checkpoint digests, not every original checkpoint's historical bytes.
- Back up the entire project together. Conversation and Session data may contain private source material and must not be uploaded as public code.

Open uses its own safe checkpoint and same-Run Interaction contracts. It does not claim to reproduce every private Main terminal status or historical-result structure. Qualification is recorded separately for each fixed candidate; earlier ten-task cohorts do not qualify new Owner changes.
