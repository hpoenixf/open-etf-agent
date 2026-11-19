# Native PDF table evidence

## ADDED Requirements

### Requirement: A cell cites an admitted original

The Project PDF owner SHALL expose an acquired cell source only when
the selected physical page, table, row, and column resolve unambiguously
within the frozen native PDF selection.

#### Scenario: Equal values in separate cells

- **WHEN** the original contains the same value in two supported cells
- **THEN** each cell has its own exact source identity, row label, column
  header, displayed unit, parser text origin, and original PDF digest.

#### Scenario: Unreliable structure

- **WHEN** the native table lacks a reliable row/column association
- **THEN** no guessed structured value is emitted for the candidate
  and the existing page text remains available.

### Requirement: Persist and read back the original cell citation

A report using a cell citation SHALL reference a cell read by the
same Run and retain the original PDF artifact and exact receipt.

#### Scenario: Read a saved report offline

- **WHEN** a new CLI process reads a committed report
- **THEN** it returns both the exact cell source and original artifact ID,
  with the original physical page and location, even if the original
  operator path has since changed.

#### Scenario: Open an existing text-only snapshot

- **WHEN** an existing task uses a `pdf-input-snapshot@1`
- **THEN** its original PDF authority, page content and tool contract do
  not acquire an implied table or change source identity.
