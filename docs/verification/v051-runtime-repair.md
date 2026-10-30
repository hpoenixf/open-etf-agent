# v0.5.1 runtime repair

This patch keeps the original v0.5 working-input, optional compaction, Memory and native report contracts. It does not import later Session, Publication or Artifact owners. Original tags and current main remain unchanged.

## Bounded repairs

The release retains the already validated same-version validation/correction, nullable stream and context-capacity handling repairs. Compaction may summarize only groups eligible under a trusted explicit read-history policy; unknown or effect-bearing groups, including save receipts, are retained. This policy is summary eligibility, not tool authorization. Original supported Source projection and readback semantics remain unchanged; it does not promise arbitrary extra source fields stay fully resident under pressure.

The shared null-ID repair preserves an already established nonempty tool-call ID on a null continuation. First/new-index null, conflicting IDs and other invalid types remain rejected, with final normalization authoritative. Closed observations do not grant execution or replay.

## Evidence and source identities

The original A batch ran `b4085c9f9252afd024edd4f77c9b143fdbb93f6d` and passed **10/10**, with 39 Go-zero-cost requests (35 Main and 4 Summary). It covered original Memory save/read persistence and a single authorized synthetic source under the unchanged 20,000-byte context limit. Notes were adopted; a read_note tool call was not observed and is not claimed. Native reports, source records, Memory files and note provenance were independently read back.

The release product source is `3af2591c3b2d04a89bdc1b99d515de48b04efc8f` (164 leaves). Relative to that A source, its delta is the null-ID predicate and portable regression file. Two version-specific actual Runtime seams passed: null-continuation read/save/report success and conflicting-ID zero-dispatch rejection. Shared parser-family boundary tests and v0.6 real-response repair evidence support the common fix.

**No B paid cohort ran on this new fixed source.** The sync-only policy reuses the original A evidence with subsequent targeted compatibility tests; it does not relabel A as new-commit ten-task qualification. Prior context-capacity and receipt-loss regression evidence is retained separately. The 20,000-byte limit is not increased: a workload exceeding available context may terminate safely with the typed capacity outcome. No new full-suite run or semantic answer-quality score is claimed.

The original build passed on this metadata release candidate; source/fixture inputs and generated dist source/fixture bytes were checked unchanged. This historical tree has no remote CI workflow; no remote CI pass is claimed. Product/test bytes are exact to the fixed source; only root package/lock version and this note are added. Dependency resolution is unchanged. Historical compound protocol errors are not retroactively assigned the null subtype, and unrelated gaps are not declared closed.

The public patch will use original phase/v0.5 commit `d075068ac99a6c798d012c46bff4fe0c33eb9979` as parent, preserving original public history rather than importing newer main.
