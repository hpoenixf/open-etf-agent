# Teaching-default evidence — 2026-10-30

A separate provider-free increment after P0 changes only the Runtime and Gateway defaults documented in `spec.md`. It does not enlarge an explicit caller budget or introduce a new gate.

The four focused cases all passed (4/4, no skip/cancel) in 0.62 seconds under Node 26.11.1, existing locked dependencies, 512 MiB heap and serial execution. The 76 selected inputs were unchanged before/after, input digest `54b185a7c67605bd9021966232c12daf41ea8ab4dd4f72911f0ddaf62f20c6ea`; test SHA-256 `bbdc96e7ac7f1974d3be9ef8449a21f27ec76b3e54a8e98284149810aa0fcb51`.

- An ordinary lesson completes after 14 injected model-budget turns and 26 tool dispatches, without an unrelated saved-report requirement. The durable definition records 24 rounds, 64 tools, 120000 ms and `requireReport: false`.
- A complete 256 KiB UTF-8 report fits the existing supported 1 MiB application input allowance, now the default. The report bytes and original receipt hash are intact.
- Explicit report requirement, single-round, single-tool and parent root-budget restrictions still fail at their original boundary.
- An explicitly selected 256 KiB input guard stops the third dispatch before the injected fetch; the already saved report and receipt hash remain intact. The outcome is failed, not fabricated success.

All responses were local injected adapters/Response objects: zero network, provider, paid or HTTP-server calls. The owned test group reached terminal state, leader waited, with no timeout, orphan or cleanup signal. The four cases do not establish real-provider token capacity or semantic quality. No unrelated 65-case rerun or live-provider validation is claimed. P0 retains its original 63 successes plus two separately corrected fixture/readback successes.

Compatibility follows `spec.md`: only new Runs obtain new defaults. Existing active definitions, bindings, deadlines, explicit limits and ledgers are not upgraded or migrated. P0's changed report-tool definition hash remains a pinned-host compatibility boundary.
