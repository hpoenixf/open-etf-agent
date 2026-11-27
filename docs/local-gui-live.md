# Optional real-model preview on a trusted loopback host

Without `--live-config`, neither the original GUI startup nor its bundled offline demo dispatch a provider request. This alternative is an explicit, single-operator mode. It uses the existing Chat Completions Research Project, Conversation, Worker and Admission identities; it does not introduce another model client or request ledger.

Use a **new, separate Project directory**. It cannot adopt an offline Project, and the offline launcher refuses a live Project. Restart with the same Project directory, configuration and port. The built-in listener does not provide authentication or public ingress; keep it on loopback. The owner profile can import a selected text PDF per question; this is not a general upload service. It does not support web crawling, guest access or account sharing.

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

Go owner mode has an optional per-turn PDF picker but no seeded demo material or per-message confirmation dialog. You can ask directly and reopen the answer in History. By default, general answers do not use external sources. The optional connectivity settings below enable online tools. Existing sourced reports remain readable. No other Go host or path is accepted by this GUI. The existing native adapter identifies itself as Open ETF Agent and sends the stable, opaque native Root session on each request for the same Run. It does not identify itself as another client. A 403 or 429 is shown on the original turn without the upstream body. The original Admission receipt remains unknown where applicable; the application does not retry, change model, or infer a zero charge.

### Ordinary follow-ups and attachments

Sending an ordinary question may include short excerpts of up to four recent completed ordinary
turns in this conversation. Start a new conversation to leave prior context behind. An attachment,
unsettled turn, or profile change stops the history chain; other conversations are not read.
Historical answers do not grant authority or restart old Runs.

In the Go owner composer, **选工具** lists the available per-turn Skills and the public-facing tools enabled by the current launch configuration. **Automatic** can choose a bundled method; **热点解读** and **长期视角分析** apply the chosen method to this turn without changing research depth or tool permissions. The chart choice remains subject to the existing data and Wind rules. Search, webpage/PDF reading and Wind are listed for discovery, not invoked by clicking the menu. The Worker still checks the Run's permissions and data; a PDF attachment does not enable external tools. A configured Daily Watch brief is scheduled-only and cannot be selected for ordinary chat.

A selected PDF belongs to one question. It needs a text layer, is capped at 1 MiB and 16 pages,
and cannot be encrypted. Upload parses locally. On send, excerpts actually read may go to the
configured model service. Attached turns do not include ordinary history or external search, web
or Wind tools. Later ordinary turns do not inherit the file or its content. Use only materials
you are authorized to transmit. [PDF route, scope and checks](verification/owner-gui-pdf.md).

### Research progress

Expand **研究进度** on a turn to see recorded execution steps. Labels describe observed
events, not the model's private reasoning. Tool return is not evidence that a source
supported the answer or that a provider succeeded. Missing or interrupted records can
leave steps unavailable. Opening progress or History does not invoke a model.

### Optional public web and Wind connectivity

In the trusted launch file, add a top-level `"connectivity": {"web": true, "search": "exa-public-preview"}` to enable the existing public HTTPS reader and Exa’s documented no-key preview. The preview is rate-limited and does not fall back to a paid account. Exa receives public search terms. Search snippets are discovery only; the page reader must retrieve an original for a sourced claim. It checks robots and public addresses and reads static text, not logins, JavaScript, or PDFs. Page provenance is saved; the free-form answer may give source links but is not a formal cited Report.

Optional paid search profiles are `deepseek-search` and `yuanbao-search`. An approved account
and matching server-side environment reference are required (`WEB_RESEARCH_DEEPSEEK_API_KEY`
or `WEB_RESEARCH_YUANBAO_API_KEY`). You can opt into these as `searchAlternates` with Exa as the
primary search provider. A paid alternate requires a successful Exa lookup in the same Run;
it is not an automatic paid fallback after Exa failure. Send only public search terms.

