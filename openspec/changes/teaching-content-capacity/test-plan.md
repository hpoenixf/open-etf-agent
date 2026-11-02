# Focused provider-free validation

Initial RED candidates use unchanged production sources. They are prepared, not yet executed; a coordinated execution window is required before any Node command.

1. 22,000 Han characters: actual Runtime final -> Publication commit -> terminal -> closed/reopened Session readback, exact body and receipt.
2. 63,000 quote characters: complete OpenAI-shaped function JSON -> original Tool Host `save_report` -> immutable report bytes and receipt -> final completion. No real transport is used.
3. A valid small answer split into 4,000 SSE frames: aggregate framing exceeds old 256 KiB, but complete finish and DONE still normalize the exact answer.
4. Maximum 256 KiB control-character final: sixfold JSON expansion, complete response, checkpoint/Publication write and reopen; no body truncation.
5. Finite caps still reject oversized UTF-8 body and wire; `length`, malformed JSON, conflicting IDs, scope/receipt mismatch and cancelled execution still fail their original protected effects.
6. Exact readback in a separate process and terminal resume must not invoke a model or regenerate a report. Existing immutable Artifact readability and old active catalog mismatch are checked directly.

Run only affected suites selected after RED; do not claim full-suite, live-provider or semantic qualification. No repeated paid run or historical-version sweep is planned.
