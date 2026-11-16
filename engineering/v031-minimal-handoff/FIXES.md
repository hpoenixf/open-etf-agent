# Minimal repair after the original live cohort

The original `a18317f5067873df1c50bd9cbeb2ef571e977147` cohort is retained: eight Runtime/delivery completions, six strict plan successes, an expired credential, and a subsequent local queue timeout. Nothing in this repair upgrades those outcomes or imports absent local increments.

The product scope remains selected text import, BM25 free queries and original sources. No embeddings, retrieval controls, reports or health features were added.

## Changed behavior

- Provider HTTP failures retain their actionable `PROVIDER_HTTP_<status>` code instead of becoming generic `EXECUTION_FAILED`. Provider bodies and credentials are not exposed. Unknown reservations, billing and no-replay behavior remain conservative.
- The current official OpenCode Go Chat Completions endpoint receives the same native Root session metadata as the retained legacy Go endpoint. Other hosts and endpoints do not receive Go-specific headers. This is not an automatic endpoint fallback.
- New tasks freeze `source-faithful-report@5`: requested query text is literal, explicit exclusivity is preserved, and the requested output format limits extra commentary. Historical v1–v4 guidance remains byte-for-byte available. New Knowledge tasks repeat the complete original request after Host material; old tasks retain their original layout. This is model guidance, not Host semantic enforcement or a guarantee of answer quality.

## Credential and execution handling

Use the explicitly configured existing Go credential through the environment variable named in the project configuration. Do not silently fall back to an old CLI credential. The CLI still does not load `.env` files or select credentials on behalf of the user.

A physical authentication refusal stops a validation cohort before another task is dispatched. Repair credentials through the authorized existing configuration; retain the failed attempt and cost unknown. Do not erase or automatically release unknown capacity merely to continue. The existing explicit local-release operation preserves remote/business/billing unknowns and does not refund or replay.

The repaired candidate requires a separately frozen full ten-task cohort with all original question/query text, source hashes, model, limits and cumulative budget. Prior failures and reservations stay separate. Successful individual replacements cannot be combined with the original cohort to manufacture 9/10.

## Verification boundaries

Regression tests cover the actual error-code propagation, unchanged unknown reservation and terminal no-replay behavior, exact official endpoint metadata, immutable historical guidance, and new-task guidance binding. These are provider-free checks. Prompt-content tests do not prove model instruction following; only the separately recorded live cohort can observe that behavior. Build, full regression, independent review, exact-head CI and publication remain distinct claims.
