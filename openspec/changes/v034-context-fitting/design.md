# A14 ownership and execution

1. The existing project validator accepts optional `contextWorkingSetBytes`.
   The original project/task definition and Session schema freeze it; absent
   means absent. No schema migration or rewrite of old task identity occurs.
2. `projectContext` validates complete ordered assistant/tool groups before
   projection. For the optional advisory pass, it considers only successful
   explicit reads outside the newest two groups. It asks the original Host for
   a reversible representation, or validates an exact registered source identity.
   Source text remains in original history; references retain original identity.
3. Eligible reductions are smaller in raw bytes and never larger under the
   configured actual encoder. Failed/unbound/opaque/nonshrinking results neither
   drive the eligible working-set sum nor get replaced. Target exhaustion alone
   is not an error. Hard-pressure fitting remains a separate original stage.
4. A Gateway-only budget does not activate a new raw-message limit or projection.
   It is enforced by final preflight. Source lookup for selected fitting respects
   the selected read-result capability.
   No new tool is added. Optional soft configuration likewise adds no authority.
5. Immediately before ordinary model reservation, `assertContextCapacity`
   checks the exact final messages and tools. This covers already-restored
   working-input and memory re-projection. Failure remains local, with no new
   model debit or dispatch. It does not settle earlier unknown requests.
6. `context_fit` is numeric metadata only, not a second persistence authority.
   A sync/async observation failure is swallowed; it cannot rewrite input or
   grant more requests. No raw source, arguments, prompt or credentials appear.

## Limits

The hard fitter retains its historical latest-group behavior; the advisory
pass protects two groups. No generic history deletion, automatic compaction,
opaque JSON rewriting, tokenizer approximation, multi-tenant authorization,
provider retry or GUI is added. A28 and other owners remain separate versions.
The actual transport budget is checked again after restart, so an old prepared
input may fail under a smaller current encoder envelope instead of dispatching.
This is an intentional local refusal, not proof of provider failure.
