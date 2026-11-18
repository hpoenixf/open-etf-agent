## ADDED Requirements

### Requirement: Project-owned reversible context fitting

A Project SHALL freeze an optional advisory older-read working-set target in each admitted task. Advisory fitting SHALL consider successful explicit result rereads outside the newest two complete assistant/tool groups. It SHALL use an exact registered result identity and reduce the selected bytes without increasing the Gateway's encoded size. Original task history and source bytes SHALL remain available.

#### Scenario: An older source reread exceeds the advisory target

- **GIVEN** the task has an advisory target and a completed older reread with an exact stored source reference
- **WHEN** the Runtime selects context for the next Gateway request
- **THEN** the older reread may be represented by that exact reference
- **AND** the newest two complete groups and the original history are preserved
- **AND** reopening the original reference returns the identical source bytes

#### Scenario: An advisory reduction is unavailable

- **WHEN** a result failed, is unbound, or has no smaller verified representation
- **THEN** it remains in context under the advisory pass
- **AND** exceeding the advisory target alone does not reject the Run

### Requirement: Final capacity validation before model reservation

The Runtime SHALL validate the exact final messages and tool definitions against configured raw and actual Gateway-encoded limits before each model reservation. It SHALL revalidate restored working input against the current encoded limit. A Gateway-only limit SHALL leave the raw-limit configuration unchanged.

#### Scenario: Restored input exceeds the current Gateway envelope

- **GIVEN** the original task has a persisted working input
- **WHEN** the final request exceeds the current Gateway encoder limit
- **THEN** the Runtime returns `CONTEXT_CAPACITY_EXCEEDED` before reserving a model request
- **AND** no new provider request is dispatched

### Requirement: Fitting observations preserve evidence boundaries

Fitting observations SHALL contain only numeric byte counts and projected-result counts. Observability failures SHALL leave the selected input and its authority unchanged.

#### Scenario: The fitting observer fails

- **WHEN** recording a fitting observation fails
- **THEN** the original Runtime continues with the same selected input and reservation rules

### Requirement: One original-read parameter correction

The Host SHALL keep the exact argument contract for original reads. In the
durable Host projection profile, it MAY issue a typed rejection for a single
`read_result` proposal whose only error is supplying a derived-page selection
for an already acquired original result. The proof SHALL bind the original
call, Run, grant, selected scope and acquired result. The rejected call SHALL
consume no tool slot.

#### Scenario: An acquired original ref was sent with a selection

- **GIVEN** the original ref is in the Run's scope and the Run has no partial or unknown effects
- **WHEN** the Host rejects the call before dispatch
- **THEN** Runtime may use its one existing correction opportunity within the original budget and deadline
- **AND** the next proposal must be a single `read_result` call with the same original `resultRef` as its only argument

#### Scenario: A corrected read is attempted after the previous model outcome became unknown

- **WHEN** reopening the Run finds that its correction model request has an unknown outcome
- **THEN** the Runtime preserves the original reservation and stops without replaying it
