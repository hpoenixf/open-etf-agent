**English** | [简体中文](child-execution.zh-CN.md)

# Bounded Child execution

v0.22 provides bounded Child execution. See the [staged qualification and limits](verification/v022-release.md). It extends the existing project/Runtime path; the old one-off `source_check` remains available unchanged.

## What it does
A research project can admit several immutable read-only methods. Main selects one method, a local question and a narrow subset of the already admitted sources. That Child runs in its own context and returns a derived summary plus verified original source references. Main may perform another independent check before producing the final report.

Each execution retains its original parent call, Child Run, root grant, method, source scope, deadline and root-budget usage. A failed Child still consumes its execution slot. Reading or restarting a task cannot turn unknown dispatched work into a fresh attempt.

## Opt into the new contract
Use the existing project initializer/update API or JSON CLI configuration. Keep your selected Gateway, limits and data approvals. Add the `child` capability and this field:

```js
import {CLAIM_COMPARISON_METHOD} from './src/child.mjs';

const childExecution = {
  schemaVersion: 'child-execution@1',
  maxChildren: 2,
  methods: [CLAIM_COMPARISON_METHOD]
};
```

`maxChildren` and method count are each 1–8. Each method uses the existing `child-method@1` descriptor and content hash. The allowed tools remain `read_page` and optionally `read_result`; each execution selects at most two documents even when the project catalog has more. The model cannot supply a new method, tool grant or budget. `childExecution` and legacy `childMethod` are mutually exclusive. Omitting `childExecution` preserves the original single `source_check` behavior.

The new model tool is `delegate_child`, with exactly `methodId`, `question` and `documents` arguments. Main must issue it alone in a tool-call response. The model can use sequential checks within the original execution limit; this is not parallel background execution.

When a declared `delegate_child` field is missing or has the wrong shape, the original Child owner can prove a JSON-stable, single-call refusal before dispatch. This creates no Child and spends no tool debit. The original Runtime may offer at most one correction across the Run: the model must supply complete arguments in a new call, preserving the same root budget and call/result pairing. `documents` is never filled automatically or replaced with the full source scope. Unknown methods, unauthorized documents or scopes, input limits, hooks, protected execution, partial effects and unknown outcomes do not receive this input-correction proof. Cold recovery verifies the original persisted refusal; an already failed task is not reopened.

Project updates affect future tasks. An already submitted task keeps its own original configuration and method hashes. No automatic migration or compatibility with an older project reader is claimed.

## Inspect and continue

```sh
node src/research-cli.mjs child list --project research-projects/my-project --run my-task
node src/research-cli.mjs run work --project research-projects/my-project --run my-task
```

`child list` is read-only and never invokes a model. It reports:

- Original Child Run, parent call, method, selected documents and actual deadline.
- Actual execution status and checkpoint phase, separately from known/unknown request disposition.
- Original root usage and execution slots. `admissionBlocked` explains why a remaining slot is not currently executable.
- `not-consumed`, `committed-not-consumed` or `consumed` for Main's original handoff.
- Verified sources and derived result only when a known terminal result is available.

Repeat `run work` to continue the same task. After a safe stop, the original parent reconciles the same Child under its remaining deadline and budget. It may wait for that Child's existing lease to expire after a crash. A model-reserved checkpoint cannot prove that the request did not run; it stops as unknown rather than replaying. A settled Child is verified and read, not executed again.

Ctrl-C/SIGTERM stops the Host cooperatively. `run cancel` cancels the original root and all children. There is no independent Child-cancel command in this version.

## Composition and limits
Main retains Memory write and publication responsibility. Existing supported Main-side Memory, calculation/CSV, task-time and managed-compaction paths are separate from Child tool authority. An earlier Child's derived summary or Main tool history is not automatically inserted into another Child's context.

When Main supplies `create_csv.rows` as a string instead of an array, the original ordinary Host refuses it before dispatch. This version lets that exact, JSON-stable, type-only refusal use the existing single correction opportunity: the model must submit a new call with an actual array of string arrays. The Host never parses the string or creates an artifact from it. Original root budget, rounds, deadline, cancellation and call identities still apply. Mixed calls, hooks, protected execution, unknown work, partial effects, other CSV validation failures and artifact I/O failures do not receive this new proof. An already failed task is not reopened by upgrading.

Response+Child, Schedule+Child, PDF+Child and trusted-plugin+Child remain explicitly unsupported. Nested, parallel/background children, peer messages, terminal continuation, dynamic profiles and independent provider routing are not included. The new mechanism does not claim parity with a full multi-user or private research service.

## Check the evidence
The [staged qualification](verification/v022-release.md), [proposal](../openspec/changes/v022-child-execution/proposal.md) and [evidence chronology](../openspec/changes/v022-child-execution/evidence.md) preserve distinct source and execution stages. The accepted basis is nine original mechanical successes out of ten, with C06's original measurement failure and independent successful readback supplement retained. This is not one continuous 10/10 batch. Free tests, remote CI and actual publication remain separate facts.

## Child summary delivery size

New methods use `output: {}` with no dedicated Child summary byte ceiling. The built-in comparison method is version 3. Summaries are not truncated, and the former ceiling is not replaced with a larger fixed threshold.

Legacy `child-method@1` descriptors retain their original valid `output.maxSummaryBytes` value (1–16000) as immutable identity metadata, **not a delivery limit**. Stored descriptors, bindings and questions are not rewritten. Legacy questions reconstruct their original byte-bound wording for exact recovery; that wording does not reinstate enforcement. New methods omit that wording. Previously failed tasks stay failed and are not automatically rerun or relabeled as successful.

Runtime final-answer capacity, Gateway request capacity, context, source authority, execution counts, time and cost boundaries remain separate and enforced. A large intact Child answer may still exceed context capacity. This change adds no paginated handoff, automatic continuation or truncation.
