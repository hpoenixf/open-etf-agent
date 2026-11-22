# v0.39.0 · Local research GUI preview

The loopback workspace lets one operator create conversations from two bundled synthetic ETF sources and inspect the saved report and original citation. History, drafts, question reuse and Markdown exports are available from the browser. The public GUI starts in offline mode. [Setup](../local-gui.md) · [Acceptance contract](../../openspec/changes/v039-local-research-gui/specs/local-research-gui/spec.md)

The fixed GUI behavior is pinned at `aa2104e52c8ba9c16822387e7c3c0709531b221e`. It wraps checksums and keeps status polling active while a Worker finishes during a read. The first browser cohort saved ten reports and automatically displayed completion in 8/10 cases. A controlled browser check reproduced the stale-state race and verified that the fix completes the same submission without manual refresh.

- **Offline product.** The built GUI passed desktop and narrow Chrome workflows, including source inspection, history search, per-conversation drafts, question reuse, Markdown exports, keyboard navigation and same-directory restart. When the browser lost a response after acceptance, both ordinary reconciliation and manual retry preserved one Run. Local GUI tests cover the loopback, same-origin and offline Project restrictions.
- **Fresh live cohort.** The fixed candidate automatically displayed completion and delivered reports in 10/10 cases. Eight cases ran in Chrome 157.0.8103.79 and two in Safari 26.4 on macOS, at desktop and narrow widths. All ten reports, original sources, clipboard contents and downloads were checked after restart. Thirty physical DeepSeek Flash requests returned HTTP 200 and matched completed Runtime records. The pricing estimate is USD 0.00655. All conclusions and values matched the synthetic documents. T02 includes one quoted fragment in the source description that is absent from the original.
- **Full suite.** Local verification on macOS and Linux ARM64 with Node 26.11.1 passed 1,592 tests per platform with four historical binary-dependent cases skipped. Locked installation, build, module documentation, the scoped OpenSpec delta and the existing article checks passed. [GitHub Release and hosted verification](https://github.com/hpoenixf/open-etf-agent/releases/tag/v0.39.0)

Live trials use a separate loopback harness limited to the ten synthetic questions and the existing Conversation, Worker and Publication paths. The shipped GUI uses offline data, and the narrow-screen evidence is from desktop browsers with reduced effective viewports. [Sanitized cohort and execution identity](v039-qualification.safe.json)

## 中文

这一版提供本地浏览器预览。用户可用两份 ETF 模拟资料新建会话、查看报告与来源、搜索历史、复用问题以及复制和下载 Markdown。发布范围为回环地址上的离线演练。

首轮固定十题均保存了报告，自动显示完成为 8/10。修复了来源校验值溢出，以及执行结束恰逢状态查询时界面停止更新的问题。修复后独立重跑十题，Chrome 和 Safari 均自动显示完成，报告及原文重启后可读，30 次真实请求全部成功。T02 的引用说明多出一段原文未出现的措辞，数字和结论与原文一致。真实调用只在独立验收入口中启用。

构建产物通过离线会话、草稿隔离、导出、键盘和丢响应重试验证。macOS 和 Linux ARM64 都用 Node 26.11.1，各通过 1,592 项，4 项需要历史二进制的测试跳过。[机器可读验收记录](v039-qualification.safe.json) · [GitHub Release 与远端验证](https://github.com/hpoenixf/open-etf-agent/releases/tag/v0.39.0)
