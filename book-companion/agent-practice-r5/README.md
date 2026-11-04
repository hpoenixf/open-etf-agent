# 《做一个能完成研究任务的 Agent》配套文件 R5

本目录提供独立随书程序与合成资料，不包含书稿全文、私人资料、凭据、数据库或依赖实体。

- [下载完整配套ZIP](./open-etf-agent-practice-companion-r5.zip)
- [ZIP的SHA256](./open-etf-agent-practice-companion-r5.sha256)
- [逐文件清单](./file-manifest.json)
- [来源与权利说明](./THIRD_PARTY_NOTICES.md)

ZIP共41个文件，解压根目录为open-etf-agent-practice-companion-r5。examples中的24个章节入口分为9个Node内置轻量入口、15个固定公开项目工程入口；另有6份合成资料/方法和2个共享模块。不是24个入口都无需安装或准备结果。

先核ZIP摘要，再解压并在包根运行：

```bash
node verify-files.mjs
node examples/minimal/first-loop.mjs
```

第一条核对39个清单载荷的原始字节；第二条运行第三章循环。完整性检查不等于安全或语义认证。校验器、缺文件、同尺寸篡改和越界路径负例，以及一次正常循环，已在独立解压目录、Node.js 24.19.0串行核对。更广的历史运行范围及未覆盖项见包内VALIDATION.md。

工程案例仍固定为[v0.21.0 / b22c4363](https://github.com/hpoenixf/open-etf-agent/tree/b22c43633101a10a50fc5b09ecc5ecba038f873a)，该历史标签没有本书examples目录。配套文件与固定源码分开取得；不把当前main的新功能、支持环境或测试结论套回书中。工程准备与运行顺序见包内appendices目录。

引用、改写自Open ETF Agent的适用部分仍遵循原MIT许可。原创新增配套代码、校验器与说明未在本次发布中另授MIT或其他开源许可；公开可访问不表示仓库根MIT自动覆盖这些新增内容。完整许可告知见本目录THIRD_PARTY_NOTICES.md。

本批ZIP SHA256：b968afd43667133999a646b314f92fa5b88b03f67cf3f310e3f2eee57eca6bfe。
