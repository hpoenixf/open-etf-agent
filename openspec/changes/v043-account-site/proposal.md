## Why

Open's current hosted owner gate intentionally provides one shared ingress
identity. To let multiple invited people use Open, authentication must produce
a server-side subject that selects a distinct Project and consistent access to
every durable read and mutation; a login screen alone is not an account system.

## What Changes

- Add a separate loopback-only authenticated entrypoint behind one fixed HTTPS
  origin. Preserve the existing owner GUI command and ingress deployment.
- Use Better Auth email/password and durable sessions; no public sign-up,
  built-in demo credential, OAuth, browser-only enforcement, or automatic adoption.
- Resolve each Project exclusively from the validated account subject before
  mounting any app route. Include all read and write surfaces in the boundary.
- Add separate operator-only database initialization and account provisioning.
- Preserve original owner History through explicit verified offline copy and
  rollback, not implicit first-login adoption.
- Keep the initial isolated account workbench in synthetic fixture mode; live
  per-account model, data-service and notification authorization are separate
  work. Do not move or change deployed owner state in this candidate.

## Impact

- Affected specs: account-site
- Affected code: account site/driver/CLI/UI and GUI handler extraction.
- Better Auth official version and lockfile, actual encrypted-cookie TLS
  operation, and compatibility of migrated live owner state are release gates.
