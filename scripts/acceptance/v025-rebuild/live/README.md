# Explicit acceptance runner: recoverable engineering copy

This directory preserves the independent supplemental acceptance harness as
reviewable engineering code. It is not a release qualification, actual result,
operator authorization, budget allocation, credential locator or production owner.
There is no default live CLI. `launcher.mjs` rejects direct invocation; a separate
authorized operator must supply an exact reviewed claim and credential injection.
No claim, ledger, raw response, database, environment configuration or credential
is included here. Do not infer permission to execute from these source files.

## Portable paths and provenance

Product imports resolve to this repository's original `src/`. The existing public
`../bridge.mjs`, `../cases.json` and `../plan.md` are used unchanged. Injected
preflight uses the explicitly synthetic `../synthetic-authority.json`. An actual
operator claim must include its own nonempty `historicalSummary.provenance`; no
unpublished authority file is read. Fixed supplement case IDs are RB25-02–10,
never RB25-01. Any observed results belong to an independent supplement, not an
automatically combined ten-case qualification.

Changes from the frozen engineering source are limited to relative paths, public
fixture/provenance input, explicit preflight output location, and this description.
The original private execution source and earlier claims/results remain untouched.
The public copy has its own tested hashes; portability does not by itself prove
actual execution equivalence or transfer earlier live qualification.

## Offline injected preflight

Set `V025_LIVE_PREFLIGHT_OUTPUT_ROOT` to an existing writable workspace directory
outside this source tree. The harness creates unique test subdirectories there.
The variable is mandatory; no automatic temporary-directory fallback is used,
and system temporary directories are rejected. Do not commit generated outputs.

```
V025_LIVE_PREFLIGHT_OUTPUT_ROOT="$ACCEPTANCE_WORKSPACE" \
  node --max-old-space-size=512 --test --test-concurrency=1 \
  scripts/acceptance/v025-rebuild/live/preflight.test.mjs
```

Create and select that workspace directory explicitly before invoking the command.
The eight checks use only injected synthetic provider responses and local loopback
Reader HTTP. They exercise no-claim/key guards, known no-report model behavior,
serial task limits, safe consumed-checkpoint stop/resume, 429 stop, held-before-
dispatch counting, supplement selection, and restricted error cause projection.
They do not read a real key, create a real allocation, or call a provider.

The copied eight-check suite passed on these public paths in a single bounded
45-second run. This evidence is limited to injected preflight. Actual source
closure, root claim, current service/account state, budget, user direction and
one-shot owner approval must be independently established before any real run.
