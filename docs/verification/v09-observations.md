# v0.9 single-Run Worker — qualification notes

This version adapts one original ScheduledTaskWorker responsibility: admitted original work → fenced execution through the same Runtime → durable original result observation. It is not the full scheduled-task product. The detailed private lineage stays local; [the public summary](../evolution/v09-worker-lineage.md) names retained contracts, adaptations and exclusions without copying private code.

## What changed

- `submitRun` shares Runtime validation and the initial checkpoint, then creates one explicit Session Run without a model/tool call, execution claim or surviving worker.
- `workRun` selects that original root and invokes the existing `run`. Session remains the only execution lease/fence, budget and deadline authority; its source and schema are unchanged.
- `hostSignal` means local Worker interruption, not user intent. The original user-cancel signal and durable cancellation retain their semantics. On a confirmed local stop, a still-owned claim can be released; an unacknowledged operation retains its original reservation/lease-expiry boundary.
- The existing CLI/demo assembly adds bounded `submit` and `work` commands for the existing synthetic `durable-publication` profile. It installs no daemon and has no queue, job table, second Task state machine or new dependencies.

## Original qualification snapshot

The first RED ran 11 assertions on the previous Runtime with new tests: ten failed and the pre-existing cancel-after-publication invariant already passed. Missing entry points are genuine missing seams, not ten distinct behavioral bugs. Two behavior failures exposed why user cancellation cannot stand in for host interruption.

The first focused GREEN passed 16 cases. After adding three further counterexamples and freezing package version 0.9.0, the entire suite passed 305/305 with no skips or cancellations. Those are separate runs; the first receipt does not include the later three cases. Original final input digest: `80966655766966b504f48055c17d0aafce65263ec019b0bd3f59a80dc128fdea` across 124 source/test/package/script/fixture files. All input bytes were checked before and after execution.

The 19 Worker cases comprise 11 Runtime/owner cases, three CLI cases and five real-process scenarios. Tests use actual SQLite, separate Node processes and actual SIGTERM/SIGKILL. They preserve one original Run across graceful interruption, reject a competing live owner, preserve the original unknown model debit after a kill, retain one Publication receipt after a post-commit kill, and count admission waiting against the original deadline. The last three counterexamples cover an unacknowledged stop, a stale token under a new fence, and readable Publication after later report failure.

An independent locked offline installation installed the existing 95 packages without network downloads or lifecycle scripts. Native build produced 55 byte-identical files from 61 non-test inputs. Eight different built CLI process IDs completed submit/inspect/work/Publication/event/revisions/terminal-repeat/readback; the original Run definition, deadline, budget and receipt were compared. The actual built Artifact owner read the new report and the retained v0.6 933-byte Artifact without changing the old bytes. Receipts are separate from the suite. The original Evidence Kit checks only the authored structural evidence; its view/status is not a release or semantic verdict.

## Maintenance rebind — 2026-10-27 09:01 UTC

The later public main maintenance is fixed at `0cf4b99e77bb77aa2530734d011e7f37985d1897`. This candidate preserves its CI, version lineage, four-column article table, and original actual coverage receipts. The Worker implementation, its 19 cases, package metadata and locked dependencies are unchanged. Among the original 124 qualification inputs, only the coverage checker and its unit test changed; 122 input files are byte-identical.

The combined input digest is `445b5cfd2e2cf792b5d431546c4742f893fc66c38f7d033949e0109bcde5431f` in [v09-combined-inputs.json](v09-combined-inputs.json). One new complete serial execution passed **309/309**, with zero failures, skips or cancellations, on Node 26.11.1 with a 512 MiB heap; all input hashes remained unchanged. See [the actual machine receipt](v09-combined-observations.safe.json). The earlier 305/305 and digest `80966655766966b504f48055c17d0aafce65263ec019b0bd3f59a80dc128fdea` remain their own historical run, not this run's evidence or a count to add to it.

[Delivery equivalence](v09-delivery-equivalence.safe.json) separately compares all 58 inputs used by installation/build and the built CLI path, including both package files, the build script, and all source/fixture bytes. All 55 retained independently built source/fixture files still match. The original 95-package offline installation and eight built CLI process observations remain historical actual evidence; no new install/build/CLI execution is claimed for this rebind. The changed checker/test is outside that built delivery path.

A public fixed v0.9 commit is still required before a truthful `since: 0.9` entry and the additional Worker coverage target can be bound and executed. The current 14-target receipt remains historical evidence for its fixed maintenance source, not proof of Worker article coverage. Main promotion, GitHub CI on that promotion, article source and restricted site readback remain independent gates.

## Limits that remain deliberate

- This is synthetic Gateway input and real Runtime/process/storage testing, not live-provider or semantic assessment. No new model request was made; historical live evidence is not extended to this Worker.
- `settled` is an observation of a durable terminal Run, including failed/cancelled. It does not mean successful research. The CLI succeeds only for original `completed`.
- An abort acknowledgement says a local promise settled; it does not prove an external effect never happened. A dispatched request without an authoritative result is not automatically repeated or refunded. There is no distributed exactly-once claim.
- One explicitly selected Run only. No Schedule, Task coordination, multi-Run fairness, notifications, parallel foreground chat, HTTP/SSE product, frontend, browser acceptance or database migration is added.
- Node support declaration remains `>=26.8.1 <27`; this candidate was actually tested on 26.11.1 only. No new dependency/configuration platform, security changes or credential is needed.
- A fixed package version is not a formal release. Remote phase/main publication, README coverage rebinding, article edits and new-domain verification remain separately recorded publisher gates. No automatic or manual all-maintenance archive is asserted here.
