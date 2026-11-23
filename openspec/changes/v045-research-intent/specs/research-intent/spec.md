## ADDED Requirements

### Requirement: Explicit owner research depth
The owner GUI SHALL freeze its selected Auto, Standard or Deep mode with the original
Conversation submission and SHALL NOT alter or replay an admitted Run when
the user changes modes. The mode SHALL NOT alter tool scope or aggregate caps.

#### Scenario: Explicit Deep
- **WHEN** the owner explicitly submits Deep
- **THEN** the trusted separate system policy asks for original evidence and honest gaps
- **AND** the original question and existing tool/budget configuration are preserved

#### Scenario: Explicit Standard
- **WHEN** the owner explicitly submits Standard
- **THEN** the normal tool/budget configuration remains available
- **AND** neither semantic routing nor an implicit Chart Skill changes the route
- **AND** an explicitly selected supported Skill is still honored

#### Scenario: Replay
- **WHEN** a same-ID acknowledged submission changes the depth, effort or Skill
- **THEN** it does not become a new Run

### Requirement: Optional semantic route
Auto SHALL permit a first-proposal native selection only where an allowed
original-evidence tool exists. It SHALL NOT use keyword rules, a dedicated
classifier request, or model prose as identity. The local chooser and its
wire exposure SHALL share the original-evidence eligibility rule.

#### Scenario: First structured selection
- **WHEN** a first single native selection is bound to its matching successful local receipt
- **THEN** the selected Research or Deep route guides subsequent work
- **AND** History reads back the original effective mode without additional dispatch

#### Scenario: Original tool is unavailable
- **WHEN** there is no authorized original-evidence tool
- **THEN** the wire does not offer the optional selector
- **AND** an unsolicited selection does not become an accepted native route

### Requirement: Preserve adjacent owner workflows
Depth SHALL NOT grant account sessions extra capabilities or affect scheduled
research. The existing PDF and Chart Skill boundaries and their original
receipts SHALL remain explicit and separately verifiable.

#### Scenario: Existing workflows and closed delivery
- **WHEN** an owner submits a supported ordinary turn or reopens an existing report
- **THEN** settled History, untouched PDF and Chart evidence, and existing daily/digest continue under their prior contracts
- **AND** user-visible mode and progress are projections of accepted records, not private reasoning or proof of factual quality

### Requirement: Bind optional model effort to the original owner turn
An opt-in capability SHALL bind to the exact supported provider, model, and API
profile. The offer and admission SHALL share the same exact options. An unsupported
selection SHALL be refused without dispatch and the omitted setting SHALL preserve
the prior provider request. The accepted choice SHALL be immutable with the original
turn, including any existing recovery, and SHALL NOT mutate a shared default, grant
tools, add retries, expose provider reasoning content, or increase budgets.

#### Scenario: Supported effort through tool continuation
- **WHEN** the exact opted-in opencode-go-owner GLM-5.3-Flash Chat Completions
  profile accepts low, high or max and a tool result precedes a next model step
- **THEN** the same selected value is serialized in each model request of that turn
- **AND** no undocumented thinking toggle or raw reasoning continuation is inferred
- **AND** cold History reports requested and locally evidenced serialized values
  without asserting provider adoption

#### Scenario: Unverified, unsupported or omitted
- **WHEN** the profile is not opted in, the route differs, or the requested value is unsupported
- **THEN** no unsupported option is offered or silently substituted
- **AND** no request is sent for an unsupported explicit choice
- **AND** omitting the choice never sends an explicit effort
