# v0.17 CI follow-up

The first final-package Runtime CI at `64588b8a79ab3d6db4cf9b20c79ff47296ecc0c9` failed: 589 of 592 tests passed. Install and build passed. [Original run](https://github.com/hpoenixf/open-etf-agent/actions/runs/41566427888). This failed run remains evidence; it is not relabeled as successful.

The duplicate-call recovery test failed during its first claim read, before any checkpoint, with `STALE_WRITER` under a 150 ms wall-clock lease. Like the existing note and Memory recovery fixtures, it now owns its lease clock while retaining a real 220 ms scheduling stall, real SIGKILL, a different process, the 150 ms lease, clock+151 takeover, fence advancement and exact persisted call/budget assertions. The independent wall-clock deadline and expired-writer tests remain unchanged.

The Admission test previously discarded the original owner's failed outcome before waiting for the next request. It now checks actual queued state, SIGKILL termination, owner completion and completed ticket state, and reports early worker failure. The original worker, 300 ms lease, queue timeout, unknown occupancy and Runtime deadlines remain unchanged.

The named CLI profile failure had no outcome diagnostics in the original assertion. The assertion now reports safe case/status/code/rounds/budget fields. One isolated pass of all four profiles succeeded; the historical failure cause remains unresolved, not declared fixed. No production limit or safety guard was changed.

Local targeted verification on Node 26.11.1: durable Runtime and CLI tests 19/19; Admission tests 10/10. These are provider-free tests, not another real-model evaluation or a replacement for the full original CI. All 79 frozen real-evaluation input files and all production source bytes are unchanged. The existing nine-success/one-unknown ten-task result remains historical evidence with its original boundaries. Formal release remains conditional on the next fixed-commit original CI and remote publication readback.
