# Optional real-model preview on a trusted loopback host

Without `--live-config`, neither the original GUI startup nor its bundled offline demo dispatch a provider request. This alternative is an explicit, single-operator mode. It uses the existing Chat Completions Research Project, Conversation, Worker and Admission identities; it does not introduce another model client or request ledger.

Use a **new, separate Project directory**. It cannot adopt an offline Project, and the offline launcher refuses a live Project. Restart with the same Project directory, configuration and port. The built-in listener does not provide authentication or public ingress; keep it on loopback. It does not support private material uploads, web crawling, guest access or account sharing.

1. Select a provider and model that explicitly allow your research workload and regional usage. Independently verify the account's spend settings and data retention. The model must support Chat Completions function tools.
2. Create an operator-only configuration file outside version control. Set **non-secret metadata only**. Inject the credential as the dedicated server-side `ETF_GUI_PROVIDER_KEY` environment variable from your approved secrets store. Do not pass its value in the file, browser, command line, git or tickets.
3. Start it on a trusted local machine. Other than the named Go owner profile below, this preview uses only the two bundled synthetic sources. Do not enter confidential information. Other local processes can access the loopback port, so operator/host trust is required.

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

The host prints its **loopback-only** origin. Opening the interface, starting a conversation and reading History do not dispatch. In the source-bound preview, the UI asks you to authorize the selected source, question and provider. In the Go owner profile, clicking Send submits immediately to the configured provider and may use its allowance. A repeated submission acknowledges only its original message and never resumes it by itself. An interrupted active Run only resumes through a separate explicit action; Admission retains the original accounting records and cannot guarantee that a provider will not charge. A request ceiling is **not** a dollar guarantee. No real-request evidence is implied by mocked transport tests.

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

Go owner mode has no source picker, no seeded demo material and no per-message confirmation dialog. You can ask directly and reopen the answer in History. General answers do not have verified external sources, live market quotes or web access. Existing sourced reports remain readable. No other Go host or path is accepted by this GUI. The existing native adapter identifies itself as Open ETF Agent and sends the stable, opaque native Root session on each request for the same Run. It does not identify itself as another client. A 403 or 429 is shown on the original turn without the upstream body. The original Admission receipt remains unknown where applicable; the application does not retry, change model, or infer a zero charge.

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

默认离线模式不变。只有显式传入 `--live-config`，且独立项目、服务端密钥环境变量和既有提供方配置都核验通过，才可启动本机真实模型预览。普通来源模式在提交前确认问题和选中的合成资料；Go 持有人模式可以直接提问，不加载演示资料。发送会使用所配置的模型与账户额度。该模式没有联网搜索或实时行情，通用回答与有来源的历史报告分开呈现。调用次数上限不是价格上限。刷新、History 和重复提交不会自动续跑，原任务需要另点确认恢复。应用本身仅监听回环地址，不自带公网入口和鉴权，不接入访客或私人材料。OpenCode Go 使用明确的账户持有人配置、官方端点及经核对的 Chat Completions 模型。内部使用不代表提供方已确认本用途；先核对用途、地区、账号、额度及 Extra Usage。不得伪装为编程流量绕过拒绝，也不会因 403/429 自动换模型或重试。

直连 DeepSeek 时，使用上面的 `deepseek-direct` / 官方端点 / `deepseek-flash` 组合。本配置按官方工具协议关闭 thinking，不会静默改用其他模型或重试其他提供方。
