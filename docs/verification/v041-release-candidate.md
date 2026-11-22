# v0.41.0 candidate · Owner research workspace

Candidate only. The package version and a running preview do not establish a tag,
Release, hosted CI pass, or final acceptance. The prior formal public baseline is
[v0.39.0](https://github.com/hpoenixf/open-etf-agent/releases/tag/v0.39.0).

This draft reviews [candidate 762b7838](https://github.com/hpoenixf/open-etf-agent/tree/762b78387d209582b2a49cc2495d94f5b42470aa),
repository tree `49d5ca33596bb1a640e4f1520abcb872e07f2514`, source subtree
`d2bb4fcc042c7876b01f8a354b43faca2e87b9cc`. The final package must be
checked against its own immutable commit and source tree.

- Default startup is still an offline demo. Live owner mode is an explicit trusted-loopback configuration.
- Bounded follow-ups use recent completed ordinary turns in the same conversation. An attached turn, unsettled turn or profile change ends context carryover. History and duplicate sends never dispatch another Run.
- Attach one supported text PDF to a single question. Parsing is local; the model may receive selected excerpts. The attached turn has no external retrieval. Check a saved report against its original physical page. OCR and visual inspection are not included.
- The optional Research Progress panel displays allowlisted recorded execution events for the selected turn: start or resume, tool preparation and return, and known completion state. It does not expose model reasoning or raw logs. Missing records can leave progress unavailable, and opening the panel does not run work.
- Opt-in search discovers public sources and the static reader retrieves pages. Snippets are not original evidence; paid providers require separate authorization. Wind returns bounded unadjusted daily closing observations for one ETF, not NAV, intraday quotes or total return.

[Owner setup and data flow](../local-gui-live.md) · [PDF limits](owner-gui-pdf.md)

Before publication, verify the exact final commit with Node 26 and the locked set:
`npm run docs:check`, `npm ci --ignore-scripts --no-audit --no-fund`,
`npm run build`, and `npm test`. Report skips and blocked steps explicitly.
Provider mocks do not qualify billing, entitlements, real service behavior or financial
accuracy. Browser upload remains separate from fixture/API PDF checks. No live
qualification count, final CI result, or public Release is claimed here.

## 中文

本稿仅记录 **0.41.0 发布候选**。默认离线演练不变。显式配置的持有人模式支持普通问题同会话追问、单轮文字 PDF、可选公开网页检索和 Wind 基金日收盘价。可展开「研究进度」查看本轮已记录的步骤，不显示模型内部推理。附件轮不带入前文或使用外部查询工具，后续普通问题不继承附件内容。正式发布须核对最终固定提交，不能将 mock、旧版或局部测试视为真实服务验收。
