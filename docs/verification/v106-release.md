# v1.0.6: Safer linked PDF table reading

[简体中文](v106-release.zh-CN.md)

A linked, approved original PDF can be read within a bounded PDF-specific limit. The reader keeps quarterly and year-to-date columns distinct when dates repeat and can retain explicit currency units. Ambiguous layouts do not produce fabricated cells: readable text and its physical-page references remain available. General web input and user-upload limits are unchanged.

Scope: original static text PDFs. This does not add OCR, arbitrary browser automation, or unrestricted file retrieval. Scheduling and research budget policy are outside this patch.

[Fixed runtime source](https://github.com/hpoenixf/open-etf-agent/tree/69099abf273d5bbc5d82277b4769bc94f0316b65).

## Verification

The fixed Stage cohort passed all 10 real-model cases: 58 completed model requests and no unknown request outcomes. Every completed body was read back and matched its canonical digest; cases verified original physical-page citations and, where requested, table cells and chart delivery. All 6 focused local cases passed, including the original bilingual financial filing and a bounded large-PDF case. The Stage cohort used one filing and does not qualify arbitrary types of PDFs. [Sanitized evidence](v106-pdf-qualification.safe.json).

Pre-release follow-up: the parser omits explicit per-share or yuan rows rather than inheriting the table-wide RMB-million unit. In the exact filing used by the live cohort, all 50 text pages and all extracted tables matched the live candidate byte-for-byte; a focused 17-case suite separately covered the new unit exception and the unchanged acquisition, chart and readback path. The live counts above refer only to the recorded Stage source.
