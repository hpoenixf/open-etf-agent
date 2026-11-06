**English** | [简体中文](provider-capacity.zh-CN.md)

# Provider capacity across project revisions

v0.24 retains the original project-local Admission owner across endpoint-equivalent project revisions. [Fixed-source real-task results and limits](verification/v024-release.md) separate Runtime contracts from model content quality. The [original proposal](../openspec/changes/v024-provider-capacity/proposal.md) preserves the historical candidate scope.

The [original Admission](shared-admission.md) owns the durable queue and one local physical-request slot. This increment stops an ordinary project's model, streaming option, provider label or credential-environment alias from accidentally creating another slot for the same endpoint. It does not introduce another budget, model router or provider registry.

## Use the ordinary project workflow

Initialize a **new empty project directory** using the existing [project configuration and CLI](research-project.md). The supplied configuration still uses `research-project@1`; there is no new capacity option. The created project record uses `research-project-record@2`, and each admitted task uses `research-task@2` with its original derived Admission binding.

Use `project update` with the inspected expected configuration hash for future tasks. An already admitted task keeps its original model, endpoint, grant, limits and source snapshot. Its capacity owner is also fixed; a newer configuration does not reroute it.

Inspect one admitted task without making a model request:

```sh
node src/research-cli.mjs capacity inspect --project DIR --run RUN_ID
```

The corresponding API is `inspectResearchCapacity({projectDir, runId})`. It returns the policy, group ID, one-project scope, capacity 1 and the selected Run's original request tickets. It does not enumerate another project's work. A reserved model ordinal can have a null ticket when execution stopped before Admission recorded it; null is not a refund or permission to retry. Inspection never creates missing storage or settles an unknown request.

## What shares capacity

- Within one new-format project, the same normalized HTTPS endpoint shares one original SQLite Admission owner across model, stream, provider-label and API-key-environment-alias changes.
- URL parsing normalizes the hostname and default port. New-format endpoints reject raw query/fragment delimiters, including a bare `?` or `#`; an empty URL accessor is not evidence that the delimiter was absent. Different paths and nondefault ports remain distinct. DNS aliases, different provider URLs and account-level capacity are not inferred. The original Gateway still requires its supported `/chat/completions` endpoint shape; identity normalization does not make an unsupported URL executable.
- Fixture tasks use one separate project-local synthetic domain. It is not a live endpoint and does not establish provider behavior.
- Different project directories are independent, even when their endpoints match. This is not distributed or account-wide throttling.

A different credential alias conservatively shares capacity; this says nothing about whether another credential or recipient is authorized. Original provider, data and cost approvals still apply.

## Original evidence controls release of the slot

Run A's original Runtime reservation, owner/fence and input hash remain attached to its ticket. Run B waits in the same FIFO. Only the original Gateway's supported complete terminal evidence can settle a dispatched ticket. Unknown transport, process death or local cancellation after dispatch retains occupancy across revisions and cold restart. There is no unknown TTL, refund, automatic retry or timeout-based claim that remote effects ended.

Main, actual Child and managed summary continue using their own Runtime receipts and the same bound Admission owner. Project metadata only locates that owner. Budget and grants remain Runtime/Session responsibilities; Report/Publication/Reader remain output responsibilities.

## Missing state fails closed

Project initialization or an explicit new-endpoint revision creates the owner once. A separate immutable Project registration is made durable before owner creation. It records the location/identity policy, not request states, capacity counts or billing. Normal submit/work opens an existing owner only.

If its registration, directory or database is missing, normal execution fails with `PROJECT_CAPACITY_OWNER_MISSING`; it does not create an empty replacement. A malformed binding or foreign database also fails. A previously selected endpoint found in the original project or its configuration revisions cannot be silently reinitialized when both registration and directory are absent. Checking a new domain is bounded to 1024 revision entries; exceeding that bound refuses expansion rather than discarding history.

Initialization spans files and is not an atomic multi-file transaction. Interruption after the durable registration but before a usable owner leaves a blocked incomplete initialization. It is not automatically rolled back or reclaimed. Restore and verify original state through an explicitly authorized recovery process; this candidate provides no repair/migration command. Do not delete old records to manufacture capacity.

## Legacy projects remain legacy

Existing `research-project-record@1`/`research-task@1` projects keep their original full-gateway-hash directories and original tickets. New code can inspect and handle their existing tasks under that historical fixed-route contract. It does not advertise the new endpoint-wide guarantee for them.

Changing a legacy project's gateway with the new `project update` is refused as `PROJECT_LEGACY_CAPACITY_REVISION_UNSUPPORTED`; non-gateway revisions remain supported. There is no automatic adoption, merge, upgrade or database relocation. Initializing a nonempty directory is not an upgrade. Old standard Project entrypoints reject the new record format before dispatch, but no control over arbitrary direct Admission callers or arbitrary old processes is claimed.

A separate project is not proof that an old request ended and is never a way to refund shared budget or authorize repeating unknown work. Existing unknowns remain part of their original accounting and recovery obligations.

## Verification boundaries

Provider-free checks use the real Project APIs and Chat encoder/parser with injected synthetic transport, actual independent worker processes, original SQLite tickets and cold readback. They cover revision contention, queued cancellation, retained unknown/dispatched work, missing-owner refusal and compatibility. An actual prior-source process separately checks old-format rejection and original legacy readback.

These are local mechanism checks. Real-provider tasks, semantic report review, actual provider concurrency, installation, final full-suite/build and publication are separately recorded. No offline result is promoted into a real-model score.
