# Test plan — v0.11 Local PDF

Use original synthetic PDFs, not private documents. Parser success must exercise the installed production parser, not a mocked text response.

- Original PDF hash, selected text hash and physical page number survive a blank middle page; unselected text does not appear in the model-facing page result.
- Replacing the source path after acquisition cannot rebind the acquired snapshot. Wrong format, encrypted, damaged, blank requested page, invalid page, oversize bytes/pages/text and symlink/non-file input fail explicitly.
- Already-cancelled work does not launch a parser; in-flight cancel/deadline and child exit without a result confirm termination and cannot publish success. Test-controlled process fixtures qualify lifecycle only, separately from real parser cases.
- Original PDF binary Artifact roundtrip; byte tampering and provenance mismatches reject; old text-only Artifact/Revision reads remain unchanged.
- Real same-Runtime next-Gateway consumption, cited report and original PDF attachment; fresh-process readback of exact text/PDF/report bytes. Operator input is not labeled synthetic; default fixture remains synthetic.
- CLI option separation and missing-path/invalid-page behavior; no URL, arbitrary tool path, provider or active durable-PDF resume claim.
- Preserve earlier failures. Final full suite/install/build are tied to final frozen inputs, not inferred from a focused pass or historical v0.10 evidence.

Review-derived cases additionally cover a real no-writer FIFO (POSIX test uses mkfifo), a cancellation immediately after the original Artifact commit, and original PDF text containing bracket-number markers. Only the demo excerpt changes those display markers; the source hash, Result, original PDF and citation validator do not change. FIFO qualification is Linux/POSIX-specific; Windows is not claimed as tested.
