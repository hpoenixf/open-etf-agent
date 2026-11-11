# v0.27 candidate: project-scoped specialist profiles

This is an unfinished candidate, not a qualified release. It starts from published
v0.25, independently of the pending v0.26 Web implementation. Integrating a later
accepted baseline requires separate consumer verification.

One module: explicit operator-authored profiles and named ordered combinations,
versioned configuration lifecycle, exact selection at task admission, and the
original Child executor consuming immutable method descriptors. Profiles do not
become a new Runtime, permission owner, provider router or model budget.

Profile IDs/revisions are independent of method IDs/versions. A preset binds
ordered exact profile revisions, not mutable latest pointers. Duplicate method
IDs remain rejected by the original Child validator. Main may choose among its
frozen method set with `delegate_child.methodId`; a preset never forces iteration
or enlarges the original root limits.

The store owns project-bound profile/preset facts, revision CAS, logical deletion
and bounded history. Tombstoned identities are not reused or restored in this
version. Disabled/removed/stale selections reject new admission. A task already
submitted must retain its original selection and one copy of each method in its
existing task config; ACK retries and cold recovery must not reread today's
catalog. Selection metadata contains identities/hashes, not duplicate method
bodies. The original Session/context/Child question bounds remain in force.

The first implementation checkpoint contains only the bounded store and selection
core plus four focused offline tests. The real Project/CLI/Child/cold consumer
is not connected yet. No new dependency, real model task, publication or complete
module acceptance is claimed. The initial unimplemented RED and first GREEN
remain separate evidence.

Required subsequent qualification: original Project selection and retry/recovery
wiring, real Child/Main/report consumer tests, legacy inline compatibility,
invalid/stale/tampered/capacity counterexamples, fixed-source aggregate/build and
independent review. Model qualification remains prospective, separately budgeted,
and governed by the original ten-task Runtime threshold, not offline counts.

No Python isolation, frontend, parallel experts, model-generated profiles,
provider credentials, arbitrary tools, external installation or network fetching
is introduced. Source selection and publication authority remain with their
existing owners. Profile instructions are not source evidence or permissions.

## Checkpoint 2

Project submit/ACK and original cold Child/report consumption are connected, with
an explicit operator CLI and stable create intent IDs. The catalog retains
immutable historical generations but exposes only current records, not historical
browsing. Focused process-CAS and partial-publication checks are added; no full
suite, live qualification or v0.26 integration claim is made. The original
checkpoint-1 create-ACK gap and first fixture argument rejection remain recorded.

## Checkpoint 3 safety and process recovery

Independent review SP-02 identified reinitialization and tail-loss rollback.
Two executable RED cases are retained. Separate persistent catalog registration
and pre-publication generation seals now reject both, and reject an interrupted
reserved generation without reclaiming it. Project's immutable task remains the
worker authority. A separate Node worker process consumes frozen specialists after
catalog removal, followed by another process's terminal replay with a throwing
Gateway proving no dispatch. The earlier checkpoint-2 reopen was same-process;
only this later test establishes the stated cross-process boundary. Maximum-size
question/definition regression cases and full-suite verification remain pending.

## Checkpoint 4 focused closure

SP-03's open-then-registration-symlink replacement is executable RED, followed by
per-read registration directory safety validation and GREEN. The focused set also
checks the original constructed Child question rejection over 16000 UTF-8 bytes,
a valid smaller question, and exact Session JSON acceptance at 65536 bytes versus
65537 rejection. These are original owner boundary tests, not a larger context
window or a promise that every descriptor accepted by the catalog fits every
future task. A paired Project fixture executes genuinely different claim-comparison
and fee-basis methods with different instruction text, tool sets and bounds through
the original Child consumer; an inline-config version still passes without a
catalog. The original Root budget and all authority restrictions are unchanged.
All responses remain FakeGateway fixture data: no semantic quality claim about
real models follows from this coverage.
