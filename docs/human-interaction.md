# Ordinary questions in a local research project

This v0.21 implementation passed fixed-source offline and real-task qualification; publication remains pending. See [qualification and limits](verification/v021-release.md).

A task can ask for missing facts, wait without an active worker, accept an explicitly associated answer and continue the same Run. An answer is untrusted task data. It does not approve a purchase, expand a document grant or authorize a Memory write.

## Opt in for new tasks

In a reviewed research-project configuration, include the `response` capability alongside `report`, and add:

```json
"interaction": {"schemaVersion":"human-interaction@1","maxQuestions":3}
```

The supported maximum is1–8. If the interaction object explicitly exists but maxQuestions is omitted, project init/update supplies3. Existing projects without this object retain their original one-question profile. Use the existing compare-and-swap project update for future tasks; already submitted tasks keep their original configuration. Schema6 is explicit and older readers reject it, rather than silently reinterpret it.

Provider, selected-data and cost approvals are still required for live submission. See [research projects](research-project.md) for import, submit and work. Waiting does not extend the original task deadline or reset its budget.

## Find, answer and resume

```sh
node dist/src/research-cli.mjs interaction list --project PROJECT
node dist/src/research-cli.mjs interaction list --project PROJECT --run TASK
node dist/src/research-cli.mjs interaction inspect --project PROJECT --run TASK --question-id QUESTION
node dist/src/research-cli.mjs run respond --project PROJECT --run TASK --question-id QUESTION --response-id RESPONSE --text ANSWER_FILE
node dist/src/research-cli.mjs run work --project PROJECT --run TASK
node dist/src/research-cli.mjs run report --project PROJECT --run TASK
```

Use the exact identifiers returned by list/inspect, not identifiers extracted from model prose. Pick a response ID once and reuse it only for an identical retry. A conflicting answer is refused. Inspect exposes the original question and received answer; keep those outputs private when they contain private data.

`awaiting-response` means no receipt; `received-not-adopted` means the reply is stored but not yet consumed. `adopted` means its original tool-result checkpoint was committed, not that the model obeyed it or any requested external effect occurred. `expired` and `unavailable` preserve the original facts without reopening the Run. An already adopted response remains an adoption fact after cancellation; it is not evidence of a successful report.

The list returns at most50 items and an optional nextAfter cursor. Pass it unchanged using `--after`. A whole-project scan is bounded to256 task records; use `--run` for a particular task beyond that bound. Listing and inspection never invoke a model. A new question is allowed only after the previous answer was adopted, within the configured question count and original root limits.

## Recovery and limits

Keep the complete project directory. Restart `run work` on the same task after a known stop; never submit a substitute to bypass an unknown request. Exact response retries remain receipts even if the task has since expired or been cancelled; new replies cannot revive it. Question receipt and adoption survive process exits through original Session transactions.

Only ordinary blocking questions are supported here. Child-targeted questions, Response+Schedule, external-effect approval, new permission grants, non-blocking chat intervention and continuation of a terminal task are not enabled. The trusted local filesystem/operator is the identity boundary; this is not a remote multi-user inbox or authentication service.

If a task record was saved but its Session Run was not yet created, the inbox returns `INTERACTION_RUN_NOT_MATERIALIZED` in its bounded warnings and keeps other questions visible. It does not recreate or execute that task. Schema, identity and integrity errors still stop the read instead of being hidden.
