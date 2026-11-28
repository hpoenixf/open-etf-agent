# Isolated guest mode

Guest mode is **off unless a separate service is explicitly provisioned**. It is a short-lived, general ETF/fund chat for invited visitors, not another owner login. Visitors join using a shared entrance phrase. Each successful login independently creates a random 256-bit token; the phrase is never a session ID or request credential. The guest origin has its own assets, an exact API route list, a separate provider and no owner middleware. It does not resolve an owner identity, Project, Conversation, Run, PDF, holdings, account, memory, schedule or skill. The Runtime has an empty tool allowlist; even a model proposing a tool cannot invoke it. Guest answers therefore do not verify current data against the web, Wind or documents.

## Deployment

Provision this independently of the owner app. There is no migration or owner configuration change.

1. Run the guest app as its own least-privilege Linux service user. Ship only the tagged code and dependencies read-only. Do not give the guest process the owner user, user/group access, environment file, service credentials, configuration, home, private data, runtime volumes, tracing hooks, HTTP logs that include bodies/headers, or access to the owner's loopback service. Limit egress to its intended provider (and DNS as needed); the owner app must not trust arbitrary loopback peers. Use NoNewPrivileges, read-only filesystem paths, LimitCORE=0, and a private bounded scratch mount. Continue using the existing owner service/gateway independently.
2. Use a separate HTTPS hostname that does not receive owner cookies. Reverse-proxy that hostname to the guest service's own loopback port with the guest hostname in the forwarded Host. No cross-origin API access is supported. Trust no browser-supplied forwarded identity. Do not route guest endpoints to the owner app. If you later add an owner-site link, use a normal cross-origin link with no token or phrase, and include `rel="noopener noreferrer"` when opening in another tab.
3. Provision a private, owner-only (`0700`), bounded Linux tmpfs/ramfs directory for Runtime scratch; filesystem type and ownership are checked at startup. Prefer a non-swapping mount (or a system without swap); disallow snapshots, crash dumps and logs containing guest content. Mount lifetime should match the guest service. Use one guest process; tokens intentionally do not survive restart or route to another replica. Start with `npm run gui:guest` or `node dist/src/guest-cli.mjs` from the tagged built package.
4. Supply only **guest** settings from the service's secrets/config store. Generate the verifier from a non-echoing input piped to `node scripts/guest-phrase-verifier.mjs`. The utility accepts the phrase on stdin and prints a salted verifier; avoid terminal output, arguments, command history or public repositories for either value. The format is `scrypt-v1:<32 lowercase hex salt>:<64 lowercase hex hash>`. Rotate by configuring a new verifier and restarting the guest service. Use a strong shareable phrase and never reuse an owner password. Existing deployments stay unchanged if these settings are not added.

| Variable | Purpose |
| --- | --- |
| `ETF_GUEST_ORIGIN` | Canonical guest HTTPS origin without a trailing slash, separate from the owner origin |
| `ETF_GUEST_RUNTIME_ROOT` | Private volatile scratch mount for the guest process only |
| `ETF_GUEST_PORT` | Dedicated loopback listen port |
| `ETF_GUEST_PHRASE_VERIFIER` | Salted verifier produced by the utility |
| `ETF_GUEST_PROVIDER`, `ETF_GUEST_PROVIDER_ENDPOINT`, `ETF_GUEST_PROVIDER_MODEL` | Explicit guest Chat Completions route on a trusted HTTPS provider; the owner OpenCode Go route is rejected |
| `ETF_GUEST_PROVIDER_KEY` | Separate, least-privilege guest provider credential with a provider-side spend/rate ceiling; no fallback to owner keys |

The guest phrase is an invitation, not a billing authorization tied to one visitor. Deploy only with gated sharing, a capped guest provider credential and a gateway connection budget. The listener bounds concurrent requests/sessions and throttles login failures/attempts. This is not a global spend ledger. Rotate the phrase if it is shared outside the intended audience.

## Privacy and behavior

- The page saves the token and completed transcript in this tab's `sessionStorage`, not cookies, long-term memory, durable browser storage or a server history database. It can restore after refresh only when the guest token is still valid. User-selected disclosure: submitted questions and this tab's prior turns are sent to the configured model provider, whose retention policy is separate. Do not send personal or confidential holdings.
- The guest service holds only session digests, timers and concurrency state in RAM. Each turn uses separate temporary Runtime scratch, removed before a successful reply. No external endpoint can read that scratch; no Run or Conversation ID is returned, reused or accepted. The service keeps no durable transcript, prompt logs, telemetry or scheduled jobs. A crash drops sessions and requires the mount lifecycle/cleanup above.
- Idle sessions expire after 30 minutes and have an 8-hour absolute lifetime. Sign-out clears the tab and revokes its server token. Ordinary independent browser contexts do not share storage. Browser duplication, restored tabs and some browser session-restoration features can preserve or initially copy the browser's own `sessionStorage`; the copy is not a new independently authenticated session. Browser-end deletion is subject to those browser features. Do not duplicate or restore a guest tab for someone else on a shared device; use a private window or explicitly sign out.
- A turn invokes the configured provider at most once, with no automatic replay. A disconnected or expired guest cannot reopen a result from the server. The app cannot undo provider work already dispatched when the tab was closed.

## Preproduction acceptance and rollback

In a separate staging guest process with synthetic identities, verify independently opened browsers A and B can sign in with the same test phrase but start with empty and separate chats. Refresh A, then confirm A restores only its own transcript and B stays independent. In a separate owner origin, confirm existing owner history still opens. Confirm guest attempts to use owner routes/IDs or identity headers fail before provider dispatch; verify guest UI has no holdings, memory, PDF upload or schedule entry. Inspect the guest scratch mount after successful and failed turns and check no content is retained. Verify sign-out and stale-token behavior. Stage/account tests must not reuse an owner credential.

For rollback, stop guest admission at the guest hostname, remove that route and stop the guest service. This should not change the owner service, model key, data or deployments. Ensure the per-service scratch mount has been disposed.
