# PR #28: Terminal answer verification

The integrated candidate passed **77 targeted tests** on Node.js 26.11.1 (0 failures, 0 skipped). This run made **0 external model-provider requests** and did not use a browser. HTTP checks used loopback listeners and synthetic accounts; persistence and failure-boundary checks used actual SQLite with local fixtures.

- **Canonical body:** Exact-turn GET/HEAD reads a confirmed Publication without listing conversation history or reading report artifacts. Tests covered missing report artifacts, oversized or corrupt history, tampered Publication records, original-body readback, and isolation across two mounted Projects. Responses are not cacheable. The endpoint does not generate a new answer or reconstruct a missing report.
- **Terminal authority:** Faults before a write, lost acknowledgement after a write, mismatched readback, an old writer fence, and user cancellation were exercised. A confirmed body remains readable after a later execution failure or cancellation; an uncommitted proposal is not delivered. Reading does not finalize, reopen, or redispatch the run.
- **W08 continuation:** Fixture tests covered malformed cursor input and recovery at both tool-dispatch and result-commit checkpoints. Valid continuation uses the original retained evidence; a missing or changed artifact is not silently fetched again.

The earlier real-request cohort recorded **9/10 runtime passes before these fixes**; W08 was the non-pass. That is historical evidence, not a real-request result for this candidate. These checks do not substitute for a full-suite run, browser acceptance, or verification of a deployed authentication gateway or model provider.
