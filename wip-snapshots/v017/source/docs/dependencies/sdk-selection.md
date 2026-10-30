# SDK selection follows the required behavior

As observed 2026-10-26, the official SDK has a stable v2 line and a maintained v1 line. Protocol support is not inferred from a package's latest label.

## Rejected first candidate
Official client/server/core 2.4.0 and zod 4.6.7 were registry-pinned, installed with scripts disabled and tested through real stdio. Its client transport deliberately skips non-JSON stdout after SyntaxError. Our strict pollution rejection failed. The negative test also lacked finally-close for an unexpected successful connection; the original 120-second timeout is preserved and cleanup was fixed. The rejected lock/audit remain in sdk-v2-rejected-lock.json and sdk-v2-rejected-audit.json.

## Final candidate and tradeoff
@modelcontextprotocol/sdk 1.32.2 is the official maintenance line, not the newest protocol. README at gitHead 3b73021a0a2272c0c04c3917bcdb03398b3ec63f states support through protocol 2025-11-25 and bug/security fixes for at least six months after the v2 release on 2026-07-27. The observed date is within that interval; recheck before a future formal release.

Its fixed src/shared/stdio.ts directly propagates JSON parse errors; installed dist/esm/shared/stdio.js was checked for the same behavior. This implementation uses official Client, Server, schemas and Stdio transports, not parallel MCP protocol machinery or SDK private process fields.

Registry artifact integrity: sha512-SWsVtH/0vULSQStoZ6xxH2K09Li8fXYTMC64ZeogCdpZ3XSi1eCPOByV1OpuJxuI3OcmHhosDWYyii07tpPsLw==. Direct versions are exact; the lock pins every transitive artifact to the official registry. zod is 4.6.7. The cost is 95 package nodes rather than the v2 candidate's 14. Unused HTTP dependencies do not imply supported HTTP functionality.

Some transitive published packages contain prepare hooks. Installation always used --ignore-scripts; no prepare/install script, git-config hook or external service was executed. The metadata audit is not a comprehensive source security certification.

## Sources
- https://registry.npmjs.org/@modelcontextprotocol/sdk/1.32.2
- https://github.com/modelcontextprotocol/typescript-sdk/blob/3b73021a0a2272c0c04c3917bcdb03398b3ec63f/README.md
- https://github.com/modelcontextprotocol/typescript-sdk/blob/3b73021a0a2272c0c04c3917bcdb03398b3ec63f/src/shared/stdio.ts
- https://github.com/modelcontextprotocol/typescript-sdk/blob/b415e60bdf0e8dd5d6cbe7e6353abfb982b06dd2/docs/protocol-versions.md

Dependency licenses do not select the application license. The vendored user-owned Evidence Kit retains its own MIT license. SDK source is not redistributed here; npm installs its licensed published artifacts from the lock.
