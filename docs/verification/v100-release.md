# v1.0.0 verification scope

[简体中文](v100-release.zh-CN.md)

The integrated 1.0 source baseline is `fdbb45ac6eafc3ff6ad668d15f9d9565ce40b67d`. The version metadata and tag are separate from this code baseline. See the [evaluation CLI](../evaluation-cli.md) for the offline verifier and the read-only live-evidence export.

- Research CLI supports local action reminders and explicit admitted trading calendars. A calendar can report an unknown session when the admitted data is insufficient.
- Owner mode supports feedback bound to one published answer. Linked public PDF reading and Jaeger export are optional, not default promises; local uploaded PDFs are a distinct path.
- In local validation, published PDF evidence, reports and exact response bytes were independently re-opened. Optional Jaeger traces were queried after collector restart with a local test store. The evaluation export distinguishes response readback, trace verification and an objective check from full semantic review.
- These checks do not establish financial accuracy, a production rollout, or browser qualification. Operators should verify each deployed environment, preserve isolated data and keep the prior build and its mapping for rollback. No new database or observability service is required to run the offline demo.
