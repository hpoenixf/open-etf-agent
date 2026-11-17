# Offline local-model manifest preparation

This independent preparation tool removes the need to hand-assemble the complete
file/SHA map required by the existing local embedding worker. It does not load a
model, fetch weights, install packages or touch the frozen Session authorization
candidate.

Run with Node 26:

```
node scripts/prepare-local-model.mjs --config model-config.json --output model-manifest.json
```

Config fields: modelDir, model, revision, dimensions, maxTokens, prompts (explicit
document and query strings), plus optional maxModelBytes. Output must be outside
the model directory; writing is exclusive, so an existing manifest is not replaced.
No model-file content is printed. The result reports the exact manifest-file SHA256,
file count, byte count and `qualification: byte-inventory-only`.

The inventory streams file hashing rather than buffering weights, with default and
maximum total size 8 GiB, 4096-file/directory bounds, 2 MiB JSON and 1 MiB manifest
bounds. It rejects symlinks, directory escapes, unsupported module types, Python or
pickle-style weight/code files, auto_map/custom-pipeline configuration and missing
safetensors. Module paths must name inventoried directories. File metadata is
checked before/after hashing and directory metadata after traversal to detect
ordinary concurrent changes. The operator must still keep the tree immutable;
this is not a sandbox or a guarantee against hostile concurrent path replacement.

Model and revision are explicit labels, not authenticated download provenance.
Filename/safetensors presence is not validation of tensor contents, license,
architecture compatibility, tokenizer behavior, semantic quality or installed
library provenance. Only standard Transformer/Pooling/Normalize module layouts are
admitted by this first tool, matching the restricted worker's declared scope.
The bytes-hashed identity includes all model files and explicit role prompts.

Verification: new tests initially failed without the module. Node 26.11.1 combined
manifest and existing process tests pass 16/16. Python fake-worker tests remain 3/3.
Coverage includes complete deterministic inventory, identity changes with file
bytes, exclusive output, output-parent symlink back into weights, malformed and
unsupported trees, size bounds, and CLI output whose SHA matches actual manifest
bytes. Independent review found a file named __proto__ was lost through the
ordinary-object setter. The new regression reproduced fileCount 4 versus 3 mapped
files. The inventory now uses a null-prototype map. Tests verify the own key and
hash, identity change with its bytes, and actual Python-worker full-file validation
of the generated manifest using an injected fake model. Test weights are explicitly
synthetic, not real models. No claims about
real SentenceTransformer loading are made.

Real packages and audited weights are still absent. This is a usable preparation
command for when selected local weights become available, not documentation offered
instead of implementation. No new permissions, network/provider calls or paid
requests were needed. Independent review is required before WIP backup.
