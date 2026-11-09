# Project context byte budget

New Projects persist `contextBytes: 1048576` by default in their configuration. Set the top-level `contextBytes` explicitly to an integer from 1 through 1,048,576 to choose a smaller budget. This is a serialized application-context **byte** limit, not a model token window or a promise that every request fits.

Existing configuration and task records without this field retain their original interpretation: ordinary tasks use 32,000 bytes, Knowledge tasks use 1,048,576 bytes. Reading an old record does not insert a default or change its hash. The native `updateResearchProject` compare-and-swap operation can persist an explicit new value for future task admissions. Previously admitted tasks keep their frozen configuration. Supplying a revision without `contextBytes` retains the absent-field interpretation; callers should preserve the current field when making unrelated revisions.

The Runtime still retains the original question and latest complete tool group. It may replace eligible older source text with immutable references, but never silently truncates mandatory content. If the budget cannot be met, it fails closed before the next model dispatch. A saved report does not turn a failed task into a completed task.

The Gateway independently limits the **complete encoded request** to 1,048,576 bytes. Tool definitions, source provenance, JSON escaping and protocol envelopes consume that budget too. Thus a 1 MiB context setting does not reserve 1 MiB for source text, and additional encoding can cause an earlier refusal. No retry, automatic overage, or model-window enlargement is implied.

Compaction is a separate opt-in capability. Its existing default `compaction.thresholdBytes: 16000` remains unchanged; enabling a larger context does not silently increase the threshold or enable compaction. Configure that threshold explicitly if appropriate. Gateway-backed summaries can consume model reservations and must remain within the task and shared budgets. Increasing context alone neither grants extra requests nor changes billing approval.
