# v0.23 candidate: admitted Knowledge retrieval

Baseline: published v0.22.0, main `051bba49ff7c3adbfbe76bc07eba675bd7e7b465`. Status: implementation candidate, not qualified or released. The superseded numeric roadmap is not used: Knowledge follows Child; Provider Admission is the next separate package.

## Original responsibility and deliberate simplifications

An explicitly selected collection and query become bounded, source-identified original evidence for the existing research consumer. The module owns deterministic indexing, query ranking, limits and collection binding. Source import owns immutable bytes, Runtime/Session own the admitted Run and budgets, Host/Result own acquired evidence, and Report/Publication own output. No new permission, success or billing owner is introduced.

The public adapter uses the existing local imported text catalog, immutable whole pages and a deterministic lexical index. It deliberately excludes vector search, external embeddings, reranking, watched roots, multi-tenant collections and adjacent-chunk context. This is not production retrieval-quality equivalence. PDF keeps its existing separately admitted reader; it is not silently indexed as text.

## Authorization and compatibility

Normal research tasks freeze their selected catalog and allowed documents when admitted. Updating project configuration or importing a new manifest affects later tasks, never rewrites an existing grant or resumed task. Source integrity remains checked: a missing or corrupt admitted snapshot is an error, not an empty search. The original input path is not revisited after explicit import.

The v0.16 `document-revocation@1` teaching profile has intentionally different current-eligibility checks. It remains unchanged and opt-in. This work neither claims that profile is equivalent to ordinary Run-lifetime authorization nor introduces a second ACL authority.

## Complete workflow and failure boundaries

Explicit import → verified catalog → bounded index → `knowledge_query` → original Source/ResultRef registration → actual model consumption → original saved report and readback. Query output separates no evidence from bounded partial coverage. Scores and ranking metadata are not independent sources or broader permission. Full selected page bytes are returned without clipping; limits never fabricate a source hash for shortened text. Tool arguments cannot name new paths, URLs or documents outside the admitted collection.

The deterministic index is rebuildable from original immutable inputs; no separate mutable index database needs recovery. Query cancellation and invalid arguments stop the operation. Recovery verifies both original acquired source bytes and query metadata against the same admitted index. Terminal readback must not dispatch another model request or repeat a save.

The ordinary Knowledge application admits a 1 MiB serialized-message context instead of the older 32000-byte context. One query response additionally reserves its Host-added ResultRefs within a 768000-byte JSON bound, including the second escaping when Chat serializes a tool result into its content string. UTF-8 body, result-count and encoding limits all retain complete original pages and report partial coverage. The existing Gateway exposes its exact encoder's pure byte measurement. Context uses that additional budget to project older originals to verified references before Runtime seals the next request, while preserving the latest complete group. This is needed even when raw history still fits, because encoded history may not. Summary input that cannot fit falls back before reserving or calling a model. Model/provider token limits remain separate. Several large queries in one tool group or sufficiently long retained history can still exhaust the shared context; prefer one query per group. This is a bounded-capacity refusal, not source truncation or semantic success.

Knowledge runs on Main and composes with the existing independent Child's returned sources; it is not implicitly delegated into Child. The existing Schedule adapter admits a narrower set of extension owners, so Knowledge + Schedule is explicitly refused at project configuration until that module's composition contract is separately extended. PDF remains a separate reader.

## Changed refusal ownership

- Knowledge validates its own query/scope and returns bounded partial coverage; it does not adjudicate answer sufficiency or alter an admitted grant.
- Source import/catalog validation retains authority over byte integrity. Missing/corrupt bytes cannot become `no-evidence`.
- Project assembly rejects unsupported composition before admitting a task. It does not reinterpret an existing Run.
- Gateway owns actual wire encoding and its byte ceiling; Context owns projection and may replace only older verified source payloads. The additional measurement is trusted host code, never model-supplied authority. An unrepresentable mandatory group is refused before a new request reservation.
- Managed compaction may skip an oversized summary input while preserving its existing baseline. No summary reservation, provider outcome or note effect is fabricated. A final answer remains the original Runtime/Publication responsibility.

## Acceptance

- Provider-free tests: query-dependent originals, frozen document subset, bilingual lexical behavior, stable ties, limits/no evidence, cancellation, corrupt input, tampered query/source output, same-name new versions and original-file changes/deletion.
- Actual Host and research workflow: model-facing query results, report/ResultRef identity, cross-process recovery, terminal zero-dispatch replay, and important supported combinations with Memory, compaction, CSV and Child on the Main side.
- Keep old revocation, PDF, Child and source-import regressions. Run the full final suite, build, independent locked installation and output/readback checks.
- Freeze ten real tasks for this version only after specific valid provider/data/cost authorization and shared accounting are established. At least nine successes and no known unresolved applicable Runtime defect; anomalies are separate. Retain all failed/unknown/not-run outcomes, history and costs.
- Audit all newly reachable publication objects, obtain any required lockfile push confirmation, non-force publish, read back remote bytes and verify exact-head CI before declaring delivery.
