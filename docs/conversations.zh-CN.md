# 显式研究对话（v0.29 候选）

[English](conversations.md)

把上一份报告选为下一次研究的起点，而不是把旧报告覆盖掉。Conversation 只拥有消息身份、父消息关系与冻结上下文；执行、预算、取消、报告和正文交付仍由原 Project、Worker、Session、Artifact、Publication 负责。

## 用法

先按[研究项目](research-project.zh-CN.md)建立项目、导入资料，取得准确 manifest SHA256：

```sh
node src/conversation-cli.mjs create --project PROJECT --conversation fees
node src/conversation-cli.mjs submit --project PROJECT --conversation fees --input first.json
node src/conversation-cli.mjs list --project PROJECT --conversation fees
node src/conversation-cli.mjs work --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs read --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs cancel --project PROJECT --conversation fees --message first
```

`first.json`：

```json
{"messageId":"first","text":"比较费用，保存带原始来源的报告。","sourceManifestSha256":"替换成准确的导入SHA256"}
```

create、submit、list 不调用模型。真实项目须在输入中显式提供 `authorization`，将 `providerApproved`、`dataApproved`、`costApproved` 设为 true，前提是确实批准该提供方、数据与费用。work 才读取原配置指定的凭据环境变量，不读取或保存 `.env`。fixture 项目不能在此 CLI 假装真实执行。

## 基于上一份报告追问

新消息显式选择父消息与原报告片段，例如：

```json
{"messageId":"followup","text":"重新核查费用差异，说明不确定性。","sourceManifestSha256":"替换成准确的导入SHA256","parent":{"messageId":"first","start":0,"end":120}}
```

start/end 是原文的 JavaScript UTF-16 字符位置，请按真实报告选择，不能照抄示例数字。保存时冻结片段、原报告 hash、revision。可另传 `review: {"directory":"复核会话目录","runId":"review-ID"}`，它必须是同一报告版本的已完成 v0.28 Review。

旧报告与 Review 都是待核查的上下文，不是事实认证、用户指令或新权限。新任务仍须检索显式选择的原始资料。支持从同一父消息分叉，不自动选择“最新”、不自动累积所有历史。

## 中断与边界

- 相同消息 ID 和相同输入只打开同一任务；同 ID 改内容会被拒绝。
- intent 已保存但任务尚未准入时，列表显示 admission-pending。再次提交只补同一准入，不调用模型。配置已变化则拒绝把旧请求套到新配置上。
- 已准入任务保持原配置；取消、unknown 和终态不重放沿用原执行底座。
- read 保留已经发布的正文。引用降级或没有报告工件，不会使正文消失；没有报告工件的已发布答案可作为明确未核实的历史文本，不伪造报告 revision。
- 消息最多12000 UTF-8字节，含上下文的完整问题最多16000字节，超限明确拒绝而不截断。可自行缩小明确选择的片段。ID最多48个ASCII字母、数字、下划线或连字符，列表最多1024项。
- 新消息不支持 Schedule 项目；不提供自动跟进、后台循环、跨项目历史、自动重试或语义正确保证。
- 整个项目一起备份，包含 conversations；其中可能有私人资料，不要当作公开代码上传。

当前是实现候选，确定性测试、完整回归、独立审查与真实模型验收分别记录。没有借用 v0.28 的真实验收结论，也尚未发布新版本。

## 扩展候选：澄清与显式接续（尚未重新完整验收）

配置启用原有 response/interaction 后，模型可以保存真实的待回答问题。用准确消息查询，不根据最近消息猜测：
```sh
node src/conversation-cli.mjs questions --project PROJECT --conversation fees --message first
node src/conversation-cli.mjs question --project PROJECT --conversation fees --message first --question QUESTION_ID
node src/conversation-cli.mjs respond --project PROJECT --conversation fees --input reply.json
```
reply.json 包含 messageId、questionId、操作者选定的稳定 responseId 和 text。重试保留这四项；底层回执里的哈希 responseId 是内部执行身份，不是新的用户回复 ID。收到回执不表示已采用，随后显式 work 原消息，由原 Run 采用，不重置预算和截止时间。与 private 的新 Run 交互接续不同，这里保留 Open 原 HIO 同 Run 生命周期。

显式接续输入可使用 continuationOfMessageId，而不是 parent 报告片段。当前仅允许已完成、无未知效果的父任务；新任务冻结原目标和来源身份，manifest 改变或权限扩大则拒绝；允许能力/工具子集与限额降低，真实调用需重新明确批准。它创建新 Run 和 grant，不复活旧 Run。private 针对执行 owner 丢失或断连的受限接续尚未在此候选对齐，不能把任意失败或取消当作 Continue 资格。

这些扩展不在原始十题真实验收范围内，完整对齐和重新验收前不发布。


更新：显式 Continue 保留整条接续链的根目标；同 Run 安全检查点恢复使用 resume 命令，不新建执行。新 Continue 可以收窄能力/工具和降低预算，但其他配置与资料 manifest 必须保持一致。已有正文无报告工件时仍可作为“未经核实的历史回答”继续核查，不伪造引用或 revision。配置核验发生在执行入口，不是即时在途撤权；变更权限前须取消原任务并确认结算，已派发请求不能撤回。
