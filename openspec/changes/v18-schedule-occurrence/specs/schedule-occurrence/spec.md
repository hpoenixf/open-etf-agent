# Schedule Occurrence contract

## Confirmation and identity
A trusted local caller MUST confirm an exact immutable revision, UTC instant, explicit time zone, lateness, grant, adapter/Gateway binding, public document/tool scope, budget and original initial Runtime checkpoint. One schedule ID admits one confirmation. Exact retry MUST return its old fact even after due/cancel. Different content or revision MUST reject; revision requires cancelling the old ID and explicitly confirming a new ID. Models cannot supply authority.

## Time and finite authority
Confirmation MUST be before the instant. maxLatenessMs MUST be a positive safe integer less than the confirmed timeoutMs, with no independent five-minute cap. Original Runtime timeout admission remains at most one hour. TaskTime anchor MUST be the scheduled instant and Run deadline MUST equal that instant plus timeout. The due interval is inclusive-start/exclusive-end. Before start returns not-due; at/after end persists missed with zero Run. Existing materialization takes precedence over late-window checking. Repeated wake MUST NOT reset deadline, TaskTime or spent budgets.

## Atomic materialization and withdrawal
Schema5 MUST be explicit new-database opt-in. Every original Run in schema5 MUST have one occurrence link. Ordinary create MUST refuse. Only the existing Session synchronous insertion owner may create the root/Run inside the same short transaction as the link. No tool/model, async callback, network request or new lease enters that transaction. Any failure rolls back all SQL writes. A filesystem preallocation can remain after a crash and is not an execution receipt.

Wake MUST validate full confirmation identity; deterministic Run ID alone is not sufficient. Duplicate/cross-process/ACK-loss wake returns the same Run. Occurrence state does not duplicate execution state. Cancel/revoke before materialization creates no Run; after materialization it retains the link and atomically delegates to original cancelRoot. Unknown dispatch facts and budgets MUST survive. Existing committed outputs remain readable; cancellation does not prove remote work stopped.

## Existing execution and output owners
Only existing Runtime submit preparation and Worker run/lease/fence drive execution. The original Admission reservation brand and queue/unknown semantics MUST remain unchanged. Initial scope has exactly read_page/save_report and atlas-a/atlas-b, report+Publication, no plugins/hooks/extensions/workingInput/PDF/protected/ordinary/Child. Synthetic CLI assembly is fixed; no credentials/provider flags are added.

Original Publication body/receipt and Artifact Reader bytes remain the output facts. Read-only schedule inspection MUST validate frozen identity and original Run linkage without running a model or mutating/recovering a DB. Old2/3/4 databases MUST not be migrated or written by schema5 opt-in. Old Session code MUST fail-closed on5. Corrupt schema, hash, orphan or wrong definition MUST fail admission.

## API error delivery
`confirmScheduledRun` returns the original asynchronous Runtime preparation. `materializeScheduledRun` first reads and validates the persisted reference synchronously, then returns that asynchronous preparation; a malformed/unknown/mismatched reference can therefore throw synchronously. Callers must not assume every rejection is delivered by Promise. No synchronous validation failure starts model/tool work.
