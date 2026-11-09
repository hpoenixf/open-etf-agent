# Project specialist profiles (v0.27 candidate)

This candidate adds a project-local operator catalog, not another Agent or an
execution router. It is based on released v0.25.0; integration with the pending
v0.26 Web/context changes requires separate verification. No live qualification
or release is claimed here.

Enable the existing `child` capability, then use `specialist init --project DIR`.
`specialist create --project DIR --id YOUR_STABLE_ID --profile FILE` accepts JSON
`{name, description, enabled, method}`. `method` is the existing bounded Child
method descriptor, with its own `id` and `version`. The profile's operator ID and
revision do not replace either method identity. Create IDs are explicit operation
identities: retry the same ID and original body after a lost acknowledgement.
It returns the current record without allocating a second entity, including an
already edited or tombstoned record; another body conflicts. Do not change IDs
merely to retry an uncertain create.

`specialist read`, `update`, `remove` require `--id`; update/remove additionally
require `--revision`. Update reads `--profile FILE`. Disable with `enabled:false`.
Remove is a logical tombstone, not deletion or restoration. `specialist list`
shows active records. Immutable generation history is retained for integrity,
but this version does not provide a catalog historical-revision browser.

`preset create --project DIR --id YOUR_STABLE_ID --preset FILE` accepts
`{name, profiles:[{profileId,revision}, ...]}` in explicit order. Preset read,
update and remove use the same CAS revision pattern. Presets never follow latest;
a changed, disabled or removed referenced profile makes a new selection fail.
A repeated method ID is rejected by the existing execution validator, never
silently renamed. The same stable-create rules apply to presets.

Use `run submit ... --specialists FILE`, where FILE contains either
`{profiles:[{profileId,revision}],maxChildren:1}` or
`{presetId,revision,maxChildren:1}`. It conflicts with an existing inline
`childMethod` or `childExecution` configuration. Old inline tasks are unchanged.
The accepted task stores one normalized descriptor collection in its original
`config.childExecution`, and separate identity/revision/hash metadata. Main
chooses `delegate_child.methodId` from that set; preset order does not force every
specialist to run. No catalog or duplicate instruction bodies enter Main context.

An acknowledged or acknowledgement-lost accepted task is authoritative. Its
repeated identical submit, worker startup and cold recovery use frozen task data,
not the mutable catalog, even after profile removal. Reusing a task ID with a
different selection fails. Live approval and original Root budgets, Child tool
scope, question limits, Session definition limits and context limits still apply.
No permission to save Memory or publish a final report is granted to a Child.

Current limits: 16 active profiles, 8 enabled profiles, 16 active presets, 32
lifetime IDs of each kind, 256 immutable store generations, 256 KiB per generation.
Mutations compete for an immutable ordinal seal before publishing its data; this
is not an atomic transaction across both directories. Concurrent writers may receive a conflict or
safe transient read refusal. There is no hidden retry loop. A torn committed
file fails closed; an uncommitted dot-prefixed publication temporary is not
admitted. This is not a claim of exhaustive crash recovery or all-descendant
process cleanup.

The catalog now has a separate sibling registration directory
`.specialists-registration` in its Project. Initialization registers once; an
existing catalog with missing registration, or registered catalog missing data,
cannot be initialized as a new empty store. Each generation's ordinal and hash
are durably reserved there before its immutable data file is published. Both
sequences must match on every read, so losing an acknowledged tail cannot silently
roll back an edit or tombstone. A reserved seal with missing/incomplete data is
uncertain and fails closed: no automatic ordinal reuse, rollback, replay, or
repair is provided. Preserve both directories in a backup. This is not protection
against simultaneous deletion or rewriting of all Project authority files.

## Child summary delivery size

New methods use `output: {}` with no dedicated Child summary byte ceiling. The built-in comparison method is version 3. Summaries are not truncated, and the former ceiling is not replaced with a larger fixed threshold.

Legacy `child-method@1` descriptors retain their original valid `output.maxSummaryBytes` value (1–16000) as immutable identity metadata, **not a delivery limit**. Stored descriptors, bindings and questions are not rewritten. Legacy questions reconstruct their original byte-bound wording for exact recovery; that wording does not reinstate enforcement. New methods omit that wording. Previously failed tasks stay failed and are not automatically rerun or relabeled as successful.

Runtime final-answer capacity, Gateway request capacity, context, source authority, execution counts, time and cost boundaries remain separate and enforced. A large intact Child answer may still exceed context capacity. This change adds no paginated handoff, automatic continuation or truncation.
