# v0.27 report reasoning guidance v2

Status: candidate reasoning guidance, not proven semantic correction or release qualification.

## Why

S03 and S05 exposed a recurring necessary-versus-sufficient error. A source-supported intermediate state was strengthened to eligibility despite absent prerequisite evidence. In S05, a caveat recognized the uncertainty while the table still said yes. Artifact integrity and successful execution did not prevent this content error.

## Change

New tasks freeze `source-faithful-report@2`. It extends the original generic fidelity guidance with four distinctions: a necessary condition is not automatically sufficient; missing evidence is unconfirmed rather than false; tables, summaries, body and footnotes must express compatible conclusion strength; Child analysis is derived reasoning, not additional source evidence or authorization. It does not embed a test answer, add a regex truth judge, force a tool call, or change permissions, budgets or Child descriptors.

Historic `source-faithful-report@1` returns its exact previous bytes. Tasks without a profile still receive none. Duplicate submissions and old persisted tasks keep their original profile and question. Unknown or malformed profiles fail closed. New defaults are not applied retroactively.

## Evidence boundary

Offline tests pin the entire v1 text, check new frozen v2 and malformed-profile handling, exercise Main/Child persistence, and resume an actual task created by the old fixed a0569384 binary with the new code without upgrading its question. These tests establish input and recovery contracts, not better model reasoning. They do not establish cross-binary recovery for an older absent-profile binary; absent-profile behavior is unit-checked only.

S03/S05 semantic findings, S04 capacity failure, S02 unknown and historical scoring remain unchanged. No new paid request is part of this change. Future independent semantic verification should use new cases covering a genuinely sufficient condition, a merely necessary condition, and missing evidence that does not establish a negative; do not rerun this case until a preferred answer appears.
