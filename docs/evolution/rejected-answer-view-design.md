> Superseded design record. This proposed historical failed-proposal Reader fallback was removed before delivery. The current contract is in ../answer-view.md and reads only committed Publication content. This record is not an implementation or a passing test claim.

# Readable answers with degraded citations

`readResearchReport` still requires an existing Report receipt. It never treats a rejected save as success.

`readResearchOutput` (and the existing `research report inspect`, `run report`, and `report serve` commands) also supports a bounded display-only answer from an original terminal failed Root Run. The eligible case is its final singleton `save_report`, paired with an original, explicitly not-dispatched citation rejection. The original answer is retained verbatim. Unknown exact source IDs and unsupported numbered markers are labeled unverified; document IDs are never expanded into source IDs.

This view has `kind: degraded-answer`, `report: null`, `receipt: null`, `revision: null`, and `publicationStatus: not-published`. The Run remains failed. No model call, tool dispatch, correction, publication, new Run, quota change, or source qualification is performed. Old failed Runs are not promoted into successful evaluations.

The original Result owner validates the acquired snapshot and stored bytes under the original document scope on each read. Known exact sources retain their numbered positions and original text. Registered calculations retain their original result records. Source identity verification does not establish the truth of answer claims or financial numbers: the view is explicitly semantically unreviewed. Artifact, source integrity, PDF-original, scope and access errors propagate instead of being relabeled as absent citations. Protected, cancelled, partial, unknown and hooked outcomes are ineligible.

The local Reader shows literal escaped text with its citation audit, never active Markdown, HTML, or links supplied by the model. Each answer request rereads original state and content. The existing immutable Report download paths remain separate. This is a display contract, not a second execution or publication owner.
