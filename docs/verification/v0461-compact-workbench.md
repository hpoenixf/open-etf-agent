**English** | [简体中文](v0461-compact-workbench.zh-CN.md)

# v0.46.1: compact research workbench

This patch changes only the browser workbench. The composer stays at the bottom while reports scroll independently. History and sources can be collapsed separately; clicking a citation opens its original source. Daily Watch starts as a capsule. The input toolbar shares one slot for Send, Retry and Stop; the information icon opens the existing permissions and data disclosure.

Stop targets the one confirmed active Run in the selected conversation through the existing cancellation endpoint. A stop request is not shown as a terminal result. The Runtime, HTTP handler, model configuration and requests, budgets, evidence, publication and persisted data formats were not changed.

## Verification and evidence boundary

- [Fixed UI implementation](https://github.com/hpoenixf/open-etf-agent/commit/1bbabf0dca0da23ee3cafcdb565340dd379b7acd), [PR #27](https://github.com/hpoenixf/open-etf-agent/pull/27), [exact-head Verify CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/45130290665). On Node 26.11.1, the focused suite passed 42 tests, skipped one browser-PDF case and had no failures. It includes synthetic active-run cancellation, rejection, settlement and conversation switching; it did not stop a real paid Run.
- Isolated staging used the exact UI overlay in Chromium at 1363 × 936 and 454 × 312. The controls, fixed composer while an options panel opened and closed, no horizontal overflow, and absence of the old transcript cancel button were checked. No additional model requests were made in this check. These viewport checks do not establish physical-phone or browser-PDF parity, and do not verify hosted production.
- The [original v0.46.0 ten-task record](v046-deep-evidence-milestones.md) stays bound to the original source, inputs and execution identity: 10/10 Runtime delivery on its defined scope. [The comparison](https://github.com/hpoenixf/open-etf-agent/compare/9b7cbfc358fd2688fc69a2af5b0c263016fc1eb9...1bbabf0dca0da23ee3cafcdb565340dd379b7acd) shows only documentation, version metadata, three browser assets and their targeted tests. Provider-side task generation, admission, execution and readback are unchanged; the browser paths touched by this patch are checked separately. This is applicability of the previous Runtime evidence, not whole-source equivalence, a new 10/10 cohort, or a new model assessment.

[Verification index](README.md) · [GUI setup](../local-gui-live.md)
