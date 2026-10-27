# Minimal design: selected source to one derived result

## Original-owner adaptation

Use the original ETF Agent Result/Reference rules, not a parallel system: immutable source identity; explicit selection with truthful coverage; calculation receives resolved bytes rather than claimed provenance; actual request exposure differs from storage; a source citation, derived result and delivered file are not interchangeable. The source and detailed private trace remain separate from this public contract adaptation. See [lineage](../../../docs/evolution/result-reference-consumption-lineage.md).

## Bounded input and selection

Use one deliberately simple, versioned synthetic JSON table encoded as the original source text. Parse and validate those stored bytes in the existing Result owner; do not trust a second mutable `rows` object attached by a caller. Rows have stable row identity and explicit scalar value/unit/currency/dataAsOf; an unknown numeric value remains explicitly unknown. This synthetic schema is not a general document/financial-data parser or a claim that arbitrary source prose has been verified.

Support only an explicit contiguous row window and two operand row/field selectors. Return original ref/content hash, original row indices, requested window, total/returned counts and whether that window was completely materialized. A complete selected window does not imply complete upstream holdings or whole-source model exposure. No filter/sort/search/cursor grammar. Bounds must fit current source/result/context limits; do not increase global capacities.

The existing calculator's bound-input form resolves operands from the selected original rows. Caller-supplied copies of numeric values cannot supply or override that binding. Retain current explicit-number arithmetic as a distinct unbound form; old records do not acquire a source relationship merely because values match. A successful bound calculation persists its actual operand bindings and comparison metadata with its existing immutable calculation record/ref. Preserve the calculator's existing IEEE-754 convention; do not claim Decimal precision or invent rounding.

The demo's one declared method is a same-snapshot comparison: the two rows must have known matching unit, currency and data cutoff, and a known nonzero denominator. These checks protect this method's numeric effect, not report semantics. For missing/out-of-window operands, incomplete required materialization or incompatible/unknown metadata, return a typed unavailable/insufficient comparison observation with original reasons and available source identity; omit the affected numeric fields and do not mint a successful calculation ref. Do not substitute zero, a guessed finite number or an alternative denominator. Malformed/foreign refs never grant access; use the existing identity owner, not a new permissions manager.

## Consumption and output

Runtime already appends actual Host results and prepares the next working input; Gateway already serializes them. Reuse these seams. Capture the actual outgoing encoded request and compare its result ref, values, operand bindings, units, cutoff and limitations with the persisted original. Reference-only context is not proof that body bytes were submitted. If the latest bounded result cannot fit, retain the existing context-limit outcome rather than silently clip rows or labels.

`save_report` already produces an authoritative numeric-derivation section. Extend that existing projection for a bound result instead of trying to inspect arbitrary prose for numbers. The model's narrative remains unreviewed. Extend the existing `create_csv` input to accept an existing bound calculation reference and serialize the original values/qualification metadata through `encodeCsv`; preserve ordinary string-row CSV as unbound output. Do not build another CSV generator or silently certify caller-authored rows.

An absent/invalid optional numeric reference or attachment must not add a whole-answer veto, hidden body filtering or forced repair turn. Emit an accurate unavailable attachment/number observation, preserve already committed Publication/Artifacts, and let the existing owner deliver independent text. Actual write/cancel/unknown failures stay failures; no fabricated saved receipt. If implementing this would require rewriting Runtime's general failure model or Publication policy, stop and narrow the adaptation for review.

## Planned touched seams, not a committed file-count target

- `src/results.mjs` / `src/calculation.mjs`: typed selection, original-operand binding and bounded derived-record validation within current owners.
- `src/tools.mjs` / `src/report.mjs`: existing Host calculator/CSV/report projection consumes the same ref; no shadow arithmetic or source classification.
- One synthetic fixture and existing CLI assembly: one runnable case; no arbitrary file importer or new service.
- Existing Runtime/Gateway/Context/Artifact/Publication should require no new owner or execution path. Tests exercise their real seams; change one only for a demonstrated necessary gap, reviewed separately.

## Qualification and boundaries

No feature code, tests or version change has been executed for this draft. Focused unit/production-seam tests precede one final frozen-input regression run and relevant locked install/build/CLI readback. Public coverage/README/article binding follows only an actually published and qualified source. Reuse earlier observations solely where input equivalence is explicit; do not inherit 309/309 as a new run. No semantic/live/browser claim is proposed.


## 2026-10-27 implementation review clarification (not final qualification)

The initial draft above remains the scope history. The selected `value` field is fixed by `comparison-table@1`; only the two original row indices and one bounded window are caller-selected. A window's `limit` is an upper bound ending at the known stored-table end. `complete` means this end-bounded window was fully materialized, while `storedTableComplete` separately reports whether it includes every stored row. Neither field means complete upstream holdings or a model's reasoning coverage.

Focused observations have now exercised the original source, actual Gateway encoder with an injected synthetic transport, and fresh-process CLI readback. Independent review then found additional malformed-reference and recovered-call identity counterexamples: earlier focused passes are not the final qualification. Invalid optional reference values must produce local unavailable observations without granting access or fabricating an Artifact. Structural extra fields, acquired-record integrity failures, genuine cancellation and storage failures retain their original boundaries. Recovery must bind the original submitted call as well as its effective Hook call and original stored result; value equality alone is insufficient, especially when two unavailable requests have the same reason.

## 2026-10-27 reviewed execution-protocol boundary

The request receipt now binds the original JSON call, Hook mode and actual effective call in one domain-separated digest (`tool-request@1`). All successful Hook executions/reconciliations, plus calculator/CSV calls without Hooks, carry that fixed-length identity. It is not authorization, source qualification or a signature. Existing original/effective Hook metadata must remain paired; verification occurs before choosing a result-validation branch. This adds bounded Context metadata, not a copy of unbound CSV rows.

This is an explicit **`tool-host@2` execution snapshot boundary**, not invisible backward compatibility. Finish active Runs on their original version before upgrading. A saved `tool-host@1` cannot resume under this protocol; it is rejected with `UNSUPPORTED_HOST_SNAPSHOT_VERSION`, without migration, fallback or a missing-digest compatibility bypass. Original immutable Result/Artifact/Publication reading is unchanged; refusing resumption is not permission to delete or rewrite previous results.

The existing Runtime has one necessary pure preflight: inspect the selected Run's Host version before plugin activation/claim, then check the version again at its existing original-binding boundary before claim. The Host also checks before creating/opening its writable owners. This refuses an observed incompatible snapshot without changing the Run, invoking tools or fabricating a terminal failure. The checks are not an atomic cross-version migration or a guarantee against arbitrary later concurrent changes; the Session's existing lease/fence still owns execution. The supported upgrade procedure ends old active execution first.
