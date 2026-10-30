# v0.8 Publication-only runtime observations

Local runtime qualification, 2026-10-27. No formal release, model-quality or browser claim. Public base: `cb735e40021ecb6916de9bc3e2ec086534baefba`.

## One module and its authority

This version adapts the original ETF Agent Publication contracts to the already-qualified public Runtime/Session/Artifact owners. It does not reproduce private implementation bytes or the complete original owner. See the [retained/adapted/excluded mapping](../evolution/v08-publication-lineage.md).

The minimal loop is synthetic final text → independent SQLite body/current-event commit → selected Run/revision CLI read. One stable Host block and delivery ordinal survive explicit CAS replacements. Exact text **and** protected bindings return the original receipt. A later failed or cancelled Run cannot erase the committed body. Recovery confirms stored identity instead of appending another revision or calling the fixture model again.

Supporting changes are confined to the existing Session transaction, Runtime final branch and session CLI/demo assembly. No new package, Worker, queue, Web Chat, HTTP/SSE product surface, global History or authentication system is included.

## Observed gates

Node **26.11.1**, heap 512 MiB, serial execution, synthetic inputs, real local SQLite. The supported engine interval `>=26.8.1 <27` is not a claim that every patch version was tested locally.

| Gate | Actual outcome | Evidence |
| --- | --- | --- |
| Pre-implementation contract RED | 19/19 failed; loadable behavioral/API failures, not missing imports | [RED](v08-publication-red.safe.json) |
| Focused Owner/Runtime/CLI GREEN | 23/23 passed; real transaction rollback, two connections and killed/restarted processes | [GREEN](v08-publication-green.safe.json) |
| Final provider-free suite | 286/286 passed, no skipped/cancelled tests; 32.672 seconds | [full-suite receipt](v08-observations.safe.json) |
| Independent locked installation | 95 existing packages from the existing offline cache; no install hooks or new dependency graph | [delivery receipt](v08-independent-delivery.safe.json) |
| Independent build/delivery | 54 built source/fixture hashes matched; five distinct CLI processes started/read/read event/read revisions/resumed | [delivery receipt](v08-independent-delivery.safe.json) |
| Artifact separation | Current 764-byte report and actual retained v0.6 933-byte Artifact read back; old bytes unchanged | [delivery receipt](v08-independent-delivery.safe.json) |
| Evidence Kit | Three tasks recorded-complete; verify current and structural lints clear | [generated view](../../openspec/changes/v08-publication-only/verify.md) |

The original RED contains 12 Owner and seven Runtime cases. Three CLI cases were authored alongside their adapter; the additional JSON-escaping boundary case was added during static review. Neither is represented as a separate observed RED. The full-suite count includes 249 existing v0.7 cases, 14 article-coverage checker cases and 23 Publication cases. It does **not** reuse the older expanded candidate's 298-test qualification.

## Exact inputs and metadata-only promotion

The 286-case run and first independent delivery used `0.8.0-dev.0` and the [119-file input snapshot](v08-candidate-inputs.json):

`bbef17375feea95e05fa32dd5aa20bc2df102209b9ae048a6aa29f04833c04ee`

The publication candidate changes only version fields in `package.json` and `package-lock.json` to `0.8.0`. The other 117 inputs and all 95 dependency lock entries are unchanged. The [new snapshot](v08-publication-inputs.json) is:

`caf5be631011562b024d2c4d62f26c4391048625a79ec8dedaea5dfab69a1711`

The [metadata promotion receipt](v08-metadata-promotion.safe.json) records the necessary narrow version/install/build checks. **286 tests were not rerun under the new aggregate digest.** Their behavioral applicability rests on the recorded byte equality, not an invented run. `private: true` remains set; no npm publication, Git tag or GitHub Release is claimed.

## Reproduce the module

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node --test --test-concurrency=1 test/publication.test.mjs test/publication-runtime.test.mjs test/publication-cli.test.mjs
node dist/src/session-cli.mjs start --session ./runs/publication-demo --case durable-publication
# Use the runId returned above; these commands only read selected persisted facts.
node dist/src/session-cli.mjs publication --session ./runs/publication-demo --run RUN_ID
node dist/src/session-cli.mjs publication --session ./runs/publication-demo --run RUN_ID --revision 1
node dist/src/session-cli.mjs publication-event --session ./runs/publication-demo --run RUN_ID
node dist/src/session-cli.mjs publication-revisions --session ./runs/publication-demo --run RUN_ID
node dist/src/session-cli.mjs resume --session ./runs/publication-demo --run RUN_ID
```

The fixture uses no live model. Publication body and report Artifact remain separate authorities. Reads do not create a missing Session or acquire execution authority. Unknown schema/identity still fails closed; existing immutable Artifact reads are not an active-Session migration guarantee.

## Completion and remaining publication gates

The existing Kit exposes `lint`, `verify` and `status`, not an archive/release command. Its **recorded-complete** result means all three scoped tasks have recorded provider-free evidence. The change stays in `openspec/changes/v08-publication-only`; formal archival and remote publication are not claimed. Existing versions retain their evidence in `openspec/changes/`; no repository-specific move/archive procedure is configured. After the fixed source, coverage, README, article and site gates are actually complete, the owner can register a dated closure while preserving those evidence links. A later manual archive would be an explicit documentation operation, not a Kit execution result. Semantic quality remains unreviewed. No new provider calls were made.

The amended scope and earlier failures are preserved: the expanded Web/Worker candidate is recoverable separately, with its browser acceptance still blocked. None of that implementation or its 298-test denominator belongs to this publication-only packet.

The publisher must establish a fixed public v0.8 source, then refresh the existing article source inventory, run its actual smoke/check, preserve the main README presentation and rebind the verification index. The current v0.7 README/coverage records are deliberately not relabelled as v0.8. An incremental update to existing article 019 is a separate draft; article and new-domain publication completion remain independent of local code qualification.
