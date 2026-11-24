# v0.48.0 candidate: Verified web sources for saved answers

- [Draft PR #31](https://github.com/hpoenixf/open-etf-agent/pull/31) pins the reviewed implementation at [`d349a386`](https://github.com/hpoenixf/open-etf-agent/tree/d349a38631324929a974341c70ff9a9fc5b6ee1e) (tree `911636d89669cb69599d2b02bfdaf4dfebf6c885`). This scope is the owner workbench's exact-turn, optional web source panel.
- Open the panel to inspect verified retained excerpts and original webpage links under the same Project, conversation and answer turn. A search preview, a link mentioned in the answer and a formal citation are not the same as an accepted original read. Missing or unverified retained data are not shown as evidence and do not change the saved answer.
- The reviewed implementation passed 68 targeted local tests without external model calls (local API, SQLite, archive/readback and stale project identity checks). Build and documentation checks passed. Isolated browser staging reopened a previously saved two-excerpt answer after refresh and verified the pinned original link and the saved second excerpt. No new model submission occurred.
- The original [v0.47.0 Runtime evidence](v047-retained-web-and-answer-delivery.md) remains separate. This read-only change does not change Runtime model inputs, execution, writes or canonical answer outputs; it does not establish new live-model qualification, answer correctness or a production rollout. No new PDF acquisition, market data, export or account permissions are included.

## 简体中文

展开已保存回答旁的「已读网页」，可以回看同一项目、同一会话和本轮实际读取的原始网页链接及留存摘录。搜索预览、正文中提到的链接和正式引用不等于已读原文。旧记录缺失或无法核验时不展示，已保存正文照常读取。

固定代码通过 68 项本地定向测试及构建、文档检查。隔离预发刷新后，回读了既有回答的固定原文链接和留存第二段，不重新提交模型。原有 Runtime 验收见 v0.47.0，本项不代表新的真实测评或正式部署。
