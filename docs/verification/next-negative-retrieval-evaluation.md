# Independent no-evidence evaluation support

This change is independent of the frozen Session authorization candidate. It changes
only the supplied-label retrieval evaluator, not Runtime query behavior, tool hashes,
source grants, Session or dynamic effects.

## Gap and explicit new protocol

Version 1 required every query to have at least one relevant source. Consequently
it could not measure retrieval against an explicitly labeled no-evidence question.
Version 2 (`knowledge-retrieval-evaluation@2`) permits an empty relevantSourceIds
array as a negative label. Old version 1 still rejects it and preserves its exact
result bytes, evaluation hash and result schema.

Version 2 returns `knowledge-retrieval-evaluation-result@2`, positiveQueries and
negativeQueries. recallAtK/mrrAtK average over positive cases only. Negative rows
have null recall/rank rather than division by zero. noEvidenceAccuracy counts
negative cases returning status no-evidence and no source; falsePositiveRate counts
negative cases returning at least one source. These metrics use negative cases only.
A missing cohort yields null, not a fabricated zero or perfect score. Version 2
is included in its evaluation hash so it cannot collide with a v1 label identity.

This is retrieval evaluation, not answer abstention or global absence certification.
Labels must describe relevance within the admitted immutable corpus. A negative
label is not justified just because a source contradicts a claim: contradictory
source text can itself be relevant evidence. Supplied labels/provider identity are
still unauthenticated; all outputs remain qualification: not-certified.

## Checks and measured negative control

Node 26.11.1: 13/13 negative-evaluation, existing v1 evaluation and vector tests pass.
New v2 tests first failed against the previous evaluator. Cases cover mixed and
single-class cohorts, incorrect vector matches, lexical fallback, sparse/duplicate/
out-of-scope labels and non-finite prevention. The full v1 golden result matches
the pre-change module byte-for-byte (SHA256
`646e8d2107581844fab4ea3d5cf21b911597422b7f93f669ec8e92e57752e4a9`).

A separate six-question synthetic control uses three literal pages:
- Cash reserves cover redemptions.
- Annual fee is charged monthly.
- Derivatives use is restricted to hedging.

Positive queries cash/fee/derivatives point to their respective pages. Negative
queries insurance/warranty/medical have no relevant page. A deliberately incorrect
synthetic insurance vector is included, not claimed as an actual model output.
At k=1, lexical and BM25 positive recall/MRR are 1 and negative no-evidence accuracy
is 1 with false-positive rate 0. Hybrid positive recall/MRR remain 1, while negative
no-evidence accuracy is 2/3 and false-positive rate is 1/3. This demonstrates the new
metric detects a vector-induced false positive that positive-only recall would hide;
it is not a measured real model quality comparison.

No model download, network/provider call, blocked authorization review or production
Session change occurred. No package/weight or paid-test access was needed. Existing
CLI accepts the explicit v2 cases object through the same evaluator; no CLI/API
side effects were added. Independent review remains required before WIP backup.
