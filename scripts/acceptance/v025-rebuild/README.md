# Rebuilt v0.25 acceptance preparation

These are synthetic acceptance inputs and an engineering transport guard, not a
second product gateway or launch permission. There is no default network runner.

Run the provider-free transport tests from the repository root:

```sh
node --test --test-concurrency=1 scripts/acceptance/v025-rebuild/bridge.test.mjs
```

`cases.json` proposes ten independent once-task scenarios and eleven reports. It
is not an executable frozen live plan, recovered historical input, or evidence
that a real model has passed. Scope is report + schedule + task-time, with no
recurrence, notifications, knowledge, Child, response or isolated Python module.
Runtime contracts, model semantics and final task outcomes are separate axes.

The bridge accepts an explicitly injected fetch and separately reviewed durable
sink. Its response is consumed by the original native gateway; request and
response body bytes are not rewritten. It reserves before network use, requires
complete Go zero-cost evidence, and stops on HTTP, fee, timeout, malformed data or
credential-echo errors. Non-200 diagnostics retain only public error enum values
and hashes/lengths of omitted fields, never arbitrary error messages. An original
Session proposal-sealed readback must bind the actual native proposal to the
response body before adoption permits another request. Interrupted or unknown
requests are never retried automatically.

The sink contract is reserve, recordBody, recordGo, recordAdoption and stop. Each
method must durably commit before returning. This directory does not implement
account authority, store credentials, initialize a real allowance, or authorize
model usage. Existing limits and unknown reservations remain in force.

The current official Go endpoint and model are pinned in bridge.mjs from the
[official Go documentation](https://opencode.ai/docs/console/go/). Operators must
confirm the matching subscription, permitted source data, exact frozen inputs,
exclusive ownership and explicit budget before live use. No account, route or
provider change may bypass a refusal.
