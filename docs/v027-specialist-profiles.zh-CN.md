# v0.27：项目专家配置

[English](v027-specialist-profiles.md) · [项目命令](research-project.zh-CN.md) · [配置生命周期（英文）](specialist-profiles.md)

本版本只有一个主要模块：由操作者管理的项目内专家配置与有序预设目录。配置选择原有的受限 Child 方法，不新增 Runtime、权限 Owner、提供方路由器或预算。

## 配置、冻结、执行、读回

1. 在 Project 配置中启用原有 `child` 能力。
2. 用 `node src/research-cli.mjs specialist init --project DIR` 初始化目录。
3. 用 `specialist create --project DIR --id PROFILE_ID --profile PROFILE.json` 创建显式配置，文件包含 `name`、`description`、`enabled` 和已准入的 `method` 描述。
4. 提交任务时传入 `run submit --specialists SELECTION.json`。例如 `{"profiles":[{"profileId":"PROFILE_ID","revision":1}],"maxChildren":1}` 选择固定修订，而非可变的“最新配置”。
5. 沿用 `run work`、`run inspect`、`run report`。任务准入时冻结所选方法；后续目录修改不改写已提交任务或恢复中的 Child。

完整的 Project、问题文件、来源清单及授权参数见 `node src/research-cli.mjs --help`。创建配置本身不调用模型，也不授予来源访问权限。

## 在原 Owner 上的必要支持适配

- 显式 `child-method@2` / `independent-evidence` 从 Child 任务文本中排除 Main 的局部解释，保留原父任务审计调用；方法、来源授权、Root 预算和 Child 身份继续受原机制约束。
- Host 工作视图可引用大型派生结果及已核验的保存报告，同时保留原始历史和工件字节。`read_result` 沿用原有分页读回，不把派生文本变成原始证据。
- 新任务可选择 `--report-delivery artifact-required@1`。只有 Publication 回答时仍保存回答，但没有报告工件就不能完成该合同。不伪造报告、不自动重试；计划任务与受保护配置不支持这一显式合同。
- 默认 Gateway 为官方 Go 端点提供原生会话元数据，Main 与 Child 沿用同一 Root 会话，其他提供方请求行为保持不变。参见[协议说明（英文）](go-gateway-session.md)。
- 新任务冻结版本化报告指导，历史 v1/v2 输入字节不变。指导仅辅助推理，不是语义验证器。

## 边界

Project、Session、Host、Child、Artifact、Reader 继续拥有原执行、权限和恢复职责。不新增并行专家调度、自动编写配置、浏览器界面、任意工具、自主重试或提供方访问权限。Runtime 完成与报告读回不保证答案质量。

包版本与公开代码谱系用于标识源码。Runtime 资格、独立安全审阅、唯一发布者核验及远端读回分别记录；本功能说明不替代这些记录。
