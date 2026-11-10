# v0.27 explicit input and delivery repair

These are opt-in product contracts on top of 6906cbc, not a release qualification.
Existing frozen tasks and their results are not changed or regraded.

## Independent Child evidence input

The N05/N10 diagnosis identified Main interpretation entering the Child task
alongside the original question. New operator-selected `child-method@2` with
`input.mode: independent-evidence` removes only that interpretation from the
actual Child input. The original parent call remains available for audit. The
original question, authored method, admitted readers, source subset, root limits,
Child identity and deadlines remain owned by the original execution path.

This is not a new agent framework or semantic adjudicator. Main still chooses the
admitted method and document subset. Child reasoning defects and Main's later
strengthening remain possible. All handoffs retain semantically-unreviewed status.
Legacy v1 method and tool-description bytes are unchanged. New v2 configuration
must be selected explicitly; older binaries cannot consume that new method.

Offline evidence starts with the unimplemented method rejected on the original
source. Green tests then verify actual blinded Child inputs, distinct retained
parent audit text, original source reading, report consumption, cross-process
same-Child continuation with unchanged identity/deadline, no terminal replay,
and frozen profile selection after the current catalog changes.

## Report artifact completion

N03's historical Publication-only result remains valid under its original task
contract. A new task may explicitly select `reportDelivery: artifact-required@1`
through the Project API or CLI. Task and Session definitions freeze this choice;
the original model input states it. Main must use the existing report save path.
Publication is still preserved, but ordinary final and citation-degraded paths
cannot mark the task complete without a report receipt. The failure is
`REPORT_ARTIFACT_REQUIRED`, not a fabricated artifact or automatic retry.

The four original regression cases were red before implementation and green
following it. Additional tests cover unknown-outcome precedence, rejection of a
forged completed checkpoint, unsupported protected/scheduled admission, and
cross-process recovery immediately after plain-final Publication commit without
another model request. Protected disclosure behavior is not changed.

## Qualification boundary

The original ten-case denominator, N03 missing report, semantic findings and
unexercised live pagination/projection remain historical facts. No paid request,
new semantic score, real-provider qualification, main merge, tag or release is
claimed by this change. Both new contracts need prospective real acceptance on
fixed inputs, with original budget accounting preserved.

## Fixed-source verification

Executable and test source: `41d351ec337dcece833862b0e134ffeb6fcf87a6`.
Node 26.11.1, serial full suite: **1,251 passed, zero failed, zero skipped**.
All frozen source/test/script hashes matched after the run. Native ESM build
and the built CLI's report-delivery option passed. Independent review found no
remaining blocking issue within these two opt-in contracts.

One earlier full run overlapped another local suite and failed the pre-existing
30 ms wall-clock test: the Runtime correctly stopped with TIMEOUT, but reached
one model turn rather than the test's expected three. That failed run is retained.
The unchanged focused suite then passed 13/13 and the subsequent full run above
passed with no other full suite running. No timeout or assertion was relaxed.
This does not establish that the 30 ms test is immune to scheduling load.

Remote WIP publication used only audited code, tests and engineering documents.
The sixteen changed files were read back in full and the complete 799-leaf tree
matched the reviewed local tree; other leaves were preserved. This is a WIP
snapshot, not a main merge or release. No remote CI pass is claimed.
