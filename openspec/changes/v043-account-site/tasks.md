## Implementation

- [x] Extract a listener-free workbench handler; preserve the explicit old loopback command.
- [x] Protect every app route and resolve Project from verified subject.
- [x] Implement same-origin Better Auth endpoint allowlist, offline account tools and revocation verification.
- [x] Test backend guard, cross-account History, report readback, sign-out and fail-closed behavior with fixture auth.
- [x] Acquire and audit the exact Better Auth release and full npm integrity lock in isolated QA.
- [x] Stage the independently read-back optional Better Auth manifest and lock.
- [ ] Run the final app installer with official HTTPS on the qualifying network; local DNS blocked the package download.
- [x] Run actual Better Auth and SQLite smoke for persisted session, logout and restart.
- [ ] Confirm duplicate offline enrollment rejects without changing the selected account.
- [ ] Qualify the live-owner copy and restart/rollback under explicit deployment approval.
- [ ] Validate actual public TLS and client cookies, with the original gate retained until separate cutover approval.
