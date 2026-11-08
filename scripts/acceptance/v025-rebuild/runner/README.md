# Provider-free Scheduled tasks controls

These are controlled synthetic exercises of the original Project, Session, Admission,
Scheduled tasks and Reader. They do not read a provider key, allocate a real budget
or call a model. The synthetic gateway uses the real native parsing and adoption
path. There is no default live mode. `synthetic-authority.json` is only example
metadata, not user authorization.

From the repository root, choose an existing parent directory outside the source
tree for immutable test output, then run:

```sh
V025_STUB_OUTPUT_ROOT=/path/to/output-parent node --test scripts/acceptance/v025-rebuild/runner/sink.test.mjs
node scripts/acceptance/v025-rebuild/runner/stub-runner.mjs --synthetic-stub-only /path/to/output-parent/new-ten
node scripts/acceptance/v025-rebuild/runner/stub-runner.mjs --synthetic-stub-only /path/to/output-parent/new-last RB25-10 last
```

Each output directory must be new; no output, unknown, or unused allocation is
overwritten. The ten scenarios expect eleven reports, including two bounded
tasks in scenario 5. A second task that legally expires remains incomplete, not
a Runtime failure. Scenario 10 stops only at an original durable consumed-page
checkpoint with a settled response and no in-flight or unknown effect, then uses
explicit same-Run work. Cold checks use a fresh process and loopback HTTP.

The controlled expected answers are not model-quality evidence. Real acceptance
requires a separately reviewed live launcher, current authorization, durable
real accounting and a three-axis report. No live outcome is claimed here. The
plan records its historical preparation stage, not current dispatch approval.
