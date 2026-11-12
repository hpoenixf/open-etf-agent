# 显式研究对话（v0.29 候选）

[English](conversations.md)

Conversation 管消息身份、显式关系和冻结上下文。执行、权限、预算、取消及输出仍归原 Project、Session、Worker、Interaction、Result 和 Publication。当前候选尚未发布。

## 首问与阅读

先创建[研究项目](research-project.zh-CN.md)，导入原始资料并取得准确 manifest hash。

```sh
node src/conversation-cli.mjs create --project PROJECT --conversation fees
node src/conversation-cli.mjs submit --project PROJECT --conversation fees --input first.json
node src/conversation-cli.mjs work --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs read --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs list --project PROJECT --conversation fees
```

first.json：
```json
{"messageId":"first","text":"比较原始费用，保存报告。","sourceManifestSha256":"准确的导入SHA256"}
```
真实调用须实际获得授权，并在输入 authorization 中把 providerApproved、dataApproved、costApproved 设为 true。work 只读原配置指定的凭据环境变量，不读取 .env。submit/list/read 不调用模型；fixture 不冒充真实验收。

## 三条关系不能混用

1. **普通追问**：提供 parent: {"messageId":"first","start":0,"end":120}。start/end 是已完成原输出的 JavaScript UTF-16 字符位置，按实际内容选择，不照抄示例。选中原文和 hash 被冻结。这是新问题，不自动继承旧执行权。
2. **登记澄清**：原 response/interaction 能力保存真实问题。用 questions --message first 查看；question --message first --question QUESTION_ID 读详情；respond --input reply.json 提交 messageId、questionId、操作者选择的稳定 responseId、text。收到回执不代表已经采用；再显式 work 原消息，由同 Run 采用，预算和截止时间不重置。底层回执的哈希 ID 不是新的用户回复 ID。
3. **显式 Continue**：使用 continuationOfMessageId，不与 parent/review 混用。根目标跨多次接续保留，父任务、来源和输出被绑定。新 Run 使用新 grant，真实调用重新明确批准。允许能力/工具子集及降低限额；其他配置与资料 manifest 须保持一致。旧文本只是待核查历史，不是当前证据或工具授权。

普通 parent 若具有真实报告 revision，可选 review: {"directory":"复核目录","runId":"复核Run"}；它必须是准确 revision/hash 的已完成 Review，仍只提供建议。

## 原 Run 恢复与新 Run 交接

resume --message first 只恢复原 active 安全检查点，当前配置必须一致。原 Session 保留 grant、截止时间、用量及租约。

显式 Continue 也可交接安全中断父任务。原 Session 在单个事务中核定义/检查点 hash、有效租约、在途和未知效果、Child 状态，冻结父并签发唯一目标新 Run 收据。待澄清不能借交接跳过；普通取消、失败、撤权和未知结果不会因此获得接续资格。

完整 prepared 意图先于冻结落盘。父已冻而子未准入时，重启仍按原输入和目标恢复，当前权限只能不变或更窄。两个父竞争同一新消息时，失败方不会误冻父。

对于配置了可信扩展包的任务，本模块无法证明其跨 Run 副作用只读或可去重，因此拒绝显式 Continue，防止重新执行已成功的外部写入。原同 Run 安全恢复仍在；明确的新问题是另一项用户意图。不伪造 private 的历史结果 lineage。

## 显式撤销执行授权

```sh
node src/conversation-cli.mjs revoke --project PROJECT --conversation fees --input revoke.json
```

输入包含 messageId、稳定 revocationId、原消息 expectedDigest、说明 reason。原 Session 的取消/fence 与控制收据同事务提交。尚未预留的后续调用被拒绝；已经预留或派发的调用不能宣称物理撤回，未知与计账保留。已发布正文不删除、不变空白。重复相同意图读回原事实。

修改项目配置不是撤权操作：它通常只影响未来准入。Conversation 的配置核对发生在执行入口，不是即时撤回网络请求。

## 持久化与边界

- 相同 ID 固定输入；原文、父关系、接续或来源选择变化会冲突，不自动重放 unknown。
- 已发布答案没有报告工件也保留阅读，并可作明确未核实的历史文本；不伪造 revision 或引用认证。
- 消息最多 12000 UTF-8 字节，含上下文问题最多 16000，澄清回复最多 8000；超限拒绝而非悄悄截断。交接前预留上下文容量。
- ID 最多 48 个 ASCII 字母、数字、下划线或连字符；列表最多 1024 个消息文件。
- 不包含 Schedule 项目、自主追问、后台循环、权限扩张或语义正确保证。
- 首次明确 revoke/handoff 才创建严格校验的 Session 控制事实表；只读不迁移，失败回滚。新版可读旧会话；旧二进制以 UNSUPPORTED_SESSION_SCHEMA 拒绝控制过的新会话，不应降级继续写入。
- 控制收据保存检查点摘要，不承诺完整历史检查点字节。
- 整个项目一起备份；其中可能含私人资料，不当作公开代码上传。

Open 使用自己的安全检查点和同 Run Interaction 合同，不宣称逐项复制 private 所有 Main 终态与历史结果结构。每个固定候选单独验收；旧十题不能覆盖新增 Owner 改动。

questions 命令支持可选的 `--limit 1..50`（默认 50）与 `--after CURSOR`。将返回的 `nextAfter` 原样传入读取下一页，直到 null；这些冷读不会调用模型，也不会采用回复。

已完成任务的 Continue 可携带最多两项有来源绑定的计算，历史投影总计不超过 2 KiB。原 Result owner 核验冻结结果基准和选定操作数，来源字节须匹配同一已准入文本清单；保留单位、币种、截止日和选择覆盖范围，不传递旧结果句柄、路径和工具调用 ID。未绑定算术、Web/PDF、笔记、Child/plugin 结果和中断交接暂不覆盖。缺失或损坏的可选结果标记不可用，新任务仍须取得自己的当前证据。这不等于完整跨 Run 历史结果对齐。

当前支持的 comparison-table 计算属于明确标注的合成数据；历史上下文保留该标记，不得表述为真实金融表现。
