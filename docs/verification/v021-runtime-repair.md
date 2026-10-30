# v0.2.1 runtime repair

This patch preserves the original v0.2 JSON/SSE, Skill, MCP and native report APIs. It does not import later ResultStore, Artifact/Reader, Session or Publication APIs. The historical `v0.2.0-dev.0` tag and current main remain untouched.

## Scope

The patch includes the already tested same-version nullable stream-field compatibility and bounded calculation validation/correction handling, trusted closed streaming-ID diagnostics, and safe same-index null-ID continuation. A null fragment may preserve an already established nonempty ID; first/new-index null, conflicting IDs and other malformed values remain rejected. Final normalization remains authoritative. Early-version Runtime error behavior is retained.

## Verification

Executed source: `e218e0345d06b361fdf9b6c6a3de83b25f59b427` (62 source leaves). Release metadata changes only package/root-lock version and this note; code/tests are byte-identical and dependencies unchanged.

The representative early-version parser/Runtime boundary suite passed 8 cases, including successful null-continuation execution and trusted conflicting-ID rejection with zero dispatch. Prior same-version repair evidence is retained; no new full-suite run is claimed.

A fresh independent B cohort passed **10/10**, using 33 Go-zero-cost requests. Three tasks used SSE; two used the original Skill/MCP mechanism with method/source/protocol identity and process-close checks. All ten report bytes and terminal receipts were independently read back. Old A results remain attached to their original source, with no sample credit, retries or replacements in B.

This historical tree has no remote CI workflow; no remote-CI pass is claimed. The original build passed on the release candidate; source and fixture inputs remained unchanged and every generated `dist` source/fixture file was byte-checked.

Checks cover runtime contracts and artifact integrity, not semantic answer quality. Successful SSE does not prove a null continuation occurred in a particular response. Historical compound ID errors are not retrospectively assigned this cause, and this patch does not qualify other version tags.

The new public commit will use the original remote v0.2 commit `a79e89bf709d4a2245b5a8652882a591ba467519` as parent, preserving its public history.
