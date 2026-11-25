**English** | [简体中文](v051-offline-delivery-evaluation.zh-CN.md)

# v0.51.0 · Offline delivery evaluation

The version adds one public CLI module. It runs four bundled synthetic fixtures, reopens report bytes, revision identity, original source windows and applicable attachments over real loopback HTTP, and saves a result that existing evaluation readers can import. The separate metadata sidecar correlates each case with its runtime run and receipt. A missing or invalid timeline does not obscure a successful artifact readback.

```sh
npm run -s eval -- run
npm run -s eval -- run --case T4
```

[Run, recheck and compare](../evaluation-cli.md).

## Verified scope

- [Implementation PR #38](https://github.com/hpoenixf/open-etf-agent/pull/38) landed at source commit [`599c512e5220a7d474ad1a021faa87897157ff36`](https://github.com/hpoenixf/open-etf-agent/commit/599c512e5220a7d474ad1a021faa87897157ff36) (tree `27575a0daf93a18b7dbe8560c10f69e2be4de7bc`). [Full hosted Runtime Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45526404077) passed on that source using Node 26.11.1. That run did not certify a later packaging commit.
- Local Node 26.11.1 CLI acceptance: **4/4** HTTP readbacks and **4/4** matched local timelines. A single T4 leaves three rows `not-run`; legacy readback, a deliberately corrupted receipt, missing/truncated/malformed/mismatched timelines and baseline regression reporting are covered. [Controlled CLI verification](v051-offline-delivery-evaluation.safe.json) retains the scope and counts.
- **Model calls: 0.** These are artifact-delivery and local-observation checks, not financial answer quality or model/provider qualification. The CLI does not send the sidecar anywhere, configure remote telemetry, or change the GUI or live provider path.

The code lineage pin identifies where the module landed. A GitHub tag, Release, or hosted deployment is a separate event and is not asserted by this record.
