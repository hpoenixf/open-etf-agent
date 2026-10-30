# Design — one PDF, existing consumers

## Authority and identity

Only Host configuration chooses the file. The default demo uses a bundled original synthetic PDF; `--pdf` explicitly selects an operator-provided file and is never marked synthetic. `read_pdf_page` receives one bounded positive physical page number. A path is not a model argument. Keep the same immutable in-memory snapshot across repeated page reads, even if the path later changes. Reject non-files, symlinks, wrong signature, byte overflow or detected changes during bounded read. Do not disclose the absolute path in Source, report, errors or persistent records.

The PDF provenance carries original SHA-256/byte length/Artifact ID, physical page count, pinned parser version and synthetic-versus-operator origin. Source IDs/version bind original PDF bytes and parser identity; text SHA-256 binds the exact extracted page text. Selected-page text is not visual inspection, OCR or proof that every visible element was extracted. Blank physical pages must not shift later page numbers. The report revision preserves this provenance and attaches the exact original PDF through the existing Artifact store, not a parallel output directory.

## Bounded parser, not a new scheduler

Use `pdf2json@4.1.0` (Apache-2.0), one mature pure-JavaScript package with no runtime/optional dependencies. The original system's richer parser is not copied; rendering/native canvas is deliberately absent. Parse bytes, not a file/URL through the library. A single owned Node subprocess performs one parse; no queue or persistent worker. Parent owns bounded IPC, maximum 1 MiB input, 16 physical pages, 64,000 UTF-8 bytes per page and 128 KiB extracted text in total, absolute elapsed timeout, AbortSignal and termination confirmation. Reject overflow rather than present a silently truncated successful page. Disable dynamic string code generation in that parsing process; this is an additional local application guard, not an isolation/sandbox claim. Never inherit model credentials or arbitrary Node preload flags. Unknown/error/exit-without-result and cleanup failure are not success.

## Existing pipeline

The PDF Host binding is available only when explicitly configured. Existing ResultRef, Context/Gateway encoding and report paths are reused. Add only a PDF binary type to Artifact; preserve existing text encoders and identities. A PDF source has validated optional provenance; old non-PDF sources remain byte-compatible. When saving a report, the Host includes the original PDF attachment from acquired PDF sources and records `synthetic: false` for operator-provided material. File/Artifact failures and cancellation stay failures with actual partial effects, not optional numerical degradation.

The CLI demo uses scripted decisions and real PDF parsing/storage. It is not a real model or semantic evaluation. Active PDF processing is not offered through durable Session/Worker profiles in this slice. Runtime drains the owned parser on every exit; no new resume protocol or lease is added.

## Review clarifications

Open the chosen path nonblocking before fstat so named pipes cannot wait indefinitely before non-file refusal. After an original PDF Artifact is committed, subsequent cancellation carries that real effect and still fails. The scripted demo renders bracket-number markers in its excerpt with fullwidth brackets, explicitly labelled as display-only; complete Source/Result/PDF bytes remain unchanged and ordinary report citation checks are retained. The parser process's 128 MiB setting bounds V8 old-space, not total process RSS or OS access.
