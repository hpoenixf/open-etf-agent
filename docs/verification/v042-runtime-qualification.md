# v0.42.0: Daily research runtime verification

The daily watch uses the original conversation and publication, with a stable daily identity in Asia/Shanghai. An unchanged question may compare against the last verified publication; edits, old failures and unavailable originals do not become a baseline. Optional digest delivery is disabled unless configured and the destination is separately verified.

## Observations

The native public-fixture run used application source tree
`8ef20d4b80fd0820403439ac23140d7126cb5f3f`, and an isolated service. The
[frozen qualification plan](https://github.com/hpoenixf/open-etf-agent/blob/8cdf429c7bb57bd645b5d9e4990df5b33e4a83fd/engineering/v042-qualification-transfer/plan.json)
contained ten prospective cases (six daily slots, four manual runs).

- **Runtime: 10/10.** All ten completed, saved an answer and read it back after reopening. All daily baseline identity checks passed. Nine cases reread their specified first-party sources; one intentionally unavailable page produced the expected recorded refusal and an honest completed answer. The two-source case recorded different original bytes for the two issuers.
- **Provider:** 20 physical model requests; all matched to included Go usage with zero extra charge. No unknown settlement in this cohort. The previous unsuccessful cohort is a separate observation and has not been rerun or removed.
- **Answer quality:** These Runtime passes do not certify all facts in the answers. Two examples: a bad UTC-to-Shanghai conversion by the model, and an inferred benchmark stated as if supported by a corporate-action notice. Neither changed the source receipts, watch baseline, publication, or History. The scheduler's simulated slot date was separate from the actual receipt time. No paid repetitions were used to replace these answers.
- **Offline checks:** the diagnostic source passed the prior full run (1,645 passes, 5 skips), and its exact source restack passed 25 focused checks. The release's package-version metadata does not change the application source.

## Boundaries

This validates the daily research runtime, not a GUI preview, owner production rollout,
financial correctness guarantee, or external email delivery. The optional email path
has only isolated synthetic SMTP verification; use the opt-in controls described in
the [daily-watch notes](../local-gui-daily-watch.md). No other staged module is included.
