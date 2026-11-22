## ADDED Requirements

### Requirement: Local offline research workspace

The GUI SHALL bind to loopback and use only the bundled synthetic sources through its offline Project configuration. Creating a conversation and submitting a question SHALL use the existing Conversation and Worker owners. The browser SHALL receive no provider configuration or credentials.

#### Scenario: Submit against an explicitly selected synthetic source

- **WHEN** the operator opens the printed loopback origin and submits a question with one of the two bundled sources
- **THEN** the question and selected source are bound to one Run, and the saved report exposes the original source for inspection

### Requirement: Durable readback and stable submission identity

The GUI SHALL show a terminal state after the running Worker finishes. Readback, refresh, and reopening the same Project SHALL use its existing saved records without dispatching new research. A retry of an unacknowledged submission SHALL retain the original message identity and payload for that Project.

#### Scenario: Worker finishes during a status read

- **WHEN** the Worker finishes while the GUI is returning an earlier active state
- **THEN** the browser receives enough information to query again and display the terminal state without a manual refresh

#### Scenario: Reopen an accepted submission after losing the response

- **WHEN** the server accepts a submission but the browser loses its response, and the operator refreshes or retries the original submission
- **THEN** the GUI reconciles or retries the original submission without creating a second Run

### Requirement: History, drafts, and original report exports

The GUI SHALL support history search by first question or conversation ID and keep unsent drafts scoped to the Project and conversation in the current browser. Reusing a question SHALL fill an empty composer without submission. Copying and downloading Markdown SHALL return the saved report.

#### Scenario: Return to an unsent draft and inspect a report on a narrow viewport

- **WHEN** the operator switches conversations using the narrow-screen history drawer and opens a report citation
- **THEN** the conversation restores its own draft, the source panel shows the original text and wraps the checksum, and closing the panel restores access to the composer
