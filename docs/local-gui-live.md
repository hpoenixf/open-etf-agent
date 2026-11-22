# Optional real-model preview on a trusted loopback host

Without `--live-config`, neither the original GUI startup nor its bundled offline demo dispatch a provider request. This alternative is an explicit, single-operator mode. It uses the existing Chat Completions Research Project, Conversation, Worker and Admission identities; it does not introduce another model client or request ledger.

Use a **new, separate Project directory**. It cannot adopt an offline Project, and the offline launcher refuses a live Project. Restart with the same Project directory, configuration and port. No private material upload, web crawling, memory export, guest access, account sharing, proxy, public DNS or public ingress is supported.

1. Select a provider and model that explicitly allow your research workload and regional usage. Independently verify the account's spend settings and data retention. The model must support Chat Completions function tools.
2. Create an operator-only configuration file outside version control. Set **non-secret metadata only**. Inject the credential as the dedicated server-side `ETF_GUI_PROVIDER_KEY` environment variable from your approved secrets store. Do not pass its value in the file, browser, command line, git or tickets.
3. Start it on a trusted local machine. For this preview, use only the two bundled synthetic sources; do not enter confidential information. Other local processes can access the loopback port, so operator/host trust is required.

Illustrative configuration (replace the domain and model; `.invalid` does not name a working endpoint):

