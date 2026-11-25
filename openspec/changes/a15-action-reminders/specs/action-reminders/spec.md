## ADDED Requirements

### Requirement: Local research follow-up lifecycle

The CLI SHALL accept explicitly entered follow-up text, an optional operator-provided research reference and a timezone-bearing due instant. Local persistence SHALL distinguish pending, displayed and acknowledged. Listing SHALL be read-only and SHALL NOT create an absent store or imply display, acknowledgment or delivery.

#### Scenario: Due item survives restart

- **WHEN** the operator adds a due follow-up and lists due items from two fresh CLI processes
- **THEN** both reads show the same pending item
- **AND** a separate explicit mark-shown action records displayed state for the exact due occurrence.

#### Scenario: Deferral and explicit acknowledgment

- **WHEN** the operator defers an unacknowledged reminder to a later time
- **THEN** a new pending occurrence is saved and a stale occurrence cannot mutate it
- **AND** acknowledgment of the current occurrence persists and removes it from the due list.

### Requirement: Reminder storage is isolated

Concurrent writes SHALL retain each successfully added item. Invalid or ambiguous input SHALL fail without creating an item. Reminder actions SHALL NOT dispatch research, send email or update the existing schedule or progress.

#### Scenario: Independent concurrent writers

- **WHEN** multiple CLI processes add different follow-ups to the same valid local store
- **THEN** every successful addition can be read back following a fresh CLI invocation.
