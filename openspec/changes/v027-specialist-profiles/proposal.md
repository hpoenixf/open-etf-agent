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
