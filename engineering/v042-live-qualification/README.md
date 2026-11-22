# Open 0.42 #19: frozen real-cohort runner

Ten logical cases are frozen in `plan.json` (the digest is hard-coded in the runner). All fund references are public fixtures; **none are private holdings**. The candidate identity and source tree are checked independently. The approved six prior posts are **not** in the denominator and are not replayed. This runner uses no synthetic model, no paid search alternates, no Wind, no email, no PDF fixture or submission substitution.

## Dry verification

Run from this directory with Node 26.11.1: `node run.mjs --check` and `node --test ledger.test.mjs`. No external calls.

## Operator only

Use an exact clean checkout with lockfile dependencies already installed; an existing HTTPS/Go provider authority; a private configuration JSON using the pinned Go endpoint, real selected model and only `"connectivity":{"web":true,"search":"exa-public-preview"}`; exact limits in the plan. Never place secrets in JSON or arguments. Verify account allowance / no overage and give this process its authorized credential via `ETF_GUI_PROVIDER_KEY`. Verify the candidate had no current externally ambiguous request before execution. Choose two absent directories under an existing non-symlink staging parent, not in the checkout or production Project.

```sh
node run.mjs --source /absolute/pinned/checkout --config /private/approved-launch.json \
  --project /private/staging/new-project --ledger /private/staging/new-ledger \
  --max-provider-posts 49994 --authorize GO-042-ONE-REAL-COHORT
```

This **can actually send chargeable requests**. `--max-provider-posts` is the operator-authorized remaining campaign account ceiling, not model/tool settings changed by the runner. All model actions retain the known launch limits. Enable `--require-included-billing` to halt at the first complete logical Run whose native per-response receipts do not prove both Go allowance and zero cash charge. An explicit positive cost or balance source always halts. Missing cost metadata is reported as unverified, not reconstructed from credential presence. Whether further requests are authorized if proof is absent is an operator/account-policy decision.

The injected Asia/Shanghai clock controls only synthetic due dates; actual Runtime and source evidence timestamps retain real time. There is a single due-clock grant per original watch operation. `provider.jsonl` fsyncs a root/ordinal/wire digest witness before each physical POST and records whether headers arrived; that is not a settlement. Original native Admission and matching complete Main proposal records provide separate outcome/charge projections. The runner cannot resume, overwrite, or repeat an existing cohort directory. A known failure remains in the denominator rather than replaced; a remotely uncertain outcome stops the cohort (a pending case is never a pass). Do not create a new directory to repeat an unresolved original case. Keep the Project, ledger and immutable receipts for inspection.

## Grading

`observed_case` distinguishes same original Publication, a real GUI close/reopen with the same body hash, original native web receipts, actual source access, call evidence, and watch baseline linkage. It never auto-passes finance assertions. Inspect the original answer through its own private Project and compare it with the predeclared grade and actual acquired text. Cited dates refer to source evidence, not the simulated trigger or download timestamp. Record pass/fail and reason once for each of the original ten case IDs. Source unavailability is a grading exception only where the plan says so. A successful digest template, mocked SMTP transport, real mailbox evidence, and CI are separate release gates, not real logical research cases. The real inbox check still requires separately authorized receipt review; do not claim cash-free usage or successful delivery from a provider header alone.
