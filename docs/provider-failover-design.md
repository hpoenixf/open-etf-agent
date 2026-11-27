# Owner model failover: scoped Go runtime pilot and qualification policy

The operator-requested model order is OpenCode Go DeepSeek V4.1 Flash, Muse Spark 1.3 Contributor, then MiMo-V2.6-Flash, with separately qualified optional direct providers. `src/provider-failover-plan.mjs` implements and tests a closed route/decision policy; it has no network, credential loading, provider-health mutation, or production activation. The private GUI keeps its current interface; an explicit, frozen Host config can enable the runtime pilot below.

## Executable Go pilot

Set the owner GUI launcher field `"goMimoFallback": "exact-go-model-not-found@1"` only after qualifying the exact models for the deployed account. The Project config records the matching `ownerGoMimoFallback` on newly admitted tasks. The pilot requires the existing official owner Go endpoint and DeepSeek V4.1 Flash as configured primary. It is off by default.

Only a fully consumed JSON HTTP 404 with the explicit provider error code `model_not_found` and no output permits the Admission owner to settle the DeepSeek ticket. For that same logical model turn, Runtime may reserve one more root model attempt in the same queue, using a distinct ordinal, unchanged input hash and original owner fence. Admission records the MiMo model on the new ticket. Every attempt consumes the originally authorized root budget; there is no refund, separate charge lane, or parallel send. The next logical turn re-evaluates primary. A cold worker finding an in-flight ticket still stops instead of replaying it.

The pilot does not switch on timeouts, loose error text, generic HTTP errors, cancellation, unknown responses, shared allowance limits, or before/after effects with unresolved state. A configuration toggle is not a live qualification receipt. Bounded injected-transport tests cover the real Project → Runtime → SQLite Admission chain; the exact Go wire rejection shape and the account's target entitlement still require stage evidence. No production activation implied. Muse, OpenAI, and Gemini stay non-executable.

## Provider and data boundary

| Route | Official wire route | Activation boundary |
|---|---|---|
| Go DeepSeek V4.1 Flash | `deepseek-v4.1-flash`, Chat Completions | Existing Go credential scope; model and region entitlement must match |
| Go Muse Spark 1.3 Contributor | `muse-spark-1.3-contributor`, Responses | Limited regions. Prompts and completions may train future Meta models; opt-in and host-proven **entire context is public** only. Never route ordinary production account/history/document/tool-output traffic here |
| Go MiMo-V2.6-Flash | `mimo-v2.6-flash`, Chat Completions | Separate qualified model route, same Go billing/admission group |
| Direct OpenAI | Responses, explicitly configured model | Operator selected direct OpenAI; deployment still requires the intended eligible key, authorized data scope and spending limit. Never infer provider from the key name or repurpose a key |
| Direct Gemini | OpenAI-compatible Chat Completions, explicitly configured model | Only with an activated, authorized Gemini API project/key, model checkout and enforced sending limit. Do not infer a billing cap from the AI Pro credit balance |

The first three routes and terms are documented in [OpenCode Go](https://opencode.ai/docs/console/go/). Google documents [Chat Completions compatibility](https://ai.google.dev/gemini-api/docs/openai) and [AI Pro developer benefits](https://developers.google.com/profile/help/benefits?hl=en). The chart does not establish entitlement, available balance, billing isolation, actual geographic eligibility, or wire compatibility with the whole research flow. Account-level settings default to untouched.

## Architecture precedent and release requirements

The design follows an existing pattern: the Host selects exact qualified routes, owns recipient authorization and a fresh durable retry permit, skips unavailable shared capacity groups, and preserves the original failure when proof is absent.

1. Extend the original transport to attest a complete, known no-output rejection with route, root, and exact attempt identities; settle the original admission ticket only on trustworthy evidence. A generic HTTP/edge status, partial stream, timeout, cancel, or error text is not proof. Never retry an unknown outcome; preserve remote outcome and billing as unknown.
2. Keep Admission and Session as the only owners. Bind the plan, original request projection digest, route and receipt evidence in the original Run. Each wire attempt needs its own fresh reservation/model debit/log. Disallow automatic routes for child, summary, scheduled, authorization denial, and previously observed model output. A Go model-specific outage can use the next available Go model; shared Go saturation/allowance exhaustion cannot.
3. Route qualification must cover actual multi-turn tool IDs and usage attribution, not only a text smoke. Muse needs a Responses adapter with correct stateless reasoning/tool continuation and independently demonstrated recipient safety. Direct OpenAI and Gemini must remain off until credentials, constraints and recipient scope are established; neither an API key nor a nominal credit amount is an activation permit.
4. Prove terminal rejection, healthy route, output/tool publication and replay-denial on deterministic fixtures, then separately qualify controlled exact route(s) and demonstrate failover on Stage. Review same-root continuation, cancellation between attempts, durable retry budget, new/old reader compatibility, and concurrency-group behavior before lifting the production block.

None of these release requirements are implied by the route-policy tests or public provider catalog.
