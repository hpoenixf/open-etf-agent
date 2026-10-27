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
