## ADDED Requirements

### Requirement: Project-local material versions

A Project SHALL track explicitly selected local text or PDF files under bounded logical material IDs. Each successful registration or replacement SHALL bind an immutable version to the original Source manifest and interpretation identity. Equivalent input SHALL return the existing version. A distinct replacement SHALL require the current revision and SHALL preserve historical versions.

#### Scenario: Alternate filename contains equivalent input

- **GIVEN** an existing material and another selected file with the same original bytes and interpretation
- **WHEN** the user reimports it
- **THEN** the registry returns the existing version and manifest without adding a revision

#### Scenario: Replacement fails or competes with another writer

- **GIVEN** an active material
- **WHEN** a replacement has an invalid input, a stale revision, or cancellation observed before seal dispatch
- **THEN** the replacement does not become active
- **AND** at most one distinct write based on a registry generation can commit

### Requirement: Exact source selection and retained task evidence

The material CLI SHALL resolve an explicitly selected version to its existing Source manifest. The task owner SHALL bind that exact manifest at admission. Replacing or removing a material SHALL preserve admitted task bindings and immutable Source snapshots. Removal SHALL block new selections through the registry.

#### Scenario: Historical version is selected after replacement

- **GIVEN** a registered material with two versions
- **WHEN** the user selects version one and submits its manifest
- **THEN** the task consumes version one's original source on a fresh work process

#### Scenario: Material is removed after task admission

- **GIVEN** a task bound to a selected manifest
- **WHEN** the user removes the material before executing the task
- **THEN** the registry rejects subsequent selection of the removed material
- **AND** the admitted task can still read and cite the exact original source

### Requirement: Explicit recovery of sealed registry state

An exclusive immutable seal SHALL commit each bounded state transition. Readers SHALL validate the project identity, generation chain and referenced state hashes. Explicit recovery SHALL restore a missing visible snapshot only from the exact prepared bytes bound by its valid seal. Ambiguous initialization or corrupt history SHALL fail closed.

#### Scenario: Seal is committed but its visible snapshot is missing

- **GIVEN** a valid committed seal and intact prepared bytes
- **WHEN** a reader encounters a missing snapshot
- **THEN** it reports recovery is required
- **AND** explicit recovery restores that snapshot without reimporting the original file or changing the selected manifest

#### Scenario: Corruption or an ambiguous initialization is observed

- **WHEN** the registry cannot prove the exact history or project identity
- **THEN** it reports the failure and preserves the existing records
