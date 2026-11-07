# Once scheduled tasks (rebuild candidate)

This module is a bounded host for the existing Schedule, Project, Session and
Worker owners. It does not create a second job database. Confirmed definitions
remain immutable `tasks/<id>.json` records and their original schedule references;
Session owns confirmation, materialization, cancellation and the execution lease.

Use a Project with `report` and `schedule` capabilities. Import explicitly selected
sources first. The schedule JSON has exactly `scheduleId`, `definitionRevision`,
`scheduledInstant` (an explicit instant), `timeZone`, and `maxLatenessMs`. Confirm
before that instant. Lateness must be less than the Project timeout.

```
node src/research-cli.mjs schedule confirm --project PROJECT --run report-once \
  --question QUESTION.txt --manifest MANIFEST_SHA256 --schedule ONCE.json \
  --confirm-once --approve-provider --approve-data --approve-cost
node src/research-cli.mjs schedule list --project PROJECT
node src/research-cli.mjs schedule inspect --project PROJECT --run report-once
node src/research-cli.mjs schedule run-due --project PROJECT --limit 16
node src/research-cli.mjs schedule cancel --project PROJECT --run report-once
```

Confirmation, list, inspect and cancellation do not request a model. Live execution
uses only the Project's configured environment variable and its already confirmed
provider/data/cost grant and original Admission. Fixture execution is only for
programmatic tests, not the CLI. There is no daemon: an operator must invoke
`run-due`. It performs one serial sweep of at most 256 persisted task definitions
and attempts at most 1–32 eligible tasks (default 16). No cron, recurrence,
notifications, automatic external scheduler installation, or new provider exists.

Eligibility is read again after asynchronous control preparation. Original Runtime
materialization and Session claim remain authoritative for competing callers,
expiry and cancellation. The once host uses an opt-in, non-persisted freshness
observation returned only by the Session transaction that actually inserts the
Run. A competing caller that finds an existing Run does not automatically work
it, even if the first caller stopped before dispatch. Legacy materialization
returns remain unchanged by default. An expired occurrence becomes `missed`, not a new Run.
Completed, cancelled and already materialized occurrences are not automatically
run again. An interrupted or uncertain materialized Run must be inspected and, if
appropriate, explicitly resumed through the existing `run work` command. Its old
identity, reservations and unknown effects are never reset by a fresh sweep.
Ctrl-C stops the host cooperatively; it does not silently cancel persisted tasks.

Tests use real local Project/Session/Worker and synthetic fixture gateways. They
are offline mechanism checks, not proof of real model or service behavior. This is
new reconstruction from v0.24, not recovered old v0.25 source or qualification.
