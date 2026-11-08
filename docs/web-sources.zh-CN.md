# 显式选择的公共 Web 来源（开发中）

这个模块为已有研究项目增加一次有限的 HTTPS 页面采集。它不是搜索 Agent，也不是浏览器。本文是开发说明，不代表公网或模型验收已经通过。

```sh
node src/research-cli.mjs source acquire --project ./research-project \
  --acquisition selected-web-01 --urls ./selected-urls.json --approve-public-fetch
node src/research-cli.mjs source acquisition --project ./research-project \
  --acquisition selected-web-01
```

`selected-urls.json` 是精确公共 HTTPS 页面 URL 的 JSON 数组。`--redirects` 可指定另一份数组，预先允许精确跳转目标；`--base-manifest` 只追加到明确选中的不可变来源清单。不提供 base 就是没有 base，不会隐式选择“最新清单”。采集也不会自动替后续任务选来源，提交研究任务时须显式使用返回的 manifest hash。

## 一个执行者，不自动重放

网络请求前先占有 acquisition ID，再落不可变计划。同 ID 的并发操作不能再次采集。成功记录实际 manifest；失败、中断不授予重试权限。查看操作只读，绝不恢复请求；成功终态计数会与来源回执交叉核对。已占有 ID 却缺完整终态属于未知，不表示请求没有发生。只有核清旧结果和相应权限后才能考虑新操作，新 ID 不能用来绕过拒绝或限流。

## 有限且保守拒绝

- 最多 4 个选中页面、16 次 HTTP 请求，每页最多 3 次跳转。跳转目标必须提前允许。仅 HTTPS，拒绝凭据、IP 字面主机、非默认端口和 fragment。
- DNS 的全部返回地址都须为公共单播地址，实际 HTTPS 请求固定使用已检查的地址，同时保留原主机名作为 TLS/SNI/Host 身份。不新增代理、替代解析器或鉴权回退。
- 访问每个来源域前检查 robots。404/410 表示文件不存在，可以继续；权限拒绝、限流、不支持的响应、错误或超限规则、正数 crawl delay 均停止。这个有意收窄的 robots profile 不承诺支持全部 RFC 用法。
- 仅 UTF-8 HTML 或文本。没有 JavaScript、嵌套资源抓取、登录、远程 PDF 或视觉检查。HTML 使用固定 parse5，并在解析过程中限制结构、工作量和提取文本。
- 每个原始页面最多 256 KiB，单个 robots 正文最多 64 KiB。一个来源清单的 Web 原件及提取文本各最多 512 KiB。这是**存储内容上限**，不是所有网络流量最多 512 KiB 的声明。每页采集另有包含 robots 的 512 KiB 可接受正文上限，整个操作还有上述请求和页数限制。跨过上限的接收 chunk 会被拒绝，不会成为有效来源。
- 操作有协作式 30 秒截止，并取消自己拥有的 HTTP 请求。操作系统 DNS 回调可能晚到，但取消后不能据此派发。同步解析有结构边界，不是可强制中断 CPU 的沙箱；也不声称证明所有逃逸子孙或远端结算。

## 证据贯通真实消费者

来源身份包括 acquisition、project、精确 base、原始/最终 URL、获取时间、原件字节 hash 与大小、提取 profile 和逐页 hash。不同获取时刻或 URL 的相同正文不会静默合并为同一个来源。HTTP 跳转和 robots 观察单独归档并通过 hash 绑定。

普通 Source → 工具结果 → Result → Report → Artifact → 冷 Reader 链路保留 Web provenance。原件是带 `nosniff` 和严格内容策略的惰性附件下载，不是在 Reader 中执行的 HTML。包含真实 Web 来源的报告不会标为 synthetic。冷读验证持久字节，不重新抓取或解析公网页面。

这是证据传递合同，不保证模型推理、引用选择或研究完整性。内容质量观察必须与 Runtime 合同结果分开报告。
