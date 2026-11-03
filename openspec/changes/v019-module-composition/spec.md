# v0.19: composition contracts for existing modules

## Goal

Remove demonstration-specific input and assembly hardcodes where the existing original owners can safely support explicit Host-owned configuration. Preserve current authority, original Run identity, shared budget, fence, source identity, effects and unknown-result semantics. Smaller deployment does not mean a second toy ownership model.

## Required contracts

1. Custom source catalogs are bounded, validated and immutable for a Run. Tools expose only selected admitted documents; prepared PDF identity may be selected without unrelated text documents.
2. Worker submission inspects original extension identity without activation. Execution activates only after original Run binding and lease admission; terminal reads do not activate again.
3. Skill and MCP have explicit trusted catalogs/connectors. Their bounded read-page protocol does not grant arbitrary transport, tool or sandbox capability.
4. Memory, Response, PDF, Child and Schedule compose only through their documented original persistent protocols. Child shares original root budget and same Admission coordination domain without reusing parent tickets.
5. Managed compaction reserves and attributes every actual summary through original RootBudget and Admission. A validated persisted frontier reuses acquired notes; repeated evidence does not automatically pay for another summary. A Run-bound attempt cap is enforced before another summary reservation. Unknown, cancelled and late summaries do not become adopted notes or refundable capacity.
6. Publication and report artifacts are separate facts; both retain original byte/identity checks where the selected scenario requires them. A saved report is not automatic Run completion.
7. Every supported combination has a concrete runnable mechanism check and explicitly bounded real evidence. Failure, environment interruption, model behavior and oracle mistakes remain separate original records.

## Unsupported or deferred

A combined Response+Schedule durable waiting lifecycle is not implemented. The historical protected Atlas revocation profile is not generalized into a new dynamic authorization product. Python isolation is excluded in this environment. Nested Worker/Child orchestration, arbitrary MCP tool protocols, complete Memory lifecycle, recurring background scheduling and production financial adapters are not hidden prerequisites or completed features.

## Evidence and release conditions

See [qualification](../../../docs/verification/v019-release.md) and the bilingual composition matrix. Each required real cohort has ten fixed tasks, at least nine successes and no known unresolved applicable Runtime defects. Original C remains unqualified; its repair is a new complete cohort, not replacement of the failed task. A/B retain original execution pins and require explicit contract-impact review before reuse. Formal publication requires separate approval, a sanitized remote object manifest, remote byte readback and original CI. A local Git commit is not a published release.
