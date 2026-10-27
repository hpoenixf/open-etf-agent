# Explicit, bounded live validation

Default `npm test`, `npm run build` and `npm run demo` remain offline. The explicit runner requires **your own** provider, synthetic-data and cost authorization; no previous operator's private ceiling is inherited. No command reads a real config or starts a request by default.

Use Node 26.11.1. Select a clean baseline repository root checked out at one of the fixed original or read-back remote commits in `scripts/live-version-pins.json`; do not overwrite uncommitted work. The CLI never switches revisions itself. Every source/fixture blob is checked before code import. Published and original commits have different IDs but independently verified identical trees. Unknown commits, wrong version selections, dirty worktrees and non-root directories are rejected before network dispatch.

The following is an explicit command shape, **not an instruction to spend money without authorization**. Replace placeholder paths, endpoint and model with your own approved scope. `--max-total-cny 800` reserves at most eight CNY 100 attempts for a single version; it is a ceiling, not a target. The same selected ledger must be reused across versions and process restarts, never reset to evade the cumulative limit.

```sh
node scripts/live-validate.mjs \
  --version v01 --baseline /your/clean/pinned/baseline \
  --config /your/owner-only/ignored.env \
  --ledger /your/shared/local-ledger --output /your/new/local-output \
  --base-url https://your-approved-provider.example/v1 --model your-approved-model \
  --max-total-cny 800 \
  --confirm-provider --confirm-synthetic-data --confirm-cost
```

The owner-only ignored config contains exactly `CHAT_BASE_URL`, `CHAT_API_KEY`, `CHAT_MODEL`. Never put credentials in command arguments or baseline tracked files. Unknown request outcomes block further use of that ledger; there is no automatic resume or retry. Configuration scope and budget checks are local safeguards, not a provider-side billing guarantee.

Tests inject a test-owned Git identity/status executable while hashing an immutable seven-file original public v0.1 fixture closure and running that original Runtime/Gateway with a fake provider. They create no extra Git worktree and require no sibling checkout. This fixture test is not a claim of a new remote live run; the original five real runs retain their earlier adapter hashes.

## Reusable boundaries

- `loadLiveConfig` accepts an explicit trusted authorization object, expected endpoint/model, and selected file. It validates scope before reading; returns a non-enumerable credential; does not mutate `process.env` or evaluate shell text.
- `openLiveLedger` owns a single durable ledger shared across versions. It reserves before sending and blocks restart continuation after an unsettled prior-owner request. A reserve is not a charge. No automatic retries or automatic release of unknown costs.
- `createControlledFetch` constrains requests, tokens, response bytes, deadlines, endpoint and honest identity. Provider failures and billing anomalies are observable, not reasons to switch accounts or impersonate another client.
- `runPinnedValidation` injects the controlled transport into the exact frozen Gateway/Runtime. It checks real report bytes after return and retains typed proposal-shape diagnostics without logging arbitrary text or authorization headers.

The [first-batch record](verification/live-v01-v05-first-batch.md) distinguishes Runtime behavior, actual file receipts, subscription billing and historical model-prose observations. The latest acceptance policy is Runtime-only; no semantic-success assertion follows from this runner.
