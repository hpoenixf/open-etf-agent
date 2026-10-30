# 持久普通回复：范围与设计动因

状态：v0.13 合同已冻结、实现及独立审阅已完成；本地资格见 [evidence.md](evidence.md)。远端发布状态单独记录。

## 来源与真实缺口
固定公开源码 `46c2822be9865b99696bb70fb9e0ff1b5257ff35`。依据 `docs/plan/v1-to-v2.md` 的旧 1.4 ordinary responses 候选，沿原 Human Interaction 的 receipt / adoption / effect 分离动因提炼；不复制私仓实现或全文。

现有 Session 已有根预算、Run lease/fence、绝对 deadline、checkpoint、恢复及 Publication；`src/session-cli.mjs` 没有问题/普通回复入口，Runtime 没有原消费者采用回复的事实。Memory search/read/current revision 投影已存在，不借旧 1.3 标题重做。此增量只补一个有独立价值的交互合同。

评审范围限定为单一 v0.13 实现、隔离合成 SQLite 与独立进程验证。本地验证通过不等于远端已发布。

## 最小成功闭环
一个显式启用 ordinary-response 的合成 Run → 原 Runtime 请求一个普通问题 → 持久登记后让出原执行 lease → CLI 收到一个有身份的回复 → 同一 Run resume → 原消费者采用原回复 → 下一实际 Gateway 输入包含该原回执 → 原输出在独立进程读回。

采用普通回复只提供回答数据，不赋予工具、Memory、来源读取、执行权限，不增加 root/run 预算、轮数、deadline 或新 Run。没有回复时不自动补答案。

## 明确不做
长等待 Human Park、通用 Approval/Permission、Correction、Continue、新认证/账号系统、UI/SSE、Scheduler、队列/第二执行器、自动唤醒、多问题工作流、Child交互、付费或真实模型测试。原模型质量仍 unreviewed。只实现本地单用户信任边界；能写 Session 的本地操作者并非新的互联网认证设计。

## 交付与停止条件
实施须遵循本目录冻结合同。成功链及 scenarios 中关键反例全部以原 Runtime/独立进程验证，受影响回归、完整provider-free回归和独立安装/build各自记录；不得借历史384用例作为本次通过。文章独立，不阻塞代码。新支持范围只针对新版本新建的显式profile；不升级旧活跃Run，不偷换存储。没有可证明的原子采用/身份恢复时停止并收窄，不添平台。
