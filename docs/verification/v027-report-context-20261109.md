# v0.27 report-context follow-up

Status: implementation under verification, not a release qualification.

## Real observation, fixed source

S03 ran against `85b0208bc58f8f7a60877d4b2bafa2fe46875ab6` with a 16 KiB Main/Child context. Five provider requests were accepted and adopted, with no new unknown. The Child completed and Main consumed its result. A report of 8,676 bytes was saved, but the subsequent model preparation failed with `CONTEXT_CAPACITY_EXCEEDED`. The harness exited normally; the product task did not succeed. No source-selection or derived-pagination read occurred, and cold coverage was not reached. Earlier S02 unknown and reservations remain accounted for.

The semantic review separately found confusion between necessary and sufficient conditions and between submission and acceptance. Transport success, artifact persistence, and context repair do not fix or erase those semantic findings.

## Mechanism

The existing context fitter projected large tool results but retained complete historical assistant tool arguments, including the saved report body. This could leave too little capacity for the model's normal final turn even after a report was durably saved.

New tasks select `host-results@3`; historical absent/@1/@2 tasks retain their frozen policy. The new policy extends the existing Host-owned working view, not a second summary service. Only a successfully dispatched `save_report` pair can receive a report-text reference. Host checks the original call ID, receipt, original text, source basis, save-time calculations, artifact/revision identity and actual stored bytes. Rendering uses the same report renderer as persistence, including automatically appended evidence sections. Input-text and complete-file hashes are explicitly distinct.

Original call/result history, report text, attachments and checkpoint truth remain complete. Only the model-facing working view changes. Tool pairing and all other arguments remain intact. Recovery compares each report call and receipt against its original pair and regenerates the allowed projection; changed or missing identities are rejected. Failed, unknown, partial, protected or hooked saves are not projected. A saved report is still not task completion: the normal model/runtime terminal path must finish.

## Architectural comparison

Private's `research-model-adapter-utils.ts` fits replayable Host-owned tool-result locators. Its `main-run-context-compaction.ts` binds transcript groups, original argument hashes and receipts before producing a derived view. It does not implement arbitrary report-argument truncation. This change follows the shared separation of immutable evidence from a verified working projection; it does not claim private has an identical special case.

## Validation boundary

Targeted offline coverage includes full-text retention, capacity fitting, old policy behavior, tamper rejection, save-time basis after later calculations, and save → pause → resume → normal terminal without replay. Full-suite fixed-source results and a new real acceptance must be recorded separately. Prior live findings are not upgraded by offline tests. No release, task-success, semantic-quality or live-pagination claim is made here.
