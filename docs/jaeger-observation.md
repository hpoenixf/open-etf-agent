# Optional local Jaeger traces

Open can send the owner GUI's bounded run metadata to an existing Jaeger
OTLP/HTTP listener. No Jaeger process or storage is bundled. The setting is
off by default; it does not start research or enable a provider. Fixture-only
mode does not export.

Enable the following in the **server environment** only:

```dotenv
ETF_LANGFUSE_ENABLED=1
ETF_LANGFUSE_PROFILE=jaeger
ETF_JAEGER_OTLP_PORT=4318
# Set ETF_LANGFUSE_TRACE_SALT to a new independent, secret trace- value.
```

Use a salt generated from 32 random bytes (for example, combine `trace-` with
the output of `openssl rand -hex 32`). Never commit the salt. Leave
`ETF_LANGFUSE_REGION`, `ETF_LANGFUSE_PUBLIC_KEY`, and
`ETF_LANGFUSE_SECRET_KEY` unset in Jaeger mode. Conflicting configuration
disables export rather than falling back to the other destination. Existing
Langfuse Cloud configurations work unchanged with no profile or
`ETF_LANGFUSE_PROFILE=cloud`.

Run Jaeger's OTLP/HTTP listener on IPv4 loopback in the same network
namespace as the owner GUI, or publish a container's listener on the host's
loopback interface only when the GUI stays on that host. Open uses a direct,
fixed `http://127.0.0.1:<port>/v1/traces` request; only the port (1024 to
65535) is configurable. The export sends no authentication header, does not
follow redirects or use proxies, and assumes that loopback is trusted. Do not
publish the Jaeger ingest, query or UI ports to the Internet. Use separate
collectors, salts and stores when environments require independent data.

Under Jaeger's `open-etf-agent` service, look for the **Research Run** root,
model dispatches, tool outcomes, and **Delivery confirmed** when a report or
publication was read back. Trace IDs are pseudonymous; payloads exclude raw
run/message IDs, model names, tool names, prompts, answers, URLs, raw errors,
credentials, and request data. Terminal outcome, delivery status, recognized
failure code, durations, and numeric model/token usage are available. Old
receipts are not replayed or backfilled. Export is best-effort; it does not
affect the answer or rerun research. A transport acceptance receipt is not
proof of storage; confirm by reading the same trace back from Jaeger.

See the official [Jaeger APIs](https://www.jaegertracing.io/docs/2.23/architecture/apis/)
and [Badger backend](https://www.jaegertracing.io/docs/2.23/storage/badger/)
documentation for collector and persistence configuration.
