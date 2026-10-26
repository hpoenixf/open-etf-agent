# Open ETF Agent — v0.1 local candidate

Not released; the mandatory authorized live exit is still blocked. Original implementation and synthetic fixtures against public PR #1. All 23 offline tests and independent npm ci/build/test/demo commands passed on Node 26.11.1, including three independently identified regression fixes. No private code/data. License selection/publication pending; private/UNLICENSED metadata prevents accidental npm publication.

## Independent commands

Node 26.11.1–26.x; zero third-party dependencies:

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
```

Build and demo were exercised through child-process tests and the independent npm commands above. The lockfile has no third-party packages; build only syntax-checks native ESM and copies src/fixtures into dist. It does not claim static type checking. `node dist/src/cli.mjs --case document-compare` runs the built copy with its own fixtures.

Default scripted gateway demonstrates plumbing, not real model quality. `--case T1` (or T2/T3/T4) selects one case but still records all four in the denominator, with others not-run. `--output ./runs` selects a trusted operator output root; models cannot choose paths. Live is blocked before reading credentials or making requests. The programmatic non-streaming Chat Completions adapter has not been tested against a real provider.

Each run creates report.md, manifest.json and run.jsonl. Manifest preserves original acquired page text/version/physical page/SHA-256 plus saved file identity and receipt. Source text is data, never permission. T3 separates difference 180 rows/export, total ratio 2.5, and increase ratio 1.5. Fixtures are original synthetic product guides, not real fund advice.

T4 readback is performed by the tests after the demo child process exits; the CLI itself does not launch a second reader or claim that the user opened a file. All semantics remain unreviewed; HTTP download is not-applicable. JSONL is diagnostic, not recovery control. No HTTP/DB/plugins/v0.2.

## Failures and local trust boundary

Tools reject unknown IDs/arguments and file paths. Writes use exclusive temporary files and no-overwrite publication. A report followed by manifest failure produces explicit partialEffects and no successful receipt. No write is automatically retried. A timed-out in-flight tool remains unknown; cancellation prevents later dispatch. Existing saved receipts survive independent logging failure.

Only local single-user, trusted output roots are supported. Static symlink ancestors are rejected before directory creation. This is not an OS sandbox against a hostile same-user process racing filesystem paths. File-set publication is not a multi-file transaction. No database, background execution or interrupted-run recovery is claimed.

See openspec/changes/v01-first-report for proposal, requirements, stable tasks and actual evidence; fixtures/cases.json retains four questions and semanticStatus unreviewed. The user-owned public Evidence Kit is pinned under tooling/ and was actually run: plan/apply structural checks passed; verify --check correctly refuses incomplete live/publication tasks. See docs/verification/kit-integration.md. This does not certify semantics or a release.
