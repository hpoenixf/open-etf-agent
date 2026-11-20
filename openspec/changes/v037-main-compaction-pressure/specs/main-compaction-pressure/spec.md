## ADDED Requirements

### Requirement: Main compaction admission uses encoded request pressure

New Project tasks MAY opt into `compaction.pressureMode: "encoded-request@1"`
with the `compaction` capability. The Runtime SHALL freeze this policy in a
new durable Main history profile. Existing tasks and opt-outs SHALL retain
their prior profile and definition identity. Every managed summary profile
keeps Memory-bearing groups on the typed Main admission path.

#### Scenario: Known request after reversible fitting

- **WHEN** the ordinary Main working view has undergone reversible context fitting
- **THEN** compare the threshold with the UTF-8 bytes produced by the Gateway's own request encoder, including the full tool definitions and protocol envelope
- **AND** a measured request below the threshold proceeds without a new summary reservation, but MAY reuse a verified persisted frontier
- **AND** a measured request at or above the threshold still requires an eligible complete source prefix and a candidate that can reduce the encoded input
- **AND** the application hard cap still applies to the request actually dispatched

#### Scenario: Unknown encoded capacity

- **WHEN** that measurement is unavailable or cannot be trusted
- **THEN** distinguish unknown from zero or fitting; do not reserve a new summary on that basis
- **AND** let the existing final admission and hard guards decide whether Main can continue
- **AND** expose only sanitized status and available byte counts in the timeline, not prompt or source bodies

### Requirement: Persist no-gain decisions without weakening evidence or budget boundaries

#### Scenario: Same eligible evidence has no way to reduce the complete request

- **WHEN** all eligible settled groups and the active verified frontier provide the same candidate under the same frozen pressure basis
- **THEN** a lower-bound proof or completed no-byte-gain comparison SHALL suppress another summary for that candidate, including after cold reopen
- **AND** an eligible evidence or capacity basis change MAY justify reconsideration
- **AND** timeout, failure, stale source, unknown outcome or transient hard-cap overflow SHALL NOT be recorded as no-byte-gain proof
- **AND** fault or no-gain fallback SHALL preserve valid existing references and the latest complete group

#### Scenario: Root budget is almost spent

- **WHEN** a summary reservation would take the final remaining slot in the root model budget
- **THEN** reject the summary reservation atomically and leave that slot available to Main
- **AND** this is not a standing reservation against unrelated concurrent calls
- **AND** admission cancellation known not to dispatch SHALL remain distinct from an unknown provider outcome; an unknown summary SHALL NOT automatically dispatch again

### Requirement: Fitting does not change evidence authority

#### Scenario: Main reopens or obtains a derived note

- **WHEN** a verified summary is saved or reused across worker reopen
- **THEN** the original question, active report state, latest complete tool group and original source identities remain authoritative
- **AND** derived prose SHALL NOT replace exact source reread, typed memory authorization or the Project memory opt-out
- **AND** groups containing typed Memory SHALL stay on the Main admission path, not be rendered as opaque summary input
- **AND** an invalid or stale note SHALL NOT authorize dispatch beyond the application cap
