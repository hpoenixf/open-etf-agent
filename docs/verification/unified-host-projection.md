# Unified Host projection (offline candidate)

This implements one Host-owned result path, not a Child context subsystem. The
private design informed the ownership and projection boundaries; no private
business services, data, account APIs or database code are copied.

New research task definitions freeze `hostProjection: host-results@1` and
`childInputProjection: host-context@1`. Existing tasks lacking these fields keep
legacy tool definitions, configuration hashes, prompt construction and limits.
A model cannot turn either policy on. The new model-facing method envelope
shows authored text once plus id/version/content hash and granted tools. Legacy
input/output metadata is not displayed as an active bound; the stored immutable
descriptor itself is unchanged, and execution limits remain explicit. New Child inputs inherit the parent's
explicit context budget without gaining reader permissions. The existing
request fitter checks the serialized request and Gateway tools/envelope budget,
including when no explicit contextBytes was supplied.

The existing Result owner stores complete Child handoffs as typed `derived:`
records, binding parent/root, original delegate call, Child/method identity,
content hash and acquired original source references. `result:` remains an
original source namespace. Derived text cannot become a report source or a bound
calculation operand. Successful delegate consumption, source identity and the
original producer are rechecked before materializing or projecting a reference.
A saved reference alone does not prove consumption or semantic correctness.

The existing `read_result` gains optional Unicode-code-point offset/limit paging
under the new policy. Coverage includes exact offsets, total, nextOffset and
whether this page is the entire stored summary. Pages do not call a model or
rerun a Child. UTF-8 original text is retained intact, not truncated. A page-size
limit is a materialization bound, not a summary acceptance threshold.

Under actual pressure, the same context fitter may reference a completed latest
Child result. It never rewrites durable messages or the consumed handoff. The
latest explicitly requested `read_result` page retains its actual text: replacing
it with a same-selection reference would cause a reread loop. If even that page
plus mandatory context cannot fit, capacity fails with instructions to narrow
the selection/use an authorized larger context. A Host lacking `read_result`
never emits inaccessible references and does not gain that permission.

## Verification boundary

Only deterministic injected gateways and synthetic files are used here; no paid
model calls. Unit checks cover typed namespaces, cross-owner rejection, original
source separation, Unicode page reassembly, canonical reference identity across
key ordering, exact legacy definition hash, unconsumed references, altered pages,
working-reference tampering and cold reopening.

A real Runtime/Project fixture hands off 25,000 UTF-8 bytes (10,000 Unicode code
points), projects into a 16,000-byte context budget, reads four 2,500-code-point
pages through the same reader, assembles the exact original string, saves the
source-based report. Before the first Main reader call, it cooperatively stops
at a durable working-input checkpoint containing the derived reference, closes
the original Session, and resumes in a different Node process. The original
message prefix/deadline/ref are retained, no Child call replays, and additional
model/tool usage matches only continuation. It then terminal-reopens without
dispatch. This tests cooperative recovery, not arbitrary kill or uncertain
provider transport recovery. A separate default-budget
fixture verifies encoded oversize input refuses before dispatch, while a small
input without reader permission still executes.

An earlier 12,000-byte-context fixture with ten smaller pages eventually exceeded
capacity because mandatory call/coverage history accumulated. That failure is
retained as a boundary, not relabeled success. No production limit was enlarged
to pass the four-page fixture. This is not unlimited context, automatic semantic
compression, or proof that every possible summary fits every chosen context.
Existing storage, checkpoint, final-answer and Gateway safety bounds remain.

## Recorded validation windows

The integrated 17-module run passed 108/108 before the final model-facing
method-envelope clarification. Its exact changed-file pins and output hash are
retained separately; this is not labeled a test of later bytes. The final
envelope clarification passed a separate 18-case new/legacy method suite.
Three actual new-task integration cases then passed separately: long multilingual
input with three granted documents, two-method execution, and independent cold
Child inspection. Neither count is added to the other as a single run. The final local receipt
binds the final file manifest and each distinct check. No paid acceptance,
release, deployment, or remote backup is claimed by these offline results.
