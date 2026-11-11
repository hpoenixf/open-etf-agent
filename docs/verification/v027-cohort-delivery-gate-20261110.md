# v0.27 fixed-cohort delivery gate

This is acceptance tooling, not a product semantic fix or a release qualification.
The base executable is 6906cbc70ae0cde35d6843482f512a82715034ee.

The retained guidance-v2 cohort completed ten Runtime tasks but produced nine
report artifacts. N03's durable Publication is valid under the original Runtime
contract. Globally changing `requireReport` to disallow Publication would rewrite
that contract; this change does not do so or reopen historical tasks.

`inspectResearchCohortDelivery` consumes an explicit ordered manifest containing
case IDs, unique run IDs, exact canonical task-definition hashes, per-case report
requirements and the original minimum-completed threshold. It uses the existing
Project inspection and delivery readers, which validate report bytes against
Artifact receipts. It never calls a model or executes/replays a task.

A completed Publication-only case does not satisfy a required report. Missing or
unavailable reports remain failures of coverage even when the numerical Runtime
threshold passes. Unsettled tasks prevent delivery qualification. Duplicated runs,
changed task identities and changed observations reject the inspection. The
manifest is copied before asynchronous work and its hash accompanies the result.

The caller must retain the original preregistered manifest. Its hash distinguishes
contracts but does not prove preregistration or prevent a caller from constructing
a different contract. Inspections are sequential, not an atomic snapshot of the
whole cohort. Semantic correctness, real-provider execution, projection/pagination
coverage and overall release eligibility explicitly remain not assessed.

## Validation

Focused tests cover the original-owner Project workflow: active tasks; a real
fixture report save and byte readback; a completed Publication-only answer;
unchanged repeat inspection; duplicate cases; changed task identity; malformed
requirements; and a deliberately different contract with a different digest.
The existing delivery-observation tests additionally damage an artifact and check
that durable Publication does not conceal unavailable report bytes.

No historical cohort was rerun, edited, pooled, or relabeled. The separate
N05/N07/N09/N10 semantic findings and real derived-pagination/projection gaps remain
open. Node 26.11.1 full-suite result: 1,240 passed, zero failed and zero skipped,
including the historic reader/guidance baseline consumers. Native ESM build
passed. Independent review found no blocking issue in this delivery-only scope.
Fixture tests do not replace live qualification.
