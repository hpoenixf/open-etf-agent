# Reproducible evidence

## Temporal demo

Synthetic-only, local CLI example (Node 26.11.1; no provider or network):

```sh
mkdir -p test-output
session=$(mktemp -d "$(pwd -P)/test-output/a36-example.XXXXXX")
cat > "$session/calendar.json" <<'JSON'
{"schemaVersion":"venue-calendar-input@1","venue":"SYNTH-X","timeZone":"America/New_York","revision":"fixture-r1","coverage":{"from":"2026-03-06","through":"2026-03-10"},"rows":[{"date":"2026-03-06","status":"open","open":"2026-03-06T09:30:00.000-05:00","close":"2026-03-06T16:00:00.000-05:00"},{"date":"2026-03-07","status":"closed"},{"date":"2026-03-08","status":"closed"},{"date":"2026-03-09","status":"open","open":"2026-03-09T09:30:00.000-04:00","close":"2026-03-09T13:00:00.000-04:00"},{"date":"2026-03-10","status":"open","open":"2026-03-10T09:30:00.000-04:00","close":"2026-03-10T16:00:00.000-04:00"}]}
JSON
npm run temporal -- submit --session "$session" --run sample --time-zone Asia/Shanghai --anchor 2026-03-09T16:59:59.999Z --calendar "$session/calendar.json"
npm run temporal -- work --session "$session" --run sample
npm run temporal -- read --session "$session" --run sample
```

The admitted Shanghai task date is `2026-03-10`, and yesterday is `2026-03-09`. The New York venue date is `2026-03-09`, its phase is `open`, and the last completed session is `2026-03-06`. At the explicit 17:00 UTC early close, the last completed session becomes `2026-03-09`. Provenance contains revision `fixture-r1` and a SHA-256 digest. The fixture crosses the New York DST offset change and includes an explicit early close. A missing required row before the latest completed candidate yields unknown; a gap older than a known completed candidate or after the venue date does not invalidate it.

## Research CLI task-time input

For an existing project configured with `task-time` capability, provide the same shape in `task-time.json`:

```sh
npm run research -- run submit --project PROJECT_DIR --run sample --question QUESTION.txt --manifest MANIFEST_SHA256 --task-time task-time.json
npm run research -- run inspect --project PROJECT_DIR --run sample
```

Scheduled submissions with `marketCalendar` return `PROJECT_SCHEDULE_TASK_TIME_UNSUPPORTED`.

## Focused verification

Node 26.11.1 (33 passing tests in the selection):

```sh
fnm exec --using 26.11.1 node --test test/temporal.test.mjs test/temporal-cli.test.mjs test/research-project.test.mjs test/research-cli.test.mjs
openspec validate a36-trading-calendar --strict
fnm exec --using 26.11.1 npm run docs:check
fnm exec --using 26.11.1 npm run build
```

The cases include missing coverage, a closed date, the exact early-close boundary, offset changes across DST, the first day of a full coverage window across the date line, invalid timestamp rollovers, changed input on retry, unsafe file input, normal Research CLI admission and worker recovery, and unchanged legacy checkpoint projection. All behavior evidence uses synthetic data.
