# A17 lifecycle design and evidence boundary

This is a bounded local research-material registry over existing Source snapshots.
It is not an ACL, parser, task owner, retrieval engine or general Private parity.
The only shared-storage adaptation is a cancellation recheck after asynchronous
directory validation, immediately before the existing native link dispatch.

## Record and commit protocol

One logical material maps to one explicitly imported text/PDF file per version.
The record retains all admitted versions and one latest version until removal.
IDs are ASCII logical identifiers, never paths. Version metadata contains only
manifest and interpretation hashes, no original bytes, filenames or input paths.

Content equivalence is kind + original digest + interpretation identity. Text
uses the existing utf8-pages-v1 contract; PDF uses its validated extraction
snapshot digest. An identical import under another filename reuses the existing
version. Returning to older content requires explicit historical selection; an
import does not silently turn an old version back into current.

A complete state is first saved under a content-addressed prepared name. An
exclusive immutable ordinal seal is the mutation's linearization point. Competing
writers based on the same generation cannot both commit different states. The
visible snapshot is then published. No persistent process lock is created.
Prepared but unsealed objects are not committed versions. Reads validate every
seal, state hash, schema, scope and previous-state chain; they do not choose the
highest filename or silently reconstruct a missing snapshot. Explicit `material
recover` may reconstruct only the exact bytes bound by an existing valid seal,
after validating the whole history. Missing prepared bytes or corrupted snapshots
fail closed. Incomplete initialization also fails closed, never creates an empty
replacement owner over surviving state.

Registry writes sync files and their directories. Original Source persistence is
unchanged. The evidence here tests process/file-state recovery, not machine power
loss or a storage device's durability guarantees.

Cancellation observed before native seal-link dispatch leaves prior selection
unchanged. Once that filesystem operation has been dispatched, cancellation or an
I/O failure cannot be interpreted as proof of no commit. Inspect/recover the original registry. Lost CLI output may replay the same
completed import/replacement or removal without adding a version. A different
replacement requires the current expected revision. A removed ID is not reused.

## Limits and selection

At most 64 material IDs (including removed IDs), 32 versions per material, 256
registry generations and 512 KiB per state/record. Existing Source import bounds
still apply. Capacity exhaustion does not prune history or change current state.
Failed imports can leave unreferenced immutable source/prepared objects. They are
not selectable registry versions and are not garbage-collected here; deleting
objects without accounting for historical tasks would be unsafe.

`material select --id ID --version N` validates the selected original snapshot and
returns its exact manifest hash. The user supplies that hash to existing `run
submit`. Runtime never resolves a mutable active material. Selection made before
a replacement can deliberately submit the old immutable version afterward.

Removal disables registry selection for future work. It is NOT source revocation:
previously admitted tasks and direct historical manifest submission retain their
existing semantics. Replacing material does not rewrite a v0.32 knowledge config
or its frozen page vectors. New-source/old-vector submission must fail its original
binding guard; re-preparation remains an explicit separate existing workflow.

## Verification scope

Synthetic tests cover core lifecycle, failure/cancellation, same bytes/different
name, replacement and removal replay, two independent process writers, corruption,
symlinks, explicit recovery, CLI, unchanged old task execution after registry loss,
and rejection of old vectors for a new version. They prove contracts and wiring,
not financial answer quality, live-provider performance, full Private parity or
version release readiness. Full suite/build and independent review remain gates.

## Recovery and incomplete initialization

Explicit recovery also recognizes the publisher's UUID temporary hardlink when
it is the only other link to the exact same regular-file inode in the same owned
directory. It never relaxes arbitrary hardlink rejection. The temporary sibling
can be unlinked and the directory synced before restoring a missing sealed
snapshot. Prepared-but-unsealed objects remain uncommitted.

Initialization interrupted before a complete identity/first seal remains a
fail-closed limitation. Do not delete or empty that owner to force it open. Keep
all original project files for diagnosis; a separate newly initialized project
can re-import explicitly selected inputs if work must continue. This does not
migrate existing tasks or certify the incomplete owner as empty. Automated repair
of ambiguous partial initialization is not implemented in this candidate.
