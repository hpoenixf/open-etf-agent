# Owner GUI: metadata-only Langfuse observation

The live owner GUI can export a bounded trace **after** normal runtime settlement and exact persisted answer readback. It is off by default and is not a runtime dependency. Offline demo and hosted account workspaces that do not configure a live owner gateway do not export.

Set `ETF_LANGFUSE_ENABLED=1`, `ETF_LANGFUSE_REGION` (`us`, `eu`, or `jp`; default `us`), `ETF_LANGFUSE_PUBLIC_KEY`, `ETF_LANGFUSE_SECRET_KEY`, and a stable private `ETF_LANGFUSE_TRACE_SALT` (random, prefixed `trace-`, at least 38 characters total) in the trusted operator environment. Keep all key/salt values out of repository files, browser config, screenshots and logs. Opt in only to an approved Langfuse project/region. No other destination or redirects are supported.

- **Model dispatch:** transport response, HTTP error, protocol error or unknown, plus bounded numeric token counters when reported. A successful transport response is not evidence of delivery or billing settlement.
- **Tool result:** succeeded, failed, rejected or unknown; whether dispatched. The name of a non-dispatched request is not exported.
- **Delivery:** verified canonical published body, saved report, no deliverable, or cannot verify. Readback failure never removes a report.
- **Privacy:** only fixed categories, bounded numeric fields, configured model identifier and dispatched tool names, timings and keyed pseudonymous trace identifiers. No prompts, responses, sources, URLs, tool arguments or results, raw IDs, credentials or user identity in exported event bodies.

The exporter uses the [Langfuse OTLP v4 endpoint](https://api.reference.langfuse.com/), and records only an immutable intent and settlement category under `langfuse-export/` in the owner Project. Intent without a settlement is indeterminate. A transport acceptance is not proof that an operator can query every span. Rejections, partial intake, timeouts and ambiguous outcomes do not retry the telemetry or the research. Worker-local events that were never collected before process loss are not reconstructed from History. Sink validation must use synthetic data before any production project is enabled.
