# Local knowledge: import, search, inspect sources

[简体中文](local-knowledge.zh-CN.md)

The v0.31 candidate offers a small local workflow: import explicitly selected text, search it with BM25, and inspect the original source bytes. **No API key, model, database or local HTTP server is required.** This is retrieval, not an automatically authored research report or semantic vector search.

## Run from the repository root

Use the supported Node.js 26.8.1–26.x runtime and installed locked dependencies. These commands make no network requests:

```sh
mkdir -p research-example
printf '%s\n' 'The product exports CSV. Offline editing is not supported.' > research-example/notes.md
printf '%s\n' '["research-example/notes.md"]' > research-example/files.json
node src/research-cli.mjs knowledge import --project research-example/collection --files research-example/files.json > research-example/import.json
MANIFEST=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("research-example/import.json","utf8")).manifestSha256)')
printf '%s' 'exports' > research-example/query.txt
node src/research-cli.mjs knowledge query --project research-example/collection --manifest "$MANIFEST" --query research-example/query.txt
```

No research project or gateway setup is needed. For these commands, `--project` names the local snapshot directory; no Agent task is created.

The JSON `sources` contain the original `text`, filename `name`, physical `page`, `sourceId` and content `sha256`. These identify imported bytes, not generated citations. `manifestSha256` identifies the selected immutable collection.

## New queries, no matches and restart

Change `query.txt` to any keywords. No query vectors are precomputed. Supply a nonblank UTF-8 file of at most 512 bytes. English word terms and overlapping Han bigrams support lexical search; synonymous wording is not guaranteed to match.

```sh
printf '%s' 'zxqvnonexistent921' > research-example/query.txt
node src/research-cli.mjs knowledge query --project research-example/collection --manifest "$MANIFEST" --query research-example/query.txt
```

This example returns `status: "no-evidence"` and empty `sources`: no lexical match in this snapshot, not proof that the answer does not exist. Missing or corrupt stored bytes produce an error, never a successful empty search.

Each command runs in a fresh process. After closing the terminal, reload `MANIFEST` from `import.json` and query again. Retain the collection directory. Changing or deleting the original input does not rewrite the imported snapshot; import again and use the new manifest to search updated contents.

Defaults are at most 4 whole pages and 128000 source bytes, with an additional encoded-response bound. Pages are not silently clipped. `partial` and `coverage` disclose count or byte limits.

## Scope and qualification

Start with `.txt`, `.md` and `.markdown`. The underlying importer retains its existing PDF behavior, but this search indexes text only. PDF-only selections fail explicitly. Existing research-task interfaces remain unchanged.

Local search does not generate model answers, reports or Host ResultRefs. Hybrid retrieval, dynamic embeddings and full private A20 parity are outside this simplified release scope. This is candidate documentation, not a release receipt. Focused tests and a working reader example do not replace independent review, the real-task gate or verified remote publication.
