# v0.28: explicit report review

Scope frozen before implementation: one independent, manually requested post-hoc review of an existing Markdown Artifact revision and its original source-text snapshots. This follows Web acquisition (v0.26) and specialist synthesis (v0.27). It is not an automatic research-time Reviewer, quality gate, repair worker or publisher.

## Owners

- Artifact reader verifies report/revision/source/attachment custody during preparation. Protected roots fail closed; no path grants document access.
- Runtime and Session own immutable request identity, lease/fence, request debit, cancellation, deadline and restart behavior. Gateway and shared Admission own provider routing and concurrency. No private review scheduler, retry loop, budget ledger or replacement gateway.
- Review owns the immutable packet, instructions, response schema and advisory projection. Hashes prove byte identity, not authenticated publication or financial truth.
- An explicit request ID addresses one frozen packet. Duplicate submit reuses the original; changed input under that ID fails. New IDs represent separately requested work, never an automatic retry.

## Contract

Input: complete bounded report text, exact revision/source snapshots, artifact identity and unavoidable coverage gaps. Maximum serialized request 48,000 UTF-8 bytes; reject larger input without clipping. Reuse host-results@3 with contextBytes=131072. The nested serialized question is additionally bounded to 60,000 bytes to fit the existing 65,536-byte Session definition; encoded Gateway capacity is enforced independently before dispatch. Attachments are validated by Artifact reader but not supplied for semantic review. Protected content is unsupported.

Execution: one model round; no exposed tools; the existing positive numeric tool reservation limit remains one but the allowed-tool set is empty. No automatic retries, source fetching, edits, repair, publication or derivative evidence registration.

Output: original model answer and Runtime outcome retained. Structured findings preserve report UTF-16 locations and original source quote references. Mechanical validity does not certify semantics. Invalid response, failed, cancelled and unknown remain distinct. Unknown never silently replays or refunds. Read-only inspection never activates a Gateway.

## Acceptance boundaries

Offline lifecycle/schema tests and ten semantic input seeds (not a frozen live execution cohort) are separate evidence. Scripted outputs only test transport/schema, not reviewer effectiveness. External provider acceptance is unrun because the complete shared budget ledger is unavailable. No production-ready semantic claim is permitted on offline evidence alone.

Scope amendment before final verification: host-results@3 replaces the original 12KB draft limit, with the explicit packet/encoded-definition/context bounds above. The ten-case seed file does not contain frozen live task identities, Gateway configuration or budget reservations; R09 still needs two independent source identities and exact citation mappings.
