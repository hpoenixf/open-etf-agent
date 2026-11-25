# v0.52.0 · Optional local Jaeger observation

The [fixed source](https://github.com/hpoenixf/open-etf-agent/tree/b487d43628432ed80e8ce1e00c86f3b05d9f97c5) adds the opt-in owner telemetry profile from [PR #40](https://github.com/hpoenixf/open-etf-agent/pull/40) to the v0.51.0 stable release line. It leaves the existing Cloud profile and answer publication authority unchanged. No new package dependency or mandatory service is installed by this release.

## Verified behavior

- The six changed source, test and guide blobs match the reviewed #40 candidate. The original candidate passed the [hosted verification workflow](https://github.com/hpoenixf/open-etf-agent/actions/runs/45531792364).
- On the stable composition, 41 GUI tests passed on Node 26.11.1. These exercise opt-in selection, loopback transport, redaction, duplicate suppression, the seven-day local receipt window, late retry, and clock rollback. No model calls were made.
- An isolated run on the staging host exercised the exact telemetry implementation through owner HTTP admission and a running Jaeger collector. A read-only Jaeger query confirmed the trace. The trace omitted prompt, answer, raw conversation ID and model alias. The original report was read back separately, and replay did not dispatch an extra export. The model was scripted; this was not a paid-model or answer-quality test.

Use the [operator guide](../jaeger-observation.md) to opt in. Seven days describes the application's separate export receipts; an operator must configure Jaeger storage retention separately. A received export is not proof that the answer exists, and absence of a trace is not proof of delivery failure. The public package does not activate hosted telemetry, expose an external listener, migrate business data, or configure anyone's collector.
