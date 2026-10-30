# v0.4 design preparation — no implementation or execution claim

Prepared while v0.3's final post-review regression awaits the shared execution window. This is the next increment only, not ten pre-created versions. Authority: public PR #1 fixed revision c390eb2dd951b53b1dab2d64a9cd72d216fde8dc, foundations roadmap and architecture contracts. v0.3 stays an offline candidate with live/semantic/publication gates open.

## Concrete need

Currently Host owns an in-memory source map and saved reports embed acquired snapshots. That is adequate for a small loop, but a larger source can leave the model window without losing its exact version. v0.4 introduces a single Research Result owner for actual source bytes and a separate Context projection for the next model request. It must remove the old parallel source map, not add a second canonical store.

## Minimal proposed structure

- ResultStore under each Run's safe local directory: immutable snapshot files identified by document/version/page/content hash; an index maps acquired source IDs to exact ResultRefs. Atomic no-overwrite publication and readback hash checks reuse the existing file-safety principles. Ref construction is Host-owned, never model-invented.
- Original builtin/MCP/batch/child sources all enter this same owner. Existing manifests may still embed selected snapshots for standalone reading, but only by reading the exact stored references; they are delivery copies, not a second mutable registry.
- A reread tool accepts only an actually acquired ResultRef. It returns the original stored bytes, not a new fetch of the latest document. Unknown/corrupted refs fail explicitly. Child-derived summaries cannot become original source records.
- Context projection consumes complete settled message groups, preserves the original user question and current restrictions, and replaces large old source payloads with readback references. Do not split assistant proposals from their tool-result group or truncate JSON/schema. Byte/character accounting is a local bound, not a provider token-window claim. No model summaries at this stage.
- Lexical retrieval is a real candidate-selection step over the allowed synthetic document set. Query terms produce ranked document/page candidates, then ordinary read_page reads selected candidates. Search hits are not acquired source text. Change query/material wording and assert both candidate ranking and actual subsequent reads change.
- Main report numbered citations resolve through actual acquired refs. Existing calculation results retain numeric input/unit and denominator identity; query hits or unknown refs cannot be laundered into citations.

## Proposed pre-implementation behavioral tests

1. Store add/read returns exact immutable original snapshot and stable ref; conflict, invalid hash, traversal and unknown ref reject.
2. After a new source version exists, rereading an old ref still returns old bytes. Corrupt an acquired snapshot and observe a failure rather than silently fetch a replacement.
3. Context preserves original user message and complete call groups under pressure; no dangling half-call or truncated JSON; projected source payload shrinks while readback retains bytes. If minimum necessary context exceeds the local budget, reject rather than silently erase requirements.
4. Different lexical queries drive different candidates and read calls; zero hits and one-sided comparison retain an explicit gap. A predetermined four-question fixture remains separately named and is not called retrieval.
5. Unknown numbered citation/ref rejects before save; stored report refs and original bytes remain verifiable after process exit.
6. Default four questions, skill-mcp, batch-read and fixture-child remain runnable when retrieval/projection is absent. Removal of the old Host source map is checked by code review and integration tests, not module count.

## Open design questions to settle before code

- Keep the index in memory with immutable local records for v0.4; this is reread, not cross-process Run recovery. Is an index manifest needed solely for post-exit readback? If so name it a content index, not checkpoint.
- Budget whole context groups before Gateway encoding. Reserve a minimum bounded tool-definition and current-question footprint; reject impossible limits. Avoid claiming exact Provider input tokens.
- Number citations deterministically at save based on selected acquired refs. Keep old v0.1–v0.3 reports independently readable without retaining old execution engines in the new branch.
- A context ref must contain enough source identity and a usable ordinary reread tool, not only a hash the model cannot resolve.

No new dependency, live model, vector platform, network retrieval, database, compaction summary or Memory is planned for this stage. Actual source/data/provider authorizations remain independent of this design document.

## Static design review refinements (not execution evidence)

An independent read-only review identified these contracts to fix before implementation:

1. A sourceId/ResultRef mapping cannot be rebound. Compare intrinsic identity metadata (document/version/page/name/media type and content hash), not merely equal text hashes; changed versions require distinct refs. Per-call MCP/model request identities are acquisition receipts, not replacement document identity. Preserve the exact original acquisition snapshot selected for delivery.
2. Child already has a separate Run directory. Main imports only explicitly validated snapshots/refs through its trusted boundary, inheriting document restrictions; model-provided refs never become arbitrary paths. Derived child summaries cannot enter the original-source store through that import route.
3. Project a complete assistant-call group plus all paired tool results, preserving IDs/order/status and authority errors. Only successful settled source payloads actually stored may become refs. Pending/failed calls cannot be rewritten into apparent reread success. Check the final Gateway-encoded body, including tool schemas and wrappers, under an explicit local byte cap; message-string length alone is insufficient and still is not a Provider token guarantee.
4. Post-exit reread requires a durable minimal content index or a delivery manifest with complete ref-to-safe-record-path mapping. This is content readback, not a Run checkpoint or execution cursor. Choose one owner for that mapping and verify it, rather than add recovery machinery.

Lexical retrieval additionally needs scoped-subset and injection-shaped candidate negatives: search cannot enlarge the document grant. Equal-ranked inputs use a stable deterministic tie-break; no reranker or manager is justified here.

Additional interface questions for the next change's spec, not implemented decisions:
- Keep existing sourceIds-based save calls readable while deriving numbered citations from the single acquired-result owner. Define how unsupported body citation markers are rejected; do not merely append a valid footer beneath an invented reference.
- Numeric-result citations must retain the actual calculate_change inputs, units, denominator convention and code identity. A calculation record is a typed derived result, not an original document page; it must not enter the source store by pretending to have a page locator.
- Skill method snapshots need not be automatically promoted into research sources. If a projection cannot retain required non-source material within its bounded complete-group policy, fail explicitly rather than invent an unimplemented generic compaction mechanism.
