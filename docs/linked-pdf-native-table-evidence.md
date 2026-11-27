# Linked PDF native table evidence

The linked-PDF source owner has an opt-in host contract,
`linked-pdf-native-tables@1`. By itself it does not expose a new model tool. The existing physical-page
contract and its citation format remain unchanged.

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

A URL or matching number alone does not prove the selected row/column or
justify rendering a chart as verified.

## Interactive chain (opt-in)
When the owner enables `ETF_GUI_PDF_CHART_CHAIN=1` alongside authorized
linked public PDF and controlled chart compute, a new interactive Run
pins linked-PDF adapter 3 and chart compute profile 3. Older Runs keep
their pinned tool contracts. A model can discover a grid using
`{linkId,page,tables:true}`, then select one cell with
`{linkId,page,table,row,column}` in the same existing PDF tool. The
receipt opens the exact original PDF page; the saved source detail
identifies its cell coordinates, row, column and unit. Dynamic or
protected pages, unsupported table layouts and missing units remain
outside the verified source path.

Formula `cells` inputs accept earlier reverified PDF cell references
from the same Run, not network URLs or copied values. Arrays must have one
observed unit per variable. A chart series can reference a completed
formula by `formulaCallId` instead of copying its numeric output; the
source links come from the original cells but the chart is still marked
as a derived result, not an independently verified figure. If any cell
is unresolved, no formula is run with invented numbers. History readback
does not fetch or rerun the PDF, the formula or the model.
