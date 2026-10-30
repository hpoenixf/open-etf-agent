# Draft contracts before v0.7 tests

## Trusted Extension Host

- Explicit trusted local descriptors bind package ID, version, contribution schema version and content identity. The operator selects them; model text or document instructions cannot install a package or expand authority.
- Validate complete proposed contributions, tool collisions, Skill identity and Hook stage/timeout limits before activation. Temporary resources acquired during activation are released on later failure in reverse order. Never leave half a package active.
- A Run retains its immutable selected package bindings. A later version only affects a new Run. Removal/release cannot retroactively replace an in-flight Run's functions. Original explicit-function configuration remains a usable simple path.
- Trusted in-process JavaScript has process privileges. This is not an isolation sandbox. No dynamic arbitrary path supplied by a model is imported.

## SQLite Session facts

- A selected safe ordinary directory owns a new session.sqlite and its associated files. Refuse symlink ancestry, unexpected existing file/schema, incompatible version and malformed bounded JSON. No credentials in schema, snapshots, error text or public evidence.
- One Run has one valid writer claim. Claim increments a fence only after old lease expiry; all durable mutations require the matching owner/fence and an unexpired lease. A stale writer cannot publish a later DB result. Claims and budget reservation are short transactions; no network or tool await holds a DB transaction open.
- Request, Grant identity, selected provider/protocol/model/package bindings, total budget and absolute deadline never refresh at resume. Global root reservations are durable; Child and compaction consume that same root pool, not copies.
- A model invocation is durably reserved before dispatch. An unsealed prior invocation is unknown. A valid sealed proposal is replayable as data without another model request. Duplicate call IDs remain invalid across restarts.
- Tool result committed before consumption is consumed once from the original receipt. Dispatched-without-result is unknown unless an explicit versioned business reconciliation adapter can establish an existing result. General MCP side effects cannot be safely retried by assumption.
- Cancel is durable and monotonic. Late result/continuation cannot revive a cancelled or terminal Run. Resource cleanup is still owned and explicit; DB state does not magically release file locks or child processes.

## Same Runtime boundaries

The optional adapter must expose only necessary persistence operations, not a universal Runtime context. Default non-durable runs retain their small ordinary behavior.

Planned transitions: ready -> model-reserved -> proposal-sealed -> tool-dispatched -> result-committed -> result-consumed -> ready/terminal. Multiple calls within one sealed group have an exact cursor. Full assistant/tool groups remain paired; never make a half-result into success. A versioned snapshot includes original question/messages, used IDs, current sealed group/cursor, counters, remaining absolute time and safe Host state. Recovered logs are observations, not the executable source of truth.

Host restore must separately validate actual source records, acquired method identities, save-attempt state and known report receipts. An original successful save is not repeated on resume; its bytes/hash are reread. File/DB cross-system effects are not a single transaction. Known orphan content and unknown publication remain explicit.

## Feature adapters

- Child: persist child relationship before start; same root Grant and narrower scope. A completed child handoff whose root has not consumed it can be consumed from the bound durable record, not regenerated. If incomplete or unknown, retain the gap; no recursive agent system.
- Compaction: persist the adopted working-input identity and note reference before the next model dispatch. A stored note alone is not proof of adoption. Resume rereads original references without regenerating a summary when an already committed adoption exists.
- Memory: never steal an old writer.lock blindly. Prefer operation-scoped open/write/close in the durable adapter, so a committed result leaves no live writer. Unknown mid-write remains blocked until explicit reconciliation can establish the one-use intent and published revision. Result-committed/consume-only resume must not consume a fresh grant or rerun a write.
- Artifact: reread immutable artifact/revision IDs, verify bytes and return the original acknowledgement. Never overwrite or regenerate an existing report to conceal a missing DB receipt.
