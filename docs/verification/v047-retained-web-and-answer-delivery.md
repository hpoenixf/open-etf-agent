# v0.47.0: Retained web excerpts and readable answers

- Reviewed implementation: [PR #28](https://github.com/hpoenixf/open-etf-agent/pull/28), head [`4a30bda`](https://github.com/hpoenixf/open-etf-agent/tree/4a30bdaec642f1305a94e62829135a93da6f88ea). [Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45303895815) checked merge commit `8f9f2adcdc4abfefcacddbc0dd843b99462abbf7` (tree `f907a3685281e725aa3099286c0e80498f80a7b9`) on Node.js 26.11.1: **1,727 passed, 0 failed, 6 skipped**. This result covers that implementation tree, not a later metadata commit or a hosted rollout.
- An admitted owner turn can continue reading a verified excerpt of the same retained public page. An invalid cursor gives typed local feedback; a changed or missing original is not fetched again. [Scope and recovery](owner-web-retained-excerpts.md).
- An answer that the original Publication owner confirmed remains readable independently of a subsequent Run failure or cancellation. If a required report is missing, the Run still fails that requirement; the answer does not stand in for a report, a receipt or a completed Run. [Contract and fault tests](terminal-body-verification.md).
- The earlier **9/10 Runtime passes** are historical, before these corrections; W08 was the non-pass. The current Verify used local fixtures and did not send requests to an external model provider. It does not establish fresh live-model qualification, answer accuracy, browser requalification or production deployment.

## 简体中文

本版能在同一次运行里接着读同一份已留存的公开网页。没有有效游标时返回明确的本地结果；原文缺失或字节改变时不重新抓取。经原交付模块确认的答案正文不因后续故障被抹掉；若任务明确要求报告，缺报告仍判失败，不能把正文说成报告或把运行标为完成。

上述固定合并代码在 Node.js 26.11.1 上通过 1,727 项、跳过 6 项、无失败。早前的 Runtime 9/10 是修复前的历史，W08 当时未通过，不计为本版真实测评。本次没有调用外部模型，也不代表浏览器复验或正式服部署。
