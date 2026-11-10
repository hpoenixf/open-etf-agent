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
lifetime IDs of each kind, 256 KiB per generation. Generation ordinals and profile/
preset revisions are positive safe integers; there is no 256-generation lifetime
mutation ceiling. Counters never wrap or reuse identities. Exhausting the numeric
representation fails explicitly. Immutable history is retained, not compacted;
reads validate the full chain sequentially and their I/O cost grows with history.

The catalog has a sibling registration directory `.specialists-registration`.
Initialization registers once; an existing catalog with missing registration or
registered catalog missing its directory cannot be silently reset. Before claiming
an ordinal seal, a writer durably stores the full canonical next snapshot in a
content-addressed `.prepared-<hash>.json` recovery object. The exclusive ordinal
seal then binds that exact snapshot hash; competing writers cannot substitute a
different state. These prepared bodies remain part of the backup, even after ACK.

Ordinary `openSpecialistProfiles` (including `create:true`), list and read calls
never reconstruct files. A recoverable gap returns `SPECIALIST_RECOVERY_NEEDED`.
Explicit recovery first validates the entire chain and visible directory entries,
then reconstructs missing snapshots only from intact prepared bodies matching their
existing seals, project identity and validated previous chain. Concurrent exact
reconstruction is idempotent and never overwrites a different existing file.
Legacy orphan seals without a provable matching body remain fail closed, as do
corrupt snapshots, unsafe paths and mismatched prepared bodies. No seal is deleted,
no head rolled back, and no ordinal or revision reused during recovery. This is
not a cross-directory atomic transaction: concurrent writers may still receive a
conflict or safe transient read refusal. Hidden temporary files are not committed
generations. Preserve both directories, including prepared bodies, in backups.
This does not protect against simultaneous rewriting/deletion of all authority
files and is not a claim of exhaustive filesystem or process crash recovery.

### Explicit recovery

Only the authorized Project owner/unique writer should run recovery, with other
catalog writers stopped. Use the Project's exact directory and project ID:

```js
import { recoverSpecialistProfiles } from './src/specialist-profiles.mjs';
const store = await recoverSpecialistProfiles({ directory, projectId });
console.log(store.recovery); // { repairedCount, alreadyPresentCount }
```

`repairedCount` counts snapshots this invocation published;
`alreadyPresentCount` counts concurrent exact reconstructions verified instead.
An intact store returns both as zero. No model calls or research tasks are started.
Validation failures cause no repair writes. An I/O failure during the subsequent
multi-file repair can leave a subset restored; it is not transactional. Preserve
the error and use the same explicit entry to validate and finish the remaining
exact repairs. Never delete the seals, prepared bodies, or immutable history.

## Child summary delivery size

New methods use `output: {}` with no dedicated Child summary byte ceiling. The built-in comparison method is version 3. Summaries are not truncated, and the former ceiling is not replaced with a larger fixed threshold.

Legacy `child-method@1` descriptors retain their original valid `output.maxSummaryBytes` value (1–16000) as immutable identity metadata, **not a delivery limit**. Stored descriptors, bindings and questions are not rewritten. Legacy questions reconstruct their original byte-bound wording for exact recovery; that wording does not reinstate enforcement. New methods omit that wording. Previously failed tasks stay failed and are not automatically rerun or relabeled as successful.

Runtime final-answer capacity, Gateway request capacity, context, source authority, execution counts, time and cost boundaries remain separate and enforced. A large intact Child answer may still exceed context capacity. This change adds no paginated handoff, automatic continuation or truncation.

## Explicit independent evidence input

An operator may choose `schemaVersion: "child-method@2"` and add
`mode: "independent-evidence"` to the method's existing `input` object. All other
method fields, hash validation, reader allowlist and budget limits remain the
same. This is an explicit profile revision, not a silent update of old methods.
`child-method@1` keeps its exact historical task construction and local question.

For this mode, the original Child executor constructs input from the frozen
original research question, operator-authored method and Main's authorized
source subset. Main's free-form delegation question stays in the original parent
audit history but is omitted from the Child task, preventing that interpretation
from becoming a premise of the independent pass. Main still selects the admitted
method and document subset, so this is not independence from source selection.
The original shared Root budget, source grants, deadlines and recovery owner
remain unchanged. No new execution system or automatic extra model call is added.

The mode prevents one observed input-contamination route. It does not validate
semantic truth, fix independent model reasoning errors, or prevent Main from
strengthening a correct handoff later. Handoffs remain semantically unreviewed.
Use an operator-authored method appropriate to the immutable original question;
a narrow subtask needing a local question should keep the existing v1 contract.
