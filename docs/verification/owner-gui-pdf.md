# Owner GUI: attach a PDF to a turn

From an authenticated owner session, choose one PDF in the optional attachment picker and send the question. A PDF needs the existing parser's text layer and must be no larger than 1 MiB and 16 pages. Password-protected or textless scans are rejected; use an authorized unencrypted or OCR'd copy. An unattached question follows the existing workflow. The attachment is explicit per turn, not inherited by later questions. The original manifest, parser version, physical pages, and evidence digests are immutable. A same-ID replay neither rebinds the attachment nor initiates another model request.

Upload parses locally without a model request and does not publish any document. The PDF is private in the Project directory and is not displayed as an inline browser PDF. When the owner submits the question, text the model actually requests from the attachment is shared with the configured model service. A PDF-attached turn does not expose external information-fetching tools that could be influenced to send PDF content elsewhere; the next unattached turn still has the configured web/Wind tools. PDF page evidence is historical Markdown/text, not a visual inspection or OCR result.

## Ingress deployment requirements

For `POST /api/conversations/<internal-id>/pdf` only, preserve the normal login and exact Origin checks, allow exact `Content-Type: application/pdf`, pass the browser's percent-encoded `X-PDF-Name` header to the loopback application, and cap body size at 1,048,576 bytes while reading (including streamed bodies). Do not expand the 18,432-byte cap for ordinary JSON. Do not expose the loopback application directly, add CORS, or send the attached file through public URL retrieval. Keep the private Project directory and backups owner-only.

`node --test test/local-gui-owner-pdf.test.mjs` exercises the API with a provider-shaped mock, no credential or paid requests; set `GUI_PDF_PLAYWRIGHT` to a Playwright module entrypoint and `GUI_PDF_CHROMIUM` to a Chromium binary to also run the mobile browser scenario.
