# v0.16 / v0.17 WIP — runnable branch root, not a release

This WIP integrates current main `34124cefc6df289e08518173789210b45a716451` with document revocation and local shared admission. Main's portfolio-rebalance demo, README, package/lock identity and existing fixes are retained. `package.json` intentionally keeps the main version; it does not advertise a released v0.16/v0.17 package.

## Verified offline

- Fixed integrated input manifest SHA-256: `47184c85ef057bd50af9e61978f7305494e41e39e93c6bb4e8186795d931999f`.
- 470 input files; 90 test files; **556 passed, 0 failed, 0 skipped** in 71.385 seconds.
- Native ESM build passed in 1.672 seconds. Both owned process groups stopped and leaders were waited; no timeout, orphan or input drift.
- No paid/model calls or external network calls. Fixture-only revocation still explicitly requires Report and Publication; shared admission covers two local callers and one fixed-route group, not account-wide quotas or arbitrary clients.

With Node 26 and dependencies installed using the existing README instructions, run these verified local examples from this branch root:

```sh
node src/admission-demo.mjs normal
node src/admission-demo.mjs unknown
```

Both start synthetic loopback HTTP and local processes, not external model services. They retain synthetic local evidence under `output/admission-demo/`; do not upload those databases or raw run logs. See [shared admission](doc/shared-admission.md) and [document revocation](docs/revocable-documents.md).

## Recovery and limits

Historical, independently recoverable snapshots are preserved at [v0.16](wip-snapshots/v016/manifest.safe.json) and [v0.17](wip-snapshots/v017/manifest.safe.json). Those older-base snapshots are not substitutes for this integrated root. Earlier failed fixture runs remain recorded; the final integrated suite does not erase them.

Code/test bytes correspond to the fixed executed inputs. Subsequent changes are engineering evidence/documentation only; the backup manifest records exact mappings and the replacement of a machine-specific Node executable path in v0.16's safe receipt with `node`.

Paid evaluation is paused. No main update, tag, Release, deployment, live-provider acceptance or Spec archive is claimed. Existing checkpoint/Host definitions are not automatically migrated; revocation cannot retract already disclosed bytes, and this evidence does not prove every maximum-size combination or arbitrary concurrency stress. WIP backup is not product acceptance.
