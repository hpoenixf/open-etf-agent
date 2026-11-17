# Local process embedding candidate (not real-model qualified)

## Implemented boundary

`createLocalEmbeddingBackend` launches one explicitly selected trusted local
executable lazily, with no shell and no HTTP service. It exposes the typed
`tokenize`, `encodeDocument`, and `encodeQuery` interface. The owner must call
`close()` in finally; cancellation/timeouts kill the direct child and permanently
close the backend, with no respawn or retries. Descendant termination is not
promised. Concurrent requests are rejected. Each JSONL response binds the request
ordinal and immutable model-manifest digest. Input, stdout and cumulative stderr
are byte bounded. Provider stderr is not returned as user-facing diagnostics.
The parent environment is not forwarded; a small explicit offline environment is
used. Those offline flags are not OS network isolation or a sandbox for arbitrary
executables. Only an authorized trusted command may be configured.

The optional backend identity is frozen into acquisition plan@2. Existing plans
without it remain readable. It records model label and full manifest digest;
labels alone are not authenticated provenance or a semantic benchmark.

## Restricted Python backend

`scripts/local-embedding-worker.py` accepts absolute model-dir, external manifest
and exact manifest SHA256 arguments. Manifest schema `local-embedding-model@1`
requires revision, explicit document/query prompts, dimensions, maxTokens, and a
complete relative file-name to SHA256 map. The worker checks every local file,
rejects symlinks/path escapes and extra files, requires safetensors and rejects
pickle/Python weight/code files, custom modules and auto_map configurations.
Only standard Transformer/Pooling/Normalize modules are accepted. The model uses
CPU, local_files_only=True, trust_remote_code=False, token=False, and safetensors.
All weights/configuration must remain immutable during the process lifetime;
startup hashing is not protection against concurrent hostile file replacement.
Dependencies and local executable also need independent provenance qualification.

Model-specific prompts are explicit, not guessed. Preflight tokenizes the full
prompt+text including special tokens without truncation; over-limit pages are
rejected, not silently shortened or chunked. It invokes encode_document or
encode_query and guards the model's actual tokenization before forward execution:
actual IDs must exactly equal preflight IDs. Unsupported internal tokenization or
model layouts fail closed. No general compatibility claim is made.

Official API basis: [SentenceTransformer reference](https://sbert.net/docs/package_reference/sentence_transformer/model.html)
and [migration guide](https://sbert.net/docs/migration_guide.html). The role-specific
methods select retrieval task semantics; explicit prompts override model defaults.
The guarded-token path is deliberately narrower than all supported library models.

## Verification and outstanding gates

Node 26.11.1: 32/32 local-process, typed-protocol and acquisition tests passed.
Python: 3/3 worker tests passed with an explicitly injected fake SentenceTransformer.
They validate roles/token accounting, pre-encode overflow rejection and custom-module
rejection, not actual embeddings. New process tests initially failed without the
implementation. Tests cover timeout, mid-request cancellation, permanently closed
state, sparse arguments, response identity, malformed output, and byte limits.
Independent review found JSON null could throw outside the request promise and
crash the host. A child-process regression reproduced exit 1. Response envelopes
and operation-specific results now require exact non-null object shapes before
property access; isolated null/primitive/array cases and malformed result/extra
field cases reject without host termination.
The existing acquire durable-commit boundary remains: backend waiting is bounded,
filesystem durability is not an overall strict timeout.

Read-only dependency check found torch, transformers and sentence_transformers
absent. No dependencies or weights were downloaded, no real model was loaded, and
no service or paid provider was called. A real backend still needs pinned dependency
and model/license qualification, exact-token compatibility testing, semantic cohort
validation, and independent code review. Shared paid-request accounting and dynamic
Runtime retrieval remain separate gates. This is a replaceable offline candidate,
not a release or proof that the actual SentenceTransformer path runs here.
