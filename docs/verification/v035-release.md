# v0.35.0 · Native PDF table evidence

A supported, local native PDF table can now yield a cell citation that identifies
the physical page, table, row, column, displayed unit and original PDF. Use an
existing [research project](../research-project.md) with the PDF and report
capabilities. Import the selected local PDF, discover available table cells via
`read_pdf_page`, then acquire each exact citation via `read_pdf_cell`. The cold
`research run report` read returns the same original reference and attachment.

- **One module.** No OCR, cross-page joins, downloaded sources, or general
  visual table recognition. Encrypted PDFs remain unsupported. Ambiguous rows
  or units leave the plain-text page available without fabricated cells.
- **Frozen real acceptance: 10/10.** Seven positive cases bound the correct cells;
  three ambiguous cases abstained without inventing a citation. Every case saved
  one report and passed original-PDF and exact-provenance readback. An issuer
  factsheet verified that two holdings with the same displayed weight remained
  distinct cells. The nine other inputs were synthetic native PDFs.
- **Usage.** 38 completed OpenCode Go DeepSeek v4.1 Flash requests, $0 additional
  USD as returned by the provider, no new unknown results. The historical
  unrelated unknown was not rewritten or treated as refunded.
- **Pins.** [Runtime source](https://github.com/hpoenixf/open-etf-agent/tree/cf066446f9bf35fb62c5e80ba3923d614241e115),
  [Verify #140](https://github.com/hpoenixf/open-etf-agent/actions/runs/44490644713),
  [safe acceptance decision](v035-qualification.safe.json), [layout design and
  offline evidence](../../openspec/changes/v035-native-pdf-table-evidence/evidence.md).
  The live run used Node 24.22.3. Its 109 source files and resolved dependency
  lock matched the runtime pin; only local package version metadata differed.
  Release packaging changes the version label, not runtime behavior.
