**English** | [简体中文](child-lifecycle.zh-CN.md)

# Asynchronous Child lifecycle (0.30 candidate)

This is a development candidate, not a released or real-model-qualified version. The [serial Child contract](child-execution.md) remains supported unchanged by `child-execution@1`.

## User outcome

Start a narrow, read-only check while Main continues its own work; inspect its original result, or cancel just that Child without cancelling unrelated work. Main remains responsible for the final report and whether a derived answer is useful.

Opt in through the existing project configuration, with the `child` capability:

```js
import {CLAIM_COMPARISON_METHOD} from './src/child.mjs';
const childExecution = {
  schemaVersion: 'child-execution@2',
  maxChildren: 2,
  maxConcurrent: 2,
  methods: [CLAIM_COMPARISON_METHOD]
};
```

`maxConcurrent` is an integer from 1 through `maxChildren`; the latter remains bounded by 8. These are operator-selected limits, not model-controlled grants. Existing tasks retain their original configuration.

## Model-visible operations

Each operation must be the only call in its tool response.

- `spawn_child({methodId, question, documents})` admits a Child from a frozen method and permitted document subset. It returns a stable reference, not an answer or evidence.
- `inspect_child({childRunId, waitMs?})` observes that exact direct Child. `waitMs` is bounded to 0–1000. Running and unknown observations contain no adopted sources; qualified terminal handoffs retain original source identity and derived-result ownership.
- `cancel_child({childRunId})` cancels that Child, not its Root. Repeating cancellation on a terminal Child is a no-op. The observation is source-free and never claims that a remote request has terminated.

The Session seals each observation against the original call and Child definition. A historical running observation remains running even if a later observation sees completion. Recovery reuses the original operation and Child identity instead of creating an independent retry.

## Stop, recover and inspect

```sh
node src/research-cli.mjs child list --project research-projects/my-project --run my-task
node src/research-cli.mjs child cancel --project research-projects/my-project --run my-task --child child-run-id
node src/research-cli.mjs run work --project research-projects/my-project --run my-task
```

Main finalization drains admitted Children under the original deadline. Host stop interrupts local workers and preserves the recovery checkpoint; it is not Root cancellation. A noncooperative provider can remain unknown after a local worker returns. In that case `effectsStopped:false` is retained, and a claim is not released merely because its local promise completed. Unknown dispatched requests remain charged and are not replayed. `run cancel` still cancels the whole Root.

Main and all Children compete for the same original Root budget. Child cancellation does not refund dispatched work, grant a replacement slot, renew a deadline or adopt a late answer.

## Qualification boundary

Synthetic checks cover simultaneous Children, cancellation isolation, immutable observations, original source projection, parent drain, commit/consume restart, cold CLI and noncooperative Host stop. Full regression and frozen real-workflow acceptance are separate gates. This candidate does not claim private-service parity, nested Children, peer messaging, broad partial-result streaming, independent provider routing, or new Response/Schedule/PDF/plugin composition support.


## Corrected-candidate qualification update

Separate candidate `2bfe816` now passed the frozen ten-workflow Runtime cohort, 89 zero-extra-cost requests and no new unknown. Earlier candidate statements above remain historical. [Qualification and semantic limits](verification/v030-release.md). This update does not itself assert tag/Release publication.
