# v0.27: project specialist profiles

[中文](v027-specialist-profiles.zh-CN.md) · [Project commands](research-project.md) · [Profile lifecycle](specialist-profiles.md)

This version has one primary module: an operator-managed, project-local catalog of specialist profiles and ordered presets. A profile selects an existing bounded Child method; it is not another Runtime, permission owner, provider router or budget.

## Configure, freeze, execute, read back

1. Enable the existing `child` capability in the Project configuration.
2. Initialize the catalog with `node src/research-cli.mjs specialist init --project DIR`.
3. Create an explicit profile with `specialist create --project DIR --id PROFILE_ID --profile PROFILE.json`. The file contains `name`, `description`, `enabled` and the admitted `method` descriptor.
4. Supply an exact selection using `run submit --specialists SELECTION.json`. For example, `{"profiles":[{"profileId":"PROFILE_ID","revision":1}],"maxChildren":1}` selects that revision, not a mutable latest profile.
5. Continue with the existing `run work`, `run inspect` and `run report` commands. Task admission freezes the selected methods; later catalog edits do not rewrite a submitted task or a resumed Child.

Use `node src/research-cli.mjs --help` for all required Project, question, source-manifest and authorization arguments. A profile does not itself run a model or grant source access.

## Supporting changes on existing owners

- Explicit `child-method@2` / `independent-evidence` input omits Main's local interpretation from Child task text while retaining the original parent audit call. Method, source grants, Root budgets and Child identity remain enforced.
- Host-owned working views can reference large derived results and a verified saved report while preserving original history and artifact bytes. `read_result` uses the existing paginated readback path; it does not turn derived text into source evidence.
- New tasks may request `--report-delivery artifact-required@1`. A Publication-only answer remains persisted but cannot complete that contract without a report artifact. No report is fabricated and no automatic retry is introduced. Scheduled and protected profiles do not support this opt-in contract.
- The default gateway supplies the official Go endpoint's native conversation metadata. Main and Child share their original Root conversation; other providers retain existing request behavior. See [protocol details](go-gateway-session.md).
- New tasks freeze the versioned report guidance; historical v1/v2 input bytes remain unchanged. Guidance is a reasoning aid, not a semantic validator.

## Boundaries

Existing Project, Session, Host, Child, Artifact and Reader owners retain execution, authority and recovery responsibilities. No parallel expert scheduler, automatic profile authoring, browser UI, arbitrary tools, autonomous retry or new provider access is added. Runtime completion and report readback do not guarantee answer quality.

Package metadata and the public code-lineage pin identify the source. Runtime qualification, safety review, final publisher verification and remote readback remain separate records; this functional overview does not substitute for them.
