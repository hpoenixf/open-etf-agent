# Project Memory operator lifecycle

### Requirement: explicit consent and versioned eligibility

Keep existing content-bound save/revise and explicit forget. An operator may
pin/unpin, pause/restore, or forget using an explicit single-use intent and
the exact current revision. A pin prevents pause until unpinned, but cannot
expand task selection or impede explicit forget. Pause creates a withheld
revision; restore re-enables the verified preceding text as a new revision,
not as a reactivation of an old qualified identity. An active or paused
entry may be forgotten, but a forgotten identity cannot be restored.
Status readback shows state/revision/provenance without returning old text.
Operators can discover paused identities in the bounded status catalog;
the model-facing ordinary list remains eligible entries only.

### Requirement: temporary and selected modes freeze before dispatch

Default omission on a new task keeps the historical mode and record shape.
`--memory-mode temporary` selects no native project Memory owner, IO,
tool exposure or writes for one ordinary task. Report, evidence and Session
remain persistent. `--memory-mode selected --memory-entries JSON_FILE`
selects at most sixteen explicit active IDs from a single project owner
and freezes their content hashes and revisions. No selected write grants.
Only that exact read-only scope is exposed to native Memory tools. A later
revision/pause/forget withdraws eligibility without substituting newer text;
explicit admission of a new Run can select the newly eligible revision.

The immutable explicit Task record is versioned. An exact matching retry,
including one after durable Task creation but before its Session was admitted,
uses the frozen config, original selection and approved expenditure/data
scope. After the record exists, omission or a conflicting mode is rejected
before reopening Memory. An independent ordinary persistent submission that
already began before the record existed does not widen a temporary Run's
authority. No new dependency or simulated Memory owner is introduced.

### Requirement: check actual outgoing typed work after queueing

For ordinary default and selected requests with typed Memory data the
Admission owner requires a final owner-state check. The check uses one atomic
index read as its eligibility cut, after acquiring capacity and before
the original dispatched transition and Gateway call. If the exact prepared
input has become ineligible before that cut, the unchanged reservation is
cancelled without sending it. Runtime recognizes only Admission-owned
nondispatch evidence; a provider error string is not proof. The conditional
gate does not lock ahead of the index cut, through the transport, or across
provider latency. A write that commits after the cut is not promised to
preempt an already authorized request.

This property applies to typed Memory artifacts and their projections, not
arbitrary free-text copies of Memory quotes in user questions, model prose,
external source text or already published history. It does not claim that
past provider or application artifacts are erased or changed.

### Requirement: current status and typed use can be inspected

A separate read-only view shows task selection, persisted typed recall
observations, and selected-mode typed-use receipts. Selection and observation
are not the same as use. A use receipt includes only metadata/identities and
is surfaced only if it matches a completed original Admission ticket by
task/root, ordinal and input hash. A locally cancelled ticket, unknown
outcome, or absent receipt cannot be counted as a completed use. This is a
local Runtime/Admission fact, not a provider attestation or a claim that
the model used the information correctly.
