# Wind Fund tools in a research project

[简体中文](wind-research.zh-CN.md)

The standalone `wind:fund` command reads a single ETF's daily exchange close. The research project integration is separate: the worker makes reviewed Wind Fund operations available as individual read-only tools, so the agent can choose several tools to answer one question. Neither interface is enabled implicitly.

## Opt in

To an otherwise valid `research-project@1` configuration add:

```json
"windData": {
  "schemaVersion": "wind-fund-research@1",
  "approvedPublicQueries": true,
  "approvedResultUse": true
}
```

Only enable a project when you are entitled to query the data and use the normalized results in its research flow. Provide `WIND_API_KEY` to the worker through its protected environment, separate from the model gateway key. Do not place credentials in project files, prompts, or examples. Submitting a task does not query Wind. The worker discovers the account's compatible public Fund tools on first use; advertised availability does not guarantee entitlement or results for every query.

The tool catalog covers exchange snapshots and K-lines, minute quotes, product profiles, reported financials and distributions, disclosed holdings, unit NAV and performance, aggregate fund size and holders, management company profile, and criteria-based screening. Requests use reviewed fields, not raw chat, credentials, attachments, or report text. The integration does not make individual securities, positions, or orders available.

## Interpret the evidence

Exchange close, unit NAV, IOPV, report period, and disclosure date are different. Preserve those distinctions in the report. Use screening for an open-ended set of products; for a known code, use the relevant lookup tools instead.

Attribute normalized Wind observations to Wind. Do not convert them into numbered citations to acquired original documents. If a query fails or the response is not verifiable, report that limitation, not an invented value or an empty result. Existing artifact/report and source rules still apply. See [Research Project](research-project.md) for submit, work, and report readback.
