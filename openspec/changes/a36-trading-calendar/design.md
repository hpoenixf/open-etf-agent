# Design

`src/temporal.mjs` remains the owner. It normalizes a calendar covering at most 366 actual days, hashes its canonical accepted shape, and accepts only offset-bearing session endpoints which map to the declared venue date. It attaches a derived `trading-calendar@1` result to the existing `task-time@1` value only when opted in. Existing task-time records and their projected message bytes remain valid.

The normalized input is retained in durable admission for recomputation, while the model receives one JSON value containing fixed task dates and resolved calendar facts/provenance. Runtime's existing config binding and `projectTaskTime` path provide immutable admission and normal Context projection. The temporal CLI uses bounded no-follow input reads. Research CLI `--task-time JSON_FILE` uses existing bounded project JSON input and Project reconstructs the admitted calendar for Worker execution. Scheduled project tasks reject calendar opt-in.
