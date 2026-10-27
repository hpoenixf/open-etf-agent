# Result / Reference consumption increment

Current local record, 2026-10-27: RC.1–RC.3 are qualified by actual 333/333 regression and independent locked build/CLI readback; RC.4 publication is incomplete. See [evidence](evidence.md) and the explicit `tool-host@2` compatibility boundary in [design](design.md). No numbered version has been promoted.

Original planning status (retained): **scope-review draft, 2026-10-27; not implemented or qualified**. This is the existing roadmap's 1.1 intent, not an assigned release or a claim that 1.0 has shipped. Planning base: public main `4ec2bb54b9747c46e8e95b9d742a50862aae9f75`, package 0.9.0. No version/dependency change is proposed now.

## One increment, one useful loop

The existing Result owner already stores original sources and numeric derivations. The existing Runtime sends tool results to the next Gateway; reports and CSV are already real Artifacts. The missing contract is the observable relationship among an exact selected input, the calculated operands/result, the material actually encoded for the next model request, and the numeric report/CSV output.

Deliver one bounded, original synthetic same-snapshot ETF comparison through the existing CLI and Runtime:

1. Acquire the original structured table as immutable source bytes through the existing source path.
2. Select an explicit bounded row window from its existing ResultRef. Resolve the two operands from those exact rows, not additional caller-supplied numeric literals.
3. Reuse the existing deterministic change calculator. Preserve original ref/hash, selected row identities, returned coverage, units, currency, data cutoff and limitations in the result. Unknown operands or incompatible comparison metadata cannot become a successful bound number.
4. Verify the next production Gateway encoding contains that same result and limitations. An injected synthetic transport proves encoding, not a real provider's receipt or semantic use.
5. Host-generated numeric report material and the existing CSV serializer read the same derived result ref. A fresh process reads original report/CSV bytes; existing Reader is reused if HTTP readback is exercised.

## Scope and reuse

Primary owner: existing Result/Reference. Source/Host/Context/Gateway, the existing calculator, Artifact/CSV/Reader and Publication are necessary existing consumers, not new modules. Keep unbound explicit arithmetic honestly unbound; do not retroactively manufacture source provenance for T3 or old records. No new result registry, acquisition system, calculation engine, API product, database table, dependency or configuration platform.

A finite comparison result is not a financial recommendation, source truth, full-table coverage or proof that the model reasoned from it. Original source refs, derived calculation refs and artifact IDs retain different purposes. Original grants, source scope, cancellation, deadlines and durable output boundaries remain with their current owners.

## Stop boundary

Finish only the success chain and its tail-row, currency/cutoff and unknown-denominator counterexamples plus relevant identity/partial-output readback checks. Do not add generic selectors, sorting/filtering/cursors, Python, Decimal, Web/PDF, RAG, financial semantic review, new live credentials or a new Publication gate. Invalid optional numeric material/attachments degrade locally; independent lawful text is not cleared, forced through repair or made undeliverable by this increment. Existing genuine identity/security/storage failures retain their original effect boundaries.

Before production implementation: review this scope and exact original-owner adaptation, author contract-derived tests, observe the smallest RED, then implement. Existing 309/309 and prior live calls remain historical, never acceptance for this increment.
