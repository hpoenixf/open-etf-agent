## ADDED Requirements

### Requirement: Explicit venue calendar resolution

The temporal owner SHALL accept an opt-in `venue-calendar-input@1` containing a venue, IANA time zone, revision, inclusive coverage range of at most 366 calendar days, and explicit open or closed rows. Coverage endpoints and row dates SHALL be real Gregorian dates. An open row SHALL provide offset-bearing timestamps for open and close; both timestamps SHALL map to that row's date in the venue time zone and close SHALL follow open. The resolver SHALL NOT infer sessions, holidays, weekends, or hours.

#### Scenario: Resolve a completed early close across a DST offset change

- GIVEN explicit New York rows spanning a DST transition with offset-bearing open and early-close timestamps
- WHEN the fixed task anchor is at or after the explicit close
- THEN the result reports the newest completed session and its normalized UTC bounds
- AND the venue date is derived from the anchor in the venue time zone

#### Scenario: Ambiguous local times are rejected

- GIVEN an open row with a local clock lacking an explicit UTC offset, an invalid date, or an endpoint that maps to another venue date
- WHEN the calendar is normalized
- THEN the input is rejected before it is admitted

#### Scenario: Unresolved latest candidate or intervening gap

- GIVEN the search reaches a missing date or the start of coverage before finding a completed session
- WHEN the resolver scans backward from the venue date
- THEN the calendar status is unknown and no session is asserted
- AND an older or future gap cannot change a session already proved to be the newest completed session

#### Scenario: Missing or null calendar reports unknown

- GIVEN no calendar was opted in, an explicit null calendar was supplied, or the venue date is outside calendar coverage
- WHEN task time is admitted
- THEN the existing task-time message bytes and local yesterday/tomorrow semantics remain unchanged when no calendar is opted in
- AND an explicit missing input or insufficient coverage yields a venue session with status unknown and no date

### Requirement: Private admission and bounded projection

The accepted normalized calendar SHALL be bound to the immutable task-time admission and retained for recomputation. The model projection SHALL contain only the fixed task dates and one resolved calendar summary with provenance; it SHALL NOT contain raw input rows or duplicate serialized task-time objects. Existing `task-time@1` checkpoints without calendar opt-in SHALL retain their byte-identical working message.

#### Scenario: Resume a calendar-enabled task

- GIVEN a persisted task-time value with a calendar input
- WHEN a project or runtime reconstructs the task
- THEN the original calendar is recomputed and checked against its admitted summary
- AND only fixed dates, resolved session facts, coverage, revision, and digest are projected

### Requirement: Research CLI task-time input

The research submit CLI SHALL accept the existing `--task-time JSON_FILE` input for fixed task dates and an optional venue calendar. Project assembly SHALL preserve and reconstruct that value for Worker execution. Scheduled tasks SHALL reject calendar opt-in explicitly instead of discarding it.

#### Scenario: Submit and resume through a research project

- GIVEN a project with task-time capability and a `--task-time` JSON file containing a calendar
- WHEN the task is submitted and later worked
- THEN the immutable task definition and Worker projection contain the same resolved summary and provenance

#### Scenario: Calendar opt-in with a schedule is rejected

- GIVEN a scheduled task submission that also opts in to a venue calendar
- WHEN the research project validates the submission
- THEN it returns an explicit unsupported-schedule error before admission

### Requirement: Safe temporal demo input

The temporal demo CLI SHALL read a selected calendar through a no-follow file descriptor with a fixed byte limit and reject non-regular, oversized, invalid UTF-8, or invalid JSON input.

#### Scenario: Calendar path changes during read

- GIVEN a selected path that is a symlink or a non-regular file
- WHEN the temporal demo reads it
- THEN the input is rejected without following the path or reading unbounded content

#### Scenario: Reproducible fixture walk-through

- GIVEN a synthetic calendar JSON file
- WHEN the submit, work, and read commands run in separate processes
- THEN the saved report includes the admitted fixed task date and calendar provenance
- AND no external calendar service or live model is used
