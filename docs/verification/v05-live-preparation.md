> Historical v0.5 preparation snapshot. Later bounded runtime evidence and the current explicit entry are documented in [live validation](../live-validation.md) and [first-batch observations](live-v01-v05-first-batch.md). The original text below is retained as history, not current live authorization or status.

# v0.5 live preparation — no configuration copied or live request sent

The implemented single-protocol Gateway takes an exact HTTPS `/chat/completions` endpoint, model ID and API key. Its separate trusted grant requires provider, synthetic-data and cost approval. Merely possessing an API key or setting an environment flag must not create that approval. The offline CLI currently blocks live before creating a Run.

Proposed local mapping after source and authority are confirmed:

| Source category | Destination placeholder | Handling |
| --- | --- | --- |
| Approved provider endpoint | `OPEN_ETF_PROVIDER_ENDPOINT` | Exact reviewed endpoint, no redirects or arbitrary model-supplied URL |
| Approved model ID | `OPEN_ETF_PROVIDER_MODEL` | Exact provider/model scope, not a default inferred from private tests |
| Existing authorized provider credential | `OPEN_ETF_PROVIDER_API_KEY` | Only a local ignored `.env.local`, never public logs, manifests or reports |

The source file/key mapping has not been located or confirmed. No actual environment values have been read, printed or copied. `.env.example` contains placeholders only and is not automatically loaded. DB URLs, user accounts, Auth/OAuth secrets, private holdings, credentials for other services and unrelated app configuration are excluded.

Planned outbound material is limited to original synthetic document pages, synthetic research questions, tool schemas, derived synthetic notes and explicit synthetic Memory demonstration entries. No private app implementation, real portfolios, original logs or real user preferences are included. The exact test cases, model request cap, no-extra-cost boundary and permitted origin must be confirmed for this public project; the private project's 5000-call permission is not inherited. Storage/receipt evidence, summary quality and live model adoption will be reported separately, with semantic review remaining explicit.

Before use: finish offline v0.5 validation; obtain exact source metadata/key declarations and reviewed source→destination mapping; establish this project's grant and finite request budget; load only the three allowed values without logging them; then run the authorized cases with redacted engineering summaries. No request has been sent at this preparation stage.
