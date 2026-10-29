# v0.14 candidate — existing Memory read-only consumption

Status: root-reviewed bounded candidate (2026-10-29), implemented and locally qualified at package 0.14.0; remote publication/release still pending. Baseline: public main `314de1b7246ff25f8fdd71d94ee21e46a9748fa3`. Original roadmap 1.3 and article `026-agent-memory-forget-durable-effects` supply the design motivation. v0.5 already owns save/revise/forget/search/read, typed projection and Runtime currentness checks; this is not their first implementation.

## Sole increment and entry

`node src/cli.mjs --case memory-recall --memory-library EXISTING --query QUERY [--temporary] [--output DIR]` consumes an explicitly selected existing library. QUERY is nonblank, at most 256 characters, using the original lexical search contract. Missing/corrupt/symlinked library fails closed; no fallback creates or repairs it. `--temporary` is resolved before importing/opening the Memory consumer's owner, validating the selected filesystem path, scanning, listing or reading it. The path may be unavailable: temporary mode still completes the independent synthetic document task, without Memory tools or projection. These flags remain incompatible with observe and other cases (except the historical explicit-memory library flag).

The CLI profile is provider-free and explicitly synthetic, never a live-model qualification. It runs the existing Runtime and Gateway request encoder against an injected bounded fixture transport, not a parallel executor. The response consumes actual encoded current Memory results, then original synthetic sources and the existing report tool. Memory is preference/untrusted context, not original source evidence or permission. A metadata-only receipt distinguishes selected/temporary mode, current consumed identities and actual encoded request hashes; no fabricated semantic adoption claim.

## Ownership and boundaries

Open `openMemoryLibrary({directory,writable:false})`; register only existing `memory_search`, `memory_read`, `memory_list` bindings, never save/revise/forget definitions. No writer lock, init, schema change, new credentials, new vector service or automatic learning. Reuse `workingInput.memoryLibrary`, `projectMemory` and both existing Runtime currentness checks. Do not duplicate this algorithm. Current owner state remains authority; stale hits and typed derived notes cannot revive superseded/forgotten revisions in subsequent requests. Other libraries are never consulted.

File Memory has no cross-owner transaction with dispatch. Rechecks are bounded observations, not atomic revocation/send or retrieval snapshot isolation. Bytes already sent cannot be withdrawn. For this synthetic fixture only, the report chooses metadata-only recall disclosure: actual encoded current revision identities/hashes drive a visible report section and receipt, alongside original synthetic sources. This is not a new Runtime output prohibition or semantic gate: authorized Memory content can remain legitimate answer context in other existing consumers; it is not source evidence or authority. No independent storage or currentness algorithm is added. No arbitrary persistent active-Run recovery, new durable bindings, retrospective report revocation or report authorization platform.

## Acceptance

1. New CLI on an existing nonempty library succeeds; independent process observes unchanged byte inventory, no new lock, same library/revision identity and original report bytes.
2. Actual encoded Gateway bodies contain the selected current typed revision; no write tool definitions. Miss returns no invented memory; alternate library data absent. Saved/revised/forgotten examples remain original lifecycle behavior.
3. Mutation after search and before subsequent dispatch removes stale typed text and dependent notes; correction can be found only as current revision on a new search, forget cannot revive. Preserve existing projection regression tests.
4. Temporary configuration returns without a Memory owner/bindings/projection; filesystem instrumentation confirms no selected-library open/stat/readdir/read, including missing/corrupt/inaccessible path. Original synthetic task/report still completes.
5. Malformed query/arguments fail before execution; missing/corrupt/symlinked library fails without writes. Cancellation/error closes read handle; existing writer lock is neither acquired nor removed.
6. Record genuine baseline RED, focused GREEN, applicable full regressions, build and independent locked install/build/CLI/byte readback. No paid/provider calls. Version/phase/tag/release remain pending root review and the sole publisher. Article work is separate and does not block code qualification.
