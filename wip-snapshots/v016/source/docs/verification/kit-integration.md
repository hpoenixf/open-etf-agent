# Public Evidence Kit: source audit and actual execution

## Source and minimal dependency closure

User-owned official repository: https://github.com/hpoenixf/openspec-evidence-kit . Fixed commit: db6ac2f43cc0319fa0f10b4f73d67521d5209c88, package 0.1.0. The package identifies hpoenixf as author and the same repository as origin. MIT and NOTICE are retained in tooling/openspec-evidence-kit-db6ac2f; they do not select the application license.

The complete executable closure is bin/spec-evidence.mjs → src/evidence.mjs → node:crypto, node:fs, node:path. Both complete source files were read before execution. No networking, subprocess, eval, dynamic third-party import or credential access occurs. The lockfile contains only the root package; there are no runtime/dev dependencies or install hooks. The only package script is its test command, which was not run here.

All six materialized files were checked using Git blob SHA-1 (`blob <byte length>\0<content>`) against the connector's fixed-commit objects. Details are in [source manifest](../../tooling/openspec-evidence-kit-db6ac2f/source-manifest.json). All matched. No npm install was needed.

lint/status read selected local documents. verify may write only the target change's generated verify.md and remove its own newly created temporary directory; symlink/outside-root targets are rejected. This is ordinary local tooling, not an OS sandbox. The observed commands below use verify --check, which does not write a verification file.

## EV-12 — actual first integration, 2026-10-26

Existing Node 26.11.1, max heap 512 MB, timeout 60 seconds; working directory is the application root. CLI prefix for each actual command:

`node tooling/openspec-evidence-kit-db6ac2f/bin/spec-evidence.mjs`

| Arguments | Actual exit | Actual result |
| --- | --- | --- |
| lint --stage plan --root . --change v01-first-report | 0 | issues: []; structuralOnly: true |
| lint --stage apply --root . --change v01-first-report | 0 | issues: []; structuralOnly: true |
| status --root . --change v01-first-report | 0 | total 8, completed 5; completion not-recorded; release not-claimed |
| verify --check --root . --change v01-first-report | 1 | refused: incomplete task 1.6, incomplete task 1.7, incomplete task 1.8 |

The refusal is preserved, not relabelled a successful close. Task 1.6 can record the actual structural invocation; live and publication remain separate incomplete tasks. After recording this check, the updated ledger must be checked again. No generated verify.md or completion.json exists. Structural results neither authenticate historical executions nor assess model answers.

The first integration ran in roughly 0.21 seconds. Original JSON outputs remain ignored locally. This safe summary is the public-facing artifact, not raw logs. Existing application source and test inputs were not changed by materializing or running the kit.

## Updated-ledger check

After recording the real CHECK and completing task 1.6, the actual commands were repeated once: lint apply exit 0 with no issues; status exit 0 with 6/8 tasks and completion not-recorded; verify --check exit 1, refused only incomplete task 1.7 and incomplete task 1.8. No generated file was created. This second check took roughly 0.14 seconds and confirms the live/publication gates remain open.
