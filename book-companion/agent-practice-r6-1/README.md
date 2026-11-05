# 《从对话到工作：研究型智能体的设计与实践》R6.1 随书配套

这是R6勘误版的独立练习包。R5、R6旧包保留原字节；推荐新读者使用R6.1。完整书稿与图稿不公开。资源仅在book-companion-r5独立分支维护，工程main不变。

- [下载 R6.1 ZIP](open-etf-agent-practice-companion-r6-1.zip)
- [ZIP SHA256](open-etf-agent-practice-companion-r6-1.sha256)
- [逐文件清单](file-manifest.json)
- [来源与权利说明](THIRD_PARTY_NOTICES.md)
- [R6历史配套](../agent-practice-r6/README.md)
- [R5历史配套](../agent-practice-r5/README.md)

ZIP为107855字节，SHA256：`9c629432ff16ab2357550d6099a77227164e62554b98e43cab1cdf830cb8a8db`。包内66个载荷文件与2份清单。解压后在根目录运行 `node verify-files.mjs`，应显示matched与66。摘要只校验字节一致。

## R6读者勘误


R6旧包和书稿保留原字节。以下修正在本版正文与配套中同步完成，已做独立复现和回归：

1. 第6章轻量检索缩小范围时，allowed只留B-guide，候选断言改为1。portfolio-policy属于另一个工程练习，其三份组合说明与Atlas材料分别使用。
2. 第15章只持有B正文和附录的助手核“B支持Markdown且导出需联网”；“新增”由主任务结合A/B再比较。
3. 第17章evidence统一表示写出的陈述受到引用支持。wrong-content的content/evidence均为false；纠正为“两版导出均需联网”后，两项都改true，并将完成数断言改为2。三篇报告的第三篇只因越过离线查看证据而失败，不因没有写180差额而失败。
4. 毕业verify重新运行并检查新产物。检查既有目录用model-loop.mjs readback及真实路径；保存后改字节报REPORT_BYTES_CHANGED。复制配套后改normal.json里save_report的正文，再运行verify，会由固定参考检查报REPORT_CONTENT_MISMATCH。字节一致与答案正确分别检查。
5. 第14章补齐正在讨论的B输入；图17-1、相关说明与相邻重复定义一起校正。

从包根运行 `node examples/minimal/test-reader-corrections.mjs`，可实际观察8项读者改动与验收检查。它会新建reader-corrections目录，原始例程保持不变；失败变体只在其副本中产生。它不请求模型，也不承担通用语义评分。


## 环境与真实验证范围

统一推荐Node.js 26.11.1。固定工程源码仍是[v0.21.0](https://github.com/hpoenixf/open-etf-agent/tree/b22c43633101a10a50fc5b09ecc5ecba038f873a)，engines为>=26.8.1 <27。轻量程序只用内置能力，无需安装依赖或提供密钥。R6.1已独立完成18项针对性检查及37条回归命令，覆盖旧9入口、协议10项、读者回归8项、毕业3场景和3篇人工审阅汇总；另按原顺序重跑旧9入口26次进程，22成功与4预期拒绝。所有实际模型与网络请求均为零。

回放是作者编写的合成响应，不是真实模型录制。真实API互通列为出版前待办，没有对应服务实测回执。未新增跨平台、真实模型质量或工程15入口全量验证声明。读取包内VALIDATION区分本轮与历史记录。

## 使用与许可

先取得配套包，再按附录选择轻量或固定项目路径。v0.21.0源码没有本书examples目录；R5旧包内main链接已经失效，改从独立分支获取。

引用、改写自Open ETF Agent的适用部分继续保留原MIT许可。本书新增例程、校验器和说明未另授MIT或其他开源许可；公开可访问不表示仓库根MIT自动覆盖新增内容。本次勘误不扩大授权。平台内查看、fork等权利依适用条款，拟采用的最终配套许可仍需按权利说明处理。
