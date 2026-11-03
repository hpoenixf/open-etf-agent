# v0.21 普通人机交互：资格与边界

固定公开源码已可达并完成字节读回；最终包原CI与tag/Release仍须单独核验。

## 已验证

同一固定实现 dfa372d596e6c1bd8440d7b5ae3000ea05a9255d 上，796/796 原离线测试和构建通过。54 项定向包含在796中，不相加。十个自然任务全部完成，所需交互机制10/10；12个问题的原receipt/adoption、10份报告及独立冷读/HTTP字节均通过。46次真实请求全部Go、零额外费用，无重试、替题或新增unknown。

原累计实际1671，保守1727/3000；历史unknown最低16仍保留。本批不是把旧版本结果换标签。模型语义与Runtime分别观察：I04未成功召回既有英文格式偏好，不能说成功召回已验证；I03提问推断了版本适用日期区间，最终使用明确确认的Version2并说明边界不确定。

## 边界

I07是已知Host停止后同Run恢复，不证明未知请求可重放；I09仅一个等待问题加另一个零模型提交任务，不证明两个同时等待任务。答复为预先声明的合成任务资料，不授予新权限。仍不支持Child提问、Response+Schedule、外部效果审批、权限扩张、非阻塞插话、终态任务续写或远程多人认证。

[使用原CLI/API](../human-interaction.zh-CN.md) · [原十题收据与报告](v021-real-ten.safe.json) · [固定执行输入](v021-execution-inputs.safe.json) · [English](v021-release.md)

## 固定公开源码

[427315b5554b1c9af8fa50b8ab622747045e691a](https://github.com/hpoenixf/open-etf-agent/tree/427315b5554b1c9af8fa50b8ab622747045e691a)，tree `8e0649c2fa6c7d1610cd680fe4b4362988a48cff`。85项执行输入与原dfa372d字节一致；package/lock仅根版本号升为0.21.0，依赖与integrity未变。`versions.json`绑定此公开源码，最终metadata提交/标签不是重新运行身份。公开收据是发布前生成的不可变测评记录，其published状态不代表后续发布状态。