```json
{
  "gateway": {
    "provider": "your-approved-provider",
    "endpoint": "https://api.example.invalid/v1/chat/completions",
    "model": "your-reviewed-model",
    "apiKeyEnv": "ETF_GUI_PROVIDER_KEY"
  },
  "limits": { "model": 4, "timeoutMs": 120000 }
}
```

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run gui -- --project ./test-output/local-gui-real --port 4179 --live-config /path/to/config.json
```

The host prints its **loopback-only** origin. Opening the interface, starting a conversation and reading History do not dispatch. The UI displays that real requests can incur cost, then asks you to authorize the selected source, question and configured provider before submission. A repeated submission acknowledges only its original message and never resumes it by itself. An interrupted active Run only resumes through a separate explicit action; Admission retains the original accounting records and cannot guarantee that a provider will not charge. A request ceiling is **not** a dollar guarantee. No real-request evidence is implied by mocked transport tests.

## OpenCode Go profile for the account owner

The [official Go guide](https://opencode.ai/docs/console/go/#where-can-i-use-it) documents coding-agent traffic and the direct API. The account owner must first verify eligibility for the intended workload and model, region, allowance, and Extra Usage setting. This local profile does not establish provider approval; it does not pool a subscription or serve other users. Do not disguise research as coding or route around an account, region or provider refusal.

Use these exact provider and endpoint values, and replace the model placeholder with an explicitly reviewed model ID that uses this Chat Completions route. The credential still comes only from the dedicated server-side environment variable.

```json
{
  "provider": "opencode-go-owner",
  "endpoint": "https://opencode.ai/inference/go/openai/v1/chat/completions",
  "model": "your-reviewed-go-chat-model",
  "apiKeyEnv": "ETF_GUI_PROVIDER_KEY"
}
```

No other Go host or path is accepted by this GUI. The existing native adapter identifies itself as Open ETF Agent and sends the stable, opaque native Root session on each request for the same Run. It does not identify itself as another client. A 403 or 429 is shown on the original turn without the upstream body. The original Admission receipt remains unknown where applicable; the application does not retry, change model, or infer a zero charge.

## Direct DeepSeek Flash profile

For an approved direct DeepSeek account, use these exact values in the configuration's `gateway` object. The credential remains in the same dedicated server-side environment variable.

```json
{
  "provider": "deepseek-direct",
  "endpoint": "https://api.deepseek.com/chat/completions",
  "model": "deepseek-flash",
  "apiKeyEnv": "ETF_GUI_PROVIDER_KEY"
}
```

This explicit profile follows [DeepSeek's non-thinking tool-call contract](https://api-docs.deepseek.com/guides/tool_calls/) and sends `thinking: {"type":"disabled"}` on each request. The adapter reuses ordinary tool messages rather than persisting/replaying provider reasoning, which the [thinking-mode protocol](https://api-docs.deepseek.com/guides/thinking_mode/) requires for tool calls. A different host, path or model is rejected when this profile is selected; it never falls back or retries on another model. Other provider wire formats and existing Run limits are unchanged. This is a tested mock transport, not evidence of connectivity, provider terms/account approval or region availability for a particular deployment.

## 中文

默认离线模式不变。只有显式传入 `--live-config`，且独立项目、服务端密钥环境变量和既有提供方配置都核验通过，才可启动本机真实模型预览。每次提交前须同意发送问题和选中的合成资料，可能产生费用；调用次数上限不是价格上限。刷新、History 和重复提交不会自动续跑，原任务需要另点确认恢复。不开放公网，不接入访客或私人材料。OpenCode Go 使用明确的账户持有人配置、官方端点及经核对的 Chat Completions 模型。内部使用不代表提供方已确认本用途；先核对用途、地区、账号、额度及 Extra Usage。不得伪装为编程流量绕过拒绝，也不会因 403/429 自动换模型或重试。

直连 DeepSeek 时，使用上面的 `deepseek-direct` / 官方端点 / `deepseek-flash` 组合。本配置按官方工具协议关闭 thinking，不会静默改用其他模型或重试其他提供方。

### 已有 Owner Project 的运行额度

`limits.model` 是 Root 级模型请求上限；`limits.maxRounds` 是独立的 Run 轮次上限，先耗尽哪一项就按哪一项停止。`tool` 与 `maxTools` 分别是 Root 和本 Run 的工具预算。它们是工作台配置，不代表模型厂商套餐、余额或并发上限；HTTP 403/429 另行解释。增配不限制正文长度，也不移除工具或浏览器、网络、账户的安全防护。计费可能随实际完成的更多轮次增加。

要从早期 4 次试点值更新现有部署，操作员先确认无在途研究、队列或待核对扣费，停止服务，在受限目录备份**原有启动配置**和 `research-cli project inspect --project DIR` 返回的完整 `.config` 及 `.configSha256`。仅修改已有 `.config.limits`，保留网关、凭据引用、源及其他字段；通过 `research-cli project update --project DIR --config FILE --expected-config OLD_SHA` 对该 Project 做显式 CAS，然后把启动配置的 `limits` 项更新为相同值，再重启核对。这里 `research-cli` 指部署里的原生 `node src/research-cli.mjs`（构建包则用对应 `dist/src`），不是设置模型代理的新接口。若失败，保持服务停机、按当时的配置 SHA CAS 恢复旧完整配置，再恢复旧启动配置。不要改写 Project ID、账本或旧任务快照。

更新仅对后续新 Run 生效；原有终态、用量与 History 不变，旧任务不自动重放。已有每日追踪在运行配置改变后须重新启用。工作台启动不会因为编辑启动配置而默默给现存 Project 扩增额度。

#### 普通问题的工具调用仅记账（可选）

操作员可显式在可信启动配置顶层设置 `"toolAccounting":"metered-only@1"`，并用上述原生 Project CAS 给新配置设置 `"ownerToolAccounting":"metered-only@1"`（其他字段保持不变）。现有工作台启动不会自动迁移此项。只影响随后新建、无附加资料的 Owner 普通问题，包括相同模式的每日追踪。已绑定旧预算的历史、未知或暂停任务不改写；PDF、离线演练、其他项目类型仍执行其原有预算。

此模式只移除普通问题的 Root 与 Run 两处聚合工具次数挡板，不加替代数字。每次工具派发仍在原 Session 执行前记账，重开仍可核对；未结算不等于工具已成功。配置里原来的 `tool` / `maxTools` 保留用于非普通问题及版本兼容，不能当作此模式的挡板。模型请求次数、模型轮次、时间窗口、访问安全、工具及供应商自己的约束仍有效，并不等于无限外部操作。关闭新任务该模式可将 Project 配置 CAS 回原值；退回不认识该计量绑定的旧二进制，不能保证安全读取超出原总数的新 Run，不建议回退旧二进制来恢复限制。
