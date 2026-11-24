[English](v0461-compact-workbench.md) | **简体中文**

# v0.46.1：紧凑研究工作台

本补丁只改网页工作台。输入框固定在底部，长报告独立滚动。会话和来源可分别折叠，点击引用直接打开原文；每日追踪默认收成胶囊。输入栏右侧在发送、重试和停止之间切换，ⓘ 收纳原有权限与数据说明。

停止只对当前会话中已确认正在运行的唯一任务生效，沿用原终止接口。停止请求已受理不等于任务已经停止。本版没有改 Runtime、HTTP 处理、模型配置与请求、预算、证据与交付流程或持久化格式。

## 验证与边界

- [固定界面源码](https://github.com/hpoenixf/open-etf-agent/commit/1bbabf0dca0da23ee3cafcdb565340dd379b7acd)、[PR #27](https://github.com/hpoenixf/open-etf-agent/pull/27)、[精确提交 Verify CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/45130290665)。Node 26.11.1 上定向测试 42 通过、1 项浏览器 PDF 跳过、0 失败。停止验收覆盖合成任务的运行中、拒绝、结算与切换会话，并未取消真实付费任务。
- 隔离预发使用同一固定界面版本，在 Chromium 的 1363 × 936 和 454 × 312 视口检查工具栏、选项展开或关闭时底部输入不移位、没有横向溢出，以及历史消息下方不再出现取消按钮。未因此新增模型调用。未覆盖手机真机、浏览器 PDF 或托管正式环境。
- [v0.46.0 原十题记录](v046-deep-evidence-milestones.md) 维持原实现、输入和执行身份，原定义范围内的 Runtime 交付为 10/10。[源码比较](https://github.com/hpoenixf/open-etf-agent/compare/9b7cbfc358fd2688fc69a2af5b0c263016fc1eb9...1bbabf0dca0da23ee3cafcdb565340dd379b7acd) 只涉及文档、版本元数据、三个浏览器文件及其测试。服务端请求生成、接纳、执行与读回路径未变，改动的浏览器路径另行验证。这是沿用原 Runtime 证据，不是全源码逐字节相同，也不是本版新跑十次或重新评估答案。

[验证索引](README.zh-CN.md) · [工作台配置](../local-gui-live.md)
