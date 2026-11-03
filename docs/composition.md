<a id="composition-contracts-v019-candidate"></a>
# Composition contracts (v0.19)

This page describes v0.19's API contracts. The [qualification record](verification/v019-release.md) separates fixed real-model cohorts, provider-free checks and formal release identity. Bundled CLI scenarios remain explicit examples. A successful example is not evidence that every possible combination is supported.

## Host-owned inputs, original execution owners

Supply a bounded `documentCatalog` to `run`/`submitRun` rather than editing fixture files. Its `document-catalog@1` value contains an ID and documents with ID, name, version and page strings. The original Source owner validates and freezes these values; selected document IDs determine the tool schema. Durable configuration binds the complete catalog hash. Changing page bytes on resume is an identity error, not a reason to silently use a replacement document.

Use original Session, Worker, RootBudget, Result, Artifact, Publication and Reader owners. A tool result is not authority, and an ordinary answer cannot grant a new tool. Child gets only the parent's admitted scope and shared root budget. Unknown dispatched operations remain unknown and are not replayed or refunded.

## Supported composition seams

| Capability | Entry and prerequisites | Boundary |
| --- | --- | --- |
| Custom documents, Result, calculation, CSV/report | `documentCatalog`, selected tools/documents, original acquired Result references | A comparison table must satisfy the original structured data contract; no invented financial adapter. |
| Worker + Memory/context | Original read-only library binding and working input | No new Memory lifecycle, automatic write permission or replacement library on resume. |
| Memory effects | Original durable Memory adapter and one-use explicit intents | An answer or retrieved text cannot create an intent. |
| Trusted plugins/hooks + Worker | Inspect descriptor/source identity on submit; activate only after original Run checks | Trusted code is not sandboxed. Terminal replay does not reactivate plugins. |
| Skill/MCP | `prepareSkillMcpExtensions`, explicit catalog/root and trusted connector; `connectTrustedMcp` with Host-owned SDK transport | The connector implements the bounded read-page contract, not arbitrary tool protocols or new network/process permissions. |
| Child + custom sources + Admission | Versioned source-check binding, actual Child Run, same Session/root/group | One-level Child, original parent fence and root ordinals. Parent tickets cannot be presented as Child tickets. |
| Managed compaction + Admission | Durable `workingInput.compaction.mode = 'gateway'`, original note/reread tools and budget | Summary uses the same Gateway with separately sealed messages and a root ordinal. Unknown summary stops Main; no automatic refund or fallback dispatch. |
| Ordinary Response + Worker/Publication | Schema3 Session with explicit `ordinary-response` binding version2 | Original question, response ID, deadline and adoption fence. Legacy version1 remains fixture-only. |
| Prepared PDF + Worker/Publication | `preparePdfSnapshot`, then `pdfInput: {snapshot}` on initial run and recovery | Host retains original PDF bytes and extracted-page snapshot. A hash alone is insufficient. No OCR or untrusted-code sandbox claim. |
| Schedule + custom sources/Memory/PDF/plugins/managed summary | Original schema5 Session and `schedule-composition@1` adapter | Explicit confirmation, instant and wake; same original Worker. No implicit cron/background service. |
| TaskTime + supported original Run | Explicit original time anchor and time-zone contract | Source data dates are not replaced by the runtime clock. |

The matrix is a contract inventory. Provider-free tests, real-model results and released status are separate evidence.

## Intentional boundaries and historical readers

- Response schema3 and Schedule schema5 are distinct persisted protocols. Their direct combined wait/schedule lifecycle is not implemented; callers receive an explicit refusal rather than a silent disabled module. This is a compatibility gap, not a claim of unrestricted cross-product composition.
- Schedule's new adapter binds prepared PDF, trusted plugins and gateway-managed compaction through the original confirmed definition and Worker. Direct unbound hooks and arbitrary inline extensions remain refused; read-only Memory is explicitly admitted. Ordinary Response still requires a different persisted wait protocol.
- Child is one level and not a nested Worker. Protected documents, ordinary Response and independently published Child roots retain their original restrictions.
- The old `document-revocation@1`/schema4 Atlas demonstration remains reproducible and separate. It is not the general authorization model: new composition preserves the original Run grant/catalog and content identity, rather than adding dynamic same-Run ACL checks. New Runs receive independent admission. This does not remove the historical profile's revocation checks.
- Old Host or adapter versions are not silently migrated. Explicit new adapter versions distinguish new contracts. An old reader may refuse a new contract; immutable historical artifacts retain their original meaning.
- Legacy path-based PDF acquisition remains non-durable. Prepared snapshots use the original parser once before admission and restore exact bytes/pages without re-reading a path. Unknown tool effects remain unreplayed.

## Qualification and costs

Real-model plans must freeze source, inputs, expected mechanisms and budgets. At most100 v0.19 scenarios, including failures, timeouts, unknowns and corrective reruns, are authorized; this is a ceiling, not a target. Every actual Main/Child/summary request consumes the existing shared physical-call allowance. Failed cases cannot be replaced to improve a denominator. Safety refusals are normally checked without a model. No scenario limit authorizes additional billing.

## Bounded managed-summary reuse

Managed compaction uses the explicit `gateway-history-compaction@2` definition. `maxSummaryRounds` is a Run-bound integer from 1 to 24, defaulting to 6. Every attempted summary consumes the original RootBudget reservation; failure, cancellation and unknown outcomes do not refund it. Reaching this local limit skips another summary reservation and uses a verified existing projection or the original bounded context fallback. The Main task must still produce its own final response.

A persisted `compaction-frontier@1` references an immutable derived note and its original message prefix. Reuse verifies the note's content address, original covered call groups, source identities and current Memory dependencies. Re-reading the same evidence does not by itself justify another paid summary. New trailing and effectful groups remain original; a note never becomes original evidence or a permission grant. A changed dependency invalidates reuse.

The new persisted definition intentionally differs from the earlier experimental `gateway-history-compaction@1`. Do not silently migrate existing Runs or attribute earlier source qualification to this implementation. Old readers reject the new definition fields. The earlier interrupted/unknown tickets and test results remain historical evidence, not reusable capacity.

## Run the original contract checks

```sh
node --test test/document-catalog.test.mjs test/worker-composition.test.mjs test/response-composition.test.mjs test/pdf-composition.test.mjs
node --test test/admission-composition.test.mjs test/additional-compositions.test.mjs test/managed-compaction-frontier.test.mjs
```

These checks use synthetic inputs and local protocols/processes, without paid model calls. Fixed real-cohort results are recorded separately. They do not prove Response+Schedule, arbitrary MCP protocols, Python isolation or production financial-data integration.
