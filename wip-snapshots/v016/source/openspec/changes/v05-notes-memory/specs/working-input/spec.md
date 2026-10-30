# Observable contracts

## Derived working notes
- Original user question and newest complete group stay intact. Older assistant-call/result groups can be replaced only whole and only after settlement; failures/permission information and unresolved calls cannot be summarized away.
- Reference-only projection remains the baseline. A note records Host-associated exact source refs, call IDs/basis hash, Memory dependencies when present, content identity and derived/unreviewed origin. Model text alone cannot choose provenance or promote itself to original source/system/user authority.
- Capture the basis before invoking a bounded summarizer. Claim one shared root model unit before dispatch. Summary failure, missing budget, stale basis, cancellation, invalid output, no net byte saving or failed note persistence must not clear originals/reports or pretend a note was adopted. Fall back to the valid reference-only view, or explicitly fail the existing byte limit if none can fit.
- Only apply a durably acknowledged note that reduces the actual projected byte count including its metadata. Final Gateway-encoded size still independently includes schemas/wrappers. Exact old source reread continues to return original bytes.
- Offline summary fixtures remain semanticStatus unreviewed. No live summary-quality or cold-resume claim follows.

## Explicit Memory library
- The operator selects the library location; default Runs do not scan/create a global memory directory. New tasks reuse it only by explicit selection. List is metadata, read/search operate only active records within that library.
- Local writer ownership excludes a second writer; all owned handles/locks are released on normal failure/finally. Do not silently steal a stale lock or imply distributed locking/recovery.
- Save/revise/forget require a trusted intent separate from model arguments, bound to selected library identity, matching operation, approved content hash and entry/revision. After validation a grant intent ID is durably reserved before mutation and cannot authorize another write; the reservation prevents replay after reopen. Failed validation does not consume it. A later persistence failure may leave a consumed grant and explicit partial effects, but must not return success or silently reuse that grant. Keywords or an untrusted boolean in tool arguments grant nothing. Sensitive-value patterns are rejected by default; this is a narrow safety guard, not a comprehensive classifier.
- Entries have stable library/entry identity, monotonically increasing revisions, original provenance and real write receipts. Revise/forget compare expected revision and reject conflicts; a forgotten entry cannot be silently revived by revision of an old snapshot.
- Forget records a tombstone and excludes the entry from current list/search/read. Immutable old revision files and historical reports are not erased by this operation.

## Stronger future-input forgetting
- Preserve original execution history but project typed Memory payloads away when forgotten/stale/unavailable. Retain operation identity/revision/outcome, not the old text. Save/revise argument text in a settled pair must also be redacted once its resulting entry is no longer current; keep valid JSON and call/result pairing and label the text as a projected redaction, not original arguments.
- Derived notes retain Host-generated Memory dependency IDs/revisions. If a dependency is forgotten or stale, future projections exclude that note's text rather than reintroduce the old preference through a summary. Missing library state fails closed rather than reusing an old payload.
- Only the explicitly selected library is queried. This is filtering of typed Memory/note provenance, not general erasure of matching phrases in original user questions or already exported files, and not semantic anonymization.

## Independent verification
Tests separately cover stored write receipt, current recall and actual future Gateway input. A fixture preserving a preference is not evidence of live model adoption. Default document comparison/Skill/MCP/worker/retrieval cases stay runnable without Memory or note compaction. Kit verification, live/semantic approval and formal publication remain separate.
