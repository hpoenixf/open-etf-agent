# OpenCode Go conversation metadata

The default Chat Completions gateway adds provider-required conversation headers only for `https://opencode.ai/zen/go/v1/chat/completions`:

- `User-Agent: open-etf-agent/0.27`, identifying this client rather than impersonating another application.
- `x-opencode-session: open-etf-agent-<sha256(identity)>`.

For native execution, identity is the original reservation's `rootId`. Main, its Child calls and reopened gateways therefore use the same conversation identifier. A malformed supplied reservation is rejected before dispatch; it does not fall back to a fresh conversation. The identifier is non-secret routing metadata, not an access credential, grant or replacement execution owner.

Direct non-durable callers that supply no reservation use one random identity per gateway instance. Repeated calls on that instance share a conversation. Constructing a new instance starts another conversation; cross-process continuity requires the native durable path. The adapter does not invent a durable task or persist an identity for direct callers.

Other endpoints retain their existing headers. Request bodies, encoding measurement, model selection, authorization requirements, redirects, budgets and outcome handling are unchanged. This metadata also applies when the existing streaming option is selected. It does not authorize requests, retries, account changes or additional spending.

Offline tests cover native Root and Child identity, a recreated gateway, direct-call identity, exact endpoint scoping, unchanged body bytes, the default Project gateway and a separate-process default CLI continuation through report completion. These tests inject synthetic HTTP responses only. They establish the client contract, not provider availability or model quality.
