# Design

The CLI reads the exact original publication through the existing read-only Session API. That owner validates the root scope, original committed event, revision chain, content hash, and binding. Child and protected-profile publications are outside the local feedback path. An ordinary unscheduled research project stores its task Session under `PROJECT/sessions/RUN_ID`. The CLI takes that Session directory explicitly.

Submit requires the original revision and publication payload hash. The per-Session SQLite file records the client key, Run, revision, hash, rating, optional reason, and status. It contains no copy of the answer. Both schema initialization and writes are transactional. The first identical submission from concurrent processes wins, and all exact retries get the same persisted record. Different data under the same key conflicts. Withdrawal sets a durable tombstone. It retains the original local feedback fields so a delayed submit cannot reactivate the record.

Feedback reads and withdrawals revalidate the original publication identity. An absent feedback read never initializes storage. A missing, unsupported, or unverifiable publication cannot accept feedback. The store uses owner file permissions and refuses linked database files and sidecars. There are no external effects.

## CLI example

Use Node 26.11.1, installed dependencies and jq. This example starts the existing synthetic publication case, then runs each feedback operation in a new process.

```sh
mkdir -p test-output
session=$(mktemp -d "$(pwd -P)/test-output/a40-example.XXXXXX")
outcome=$(node src/session-cli.mjs start --session "$session" --case durable-publication)
run=$(printf '%s\n' "$outcome" | jq -r .runId)
receipt=$(node src/answer-feedback-cli.mjs identity --session "$session" --run "$run" --revision 1)
hash=$(printf '%s\n' "$receipt" | jq -r .receipt.payloadHash)
submit() {
  node src/answer-feedback-cli.mjs submit --session "$session" --run "$run" \
    --revision 1 --expected-hash "$hash" --key fixture-feedback --rating 5 --reason 'Synthetic review'
}
submit
submit
node src/answer-feedback-cli.mjs read --session "$session" --key fixture-feedback
node src/answer-feedback-cli.mjs withdraw --session "$session" --key fixture-feedback
submit
node src/answer-feedback-cli.mjs read --session "$session" --key fixture-feedback
```
