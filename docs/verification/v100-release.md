# v1.0.0 verification scope

[简体中文](v100-release.zh-CN.md)

The published source candidate is [`d9b44f0`](https://github.com/hpoenixf/open-etf-agent/commit/d9b44f0508d15c35f9e7f52da27d7bdb8c4eb704), with Git tree `75255e8b3611275d040daf05fa8bb4c7066041f4`. Deployment and local build verification used an identical source tree under a separate commit identity. Release documentation can change without changing that executable source. See the [evaluation CLI](../evaluation-cli.md) for the offline verifier and the read-only live-evidence export.

- Research CLI supports local action reminders and explicit admitted trading calendars. A calendar can report an unknown session when the admitted data is insufficient.
- Owner mode supports feedback bound to one published answer. Linked public PDF reading and Jaeger export are optional, not default promises; local uploaded PDFs are a distinct path.
- In local validation, published PDF evidence, reports and exact response bytes were independently re-opened. Optional Jaeger traces were queried after collector restart with a local test store. The evaluation export distinguishes response readback, trace verification and an objective check from full semantic review.
- These checks do not establish financial accuracy, a production rollout, or browser qualification. Operators should verify each deployed environment, preserve isolated data and keep the prior build and its mapping for rollback. No new database or observability service is required to run the offline demo.
