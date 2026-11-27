# Linked PDF native table evidence

The linked-PDF source owner has an opt-in host contract,
`linked-pdf-native-tables@1`. It does not enable any new tool in the
interactive agent. The existing physical-page tool and its citation format
remain unchanged.

| Operation | Contract |
|---|---|
| Acquire | Use exactly the eligible PDF link proven by already-consumed HTML in the same owner Run. Reuse an existing receipt; do not refetch to upgrade it. |
| Inspect page | Return the existing page-text result, with the same page citation identity. |
| Inspect tables | Read the retained native grid for one physical page, or return a typed miss. A grid binds the caption, headers, unit, row labels and parser coordinates. |
| Inspect one cell | Read one 1-based page/table/row/column selector and retain the original number string and slot metadata. Two equal strings in adjacent cells have different references. |

The owner revalidates retained page data before reading either output and
separately checks the table binding before reading a grid or cell. A
table-only integrity failure does not invalidate the independently checked
page result. No read reopens the network or parser. Older text-only receipts have no recoverable grid;
they return `WEB_PDF_TABLES_NOT_RETAINED` rather than triggering a second
fetch. A new receipt whose parser yields no supported grid returns
`WEB_PDF_NO_STRUCTURED_TABLE`; this means no supported grid was retained,
not that the original document has no table. A table that the parser has
produced but the owner cannot retain within its local cap returns
`WEB_PDF_TABLE_EVIDENCE_LIMIT`. The page text stays independently usable.
The bounds and missing-unit behavior are those of the existing native
table parser. This is not OCR, visual verification, or a guarantee of
complete table coverage.

For runtime adoption, pin a new linked-PDF adapter revision at Run
admission and keep the existing page-only revisions recoverable. Add
model-visible table and cell selectors and verify their consumed receipts
on cold History readback before calling a cell a cited source. A URL or
matching number alone does not prove the selected row/column or justify
rendering a chart as verified.
