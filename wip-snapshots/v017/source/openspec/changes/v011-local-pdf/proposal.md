# v0.11 — Local text-layer PDF input

Dated scope: 2026-10-28. Baseline: public main `1931d45ddf2c66dc6d015b775e1d21d234345522` (v0.10). The existing CLI-first roadmap lists local text PDF as the next independent candidate after the completed Result/Reference increment. This proposal selects that module for v0.11; it does not replace it with Web or declare 1.0 complete. Initial status: planned, not implemented or released.

## One deliverable

An operator explicitly selects one local PDF (or the bundled original synthetic PDF). A bounded parser obtains text from physical pages. A model-facing tool accepts only a page number, never a path or URL. The ordinary Runtime/Host stores the selected original page, sends it through the next Gateway input, saves a cited report and the exact original PDF using the existing Artifact owner. A fresh process reads the report, page snapshot and PDF bytes without parsing or model calls.

## Reused responsibilities

This is a controlled adaptation of the original ETF Agent PDF acquisition, document-reading and extraction-execution responsibilities, not verbatim publication of its private implementation. Preserve byte identity, physical page identity, text identity, explicit acquisition, bounded work and failure/cancel distinctions. Reuse public Source, Result, Artifact, Host, Runtime and CLI. Necessary support: a bounded binary PDF format in the existing Artifact owner, typed PDF provenance in source/revision snapshots, and accurate non-synthetic provenance for operator-provided files. No new store or execution chain.

## Deliberate exclusions

No OCR, page images, visual/layout verification, tables, formula extraction, Web/network inputs, browser UI, search, RAG, queue/service, new credentials, provider calls or financial semantic qualification. No cross-process resume profile for an active PDF parse. Old immutable artifacts remain readable; no migration or general compatibility framework. Parser process/resource limits are not a security sandbox for arbitrary hostile files.
