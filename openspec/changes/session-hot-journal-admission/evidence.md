# Session hot-journal admission: qualification evidence

This is a bounded Session correction accompanying the local-PDF WIP, not a stable release, cloud deployment, general database-repair tool or Host snapshot migration.

## Original failure and preserved evidence

The PDF candidate's original 358/359 run failed in the unchanged saved-artifact crash case with SQLite 776. Its original record remains in `docs/verification/v011-observations.safe.json`; neither the failure nor the old test was removed. A first Session correction subsequently completed 370/371, failing the unchanged competing-Worker case with SQLite BUSY (5). Its exact failing stage was not established because the original stack was unavailable. A later bounded lock observation reproduced an initial-readonly busy-policy window; it did not reconstruct that missing stack.

## Final fixed execution

The reviewed correction places the existing 1000 ms native busy policy at both initial connection constructors. Only precise SQLite 776 enters bounded copy admission and original native rollback. A final serial execution completed 373/373 with no skipped, cancelled or drifted inputs on Node 26.11.1 / SQLite 3.53.4, ending 2026-10-28 07:06:45 UTC. The unchanged original Session, durable-runtime, Worker and worker-process tests are included. Fourteen additional tests exercise the bounded admission and initial busy cases.

The fixed input digest is `73148a908096545de29a30842c81255338011ae524d056ef8175a9cdff078828`. [The safe receipt](../../../docs/verification/session-hot-journal-admission.safe.json) retains source hashes, exact command, final observation, prior failure summary and original output digests without uploading raw output or databases. Counts belong to this specific input set; do not add earlier runs to them.

## Integration and remaining delivery gates

The candidate retains current public-main documentation, CI and maintenance checkers rather than restoring the old PDF working tree. Its Runtime source, tests, fixtures and package files match the final execution, but differing maintenance inputs require separate verification. No exact integrated install/build, current-checker run, refreshed fixed-source article receipt, stable publication or canonical article delivery is claimed here. The wider PDF delivery checklist remains open until its actual gates pass.

The original task checkboxes are the pre-verification frozen record; this dated evidence updates the observations without rewriting that executed input. Publication and any later task closure require their own verified outcomes.
