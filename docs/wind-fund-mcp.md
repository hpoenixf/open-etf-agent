# Wind Fund MCP: operator-only daily close (0.38 candidate)

Grab a bounded exchange close series for a single fund code. The command is separate from the default research and synthetic MCP demo; it only makes a Wind request if you execute it with your own authorized Wind API key available as `WIND_API_KEY`. Keep the key in your local secret store or shell environment; never paste it into a repository, prompt, command argument, or shared log.

```bash
npm run wind:fund -- --help
# Only when authorized to make a Wind request:
npm run wind:fund -- 588200.SH 2026-06-01 2026-06-05
```

The host callable is `fetchWindFundDailyClose({windCode, beginDate, endDate}, {apiKey, signal})`. It contacts only the provider's Fund MCP HTTPS endpoint. The inline result is a `wind-fund-daily-close@1` object with dates, numeric unadjusted exchange closes, the documented provider/tool/price basis, and `asOf` (the latest returned observation date, not retrieval time). That is **not** fund NAV, adjusted return or total return. The date range is inclusive and at most 31 calendar days; the request excludes suspended observations, and gaps are not filled or fact-checked. If the result has no recognized Wind-code column, `identityConfirmation: "request-only"` makes the weaker evidence explicit; that is not independent validation of the product identity.

The command prints only typed rows and provenance, not the full Wind payload. It doesn't save to research history, feed a model, retry a failed provider operation, or switch to another data source. `WIND_FUND_NO_DATA` differs from a response error; authentication, entitlement, rate limits, timeout and invalid data are separate errors. Use and retain provider data only as permitted by your Wind agreement.

The parser preserves the reported trading date for date-only values, compact dates and ISO timestamps with an explicit offset, rather than converting the timestamp to a UTC date. If Wind returns an instrument code, its exchange suffix must also match; identical digits alone do not identify the same instrument.

The first cloud probe established an authenticated MCP round trip but did not return a validated data row. After the parser change, authorized cloud checks returned validated daily rows for three ETF/date windows across both exchanges. All three responses lacked a recognized instrument column, so they were marked request-only. This verifies the direct Wind data path, not the default research pipeline or independent instrument identity. The published [Fund tool contract](https://github.com/Wind-Alice/AliceMarket/blob/ab8fa4cfc7904fa28d2a7297cd293d192eda3b5e/skills/wind-mcp-skill/references/fund.md), [wire mapping](https://github.com/Wind-Alice/AliceMarket/blob/ab8fa4cfc7904fa28d2a7297cd293d192eda3b5e/skills/wind-mcp-skill/scripts/call-rules.json) and [official example client](https://github.com/Wind-Alice/AliceMarket/blob/ab8fa4cfc7904fa28d2a7297cd293d192eda3b5e/skills/wind-mcp-skill/scripts/cli.mjs) are the provider references.

Maintainers can opt into the host callable’s onResponseShape callback. It reports only bounded structural counters, recognized field names and format categories, never vendor values or credentials. This does not change response validation or make another request.
