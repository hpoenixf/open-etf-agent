# v0.14 Memory consumer — local code qualification, publication pending

Baseline public main: `314de1b7246ff25f8fdd71d94ee21e46a9748fa3`. All 393 baseline blobs were independently checked against the recursive public Git tree before edits. No baseline root AGENTS.md exists. This evidence concerns a new consumer of the v0.5 Memory owner, not a newly invented recall/lifecycle implementation.

## Actual observations, 2026-10-29

| Gate | Actual result | Meaning / limit |
| --- | --- | --- |
| Root Spec/PLAN review | Accepted with metadata-only fixture clarification | No general prohibition on lawful Memory answer content; no new Runtime semantic/output gate. |
| Baseline RED, Node 26.11.1 | 3 tests: 1 pass / 2 fail | Original CLI rejects memory-recall + existing library, and rejects temporary flag. Genuine behavior failures, not import failures. |
| First focused GREEN | 9/9, 975.964 ms | New CLI/consumer tests; synthetic transport, no real provider calls. |
| Simpler consumer + affected regressions | 47/47, 7,325.846 ms | Test-only loader extension removed. New tests plus original Memory lifecycle/currentness/derived-note, Gateway and CLI regressions. |
| Final 0.14.0 complete original offline suite | 432/432, 59,117.464 ms; no skip/cancel | Node 26.11.1, single worker, 512 MiB V8 old-space bound; final executable/test/package input hashes unchanged before/after. |
| Final numbered original build | Exit 0 | Syntax-checked native ESM copy, not a TypeScript check. |
| Independent locked install/build/CLI/readback | 7/7 stages exit 0 | Offline npm ci --ignore-scripts; independent original-owner synthetic seed; dist CLI; Artifact and Memory fresh-process original identity/bytes; temporary missing-library completion. |
| Public code/phase/tag/release | Pending sole publisher | No remote mutation by this implementation task. |
| Article alignment / publication | Separate pending work | Does not block code qualification; no article synchronization claimed. |

The temporary CLI test preloads a filesystem interceptor covering the selected library's open/stat/lstat/realpath/readdir/readFile/access/opendir/mkdir operations. The normal synthetic task still completes against a configured missing library. The direct adapter has no Memory owner, bindings or working projection in temporary mode; it exposes no test loader extension.

The nonempty-library test compares the entire library file inventory before/after, independently reads the report bytes, and requires the actual consumed revision ID/hash in the report. A separate test keeps an existing writer open and proves its lock bytes unchanged by consumer open/close. Missing/corrupt/symlinked libraries fail without initialization or repair.

Real original-owner revise/forget happens after the original search returns and before the next Runtime dispatch. Actual Gateway encoded bodies contain no superseded/forgotten text; a new search after revise returns revision 2, while forget remains absent. Original projection and derived-note tests are retained unchanged. No new owner algorithm, schema, vector service, source grant or writer tool is introduced.

## Boundaries

All execution here is provider-free synthetic behavior through the original Runtime and original Chat Gateway encoder/normalizer with a fixed local fixture transport. It is not live-model adoption, model quality or investment evidence. Metadata-only report disclosure is this fixture's choice, not a new restriction on other lawful consumers. Memory remains preference context, never original source evidence or authorization.

Currentness is checked at the original bounded observations, without a cross-owner file/dispatch transaction. Already sent bytes cannot be withdrawn; the report does not become a retroactive revocation platform. No active-Run cross-version recovery qualification is claimed. Raw local logs, synthetic library databases/files and dependency trees are excluded from publication; only sanitized evidence is eligible.

## Final immutable candidate identity and independent delivery

Package and lock root identity are both `0.14.0`; dependencies did not change. The 154 final code/test/fixture/package/build inputs have inventory SHA-256 `b57825717777462422134ad3c528bfcb9733c2dc4d964382f95b6e4d09410f00`. The full suite/build and independent run used that same frozen candidate; the earlier 0.13-numbered focused run is not substituted for final qualification. [Portable structured receipt](../../../docs/verification/v014-memory-consumer.safe.json) lists input hashes and actual stage output hashes, not raw logs.

The independent report is 1,198 bytes, SHA-256 `fd3adb9ab6e4123dccee3fee926a6d557f0153c4349aa6b228ef4ad6a503d31f`, revision `revision:sha256:052992def59e73b048f98aa4dc5ea4dbba7815acdcc7fbc070fe8ab299082851`. An independent Artifact reader returned the same bytes/hash. A separate original Memory reader returned the same library/entry/revision/hash; the entire library file inventory remained unchanged. Temporary mode completed without creating the configured missing library. All library content used for these checks was newly generated synthetic test data, never migrated private Memory.

Reproduction on the supported Node 26 toolchain:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test --test-concurrency=1 test/memory-consumer-cli.test.mjs test/memory-consumer.test.mjs
node --test --test-concurrency=1 test/*.test.mjs
node scripts/build.mjs
```

The independent install in this observation used the existing official npm cache with `--offline` and empty npm configs. Test preparation uses the original Memory owner with an exact synthetic one-use intent; the consumer itself does not write or create Memory. Release ref creation, remote byte readback and required CI remain the sole publisher's separately recorded gates. Local success does not imply them.
