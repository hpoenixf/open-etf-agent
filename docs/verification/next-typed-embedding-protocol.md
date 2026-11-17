# Typed embedding protocol: offline candidate

This is an isolated next-version contract, not a real backend or a release.
`embedding-protocol.mjs` keeps document and query roles distinct even for identical
text. It preflights the entire batch with `truncation:false`, rejects missing or
positive truncation flags and token overflow before invoking any encoder, and
routes prepared inputs to distinct document/query callbacks. Encoders must return
the exact prepared-token digest and an explicit non-truncated receipt. All inputs,
token arrays and output vectors are copied and frozen. No automatic retry exists.

Model-specific prompts and special tokens must be included in the tokenizer's
reported IDs. A future real backend must consume those exact IDs, or independently
prove its encode_document/encode_query tokenization is identical. A dishonest
adapter can lie in its receipt: this contract is not remote-provider attestation.
It does not validate model weights, tokenizer revision, license or semantic quality.
It is not connected to the acquisition port, Runtime, shared budget or a process
launcher yet. The existing acquisition prototype still uses its old flat callback;
do not claim the end-to-end acquisition path already enforces this new contract.

Node 26.11.1 offline checks: the new test initially failed because the module was
absent. Review then found sparse input arrays could reach the tokenizer before
rejection. A new regression failed before the fix; explicit own-index density
validation now rejects holes (including inherited substitutes) before callbacks.
Seven protocol tests and nine existing acquisition tests passed (16/16).
Tests cover role routing, complete-batch preflight, oversize rejection, missing or
positive truncation evidence, token-digest mismatch, invalid vectors, malformed
roles, leading/trailing/middle holes, mixed valid/invalid batches and
pre-cancellation. Synthetic tokens/vectors are wiring evidence only.

No model download, socket/service startup, network request, dependency install,
paid call, remote write or old task schema change occurred. The helper relies on
the acquisition owner's bounded wait around uncooperative callbacks; that remains
a mandatory integration gate, not an optional adapter convention. It does not promise
remote termination, exactly one physical request or persisted recovery receipts.
