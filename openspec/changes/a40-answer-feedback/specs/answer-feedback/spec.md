## ADDED Requirements

### Requirement: Feedback binds to a published revision

The local feedback CLI SHALL require an exact root publication Run, revision and expected payload hash. It SHALL verify them through the original read-only publication API. An unauthorized, missing, mismatched or unverifiable publication SHALL NOT accept feedback. Feedback SHALL NOT modify published content, dispatch a model, write Memory or generate evaluation scores.

#### Scenario: Stale revision hash

- **GIVEN** versions one and two have different committed payloads
- **WHEN** the operator attempts to submit for version two using version one's hash
- **THEN** the operation fails without creating feedback.

### Requirement: Submission and withdrawal are durable

A Session SHALL use a separate local store for feedback. The same client key and exact input SHALL return the existing feedback record even after withdrawal. A conflicting use of that key SHALL fail and leave the record intact. Reading an absent store SHALL NOT initialize it.

#### Scenario: Concurrent retry and subsequent withdrawal

- **WHEN** separate processes submit identical feedback using the same client key
- **THEN** both processes receive the same saved record
- **AND** an explicit withdrawal persists across restarts and is preserved by delayed submission retries.