For the official [Tencent Yuanbao Search MCP](https://developer.cloud.tencent.com/mcp/server/11764), select `yuanbao-mcp` as `search` or an explicit alternate. It uses the same WSA service key as the direct `yuanbao-search` adapter, but is a different, explicitly selected transport. Only the fixed `SearchPro` tool and public search keywords are sent. Search summaries are discovery, not citations; open the original public HTTPS source before citing a claim. The MCP handshake and search share one 90-second maximum and accept at most 2 MiB per response; only the first three bounded discovery hits are retained. The Run’s own cancellation or deadline can stop it earlier. Nothing is enabled by default; do not configure both Yuanbao adapters unless intentionally comparing them.

To additionally enable the typed Wind fund daily close tool, set `"wind": true` in the same object and inject `WIND_API_KEY` into the server process via an authorized secret store. Never store it in the launch JSON. The Wind tool is not a raw MCP passthrough, does not expose arbitrary service calls, and is not a universal live market feed. Restart the host with the same Project to preserve history. Old tasks keep their original configuration.

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

默认离线模式不变。只有显式传入 `--live-config`，且独立项目、服务端密钥环境变量和既有提供方配置都核验通过，才可启动本机真实模型预览。普通来源模式在提交前确认问题和选中的合成资料；Go 持有人模式可以直接提问，不加载演示资料。发送会使用所配置的模型与账户额度。未配置联网工具时只使用模型知识。可选联网能力见上文；Wind 需单独授权密钥，目前工具用于基金日收盘价，不等于通用实时行情。调用次数上限不是价格上限。刷新、History 和重复提交不会自动续跑，原任务需要另点确认恢复。应用本身仅监听回环地址，不自带公网入口和鉴权，不接入访客。仅显式选中的单轮文字 PDF 可导入；读取到的摘录可能发给配置的模型服务。OpenCode Go 使用明确的账户持有人配置、官方端点及经核对的 Chat Completions 模型。内部使用不代表提供方已确认本用途；先核对用途、地区、账号、额度及 Extra Usage。不得伪装为编程流量绕过拒绝，也不会因 403/429 自动换模型或重试。

直连 DeepSeek 时，使用上面的 `deepseek-direct` / 官方端点 / `deepseek-flash` 组合。本配置按官方工具协议关闭 thinking，不会静默改用其他模型或重试其他提供方。

For plots based on values you provide, see [financial chart input examples](skills/financial-chart-user-data.md). Earlier conversation numbers are not picked up automatically.

### Optional owner-only concurrent admission

Set the trusted server process environment variable `ETF_GUI_CONCURRENT_ADMISSION=1` only for the
current OpenCode Go owner profile and after confirming the upstream account can support the load.
It admits up to five independent conversations and at most five local model requests on the
existing Project/endpoint ledger. One conversation remains sequential and duplicate submissions
do not dispatch again. A sixth simultaneous conversation receives `GUI_WORKER_BUSY` while all five
workers are used. Unset the flag to return to the previous one-worker and one-request behavior.

The enabled GUI periodically checks its original Project ledger. After three minutes in the
**unknown** state, it can free the local slot only with the existing proof of terminal local
ownership. On the opted-in OpenCode Go route, a dispatched provider request also has a
three-minute **inactivity** watchdog, not a three-minute total task deadline. Response headers
and actual body progress restart it; SSE comments and empty/role-only events do not. If it fires,
only the local provider transport stops. Its slot is released when the exact reservation has a
durable terminal Session proof, without another three-minute wait. This does not impose an
idle deadline on tools or shorten the ordinary run timeout. The original unknown request,
usage/billing uncertainty and run record stay intact; there is no re-send, refund, or
assertion that remote execution stopped. Existing release receipts and ledger identity are
unchanged; rollbacks can read newly recorded local-only releases. The extra slots are a host
capacity bound, not an upstream allowance, and do not retry provider refusals.
