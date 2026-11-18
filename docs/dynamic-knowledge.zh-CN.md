# Run 内本地动态 Knowledge 查询——0.32 候选

[English](dynamic-knowledge.md)

Knowledge 复用已准入的页面向量，在原 Run 内编码新查询。本版主要增强 Knowledge；Session 与 Runtime 提供原有预算预留、执行权、截止时间和恢复机制。原 BM25 CLI 仍可无模型运行。

支持 Node >=26.8.1 <27；本次实测 26.11.1。安装锁定的 Node 依赖，按[模型下载记录](../engineering/a20-local-embedding/model-download-receipt.json)、[Python 哈希锁](../engineering/a20-local-embedding/requirements.lock)准备公开 MIT `intfloat/multilingual-e5-small`，固定 revision `614241f622f53c4eeff9890bdc4f31cfecc418b3`，并按[模型清单](../engineering/a20-local-embedding/model-manifest.json)验证文件。仓库不分发模型权重。

## 显式准入

新 Project 仅启用 `report`、`knowledge`，检索为 hybrid，并增加以下配置；哈希应来自自己的准入快照：

```json
{
  "knowledgeQuery": {
    "schemaVersion": "local-knowledge-query@1",
    "sourceManifestSha256": "<64 位来源清单 SHA-256>",
    "modelManifestSha256": "<64 位模型清单 SHA-256>",
    "pageEvidenceSha256": "<冻结证据的 pageVectorIdentity>",
    "maxTokens": 512,
    "maxQueries": 2
  }
}
```

先用 `scripts/prepared-knowledge.mjs prepare` 准备页面向量，种子查询应与实际业务查询不同；`export` 导出给 `run submit --knowledge-vectors` 使用的证据文件。`src/knowledge-query-tool.mjs` 的 `pageVectorIdentity` 绑定提供方、维度与页面身份，不绑定有限的预备查询缓存。[实际十题配置](../engineering/v032-dynamic-20261118/final/config.json)及[冻结计划](../engineering/v032-dynamic-20261118/final/PLAN.safe.json)记录本次精确输入。

运行时提供本地私有映射，只允许绝对路径：

```json
{
  "schemaVersion": "local-embedding-runtime@1",
  "python": "/absolute/venv/bin/python",
  "modelDirectory": "/absolute/model",
  "manifestFile": "/absolute/model-manifest.json"
}
```

```sh
node src/research-cli.mjs run work --project YOUR_PROJECT --run YOUR_RUN --embedding-runtime YOUR_MAPPING.json
node src/research-cli.mjs knowledge inspect --project YOUR_PROJECT --run YOUR_RUN
node src/research-cli.mjs run report --project YOUR_PROJECT --run YOUR_RUN
```

真实对话仍需原有提供方、数据、费用授权及凭据环境。本地编码没有计费传输或 HTTP embedding 服务。调用方注入 backend 只允许 fixture Project；该动态配置拒绝 Child、插件、PDF、额外能力与适配器。这是有界本地集成。

## 预算与恢复

Session schema 7 在原 Session 数据库内保存计数与精确回执。原工具派发事务同时预留工具次数、一次查询和两次本地协议操作（`tokenize`、`encodeQuery`）；额度不足会全部回滚。向量回执在来源进入 Host 前提交，旧执行权或变化的输入、模型及资料身份不能写入。

恢复只用完整回执重新计算检索，不启动模型。缺失、部分完成和不确定操作保留 unknown 及额度，不换 ID 重新编码。原持久截止时间与取消机制继续生效。终态输出无须提供 embedding runtime 即可读回。本地操作次数与 Go 对话请求及真实消耗分开记录。

## 候选不等于可以回答

`only` 不扩大范围；`prefer` 只在准入集合内扩展。原文整页返回，保留数量与编码字节限制。向量渠道可用或返回候选均不证明证据充分。`coverage.completeWithinCollection=false` 时不能断言整个集合缺失某信息；`only` 子集完整也不代表其他文档已查看。新动态任务冻结 `source-faithful-local-query@1` 指引，旧提示版本保持原字节。提示帮助模型推理，Host 不认证正文语义。

[验收、逐次消耗、失败与复现](verification/v032-release-readiness.zh-CN.md)。
