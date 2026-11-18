## ADDED Requirements

### Requirement: Explicit local dynamic query admission
The Project SHALL bind the source manifest, page-vector identity, local model manifest, token bound and maximum query count before admitting a `local-knowledge-query@1` Run. Only report and Knowledge capabilities SHALL be supported by this initial local profile. Existing static task definitions SHALL keep their original identities.

#### Scenario: A business query was not prepared at admission
- **GIVEN** verified local E5 page vectors and an admitted local dynamic query profile
- **WHEN** the original Runtime requests a new query within its original deadline and scope
- **THEN** the adapter encodes only that query and returns original whole-page evidence with existing source identity and ResultRefs
- **AND** cached page vectors are reused without widening the admitted collection

#### Scenario: Model or page vectors change
- **GIVEN** a frozen task definition
- **WHEN** the runtime mapping, model manifest or page-vector identity does not match it
- **THEN** the operation fails closed without acquiring replacement evidence

### Requirement: Atomic query budget and fenced receipt
The original Session tool dispatch SHALL atomically reserve its tool slot, one query and two local protocol operations. Each operation SHALL persist a dispatch marker before execution. The exact typed vector receipt SHALL be committed before Host source ingestion and SHALL require the original active fence. Local operations SHALL be accounted separately from model requests and external billing.

#### Scenario: Query allowance is exhausted
- **WHEN** a tool dispatch would exceed its admitted query allowance
- **THEN** the original transaction rejects it
- **AND** neither the tool counter nor the query counter is advanced

#### Scenario: Late completion under an old fence
- **GIVEN** execution ownership has moved to a new fence
- **WHEN** the former owner attempts to commit an encoded result
- **THEN** the Session rejects the stale write

### Requirement: Recovery does not replay uncertain encoding
Recovery SHALL read completed exact receipts without starting an embedding backend. Missing, partial or ambiguous operations SHALL remain unknown and retain their reservations. Recovery SHALL NOT retry them under a new call identity or refresh the original deadline.

#### Scenario: Process stops after receipt commit
- **GIVEN** the process stops before Host consumption but after committing the query receipt
- **WHEN** a new process recovers the original Run
- **THEN** retrieval is recomputed from the receipt without tokenizer or encoder calls

#### Scenario: Process stops during local encoding
- **GIVEN** a query stage was dispatched without a complete durable receipt
- **WHEN** the original Run is recovered
- **THEN** it preserves the unknown operation and its reserved allowance instead of re-encoding

### Requirement: Evidence and answerability remain distinct
Knowledge SHALL preserve scoped retrieval coverage and original whole-page byte bounds. Candidate matches SHALL NOT be represented as answerability. Newly admitted dynamic tasks SHALL freeze a versioned instruction that scopes absence claims to returned original evidence and distinguishes explicit not-specified statements from insufficient evidence. Legacy instruction bytes SHALL remain unchanged. Qualification SHALL preserve all ten frozen real tasks, all failures and original labels, with at least nine eligible successes and separate content review.

#### Scenario: Partial result omits four of eight pages
- **WHEN** a query returns four of eight admitted pages
- **THEN** its coverage reports that limitation
- **AND** the model guidance forbids claiming that the whole collection lacks the fact
- **AND** a supported positive fact or explicit not-specified statement remains scoped to its cited original

#### Scenario: Earlier cohort misses content acceptance
- **GIVEN** the first fixed candidate has ten Runtime completions but eight strict content successes
- **WHEN** a general evidence-boundary framing defect is fixed with a new frozen instruction version
- **THEN** the first cohort and failures remain retained
- **AND** a new complete prospective cohort is evaluated independently without replacing failed tasks or altering relevance labels or ranking thresholds
