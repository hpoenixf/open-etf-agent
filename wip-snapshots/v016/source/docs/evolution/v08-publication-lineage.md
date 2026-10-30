# Publication: a bounded adaptation of the existing owner

Status: **locally runtime-qualified; public commit/case binding pending**. This is not a formal release or a verified published article mapping.

This module is being adapted from ETF Agent's existing Publication responsibilities and failure contracts. It is not a verbatim release of private source, a complete port of the original owner, or a second architecture written to match an article. Detailed private source review remains outside this public repository; this document contains only the reviewed responsibility summary.

The existing [Publication article](https://hpoenixf.com/eff-agent-article/articles/019-agent-answer-publication) explains the motivating distinctions. The former governance-retrospective article was merged into it; no new synonymous article is required. An existing English counterpart has not been established, so bilingual publication is not claimed.

| Original contract retained | Public adaptation | Deliberately excluded |
| --- | --- | --- |
| Prepared content is not a committed receipt. | Plain Markdown preparation, then the existing Session transaction returns the receipt. | Preview UI, asynchronous saving queue, private content/review policies. |
| Stable block identity, revision and delivery position are separate. | One Host block per root Run; explicit CAS replacement changes revision but keeps its ordinal. | Multiple blocks and dependency revalidation graphs. |
| Exact unchanged content AND protected bindings reuse the original receipt. | Exact text and persisted Host/Run binding hash; no semantic similarity or whitespace normalization. | Model-authored authority labels and source-status qualification machinery. |
| Body versions and the current delivery slot change atomically. | Node's existing built-in SQLite owner, not a new store framework. | PostgreSQL deployment, ORM, event bus, network stream. |
| A later failure cannot erase earlier committed body. | Publication commits independently before ordinary Run finalization; cancellation fences only new effects. | Background Worker and whole-conversation History. |
| Recovery confirms original stored identity rather than generating a new answer. | Selected-Run/revision read, exact receipt confirmation, actual process-kill/restart evidence. | Cross-version active-Run migration, account authentication, private source authorization. |

The root/grant namespace is the existing local demo isolation boundary; it is not multi-tenant security. Artifact reports remain the v0.7 Artifact owner's immutable products, not evidence that a Publication body was committed. The body-only slice does not imply support for the original table/citation/numeric capacities. Original Run grants remain fixed during that Run; this slice adds no dynamic ACL service.

## Public counterexamples and qualification

The new public tests use independently authored synthetic inputs. Their scenario origins are duplicate/conflicting same-block publication, stale revision CAS, missing delivery-slot rollback, protected-binding changes despite equal text, committed body followed by failure/cancellation, and active read without lease takeover. The [qualification record](../verification/v08-observations.md) separates actual local tests from the pending fixed public commit/case mapping. Until that publication and coverage rebinding, the coverage entry remains **draft / no verified public case**.

The earlier expanded Web/Worker candidate had different identity/event behavior. Its 298 provider-free tests and blocked browser attempt are preserved as historical evidence, not proof of this smaller original-contract adaptation. The dated scope/lineage amendments preserve that distinction.

## Dependencies and limits

Incremental dependencies: **0 packages, 0 download bytes**. Reuse Node's existing `node:sqlite`, cryptographic hashing, filesystem, and already-locked Zod where useful; no queue, web framework or configuration platform. [Node's fixed-version license and bundled notices](https://github.com/nodejs/node/blob/v26.11.1/LICENSE) and [SQLite's deliverable public-domain statement](https://www.sqlite.org/copyright.html) remain their own authorities. Local validation uses Node 26.11.1; the supported engine interval is not a claim of testing every patch version.

The module proves mechanical runtime effects, not factual or financial correctness. Fixture-model output remains synthetic, semantic status remains unreviewed, and no new live-model evidence is claimed.
