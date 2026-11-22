# Open 0.43 account site | staged candidate, not activated

The new account entrypoint does not replace the deployed single-owner gate and
does not start a GUI socket behind each user. Production needs one HTTPS proxy
to a single authenticated loopback listener. Every protected asset, API, report
and write goes through that dispatcher. The ordinary `gui` command still exists
only for explicitly local owner work; never route public traffic there.

## Exact package gate

Target candidate: official [Better Auth v1.7.27](https://github.com/better-auth/better-auth/releases/tag/v1.7.27),
Git tag commit `9faf6f6a1155a6cdaf8ba2d25ce53e4f5a3fda72`.
Use [Node built-in SQLite](https://better-auth.com/docs/adapters/sqlite), no extra
native SQLite driver and no database credentials. Recheck the official supported
stable release/advisories at activation; this evidence binds 1.7.27 specifically.
The exact package and verified lock were tested in isolated Singapore QA.
The earlier mirror lock was rejected, not overridden. All 21 exact package
metadata entries matched their official HTTPS npm tarball and SRI, followed
by clean-cache npm installation of 21 packages. Tested separate lock SHA256:
`92517784461e429a3523551d1d3459f1f9db214527136e0403f5daf04f2f8576`.
This runtime was exercised against the exact `e3c13ecc` account candidate:
all five account tests passed, including actual Better Auth/SQLite login,
per-account Project guard, stale-cookie rejection after sign-out, and restart
readback. This is an isolated dependency and loopback record, not public TLS,
real users, live owner-history migration or production readiness. The
exact official manifest and lock are present in the optional install lane.
An earlier cloud packaging attempt stopped before download because the
official npm registry could not resolve. The subsequent fresh, isolated
Singapore run of the shipping installer passed at exact application commit
`f0dc68b99f332e0f9cc2ed484f4c7e53db95963c`, root tree
`8e3748da0a3fab8b30052679c925c4271268b1b2`, source tree
`c96dfc06dc18441a254524c38475e2a50741a3d8`, on Node 26.11.1.
The normal official-registry install added 100 dependencies and did not
install Better Auth. The checked-in optional installer then installed the
21 locked dependencies from the official registry and resolved Better Auth
1.7.27 from the intended sidecar. All five account tests passed (no failure
or skip), including actual Better Auth/SQLite and cold account readback.
No external model, email, production Project or browser/TLS was exercised.
This supersedes the installer blocker only; it does not qualify production
activation or grant additional scope.

Do not resolve fresh dependencies for a release test. First run the normal
root install on Node 26. The verified manifest and lock live under
`tooling/account-auth-runtime/`. Use the explicit Linux or macOS setup:
```sh
npm ci --ignore-scripts --no-audit --no-fund
node scripts/install-account-deps.mjs
OPEN_ACCOUNT_REAL_TEST=1 node --test --test-concurrency=1 test/account-site.test.mjs
```

The optional helper rejects missing or altered lock bytes, any non-official
registry URL, symlinked install roots or foreign existing Better Auth binding.
It uses fresh npm configs/cache and disables package install scripts. Stop any
running account process before reinstalling its sidecar. A later root npm ci
can prune the generated Better Auth link; rerun the explicit setup afterwards.
The normal GUI, main npm manifest/lock and startup default do not change.
If the exact optional files are missing or altered, the helper refuses
before npm or link writes; there is no placeholder graph or fallback install.

The opt-in test uses throwaway accounts/directories, not real emails or
provider calls. Normal fixture tests do not run it. The separate local
non-browser baseline achieved 45 passed, 2 skipped, 0 failed. Those counts,
the earlier five account tests, and the shipping five account tests overlap
and must not be added together.

## Operator configuration

`node src/account-cli.mjs migrate --config FILE`: dedicated new owner-only
state directory, fixed HTTPS origin, exact 32-byte base64url secret file.
The command creates only the account database. Do not migrate the existing app
Project or an open live DB. `serve` fails if migrations are pending.
`node src/account-cli.mjs provision --config FILE`: while server is stopped,
adds one explicitly selected account using its local mode-0600 password file,
outputting only its bound project-directory basename. There is no default user
or password, email delivery, cloud provider or Internet sign-up path.

Configuration keys are exact. Migrate: `origin,secretFile,stateDir`. Provision
adds `name,email,passwordFile`. Serve adds `projectRoot,port` to the migrate
keys, not the enrollment keys. Use absolute canonical paths with auth state and
Project roots separate; use an operator-protected file or systemd credential
for the auth secret and do not place secret values in flags, Git or logs.
Unlink each consumed plaintext provisioning file through the operator's own
secure workflow; hashed credentials and signed sessions stay in dedicated DB.

Cookies are Secure, HttpOnly, SameSite Strict and host-only. No cookie cache or
secondary store, no OAuth, recovery email or open registration. A persistent
sign-in rate budget uses a single trusted loopback bucket; client-forwarded
Host and IP assertions are never used. The shared bucket suits an invite-only
pilot, but login lock-out availability and real TLS on an Internet-facing app
need separate qualification. Keep the existing outer gate unchanged during test.

## Owner transfer and rollback

1. Use a disposable/staging account namespace, never the production gate's
   database or the live original Project. Verify no caller override and two
   distinct account Projects with the same UI.
2. Before any migration, finish/adjudicate active runs and quiesce old Project
   writes by the old owner, not by the new server. Make a complete encrypted
   out-of-instance backup and verify original Directory/file checksums (include
   true app state and any valid SQLite sidecars). Do not replay ambiguous calls.
3. Bind the chosen account by its immutable ID; only that account's deterministic
   Project path may receive the copy. Preserve Project and report/source digests.
   Do not move/delete/relabel the original or assign legacy data to the first
   caller. The fixture-only current account server rejects any incompatible
   live-owner config; do not relax that check. If the old Project is live, a
   separately scoped operator provider mapping, no-email/no-schedule rehearsal
   and compatible readback are prerequisites before any production adoption.
4. On TLS staging, verify direct unauthenticated requests do not get app assets,
   both accounts can only read their own History and files, original Markdown
   download/source IDs match and old cookies fail after logout and restart.
   Verify the proxy's canonical Host, no underlying ports publicly listening,
   cookie behavior on real mobile and desktop, and continued original gate access.
5. Only after a separate cutover decision change Caddy/DNS as applicable. Preserve
   the old listener and immutable backup. To roll back, restore the old route
   to the unchanged owner gate. Retain and separately reconcile any account
   writes accepted after cutover; never silently overlay them onto the original.
