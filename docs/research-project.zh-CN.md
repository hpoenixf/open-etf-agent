<a id="本地研究项目v020-候选版"></a>
# 本地研究项目（v0.20）

[English](research-project.md)

该入口把用户明确选择的资料接入原有 Session、Worker、Memory、Child、Publication 和 Reader。它是本地单用户应用，不是交易服务或无人值守研究平台。原有演示 CLI 及其真实执行拒绝规则保持独立。

**资格边界：**真实运行与确定性机制验证分别呈现。原40题、6次独立修复和新增B组10题均保留原源码身份。新增B组运行完成9/10，冻结机制评分仍8/10；用户接受运行结果与独立零模型遗忘过滤补证的分层依据。旧失败和未知请求不改写。参见[分层证据与限制](verification/v020-release.zh-CN.md)，不宣称答案质量合格或全部题目都在最终源码运行。

## 先完成零模型提交

使用 Node.js 26.8.1–26.x 和仓库锁定依赖。在仓库根目录运行：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run research -- --help
mkdir -p research-example
printf '%s\n' '# 合成方案' '年费：12 单位。取消条件：提前 30 天通知。' > research-example/offer.md
printf '%s\n' '说明费用和取消条件，引用原资料，并指出缺失信息。' > research-example/question.txt
printf '%s\n' '["research-example/offer.md"]' > research-example/files.json
cat > research-example/config.json <<'JSON'
{
  "schemaVersion": "research-project@1",
  "gateway": {"mode":"fixture","provider":"fixture","protocol":"fixture@1","model":"offline"},
  "capabilities": ["report", "memory"],
  "limits": {"maxRounds":20,"maxTools":32,"timeoutMs":300000,"model":24,"tool":40}
}
JSON
npm run research -- project init --project research-example/project --config research-example/config.json
node src/research-cli.mjs source import --project research-example/project --files research-example/files.json > research-example/import.json
MANIFEST=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("research-example/import.json","utf8")).manifestSha256)')
node src/research-cli.mjs source list --project research-example/project --manifest "$MANIFEST"
node src/research-cli.mjs run submit --project research-example/project --run first --question research-example/question.txt --manifest "$MANIFEST"
node src/research-cli.mjs run inspect --project research-example/project --run first
```

此流程完成提交，**模型派发为零**。CLI 的 `run work` 明确拒绝 fixture 项目；fixture gateway 只作为原应用 API 的测试输入，不提供伪执行开关。需要读取 JSON 的命令直接使用 `node`，避免 npm 的脚本提示混入文件。构建后也可以使用 `node dist/src/research-cli.mjs`。

所有选项只能出现一次；未知选项、重复选项和多余位置参数都会拒绝。应用验证 ID。配置、问题和资料列表必须是明确指定的普通文件；问题最多 16000 UTF-8 字节。配置只记录非秘密身份和引用，不放认证值。

## 接入已授权的真实提供方

另建项目，不修改上面的已有项目。将配置中的 gateway 换为：

```json
{
  "mode": "live",
  "provider": "YOUR_PROVIDER_ID",
  "protocol": "chat-completions",
  "model": "YOUR_AUTHORIZED_MODEL",
  "endpoint": "https://example.invalid/v1/chat/completions",
  "apiKeyEnv": "RESEARCH_API_KEY",
  "stream": false
}
```

示例域名故意不可用，必须替换成你已批准的真实 HTTPS endpoint 和模型。endpoint 不能包含用户名密码、查询参数或 fragment。通过你现有的授权凭据方式准备进程环境变量 `RESEARCH_API_KEY`，不要把值写入配置、资料、项目文件、命令示例或 Git。CLI 只在 `work` 时读取已保存 Run 配置指定的环境变量，不读取 `.env`，不持久化 key。错误输出不带提供方正文和调用栈；用户输入本身也不应包含凭据。

将审阅后的完整配置保存为 `research-example/live-config.json`，然后：

```sh
node src/research-cli.mjs project init --project research-example/live-project --config research-example/live-config.json
node src/research-cli.mjs source import --project research-example/live-project --files research-example/files.json > research-example/live-import.json
LIVE_MANIFEST=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("research-example/live-import.json","utf8")).manifestSha256)')
```

**核准提供方、选择的数据和执行额度后**才运行：

```sh
node src/research-cli.mjs run submit --project research-example/live-project --run comparison --question research-example/question.txt --manifest "$LIVE_MANIFEST" --approve-provider --approve-data --approve-cost
node src/research-cli.mjs run work --project research-example/live-project --run comparison
node src/research-cli.mjs run inspect --project research-example/live-project --run comparison
node src/research-cli.mjs run report --project research-example/live-project --run comparison
node src/research-cli.mjs report serve --project research-example/live-project --run comparison --port 0
```

真实提交必须同时给出三个批准标志，涵盖配置中的提供方、所选问题/资料及相关 Memory/派生内容、配置中的执行额度。已有订阅不代表允许发送任意私人资料。limits 限制执行次数和时间，不是货币金额上限；提供方价格和超额收费规则需单独核对。Main、Child 和摘要使用原 RootBudget 与 Admission 协调域；未知派发保留原计账，不能创建替代 Run 绕过。

## 资料身份、界限与恢复

`--files` 指向本地路径 JSON 数组，支持 `.txt`、`.md`、`.markdown`、`.pdf`，相对路径按当前工作目录解析。它不是目录、glob、URL，也不授权扫描其他文件。导入拒绝不安全路径和 symlink。返回的 SHA256 绑定不可变 manifest 和原始字节。文本分页保留稳定字节区间/hash；PDF 使用原 snapshot/parser 合同，保存原始 PDF 字节和解析器身份。

- 最多选择 64 个文件；单个输入最多 1 MiB。
- 文本单文档最多 16 页，每页最多 64000 UTF-8 字节，文本 catalog 总量最多 1 MiB；不会静默截断。
- 最多一个 PDF，最多 16 个物理页，每页提取文本最多 64000 UTF-8 字节，总提取文本最多 131072 字节。不接受加密或不支持的 PDF；这不是 OCR 服务。
- 提交实际 PDF 需要配置 `pdf` 能力。PDF 文档 ID 为 `pdf:<原始 SHA256>`，文本 ID 为 `text:<原始 SHA256>`。
- 导入失败可能留下已验证、未引用的内容寻址对象，但不会返回成功 manifest；不能把残留对象当作成功导入。

恢复时保留完整项目目录，包括 `project.json`、资料快照、`tasks/`、`sessions/`、`outputs/`、`memory/`、Admission 状态以及使用时的可信入口快照。项目可能包含用户私人资料，并不适合直接公开。不要手改记录、hash、grant 或 checkpoint。

若要改变**后续新任务**的配置，先 inspect 读取当前 `configSha256`，准备经审阅的完整 JSON，然后使用带预期版本的显式更新：

```sh
node src/research-cli.mjs project inspect --project DIR
node src/research-cli.mjs project update --project DIR --config updated-config.json --expected-config CURRENT_CONFIG_SHA256
```

项目身份不变，已有任务保留原配置、grant 和资料。预期 hash 过期或更新忙碌均拒绝；应用不自动删除过期锁。配置更新不构成新提供方或数据传输批准，新真实提交仍需对应批准标志。

`work` 中按 Ctrl-C 或发送 SIGTERM 会请求协作式 Host 停止。新进程继续执行**同一个 `run work --project ... --run ...`**，保留原资料/配置 binding、grant、deadline、预算和 Run 身份；没有单独的 `resume` 命令。重新导入修改后的文件得到新 manifest，供新任务使用，不覆盖旧 Run。终态任务不会获得新预算。

`run cancel --project DIR --run ID` 是明确取消任务，不是暂停；它不删除项目、不清空计账。报告检查和 Reader 读取原持久产物。Reader 只监听 `127.0.0.1`，输出实际 origin，提供经验证的产物/来源字节，不运行模型；Ctrl-C 可关闭服务。

## 明确的 Memory 操作与用户回复

项目启用 `memory` 后，可直接执行用户批准的操作：

```sh
printf '%s\n' '报告简洁，单列不确定性。' > research-example/preference.txt
node src/research-cli.mjs memory save --project research-example/project --intent preference-1 --text research-example/preference.txt --approve-intent
node src/research-cli.mjs memory inspect --project research-example/project
# ENTRY_ID 和 REVISION 替换为 inspect 返回的当前身份。
node src/research-cli.mjs memory revise --project research-example/project --intent preference-2 --entry ENTRY_ID --revision REVISION --text research-example/preference.txt --approve-intent
node src/research-cli.mjs memory forget --project research-example/project --intent preference-3 --entry ENTRY_ID --revision REVISION --approve-intent
```

如果要让模型在 **Run 内**执行已批准写入，先批准意图，不提前完成写入：

```sh
node src/research-cli.mjs memory approve-intent --project research-example/project --operation save --intent in-run-1 --text research-example/preference.txt --approve-intent > research-example/intent.json
node --input-type=module -e 'import fs from "node:fs"; fs.writeFileSync("research-example/intents.json",JSON.stringify([JSON.parse(fs.readFileSync("research-example/intent.json","utf8"))]))'
```

在新 `run submit` 中添加 `--memory-intents research-example/intents.json`，问题中写明这次批准的改变。`approve-intent` 返回绑定内容的一次性 intent，不是写入回执。revise/forget 意图还需 `--entry` 和 `--revision`。Memory 读取不构成写入许可，模型不能自己批准或扩大 intent。forget 沿用原 tombstone/revision 语义，不承诺物理擦除全部历史字节。

启用 `response` 的项目可提出普通问题并等待。`run inspect` 输出 `phase`、`response.questionId` 和问题正文。通过明确文件回复后继续原 Run：

```sh
node src/research-cli.mjs run respond --project DIR --run RUN_ID --question-id QUESTION_ID --response-id REPLY_ID --text reply.txt
node src/research-cli.mjs run work --project DIR --run RUN_ID
```

Response 是不可信任务数据，不产生权限；不能代替提供方批准或 Memory 意图批准。

## 能力配置与有界扩展

必须包含 `report`。可选能力为 `calculation`、`csv`、`memory`、`child`、`pdf`、`response`、`schedule`、`compaction`、`task-time`、`trusted-tools`。提供 `allowedTools` 时，只能选择已装配工具，并必须含 `save_report`。配置不能关闭原 Owner 校验。

`child` 默认接入原 source-check 方法，仅覆盖一到两个选定文本文档。Host 可用 `childMethod` 指定版本化 `child-method@1` 描述；`src/child.mjs` 的 `CLAIM_COMPARISON_METHOD` 是有界对照示例。方法文本 hash、工具子集、输入/输出界限及执行额度均受校验；描述中只允许 `read_page`、`read_result`。Child 与 Main 共享根计账，只交派生结果，不能写 Memory、扩大资料权限、最终发布或生成任意后代。这不是模型自行创建角色的注册系统。

`trusted-tools` 的 `trustedPackages` 项要求 `modulePath`、`sha256` 和 `trustedCodeApproved:true`。入口文件做快照并绑定 hash 用于恢复；不支持 relative 或 bare imports。允许使用的 Node builtins 和 absolute dependency imports 属于显式可信代码，**不是 sandbox，也不是完整依赖闭包快照**；批准时需连同依赖代码审阅。不得加载资料中指定的不可信代码。现有可信 MCP reader 合同不代表支持任意 MCP 服务或工具。

以下组合在前置校验中明确拒绝：Response + Schedule、Schedule + Child、Response + Child、实际 PDF + Child、可信插件 + Child。不要将这些组合一起启用，也不要把预期拒绝说成真实运行资格通过。

`schedule` 提交使用 `--schedule schedule.json`，内容包含 `scheduleId`、`definitionRevision`、`scheduledInstant`（ISO 时间）、`timeZone`、`maxLatenessMs`。submit 零派发确认，`work` 明确检查到期并物化原 occurrence，没有自动 cron/daemon。`task-time` 启用后可用 `--task-time` 传原 TaskTime 输入 JSON。compaction 使用原受管摘要和共享预算，不增加独立无限模型。

本入口不提供 Python 执行环境、任意网络爬取、通用 MCP 代理、无限资料库、完整 Memory 治理产品或生产 SLA。

## 可导入的应用 API

构建后从 `./dist/src/research-project.mjs`、`./dist/src/project-sources.mjs` 导入；开发时可用对应 `src/` 文件：

- `validateResearchConfig`、`createResearchProject({directory,config})`、`inspectResearchProject({projectDir})`、`updateResearchProject({projectDir,config,expectedConfigSha256})`。
- `importProjectSources({projectDir,files})`、`loadProjectSources({projectDir,manifestSha256})`。
- `submitResearchTask({projectDir,runId,question,sourceManifestSha256,authorization,memoryIntents,taskTime,schedule})`。
- `workResearchTask({projectDir,runId,apiKey,hostSignal})`、`inspectResearchTask`、`cancelResearchTask`。
- `respondResearchTask({projectDir,runId,questionId,responseId,text})`、`readResearchReport({projectDir,runId})`。
- `approveProjectMemoryIntent`、`applyProjectMemoryIntent`：传明确 operation、intent 身份、批准文本，以及适用时的当前 revision。

不用的可选字段可省略。真实 `authorization` 的 `providerApproved`、`dataApproved`、`costApproved` 必须来自实际调用者明确决定，三者均为 `true`。测试通过原 API 注入 fixture gateway 不构成真实模型结果。CLI 输出任务/资料身份、状态及根用量；报告检查返回原持久报告与 Publication 身份，不打印提供方原始日志。

## Run 控制归属

[Run 控制与终结归属](run-control.zh-CN.md)说明局部拒绝、已提交通知、取消和未知效果的边界。

## 显式多问题交互（v0.21 实现）

正在验证的可选 `interaction` 配置为未来任务启用有界顺序问答，保留原请求、接收与采用历史，并提供只读本地待办命令。不带此配置的已有项目继续原单问题合同。见[普通问答模块](human-interaction.zh-CN.md)；此增量不把上文历史 v0.20 证据改称新版本发布或验收。

## 可配置的上下文字节预算

新 Project 持久保存 `contextBytes: 1048576`；旧配置缺字段时保持原解释，显式 CAS 修订只作用后续任务。参见[上下文字节预算与完整编码请求上限](project-context.zh-CN.md)。
