# Open ETF Agent: one release artifact, two configurations

**Contract:** Stage and production consume the identical reviewed artifact SHA-256
from an immutable release tag/commit. Publish the artifact once; do not rerun the
build on either host or apply executable overlays after unpacking. The host
records the source commit, artifact SHA-256 and revision of its non-secret
configuration manifest. Environment-specific config, credentials, routing and
state stay outside the release directory.

## Prepare and promote

1. Check out the approved release from Git. Build on the target CPU/OS (and
   compatible libc), using pinned Node and lockfile. Invoke
   `build-open-release.sh CHECKOUT COMMIT TREE NEW_OUTPUT_DIR`. The script
   builds from Git's committed tree, not the worktree, and writes the artifact,
   SHA-256, and a source/toolchain receipt. For the v1.0.4 baseline use
   `a61717b9a2ff004ebc5f6e0f457f10147efc9e84` and
   `eab720a3e9184a233abfaf03c7f3b9d331ab28c3`.
2. Keep deployment scripts, service/unit templates and a non-secret config schema
   under review in Git. For owner-only deployment code or private adapters use
   the private infrastructure repository; Git for this contract can be the
   public source ref plus a separately pinned private release/build manifest.
   Never copy deployed overlay files, logs, user data or credential values into
   the public repository. If private code is required, include it in the same
   reviewed release artifact for both environments; environment flags switch it
   on or off.
3. Verify the artifact digest against the trusted release record; unpack into a
   fresh immutable release directory. Put app files under a non-writable tree
   accessible to the service account (e.g. root-owned directory with group
   read/traverse), secrets at restricted modes, and writable state separately.
   Under the actual systemd service identity, check directory traversal,
   readable entrypoint and runtime, readable config, and writable state before
   restarting. Do not recursively relax permissions on the credentials or data.
4. Activate Stage first using an atomically replaced `current` symlink or
   equivalent platform release pointer. Verify live runtime commit/digest using
   the deploy receipt and resolved process entrypoint; confirm service starts,
   authenticated UI/CLI result reaches a useful terminal answer, and relevant
   changed paths are tested. Verify Stage jobs/observability use Stage state and
   recipients. When approved, promote that **same digest** to production and
   confirm health and artifact identity there. Record both results in the
   server-side release manifest. Keep the prior digest and its config revision.
5. If code startup/smoke fails, restore the last known-good artifact pointer and
   config pair. Database migration is a separate decision: keep a pre-migration
   snapshot and recovery plan; do not start an older process against a newer
   schema unless its compatibility was checked.

## Fresh-host recovery

- Restore infrastructure from pinned templates: OS/architecture, Node,
  systemd/reverse proxy, certificates/DNS bindings, service user and capabilities.
- Restore the approved environment config and separately recover credentials
  from the authorized secret store. Check references without printing values.
- Restore backups into an isolated target: database/schema, scheduler state and
  send/deduplication ledger, and any user-approved file/object data. If both
  environments share a database service, provision different database/roles or
  equivalently strong state isolation. Never point Stage at production-owned data
  or live recipients. Keep scheduler and mail sending disabled until validation.
- Reinstall the approved digest (or rebuild from its pinned manifest if artifacts
  are lost), check restore completeness on representative data, then enable jobs
  only once ownership and idempotency have been verified. Record recovered
  artifact/config/backup IDs, elapsed time and the backup's age. A file-free
  synthetic build smoke does not demonstrate data restoration or delivery.
- Using the exact approved app and configuration revisions, first verify in
  isolation that old saved bodies can be read back and that representative jobs
  retain their owner, scheduled occurrence and send/deduplication state after
  restart. Disable outbound delivery or redirect it to a test sink; the test
  must not send to real recipients. Verify no duplicate scheduled delivery and
  audit the same file/code digest before and after the exercise.

## Check environment parity before adopting this release procedure

Compare the effective Stage and production executables against the tracked
source pins. If either environment still uses local executable changes, port
them to an authorized source repository and include those reviewed modules in
the same release artifact. Do not assume a working hosted environment can be
recovered from Git while a server-only code delta is still present.

## Service template and rollback details

Use the adjacent service example as an infra-repository template, not a drop-in
replacement for the existing service. Keep code and the pinned Node binary in
service-readable non-home paths so `ProtectHome=yes` does not hide them. If an
input must be exposed, bind only that reviewed path read-only; prefer a dedicated
non-home publication path rather than weakening isolation for an entire home.
The service account still needs read/traverse permission on source and target.
Keep each environment's config/credential source separate. `LoadCredential`
passes a read-only credential path to the process, not the value via a command
line or checked-in environment file. If a provider still requires an environment
variable, use a reviewed adapter to read that individual credential file and
supply only the expected variable to the process, without logging it. Confirm
the public CLI's actual config and authentication contract before enabling live
operations; the example is not a complete provider or scheduler configuration.
Restore optional keys only for configured profiles. The launcher maps
`openai-backup.key`, `gemini-free.key`, and `yuanbao-search.key` to their
respective environment variables. A Gemini-enabled live configuration requires
both the mounted Gemini key and `ETF_GUI_GEMINI_FREE_PROJECT_VERIFIED=1`. Set
the latter only after an operator verifies the key belongs to the intended free
tier project; do not infer it from the presence of a key. Include a negative
startup check with the attestation missing and a positive credential contract
check on an isolated service without dispatching a live request.

Before promotion save the old resolved `current` symlink, expected digest,
config revision and health command. Flip the symlink with a rename on the same
filesystem, restart the service and check readiness against the expected build.
On activation failure, atomically restore the old pointer/config revision and
restart, then verify health again. Keep service-unit rollback separate from
application rollback: reinstall the previous managed unit revision and
daemon-reload only if the current unit itself changed. Never run two schedulers
against the same state during a restore drill.

## Recorded clean-room checks (2026-11-27)

- Public tag `v1.0.4`, `a61717b`: two clean archive builds with the same
  toolchain yielded byte-identical archives. Standalone unpack passed the offline
  fixture CLI and localhost GUI shell/workspace HTTP smoke.
- Later pinned Git main `f53bbc8c8e5427078e89d6af67a0bdb059316374`
  (tree `1cf311c378d67136775da20d46c493cbc804229e`, manifest version `1.0.4`):
  clean build with Node 26.11.1/npm 11.20.0 on Linux x64, artifact SHA-256
  `04863783aff94b15d845d97c2cbf7f505f2718decfb4f19b401abe8c21aa5812`;
  checksum verified after build. Fresh unpack passed deterministic CLI
  4/4 and GUI `/` and `/api/workspace` HTTP 200 on isolated fixture state.
  The digest identifies this audit artifact, not what was previously deployed.
- These checks do not verify PostgreSQL restoration, actual systemd startup,
  scheduler recovery, or outbound delivery.
