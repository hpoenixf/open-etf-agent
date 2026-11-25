# Offline delivery evaluation / 离线交付测评

Run from the repository root with the supported Node version and installed dependencies:

```sh
npm run -s eval -- run --output runs/eval
npm run -s eval -- run --case T4 --output runs/eval
```

The first command runs the four public Atlas Notes fixtures; the second runs only T4. Each invocation creates a new evaluation directory (printed on stderr). Stdout is the machine-readable HTTP result. No provider key, live model, GUI or external service is required; localhost TCP must be available.

| File in the new directory | Purpose |
| --- | --- |
| `fixture-run.json` | Local fixture receipts and artifact paths. Keep it next to the artifacts for rechecks. |
| `artifacts/` | The generated report and revision/source data. |
| `http-evaluation.json` | Portable result for an evaluation consumer. Same raw four-case contract as `npm run -s evaluate`; no local directory or report text. |
| `eval-observations.json` | Local metadata-only correlation: each case, runtime run ID, receipt, readback status and timeline summary. Not part of the portable result contract. |

To independently re-read the stored bytes, use the original CLI. Substitute the directory printed by the run:

```sh
npm run -s evaluate -- --input runs/eval/eval-EXAMPLE/fixture-run.json
npm run -s eval -- compare runs/eval/eval-BASE/http-evaluation.json runs/eval/eval-NEXT/http-evaluation.json
```

Each executed case checks report bytes and content type against the receipt, revision identity, original source windows and attachment inventory over actual loopback HTTP. A failed readback is not a partial pass. With `--case T4` the other three remain `not-run`: one passed check is not a four-case pass. Comparison lists each case; a case skipped in either run is not comparable. A regression means the same case changed from passed to failed. Comparing saved results does not rerun the checks. Use recordings from the same fixture definitions and code/configuration relevant to your experiment. These are local unsigned receipts, not proof of origin.

Exit codes: **0** successful command (for comparison: no comparable regression), **1** unsuccessful selected case or comparable regression, **2** invalid invocation/input or runner setup error. Read the comparison coverage as well as its exit code. This is a scripted artifact-delivery check, not a score for research, model quality or financial accuracy; all cases retain `semanticStatus: unreviewed`.


## Reading the diagnosis / 如何排查

Compare three independent fields for each case: `runtime.status` tells whether the producer completed; `evaluation.status` tells whether the published report and evidence could be read back; `timeline.status` tells whether a matching local lifecycle log was observed. A report can pass even if the timeline is unavailable: observing it is not a prerequisite for delivery. `not-run`, `unavailable`, `incomplete` and `mismatch` are kept distinct. Timeline entries are observations before settlement, not an independent terminal decision. For diagnosis, the sidecar counts scripted fixture proposals and tool results; those counts are not live model calls or billed usage. The sidecar does not carry prompt text, source content, report body, paths, web URLs, or credentials and is not sent anywhere. This CLI does not configure or verify Langfuse.
