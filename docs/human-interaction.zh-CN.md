# 本地研究项目中的普通问答

固定版本已通过离线与真实任务资格核验，最终包CI与标签另行核验。[资格与边界](verification/v021-release.zh-CN.md)。

任务可以询问缺失信息、让出 Worker、接收明确关联的回答，再继续同一个 Run。回答是未经信任的任务内容，不是购买确认、新资料授权或 Memory 写入授权。

## 为未来任务显式启用

在经过审阅的项目配置中保留 `report`，加入 `response` 能力，并增加：

```json
"interaction": {"schemaVersion":"human-interaction@1","maxQuestions":3}
```

问题上限支持 1–8。仅当明确提供 interaction 对象而省略 maxQuestions 时，project init/update 才补为 3。没有此对象的旧项目继续单问题合同。项目配置的 compare-and-swap 更新只影响未来任务，不改已有任务的配置。新 Session schema6 采用明确版本；旧读取器应拒绝，不悄悄迁移数据库。

真实提交仍需 provider、选定数据和费用批准。导入、提交与执行见[本地研究项目](research-project.zh-CN.md)。等待不延长原任务期限，也不重置预算。

## 查找、回答、继续

```sh
node dist/src/research-cli.mjs interaction list --project PROJECT
node dist/src/research-cli.mjs interaction list --project PROJECT --run TASK
node dist/src/research-cli.mjs interaction inspect --project PROJECT --run TASK --question-id QUESTION
node dist/src/research-cli.mjs run respond --project PROJECT --run TASK --question-id QUESTION --response-id RESPONSE --text ANSWER_FILE
node dist/src/research-cli.mjs run work --project PROJECT --run TASK
node dist/src/research-cli.mjs run report --project PROJECT --run TASK
```

使用 list/inspect 返回的原标识，不从模型正文推测。为一次回答选定 response ID，只在完全相同的重试中复用；同一身份配不同正文会被拒绝。inspect 包含原问题和收到的回答，涉及私人内容时应保密。

- `awaiting-response`：尚未收到回答。
- `received-not-adopted`：已保存回执，原 Run 尚未采用。
- `adopted`：原工具结果 checkpoint 已提交，不代表模型遵从了回答，更不代表外部效果已发生。
- `expired` / `unavailable`：保留原事实，不重开 Run。回答已经采用后即使任务取消，仍保留采用事实，但不能据此声称报告成功。

列表每页最多 50 项；返回 nextAfter 时，通过 `--after` 原样传入下一页。整个项目最多扫描 256 份任务记录，超过时可用 `--run` 精确读取指定任务。列表和详情绝不调用模型。只有前一答案已采用，且原问题额度、模型/工具预算允许，才能再次提问。

## 恢复与边界

保留完整项目目录。已知停止后对同一任务再次 work；不要重新提交一个替代任务绕过未知派发。任务过期或取消后，相同回答重试仍可取回原回执，但新回答不能复活任务。接收与采用通过原 Session 事务分别持久化，进程退出不把两者混成成功。

当前仅支持本地单用户普通阻塞问答。Child 定向问题、Response 与 Schedule、外部效果审批、追加权限、非阻塞聊天介入和终态任务续跑均未启用。本地文件系统及操作者是身份信任边界，不是远程多用户收件箱或认证服务。

若任务记录已保存、但原 Session Run 尚未创建，列表会在有界 warnings 中返回 `INTERACTION_RUN_NOT_MATERIALIZED`，不遮住其他待回答问题，也不自动重建或执行该任务。Schema、身份和完整性错误仍中止读取，不会被当作未物化任务忽略。
