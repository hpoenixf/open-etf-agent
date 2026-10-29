# v0.15 candidate evidence — incomplete qualification

Base public source: `d7882908a84b19c68548c6d8857e15ab5c820214`. Local implementation is not a published source pin. No formal release, remote write or real model call is claimed. Current package version remains the last delivered version until version/publishing policy is separately settled.

## Observed stages

- Behavioral RED: original next-request/byte-readback test reached a loadable but unimplemented consumer and failed (0/1); not an import failure.
- First mechanism GREEN: same success assertion 1/1.
- Initial focused boundaries: 11/11, including original terminal Child result/parsed page text into Main, same root budget, failure/unknown, cancellation and independent CLI.
- Related regression before review fixes: 56/56. This is historical, not final-source full qualification.
- Independent review required two changes: actual adapter.reconcile crash window rather than only parent result-committed; and genuine read-only Session/Result/Host rather than healthy-byte equality alone.
- Review fixes: 14/14, including child-terminal/parent-tool-dispatched kill with `reconciled:true`, missing store refusal and real hot-journal refusal with unchanged bytes.
- Final focused tests: 18/18; final full suite: 450/450, zero failure/cancellation/skip, 64.981 seconds. Node 26.11.1, heap 512 MB, single worker.
- R3 independent code review: GO; read-only reconcile now rejects before any extension callback (15.17). This is not live or semantic qualification.
- Independent clean locked offline installation, build, compiled CLI run, separate original read and terminal resume: all five stages exit 0. Original two source refs and report hash match; read/resume preserve session bytes. Actual provider calls: 0. See `verification.safe.json`.

## Scope-to-evidence map

| Contract | Exact evidence selection | Boundary |
|---|---|---|
| C15-01/02/03 independent context and consumed original content | specialist-child 15.1,15.2 | Real Runtime/Gateway encoder, injected local transport; no provider request |
| C15-04 original readback | specialist-process 15.10; specialist-readonly 15.13/14 | Native read-only Session and original read-only storage; rejects recovery/absent paths |
| C15-05 serial execution | 15.1 request sequence; 15.18 deferred Child request proves no Main request while Child is pending | No parallel capacity claim |
| C15-06 second/mixed dispatch | 15.3/15.4/15.15 | Fixed parent/task durable lookup; legacy sibling policy unchanged |
| C15-07 root limits/deadline | 15.7; session “child scope cannot extend grant, provider binding, root budget or deadline”; durable-runtime “original absolute deadline expires across process restart” | Existing Owner cases reused only for their exact clauses |
| C15-08 reservation/cancel ordering | ordinary-response “OR-13/21 cancellation and model reservation linearize in SQLite commit order”; specialist 15.9 | Existing reservation semantics; no instantaneous remote revocation promise |
| C15-09/10 partial/unknown | 15.5/15.6 plus original persisted effects | Known terminal failure preserves actual source; uncertain model reservation blocks continuation |
| C15-11 settled reconciliation | specialist-process 15.12 | Actual kill with parent tool-dispatched and Child terminal; Child requests not repeated |
| C15-12 forged facts | 15.8/15.15 plus strict Session/Host identity validation | No source promotion from derived summary |
| C15-13 stale observation/fence | ordinary-response “OR-22 Runtime re-reads the authoritative checkpoint after claim”; session “child admission requires current parent fence” | Reuses unchanged Runtime/Session; does not claim a new distributed lock |
| C15-14 legacy behavior | Final full suite 450/450 | Not inferred from new focused cases |
| C15-15 authorization | specialist-process 15.16; default fixture transport has no external network implementation | New key or private grant is not a public live allowance |
| C15-16 actual models | NOT RUN / authorization pending | Required original roadmap qualification remains open |
| C15-17 install/build/process | Five independent stages PASS; original two sources/report hash verified | Installation does not imply model quality |

The command entry is `node src/specialist-cli.mjs run --session <new-owned-dir>`, `read --session <dir> --run <id>`, and bounded `resume` of the supported settled-handoff path. It is explicitly provider-free. No package script or key flag is invented.

README/author biography and article updates by other owners are preserved through a fresh publication base; this candidate does not overwrite them. Article/site completion is separate, not a substitute for live-mechanism qualification.
