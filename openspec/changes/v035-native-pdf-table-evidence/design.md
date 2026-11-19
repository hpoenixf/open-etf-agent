# Design

- The existing owned `pdf2json@4.1.0` worker observes native text origins.
  It supports a single physical page at a time, either an explicitly
  unit-labelled caption followed by a simple column-header row, or a named
  two-column section with its explicitly unit-labelled value header on
  the same line. Data rows require an aligned label and one unambiguous
  numeric span per expected value column. Units are copied only from the
  applicable caption/header, not inferred from the number. Partial/shifted
  numeric rows, contradictory unit labels, oversized headers and competing
  candidates that reuse a physical cell fall back instead of being slid
  to another column. Unsupported layouts keep plain page text.
- Table structures attach only to new table-bearing frozen selections
  (`pdf-input-snapshot@2`) and are covered by the existing snapshot digest.
  Legacy `@1` snapshots keep their original input, tool definitions and text
  citations. Previously imported material is not silently reparsed; import
  the local original again if it should be considered for table evidence.
- `read_pdf_page` exposes bounded tables under `pdf.tables`. Coordinates
  are in the parser's top-left units, not glyph bounds or an OCR judgement.
  `read_pdf_cell` accepts 1-based `page`, `table`, `row`, `column`
  on the same admitted PDF, and returns the original numeric text plus a
  cell receipt. Explicit allowlists keep cell discovery and selection
  together; page-only configurations remain available. The Result identity pins table metadata as well as
  content and location; equal values in different cells stay distinct.
- The existing `save_report` accepts acquired cell source IDs, uses
  normal numbered citations, and automatically attaches the original
  PDF once. Cold `research run report` returns the exact revision and
  cell receipts without calling a provider or opening the operator path.
  The existing artifact integrity checks apply. This proves provenance,
  not that the model interpreted a financial value correctly.
- Existing file, page, extraction-time, process termination and context
  limits stay in force. Table observations are bounded by layout, size,
  table count and row/column counts; they are not an exhaustive inventory.
  Encrypted files, scans, multirow or merged headings, captionless
  layouts and mixed/implicit units are unsupported by this subset.
