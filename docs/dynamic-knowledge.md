# Dynamic local Knowledge queries — 0.32 candidate

[简体中文](dynamic-knowledge.zh-CN.md)

Knowledge reuses the admitted page vectors and encodes a new query inside its original Run. The main enhancement is Knowledge; Session and Runtime supply the existing reservation, fence, deadline and recovery owners. The normal BM25 CLI remains available without a model.

Use Node >=26.8.1 <27; actual qualification used 26.11.1. Install the locked Node dependencies. Obtain the public MIT `intfloat/multilingual-e5-small` revision `614241f622f53c4eeff9890bdc4f31cfecc418b3` and the exact Python environment described by [model/dependency provenance](../engineering/a20-local-embedding/model-download-receipt.json) and [hash-locked dependencies](../engineering/a20-local-embedding/requirements.lock). Weights are not distributed in this repository. Verify model files against [the manifest](../engineering/a20-local-embedding/model-manifest.json).

## Admit explicitly

A new Project enables `report` and `knowledge`, uses hybrid retrieval, and binds this additional config (substitute identities from your own admitted snapshot):

```json
{
  "knowledgeQuery": {
    "schemaVersion": "local-knowledge-query@1",
    "sourceManifestSha256": "<64-character source manifest SHA-256>",
    "modelManifestSha256": "<64-character model manifest SHA-256>",
    "pageEvidenceSha256": "<pageVectorIdentity of frozen evidence>",
    "maxTokens": 512,
    "maxQueries": 2
  }
}
```

Prepare page vectors once with `scripts/prepared-knowledge.mjs prepare`; supply a seed query that is **not** a business query. `export` produces the evidence file for `run submit --knowledge-vectors`. `pageVectorIdentity` from `src/knowledge-query-tool.mjs` hashes provider, dimension and page identities, excluding the finite prepared-query cache. The [executed ten-task config](../engineering/v032-dynamic-20261118/final/config.json) and [frozen plan](../engineering/v032-dynamic-20261118/final/PLAN.safe.json) show exact qualified inputs.

At work time, supply a private local mapping containing only absolute paths:

```json
{
  "schemaVersion": "local-embedding-runtime@1",
  "python": "/absolute/venv/bin/python",
  "modelDirectory": "/absolute/model",
  "manifestFile": "/absolute/model-manifest.json"
}
```

```sh
node src/research-cli.mjs run work --project YOUR_PROJECT --run YOUR_RUN --embedding-runtime YOUR_MAPPING.json
node src/research-cli.mjs knowledge inspect --project YOUR_PROJECT --run YOUR_RUN
node src/research-cli.mjs run report --project YOUR_PROJECT --run YOUR_RUN
```

Live chat still requires its existing explicit provider/data/cost approval and credential environment. Local encoding has no billable transport or HTTP embedding service. A caller-supplied backend is restricted to fixture Projects. Child, plugins, PDF and additional capabilities/adapters are rejected for this profile. This is a bounded local integration, not a general embedding service.

## Budget and recovery

Session schema 7 stores counters and exact receipts inside the original Session database. One original tool dispatch atomically reserves its tool slot, one query and two local protocol operations (`tokenize`, `encodeQuery`). A failed quota transaction changes none of those counters. The committed vector receipt precedes source ingestion; fences reject stale writes and input/profile changes.

Recovery recomputes retrieval from a complete typed receipt without starting a model. Missing, partial or uncertain work stays unknown and keeps its reservation; it is not re-encoded under a new ID. The original persisted deadline and cancellation still apply. A terminal output can be inspected without supplying the embedding runtime. These counters describe local operations, separately from Go chat requests and their actual costs.

## Evidence is not answerability

`only` never widens. `prefer` can expand only within the admitted collection. Source text stays whole, subject to original count and encoded-byte limits. Vector channel availability and candidate matches do not establish sufficient evidence. `coverage.completeWithinCollection=false` forbids a claim about absence in the whole collection; a fully covered `only` scope still excludes other documents. New dynamic tasks freeze `source-faithful-local-query@1` guidance. Old report profiles retain their exact bytes. Guidance helps the model reason; Host does not certify prose semantics.

[Qualification, per-task costs, failures and reproduction](verification/v032-release-readiness.md).
