# Tasks — local implementation and qualification

- [x] 9.1 Add original-contract-derived synthetic RED cases and shared Runtime admission without dispatch
- [x] 9.2 Adapt the same Runtime/Session to bounded independent Worker execution, non-user host stop and durable readback
- [x] 9.3 [check-only] Qualify actual separate processes, identity/fence/cancel/unknown boundaries, independent install/build and preserved regressions; freeze safe evidence

Initial 2026-10-27 planning record: lineage, proposal and test design only. No implementation or v0.9 test run has occurred. The original expanded candidate is not part of these tasks or their denominator. Scope review must precede implementation.

2026-10-27 implementation update: 9.1/9.2 have actual 11-case RED then 16-case focused GREEN. After three more counterexamples and version 0.9.0 freeze, the final 124-input combination passed 305/305 provider-free cases. Task 9.3 then passed independent locked offline installation/build, eight built CLI processes, exact new/retained Artifact reads and structural plan/apply checks. Final Kit verification/status is recorded separately; it does not execute tests. No remote publication, article or site completion follows from local tests.

2026-10-27 maintenance-rebind update: current main `0cf4b99e77bb77aa2530734d011e7f37985d1897` contributes only the previously qualified checker/test changes among the 124 runtime qualification inputs. One new combined run passed 309/309 at digest `445b5cfd2e2cf792b5d431546c4742f893fc66c38f7d033949e0109bcde5431f`; all ten maintenance paths are preserved. Original 305/305 and install/eight-CLI receipts remain historical; a separate exact 58-input/55-built-file comparison establishes unchanged delivery inputs without claiming a new execution. Fixed-phase coverage and remote/article/site gates are still separate.
