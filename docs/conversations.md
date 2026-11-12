# Explicit research conversations (v0.29 candidate)

[简体中文](conversations.zh-CN.md)

Continue research from a selected earlier report without replacing that report. A Conversation owns message identity and parent links. The existing Project, Worker, Session, Artifact and Publication owners still execute, account, cancel and deliver. This is a local single-user module, not an autonomous chat server.

## Start and submit

Use an existing research project and an explicitly imported source manifest from [Research projects](research-project.md). The following commands do not dispatch a model:

```sh
node src/conversation-cli.mjs create --project PROJECT --conversation fees
node src/conversation-cli.mjs submit --project PROJECT --conversation fees --input first.json
node src/conversation-cli.mjs list --project PROJECT --conversation fees
```

`first.json`:

```json
{"messageId":"first","text":"Compare the fees and save the source-backed report.","sourceManifestSha256":"REPLACE_WITH_IMPORTED_SHA256"}
```

For a live project, add `authorization` with `providerApproved`, `dataApproved` and `costApproved` explicitly true only after approving this provider, selected material and cost. The original Project enforces these flags. The CLI reads the configured existing API-key environment variable only during `work`; it does not load `.env` or save credentials.

```sh
node src/conversation-cli.mjs work --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs read --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs cancel --project PROJECT --conversation fees --message first
```

The default fixture project cannot be executed through this CLI. Synthetic Gateways are test API inputs, not a real-model claim.

## Follow up and optionally use Review

Submit a new message ID and explicitly select a completed parent's report excerpt:

```json
{"messageId":"followup","text":"Recheck the fee comparison and explain uncertainty.","sourceManifestSha256":"REPLACE_WITH_IMPORTED_SHA256","parent":{"messageId":"first","start":0,"end":120}}
```

Offsets are JavaScript UTF-16 string positions into the actual prior report. Choose valid exact positions from its readback, not the example number. The excerpt, original report hash and revision ID are frozen. The complete prompt is bounded to 16000 UTF-8 bytes; an oversized selection is refused rather than truncated. The caller may select a smaller explicit excerpt. There is no implicit latest message or automatic full-history accumulation.

Optional `review: {"directory":"REVIEW_SESSION","runId":"review-ID"}` must refer to a completed v0.28 Review of exactly that report revision/hash. All findings remain advisory, not approved corrections, facts or source authority. Model-produced text and reviews never grant capabilities. The new task rechecks sources from the explicitly selected manifest; old narrative is not a replacement for original evidence. A parent must have a verified Markdown/report Artifact; a delivered answer without an Artifact is still readable but cannot be used as a report parent.

## Recovery and limits

- Same message ID and identical input reopen the original task. A changed message is refused; use a new ID for a genuinely new request, never to hide an unknown old execution.
- Frozen intent precedes original task admission. Listing distinguishes admission-pending. Resubmission can finish the same admission without dispatch; it cannot silently apply updated configuration to a pending old message.
- Already-admitted messages keep their original configuration after project changes. Run, cancellation and unknown behavior remain the original owners' behavior; a repeated terminal run does not call a model again.
- `read` uses Publication-aware output, retaining delivered text when citations degrade or no report Artifact exists. Failure of a new task does not erase the old report.
- Explicit parent branches are permitted. IDs are at most48 ASCII letters/digits/underscore/hyphen. Message text is at most12000 UTF-8 bytes; listing is bounded to1024 entries.
- Schedule projects are not admitted for new conversations/messages. No timers, background workers, automatic retry, cross-project history, permission expansion or semantic correctness guarantee.
- Back up the whole project, including `conversations/`. These files contain selected user text and may be private. They are covered by the project ignore rule and are not publication artifacts.

## Qualification

This is an implementation candidate. Focused fixture results, complete regression, independent review and real-model acceptance are recorded separately. No v0.28 real-model qualification is borrowed; no new version is released by this document.
