**English** | [简体中文](knowledge.zh-CN.md)

# Knowledge: query an admitted collection and retain original evidence

This is the **v0.23 candidate**. Local/provider-free checks are not a real-model qualification or release. The [proposal](../openspec/changes/v023-knowledge/proposal.md) records the scope and acceptance gates.

Knowledge connects the existing explicit source import to bounded retrieval and the original research workflow. A query returns original whole pages. Host registers them in the existing Result store, the model receives their text and exact `sourceId`/`resultRef`, and the ordinary Report/Publication/Reader path retains the same bytes. Search scores are ranking hints, not authority or a semantic-quality judgment.

## Enable it for a new research task

Follow [the research-project guide](research-project.md) to initialize a project, explicitly import local files and submit a task. In the full reviewed project configuration, add `knowledge` to `capabilities`:

```json
{
  "capabilities": ["report", "knowledge"],
  "knowledge": {"maxResults": 4, "maxSourceBytes": 128000}
}
```

This is a fragment, not a complete gateway configuration. Existing projects use `project update` with the inspected expected configuration hash. The change applies only to **new** tasks. A custom `allowedTools` list must explicitly include `knowledge_query` if the model is to use it; `read_result` and `save_report` remain necessary for this workflow.

For example, explicitly import two synthetic service descriptions, then ask: “Use Knowledge to find the export formats and offline restrictions in both descriptions. Save a report citing the original pages, and say if this collection does not answer a question.” The model chooses query terms; the Runtime does not turn lexical overlap into a correctness score.

Inspect a task's original collection without executing it:

```sh
node src/research-cli.mjs knowledge inspect --project DIR --run RUN_ID
```

The output identifies the admitted source manifest, catalog/index hashes, document subset and limits. It is not an acquisition or model-adoption receipt. Ordinary `run work`, `run report` and `report serve` retain their existing meanings and live-provider approval requirements.

## Result and capacity contract

`knowledge_query` accepts only a nonblank query of at most 512 UTF-8 bytes and an optional positive `limit` no greater than the admitted `maxResults` (1–8). It accepts no document IDs, paths, URLs or new collection. The implementation uses Unicode word terms and overlapping Han bigrams, normalized with NFKC; there is no embedding provider, reranker or semantic-search guarantee. Ties use document ID and physical page number.

- `complete`: every lexical match in this admitted collection is returned.
- `partial`: result-count, raw-text or JSON-encoding capacity omitted later ranked pages. `coverage` identifies the actual bounds and number returned. Partial is not a retrieval failure or a claim of exhaustive business evidence.
- `no-evidence`: the valid collection has no lexical match. This does not prove that the answer is absent elsewhere.
- Invalid input, cancellation, missing or corrupt admitted bytes are errors, never empty successful searches.

Default text capacity is 128000 bytes, configurable from 64000 to 512000. Every returned page remains the full original page, at most 64000 bytes. The response additionally fits a 768000-byte JSON bound including Host-added ResultRefs and the second escaping used by Chat tool content. A page is omitted as a whole rather than clipped under its old hash.

Knowledge projects freeze a 1 MiB message-context capacity, versus 32000 bytes in ordinary non-Knowledge projects. Context also uses the Gateway's actual request encoder to account for tool definitions and escaped history before sealing a request. Only older evidence may become verified reread references; the latest complete group retains its original text. An oversized summary input skips compaction before any summary reservation. The actual model/provider token limit is separate. Prefer one query per tool group. Several large queries in the same group or sufficiently long retained history can still reach the shared Context limit and stop before another model request. No source is silently shortened to manufacture success.

## Snapshot, authority and recovery

Import owns original bytes and a content-addressed manifest. Knowledge's derived index is deterministically rebuilt from that exact verified catalog; there is no second index database or permission store. The Run freezes its collection/configuration and original grant. New imports, same-named replacement files and project configuration changes do not rebind an admitted task. Deleting the original input file does not destroy an already imported snapshot. Missing/corrupt stored snapshot objects still fail integrity checks.

This is **import-time snapshot evidence**, not a claim that an external personal file remains current. No directory watching, external collection service, live ACL reread, vector service or automatic reindexing is implemented. The historical `document-revocation@1` teaching profile retains its separate current-eligibility behavior and is not silently migrated.

On recovery, Host verifies both original Result bytes and the query's index, ranking and coverage against its admitted pure index. Safe checkpoint continuation uses the same Run and sources; terminal replay makes no new model call and does not save again. Query output does not authorize a new scope or erase unknown execution outcomes.

## Composition and checks

Provider-free tests exercise Main-side Knowledge with explicit Memory, calculation/CSV, actual Child execution and managed compaction. Child keeps its separately admitted read-only tools; enabling Knowledge on Main does not add it to Child. PDF remains its existing separate reader and is not implicitly indexed. Knowledge + Schedule is rejected at configuration because the current Schedule adapter has a narrower supported extension contract.

```sh
node --test test/knowledge.test.mjs test/knowledge-project.test.mjs
```

These tests include the real Chat encoder/parser with an injected local transport, process exit/recovery, actual loopback Reader bytes and capacity/refusal cases. They do **not** contact a model service or establish real-model qualification. Semantic answer review, provider execution, full-suite/build/install and release each retain separate evidence.
