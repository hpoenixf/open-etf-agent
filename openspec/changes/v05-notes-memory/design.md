# Implementation decisions before the first execution

Status: proposed implementation, not test evidence. The v0.4 freeze remains unchanged.

## Ownership and storage

One explicitly opened Memory library owns its index and immutable entry revisions. The Run's ResultStore continues to own original sources, calculations and new derived working notes; it does not become the Memory database. No manager or global default path is introduced. Read-only opens must not initialize absent libraries. Writable initialization first validates the existing directory ancestry, then obtains an exclusive writer lock before publishing library identity/index. A failed initialization releases only its own lock. Closing waits for this handle's serialized writes before releasing ownership. Existing stale locks are an explicit operator problem, not automatically stolen.

The small versioned index identifies the library, current entry revision, active/tombstone state, relative revision record and content hash. Record paths are derived from validated IDs/revisions, never accepted from model input. Bounded no-follow reads validate the index and record identities/hash. An immutable revision file is published before the new index; a failed index publication can leave an orphan revision, and must not return a successful receipt. This is not a multi-file transaction or crash-recovery guarantee.

Intent validation is a trusted caller boundary, not cryptographic authentication: a local operator-created closure supplies the approved operation/content hash/entry/revision. JSON tool arguments cannot supply or replace that closure. Synthetic CLI intents are labeled demonstration intents, not claims of a real user's enduring preference. Writes retain intent ID/origin in provenance but do not store unnecessary approval text. Text is bounded; a narrow sensitive-pattern refusal is defense in depth, not comprehensive privacy detection.

## Future input

Memory projection does not mutate canonical history. It checks typed entry/receipt/note provenance against the explicitly selected library's current state. Forgotten, superseded or missing entries cannot contribute old text to future model input. Unavailable state raises an explicit error rather than accepting cached text. In settled write pairs the historical argument text must also be replaced with a labeled projection marker; operation identifiers, pairing and actual outcomes remain. Arbitrary user text and already exported reports are not rewritten.

Working notes are a third typed ResultStore namespace, never original sources. The Host fixes source references, call IDs, basis identity and Memory dependencies; the summarizer only supplies bounded derived text. Original question/latest group and failure/permission facts survive. The compactor checks whole settled groups and claims root model budget before its bounded callback. It checks basis again after generation and persistence. Only an acknowledged note with a smaller actual serialized future view is adopted; otherwise the reference-only view remains, or the existing size contract rejects. Persistence without adoption is possible on cancellation/staleness after a write and must not be reported as adoption.

## Verification sequence

1. Native behavioral RED for the ten authored unit cases, with real assertions against loadable interfaces.
2. Minimal implementations and targeted GREEN; add boundary cases before relevant fixes where review exposes missing behavior.
3. Integration RED for actual persisted note readback, Host-bound intent, unchanged original source reread and captured subsequent Gateway input after forget.
4. Explicit CLI examples, independent offline install/build/full regression and demos. No prior v0.4 result is attached to changed v0.5 inputs.
5. Actual Kit lint/status/check and fixed local source/evidence inventories; live/semantic/license/publication remain separate unfinished gates.

### Review-driven acceptance additions (before RED)

The initial fourteen unit cases are not the whole stage exit gate. The integration batch must additionally prove that a model-supplied `intent`/`explicit`/hash cannot acquire authority through a Host binding; the closure binds grants to the selected library and approves only the exact operation/content/revision. Intent IDs are durably reserved after validation and before mutation: a later write failure can consume a grant without completing the requested write, which must be an explicit failure, not permission to retry silently. Reopening must not reset consumption.

Future-input tests must exercise actual next Gateway messages, including a latest tool group, with search containers, previous revise arguments and a dependent note. A state lookup for a different library or entry is not current authorization. A note's Host-associated source refs and Memory dependencies must come from the selected basis; structured or instruction-like summary output cannot choose refs or elevate message role. Changes during `saveNote` are checked after its acknowledgement; an orphan acknowledged note can remain immutable without ever being applied. The net-savings negative test starts with already projected source references, so removed raw source bytes cannot manufacture a false gain.
