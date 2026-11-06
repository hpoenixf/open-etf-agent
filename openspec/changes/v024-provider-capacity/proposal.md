# v0.24 candidate: stable project-local provider capacity

## Status and lineage

This independent candidate starts from the frozen v0.23 Knowledge candidate `f821f69d7a3866cab47977e1ca87c319ff297fd9`. v0.23 real qualification is still pending; this branch is neither a v0.23 qualification result nor a released v0.24. The stable public baseline remains v0.22.0. Real model authority, ten-task qualification and publication remain separate gates.

The original Provider Admission module groups physical attempts by their trusted capacity endpoint independently of model/profile selection. The public v0.17 module already preserves a local K=1 FIFO, original Runtime reservations, fencing, pre-dispatch cancellation and indefinite unknown occupancy. Reimplementing that queue is unnecessary. This increment makes the ordinary Project's capacity identity stable across configuration revisions while reusing that same Admission owner.

## One primary owner and minimum loop

**Primary module: Provider Admission.** Project metadata locates the existing owner; Runtime/Session still own grants, request debits, original Run identity, cancellation and deadlines. Gateway still owns complete protocol termination evidence. No new budget, health, routing, migration or publication authority is introduced.

The minimum loop is: create a new project, admit Run A, revise the same endpoint's model/stream/credential environment alias, admit Run B, observe B queued behind A in the same original SQLite owner, then read both original tickets after a cold reopen. A dispatched or unknown A continues occupying capacity. Revision is never a refund, retry or proof of remote termination.

## Scope

- New projects use `research-project-record@2`; the human-authored configuration remains `research-project@1` with no extra capacity knobs.
- New tasks use `research-task@2` and freeze the derived Admission policy/group identity. It is checked against the task's original gateway and the project's immutable format; current configuration does not rebind an old task.
- One project and one normalized HTTPS endpoint share one K=1 group. URL parsing normalizes host/default port and the effective URL representation. Raw query/fragment delimiters, including bare `?`/`#`, are rejected for new-format projects rather than becoming extra capacity identities. Paths remain meaningful and must still satisfy the original Gateway endpoint contract; DNS/provider aliases and different paths are not merged.
- Provider display name, model, stream and API-key environment alias do not create additional capacity for that endpoint. This conservative sharing does not approve a different credential or data recipient.
- Fixture work has one separate synthetic domain per project; it is never conflated with a live endpoint.
- Distinct endpoints and distinct project directories remain independent. This is not an account-wide or distributed provider-limit guarantee.
- A one-time immutable Project registration is durable before owner creation. Ordinary work/submit uses Admission in existing-only mode; a missing, empty or foreign original owner is not replaced. A new-endpoint revision checks retained original/config-revision identities (at most 1024 entries) before creating a never-registered group. Incomplete initialization remains blocked, not automatically rolled back.
- Read-only inspection identifies the original group and selected Run's original request tickets without creating storage, making calls or changing settlement.

## Compatibility, deliberately without migration

A new-format project must be initialized in an empty directory (or an exact interrupted-initialization `.gitignore` only). Initializing over old state is not an upgrade. The old binary rejects the new Project record format before its normal project entrypoints can dispatch; this must be checked using the actual old source, not inferred from a new-version test alone.

Existing `research-project-record@1` and `research-task@1` retain their original full-gateway-hash directories, ticket identities and cold readback. No old database, unknown ticket, task, grant or Session binding is rewritten. New code rejects changing the gateway configuration of a legacy project; non-gateway revisions remain supported. Already admitted legacy tasks keep their historical fixed-route contract, not the new endpoint-wide guarantee.

There is no automatic adoption, multi-store merge, old/new writer coordination, or legacy upgrade command in this candidate. Merely swapping the hash would abandon old occupancy. A safe future upgrade would need a complete legacy task/store inventory and a verified writer lifecycle; this release does not invent those proofs. Existing projects can still be inspected and their existing tasks handled under their original contracts. Creating a separate project never clears the old project's occupancy or changes global budget authority.

## Acceptance

1. First reproduce the old same-endpoint/model-revision second-dispatch behavior using actual public Project APIs and the original Chat encoder with injected synthetic transport.
2. In the new format, model, stream, provider-label, credential-alias and normalized endpoint revisions keep the same capacity group. Distinct endpoint paths remain independent.
3. Deterministic barrier and actual ticket inspection demonstrate contention, cancellation while queued, and process-separated execution without relying on a short sleep to prove absence of dispatch.
4. Unknown/dispatched occupancy survives cold reopen and revision. Original ticket and reservation identities remain readable; no replay or refund occurs.
5. Task/group tampering, unsupported format changes, unsafe initialization and corrupt storage fail closed. Legacy original paths/readback remain intact; gateway mutation is refused rather than migrated.
6. Existing Main/Child/summary, Knowledge and project revision behavior remains covered. Run focused checks, the final full suite, build and fixed locked installation with the declared Node pin.
7. Real qualification must use exactly ten frozen logical tasks and at least nine eligible successes, with no unresolved in-scope Runtime defect. Offline counts and v0.23 results are not this evidence. Complete independent evidence review and approved publication afterward.

## Explicitly deferred

Legacy migration; cross-project/account capacity; configurable K; distributed backends; Retry-After/cooldown; timeout-based unknown reclamation; provider retries/failover; dispatch-relative Runtime clock redesign; new credentials or payment authority.
