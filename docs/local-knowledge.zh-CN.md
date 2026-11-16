# 本地资料检索：导入、查询、查看来源

[English](local-knowledge.md)

v0.31 提供一个小而完整的本地入口：导入你选定的文本，用 BM25 检索，查看命中的原文与来源。**不需要 API key、模型、数据库或本地 HTTP 服务。** 这是检索，不是自动撰写研究报告，也不是向量语义搜索。

## 从仓库根目录运行

使用项目支持的 Node.js 26.8.1–26.x 和已安装的锁定依赖。下面的示例不会发送网络请求：

```sh
mkdir -p research-example
printf '%s\n' '产品支持 CSV 导出，不支持离线编辑。' > research-example/notes.md
printf '%s\n' '["research-example/notes.md"]' > research-example/files.json
node src/research-cli.mjs knowledge import --project research-example/collection --files research-example/files.json > research-example/import.json
MANIFEST=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("research-example/import.json","utf8")).manifestSha256)')
printf '%s' '导出' > research-example/query.txt
node src/research-cli.mjs knowledge query --project research-example/collection --manifest "$MANIFEST" --query research-example/query.txt
```

无需先初始化研究项目或配置 gateway。`--project` 在这两个命令中只是保存导入快照的本地目录，不创建 Agent 任务。

结果是 JSON。`sources` 中的每项包含文件名 `name`、页号 `page`、原文 `text`、来源标识 `sourceId` 和内容校验值 `sha256`。它们对应实际导入的字节，不是生成的引用。`manifestSha256` 标识本次选定资料的固定快照。

## 改问题、无命中、重启

把 `query.txt` 改成其他关键词就能查询，不需要预生成问题向量。查询文件须为非空 UTF-8 文本，最多 512 字节。中文使用相邻双字分词，英文使用词项；这是词法匹配，不能保证理解同义表达。

```sh
printf '%s' 'zxqvnonexistent921' > research-example/query.txt
node src/research-cli.mjs knowledge query --project research-example/collection --manifest "$MANIFEST" --query research-example/query.txt
```

这个例子返回 `status: "no-evidence"` 和空 `sources`，意思是**当前资料中没有词法匹配**，不是证明问题没有答案。资料丢失或损坏会报错，不能当作无命中。

每次命令都是独立进程。关闭终端后，重新从 `import.json` 读取 `MANIFEST` 并运行查询即可；只需保留导入目录。修改或删除原始 `notes.md` 不会改变已经导入的快照。要搜索修改后的内容，应重新导入并使用新返回的 manifest。

默认最多返回 4 页，原文预算为 128000 字节，并有 JSON 编码上限；不截断单页原文。`partial` 表示命中没有全部返回，`coverage` 说明数量或容量限制。

## 范围与验收

先使用 `.txt`、`.md`、`.markdown`。底层导入器仍支持其原有 PDF 流程，但本入口只检索文本资料；纯 PDF 清单会明确报错，不伪装成已经检索。既有研究任务接口与原有任务合同保留。

本地检索不生成模型回答、研究报告或 Host 的 ResultRef。它不要求你学习这些功能。混合检索、动态 embedding 和完整 private A20 对齐不属于本次简化范围。[Runtime 资格与单独的模型质量边界](verification/v031-release.zh-CN.md)有明确记录；本地检索本身不调用模型。
