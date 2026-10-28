# PDF input: retained responsibilities and minimal public adaptation

The original ETF Agent PDF owner separates acquisition, original-byte identity, physical-page text, document readback and bounded extraction execution. The existing article [PDF: from text to evidence](https://hpoenixf.com/eff-agent-article/articles/024-agent-pdf-from-text-to-evidence) explains why extracted text alone is not visual evidence.

This v0.11 candidate retains original byte/text hashes, physical page numbers (including blank-page gaps), explicit selected-page acquisition, cancellation/deadline/unknown failures and independent artifact readback. It adapts those contracts to the existing public Source/Result/Artifact/Host owners with one local file and CLI, rather than copying private source or recreating the full original PDF subsystem.

The original richer parser/rendering stack is replaced for this narrow text-only slice by the mature pure-JavaScript `pdf2json@4.1.0`. No private implementation, SQL, Spec prose, payload or restricted revision identifiers are published. Excluded: visual rendering, OCR, geometric tables, paged search/expansion, remote files, capacity queues and durable active parsing. These exclusions must remain visible in the article and README; local text extraction does not qualify the full PDF article.

## Dependency decision

Official source: https://github.com/modesty/pdf2json ; official distribution: https://registry.npmjs.org/pdf2json/4.1.0 . License: Apache-2.0; keep upstream notices. Exact reviewed archive: 2,213,351 compressed bytes, 11,927,883 unpacked file bytes, 12 files; SHA-512 matches the official integrity. No runtime/optional dependencies, native binaries or install lifecycle hooks. Node requirement >=22.23.2 is below the declared Node26 range. The existing 95 dependency entries remain unchanged; only this one package is added. Actual isolated install/build qualification is still required, not implied by these metadata facts.

Current PDF.js distribution would add a substantially larger package and optional native canvas. Do not hand-write a PDF parser, pin an unreviewed old parser just to avoid native requirements, or claim that a worker process is a sandbox. This parser's text reconstruction is qualified only by explicit synthetic cases and stated limits.
