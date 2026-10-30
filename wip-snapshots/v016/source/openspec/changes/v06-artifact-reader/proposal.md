# v0.6 — bytes that a reader actually receives

The v0.5 candidate can save and locally reopen reports, but has no HTTP download contract. Following the fixed public PR #1 roadmap (c390eb2), deepen its ordinary save responsibility into one Report/Artifact module rather than adding a second Run or source owner. A loopback-only read service exposes immutable artifact and revision IDs; refresh never invokes a model or restarts research.

Keep Markdown compatibility and provenance, add deterministic CSV attachments and explicit HTML/SVG download-only handling. No Web Chat, background worker, database, plugin, recovery or public hosting. Runtime correctness and byte/source fidelity are acceptance gates; model prose quality is informational. Existing real-model evidence remains historical and does not prove this new reader. No extra provider calls are planned.
