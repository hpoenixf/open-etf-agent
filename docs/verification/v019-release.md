# v0.19 composition qualification

[中文](v019-release.zh-CN.md) · [Composition matrix](../composition.md) · [Upgrade boundary](../upgrade-guide.md#v019-explicit-composition-and-summary-protocol-boundaries)

## Status and exact scope

Implementation and bounded mechanism qualification are complete for the documented combinations. The immutable public implementation/evidence snapshot is identified below. Formal release status is separate from this qualification record. This is an extensibility upgrade of existing owners, not a production fund-research service or a claim that every module combination works.

Custom catalogs, original Result/Calculation/CSV/report, Memory consumption and explicit one-use effects, Worker recovery, trusted Skill/MCP/plugins, Response/PDF, Child/Admission and confirmed Schedule combinations retain their original identity, permission, shared budget, fence and unknown-result rules. See the full supported/prerequisite/unsupported matrix rather than inferring capability from a successful example.

## Four retained cohorts, not forty same-source successes

- A: 10/10 on execution source `c4037c06f90be44662f27b7f5d3c385237aa696d`, 31 physical requests.
- B: 9/10 on the same source, 36 requests. B03 remains failed: its original oracle incorrectly required exactly one MCP read despite the allowed two-document Skill method. The other seven original, never-started tasks continued without repeating or rescoring B03.
- Original C: 9 successes plus one failure, 48 requests. **Not qualified.** C10 repeatedly summarized history and reached a local summary-role limit after an original Admission reservation. That ticket stays unknown. No additional physical request is invented for the local rejection.
- Repair C: 10/10 on `6a52f20ecf1ef7235049859a27f0cd57af4eb523`, 44 requests. A persisted validated frontier reuses notes, and the Run-bound summary-attempt cap is checked before another reservation. C10 completed with eight Main requests and two summaries; persisted attempts, original Host dependencies, Publication and independent cold readback match.

These are 40 logical executions and 159 physical requests, all observed provider responses charged zero additional Go balance. Existing historical billing unknowns and conservative budget holds were retained. The public [campaign record](v019-campaign.safe.json), per-cohort decisions and execution inventories preserve each source and all failures. Local execution hashes are identifiers, not claims that those Git objects were publicly published.

A/B do not configure managed compaction or Schedule. The separately reviewed source delta leaves their exercised contracts unchanged; they remain regression evidence on their original source, not newly executed results on the repair source. The repair cohort exercises the changed contract. No mixing successful samples into a new denominator and no 38/40 substitute for the per-cohort ten-task gate.

## Provider-free and compatibility evidence

The repair's full suite observed 650/651. Its sole failure was an existing real-kill test using a 150ms wall-clock lease, expiring before the first checkpoint. The test now uses the same owned-clock method as its adjacent recovery cases, including a real process kill and a second-process fence advance; its targeted rerun passed. The complete failure is retained, and this is **not** a claim that the final tree reran all 651 tests. Build and the bounded normal/unknown/cancellation/late-response/recovery/tampering checks passed. No production lease or unknown guard was weakened.

An actual old Session reader rejects the new `gateway-history-compaction@2` definition with `INVALID_DEFINITION`. The new reader opens it read-only; original bytes remain unchanged. See the upgrade guide; this is explicit version refusal, not transparent old-Run migration.

## Deliberate remaining gaps

Response + Schedule needs a combined durable wait protocol and is unsupported. Historical Atlas revocation remains a separate demonstration; it is not a new general dynamic same-Run authorization product. Python isolation is not implemented or claimed verified in this environment. The MCP seam is a trusted bounded read-page protocol, not arbitrary MCP tools. Full Memory lifecycle, recurring background scheduling, financial data adapters, production deployment and financial-semantic accuracy remain outside this version.

## Machine-readable evidence

- [Campaign and retained failures](v019-campaign.safe.json)
- [A decision](v019-a-decision.safe.json) · [B decision](v019-b-decision.safe.json) · [Original C decision](v019-c-original-decision.safe.json) · [Repair C decision](v019-c-repair-decision.safe.json)
- [Original evaluator outputs](v019-mechanical-results.safe.json)
- [Original execution inputs](v019-original-execution-inputs.safe.json) · [Repair execution inputs](v019-repair-execution-inputs.safe.json)
- [Provider-free and source-impact boundaries](v019-provider-free.safe.json)

## Immutable public source and final release package

The implementation/evidence snapshot is [`9b6ae0adf1df7efd4fd138b8d2957103b8fd9132`](https://github.com/hpoenixf/open-etf-agent/tree/9b6ae0adf1df7efd4fd138b8d2957103b8fd9132) with tree `13739de4e3062df5674710e5a1709dbf28a07f9f`. Its 80 executable-input hashes match the repair execution inventory; A/B retain their original execution identity and separately reviewed unaffected-contract scope. The public snapshot contains the safe evidence, not private harness state or local Git ancestors.

`versions.json` records this immutable source snapshot. The `v0.19.0` tag and GitHub Release must identify the subsequent final metadata package after its original CI passes. Metadata does not change the execution inputs. Consult [GitHub Releases](https://github.com/hpoenixf/open-etf-agent/releases) and the tagged commit’s checks for actual publication status; this record alone is not proof of a completed release or CI run.
