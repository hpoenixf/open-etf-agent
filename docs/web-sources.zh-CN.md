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
- DNS 的全部返回地址都须为公共单播地址，实际 HTTPS 请求固定使用已检查的地址，同时保留原主机名作为 TLS/SNI/Host 身份。默认路线不新增代理、替代解析器或鉴权回退；下文另行明确选择的开发 profile 有单独合同。
- 访问每个来源域前检查 robots。404/410 表示文件不存在，可以继续；权限拒绝、限流、不支持的响应、错误或超限规则、正数 crawl delay 均停止。这个有意收窄的 robots profile 不承诺支持全部 RFC 用法。
- 仅 UTF-8 HTML 或文本。没有 JavaScript、嵌套资源抓取、登录、远程 PDF 或视觉检查。HTML 使用固定 parse5，并在解析过程中限制结构、工作量和提取文本。
- 每个原始页面最多 256 KiB，单个 robots 正文最多 64 KiB。一个来源清单的 Web 原件及提取文本各最多 512 KiB。这是**存储内容上限**，不是所有网络流量最多 512 KiB 的声明。每页采集另有包含 robots 的 512 KiB 可接受正文上限，整个操作还有上述请求和页数限制。跨过上限的接收 chunk 会被拒绝，不会成为有效来源。
- 操作有协作式 30 秒截止，并取消自己拥有的 HTTP 请求。操作系统 DNS 回调可能晚到，但取消后不能据此派发。同步解析有结构边界，不是可强制中断 CPU 的沙箱；也不声称证明所有逃逸子孙或远端结算。

## 证据贯通真实消费者

来源身份包括 acquisition、project、精确 base、原始/最终 URL、获取时间、原件字节 hash 与大小、提取 profile 和逐页 hash。不同获取时刻或 URL 的相同正文不会静默合并为同一个来源。HTTP 跳转和 robots 观察单独归档并通过 hash 绑定。

普通 Source → 工具结果 → Result → Report → Artifact → 冷 Reader 链路保留 Web provenance。原件是带 `nosniff` 和严格内容策略的惰性附件下载，不是在 Reader 中执行的 HTML。包含真实 Web 来源的报告不会标为 synthetic。冷读验证持久字节，不重新抓取或解析公网页面。

这是证据传递合同，不保证模型推理、引用选择或研究完整性。内容质量观察必须与 Runtime 合同结果分开报告。

## 显式平台 profile（开发增量）

默认 `system-direct@1` 路线及其旧记录不变。操作者可以事前明确选择 `--network-profile platform-doh-pinned@1`，失败后绝不自动切换。这个独立 profile 已实现并正在离线核验，还没有通过实际公网采集。

占有 acquisition 前只快照环境既有代理配置，不新增代理服务、凭据、全局 dispatcher 或信任设置。配置缺失、非法或 `NO_PROXY` 冲突/不支持时拒绝，而不是改成直连。当前明确核验的原生代理 API 目标为 Node 26.11.1，其他 runtime 对这个可选 profile 保守拒绝。

固定解析器是 Cloudflare DoH（`cloudflare-dns.com`，bootstrap `1.1.1.1`）。CONNECT 指向固定且验证过的 IP，同时保留原始 TLS/SNI/Host 身份。A 和 AAAA 两族都须返回有界、非截断、问题身份匹配的 NOERROR 回复。允许一族 NODATA；两族全空、CNAME/不支持的记录、错误回复或任何不安全地址都会拒绝。“完整答案集”仅指本次两族回复，不表示一个 DNS 域在所有时刻的全部可能地址。

DNS、robots 和页面共享整个操作的 16 次 HTTP 上限及 30 秒截止。plan@2 另声明整个操作 1 MiB 的可接受响应正文上限，旧原件/文本及单正文限制继续保留。DNS 原始正文有独立大小上限，绑定 hash 保存并在冷读重新核验；代理连接尝试单独观察，不冒充 HTTP 响应。旧 plan/transport/terminal @1 仍可读取，新 @2 明示所选 profile。`web-source@1` 身份规则不变，其 admission 与 transport hash 已绑定这些记录。

权限拒绝、限流或未知副作用仍停止，不回退。代理路线的成功不能当成旧直连路线通过；历史上成功抓过网页，也不能替代本次实测。

### 既有排除规则

有界 `NO_PROXY` 解析器保留排除意图，即使原生代理 API 会忽略 CIDR。域名、地址或严格解析后的 CIDR 匹配时，本 profile 仍拒绝；合法但不匹配的 CIDR 不会改写或删除原配置。完整裸 IPv6 先于可选域名端口规则解析。畸形、映射地址族及不支持或歧义规则继续保守拒绝。这是兼容既有策略，不是绕过排除规则的许可。

### 按 JSON 编码预算划分逻辑文本页

新采集采用 `utf8-text-json-pages@3` 或 `static-html-parse5@8.1.0-json-pages@3`。这里是逻辑文本页，不是物理页或视觉页。分页保留完整 Unicode 码点；每页原 UTF-8 字节、第一层 JSON 字符串内文、第二层 JSON 字符串内文（扣除固定定界开销）各不超过 131,072 字节。最多 16 页，超出以 `WEB_PAGE_LIMIT` 明确拒绝，不截断；拼接各页严格等于提取正文，原 HTML/text 附件不变。

旧 `utf8-text@1`/HTML v1 profile 保留原 64,000 raw 字节限制；JSON-pages `@2` 保留三项 65,536 字节限制。冷读保留身份，不重新分页。单原文/提取正文 262,144 字节及来源集合 524,288 字节总上限不变，16 页上限不意味着扩充这些预算。此预算只约束文本编码，不保证完整请求符合项目预算：来源元数据、问题、历史和工具调用仍占空间，新 Project 默认 1MiB 上下文且可显式配置并冻结；旧任务缺少该配置时保留原限制。Runtime 与 Gateway 的编码保护仍拒绝超限输入。
