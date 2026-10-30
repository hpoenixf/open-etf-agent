# Local revocable-document demo (candidate v0.16)

This is an explicit, fresh, fixture-only profile over the original Session, Source/ResultStore, Runtime, Report/Artifact and Reader owners. It uses two public synthetic Atlas documents, not private files or an external model. Existing unprotected profiles remain separate. No migration of previous protected development layouts is supported.

## Run locally

Use the repository's supported Node 26 version. From its root:

```sh
node src/session-cli.mjs init-documents --session ./test-output/revocable-demo --profile document-revocation@1
node src/session-cli.mjs start --session ./test-output/revocable-demo --profile document-revocation@1 --case revocable-rag
```

The returned `runId` is control metadata, not a disclosure permission. The fixture executes lexical query, actual page acquisition, exact ResultRef reread, original CSV encoding, saved Report with attachment and final Publication. It has one root Run, at most eight model reservations (scripted, no physical model calls), eight tools and a 30-second original deadline.

```sh
node src/session-cli.mjs inspect --session ./test-output/revocable-demo --profile document-revocation@1 --run RUN_ID
node src/session-cli.mjs publication --session ./test-output/revocable-demo --profile document-revocation@1 --run RUN_ID
node src/session-cli.mjs publication-revisions --session ./test-output/revocable-demo --profile document-revocation@1 --run RUN_ID
node src/session-cli.mjs publication-event --session ./test-output/revocable-demo --profile document-revocation@1 --run RUN_ID
# The Run UUID is not the directory basename. Obtain the actual absolute directory.
RUN_DIRECTORY="$(node --input-type=module -e 'import {openSession} from "./src/session.mjs"; const s=await openSession({directory:process.argv[1],profile:"document-revocation@1",readOnly:true}); try { console.log(s.inspect(process.argv[2]).directory); } finally { s.close(); }' ./test-output/revocable-demo RUN_ID)"
node src/reader-cli.mjs --run "$RUN_DIRECTORY" --session ./test-output/revocable-demo --run-id RUN_ID --profile document-revocation@1
```

Reader listens only on loopback and reports its origin. Its root lists registered report revisions; revision metadata gives registered CSV IDs. Report/CSV downloads, their metadata, revision and original-source routes require current qualification on every GET or HEAD. Control `inspect` does not print the question, messages, source bodies, hints, report receipt or answer. Use the gated Publication/Reader paths for content.

```sh
node src/session-cli.mjs revoke-document --session ./test-output/revocable-demo --profile document-revocation@1 --document atlas-a --expected-revision 1
```

Revoke whichever document is referenced by the original source or disclosed query hint. A hint is a metadata dependency even when that page was never acquired. Revocation is monotonic: rerunning init cannot regrant, and missing/wrong profile cannot downgrade the existing library or protected artifacts. Existing bytes and past receipts are not deleted or rewritten. Subsequent gated Publication/history/event and Reader reads fail closed. Already admitted disclosures cannot be physically recalled.

`resume` requires the same exact fixture bindings and never resets original budgets/deadline or retries an unknown effect. `cancel` uses the original root cancellation authority. Report registration remains an independent original save effect, not a second delivery receipt or proof that the Run succeeded; an already saved registered report from a failed Run is readable only under current qualification.

## Scope and non-claims

- Five protected tools only: search_pages, read_page, read_result, create_csv (raw rows), save_report. Original encoder, source identity and immutable artifact verification remain authoritative.
- Two fixed synthetic documents; no arbitrary document ingestion, vector service, remote authorization, regrant, enterprise ACL or new manager.
- No protected plugins, hooks, Child, Memory, compaction, PDF lane, ordinary-response lane or background submit/work. Those original profiles are not silently enabled here.
- Same-user direct filesystem reads are outside mediated revocation. Protected marker/record/Session layout prevent accidental legacy API downgrade; they do not constitute an OS security boundary.
- Unknown crash reservations and partial artifact/report effects are preserved and not replayed. True-kill coverage is separate from deterministic transaction ordering; no exactly-once or physical unsend promise.
- CLI provider-free qualification passed three cases on its fixed candidate. The complete local execution commit `68dd43b06f39e34971b1761aa6a2cb655a1a2706` passed 488/488 tests and build. This later usage-directory correction is documentation-only; no product bytes changed. Earlier provider-free results are scoped to their exact fixed revisions. External model execution/public release remain blocked; no live qualification or v0.16 release is claimed.

The original proposal and early tasks are historical contract records. Final evidence must map their full retrieval/read/Publication/Report/CSV/Reader/CLI scope; a three-tool intermediate slice is not the complete module. Test parse/setup failures and the working-checkpoint defect remain in the engineering evidence rather than being overwritten by later passing runs.
