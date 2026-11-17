"""Restricted SentenceTransformer JSONL worker; requires independently qualified deps.
No downloader, remote-code modules, pickle weights or HTTP service. Fail closed.
"""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import sys

LIMIT = 2097152

def digest(value):
    return hashlib.sha256(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()

def require(ok):
    if not ok:
        raise ValueError("EMBEDDING_WORKER_REJECTED")

def safe_config(value):
    if isinstance(value, dict):
        require(not any(k in value for k in ("auto_map", "custom_pipelines")))
        for child in value.values():
            safe_config(child)
    elif isinstance(value, list):
        for child in value:
            safe_config(child)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--manifest-sha256", required=True)
    args = parser.parse_args()
    root = Path(args.model_dir)
    require(root.is_absolute() and root.is_dir() and not root.is_symlink())
    require(str(root.resolve()) == str(root))
    with Path(args.manifest).open("rb") as f:
        raw = f.read(1048577)
    require(len(raw) <= 1048576 and hashlib.sha256(raw).hexdigest() == args.manifest_sha256)
    manifest = json.loads(raw)
    require(manifest["schemaVersion"] == "local-embedding-model@1")
    require(isinstance(manifest["revision"], str) and bool(manifest["revision"]))
    prompts = manifest["prompts"]
    require(set(prompts) == {"document", "query"} and all(isinstance(v, str) for v in prompts.values()))
    files = manifest["files"]
    require(isinstance(files, dict) and bool(files) and len(files) <= 4096)
    actual = set()
    for path in root.rglob("*"):
        require(not path.is_symlink())
        if not path.is_file():
            continue
        name = path.relative_to(root).as_posix()
        actual.add(name)
        require(name in files and path.suffix not in (".py", ".pyc", ".bin", ".pt", ".pth", ".pkl", ".pickle"))
        h = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(1048576), b""):
                h.update(chunk)
        require(h.hexdigest() == files[name])
        if path.suffix == ".json":
            require(path.stat().st_size <= LIMIT)
            safe_config(json.loads(path.read_text()))
    require(actual == set(files) and any(n.endswith('.safetensors') for n in actual))
    modules = json.loads((root / "modules.json").read_text())
    allowed = {"sentence_transformers.models.Transformer", "sentence_transformers.models.Pooling", "sentence_transformers.models.Normalize"}
    require(isinstance(modules, list) and bool(modules) and all(m.get("type") in allowed for m in modules))
    for module in modules:
        relative = Path(module.get("path", ""))
        require(not relative.is_absolute() and ".." not in relative.parts)
        require((root / relative).resolve().is_relative_to(root))
    require(modules[0]["type"] == "sentence_transformers.models.Transformer")
    # Imports and model diagnostics may never contaminate the protocol channel.
    with contextlib.redirect_stdout(sys.stderr):
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(str(root), device="cpu", local_files_only=True,
                                    trust_remote_code=False, token=False,
                                    model_kwargs={"use_safetensors": True})
    max_tokens = manifest["maxTokens"]
    require(type(max_tokens) is int and 0 < max_tokens <= model.max_seq_length)
    require(model.get_sentence_embedding_dimension() == manifest["dimensions"])
    tokenizer = model.tokenizer
    original_tokenize = model.tokenize
    while True:
        raw_line = sys.stdin.buffer.readline(LIMIT + 1)
        if not raw_line:
            break
        require(len(raw_line) <= LIMIT and raw_line.endswith(b"\n"))
        request = json.loads(raw_line)
        require(request["manifestSha256"] == args.manifest_sha256)
        operation, inp = request["operation"], request["input"]
        require(operation in ("tokenize", "document", "query"))
        kind = inp["kind"]
        require(kind in ("document", "query") and inp.get("truncation") is False)
        require(operation == "tokenize" or operation == kind)
        text = inp["text"]
        require(isinstance(text, str) and 0 < len(text.encode()) <= (512 if kind == "query" else 64000))
        ids = tokenizer(prompts[kind] + text, add_special_tokens=True, truncation=False)["input_ids"]
        require(0 < len(ids) <= max_tokens)
        if operation == "tokenize":
            result = {"tokenIds": ids, "truncated": False}
        else:
            require(inp["tokenIds"] == ids and inp["tokenIdsSha256"] == digest(ids))
            seen = []
            def guarded_tokenize(*positional, **kwargs):
                features = original_tokenize(*positional, **kwargs)
                actual_ids = features["input_ids"].tolist()
                masks = features["attention_mask"].tolist()
                require(len(actual_ids) == 1 and len(masks) == 1)
                actual_ids = [i for i, mask in zip(actual_ids[0], masks[0]) if mask]
                require(actual_ids == ids)
                seen.append(True)
                return features
            model.tokenize = guarded_tokenize
            try:
                with contextlib.redirect_stdout(sys.stderr):
                    method = model.encode_document if kind == "document" else model.encode_query
                    vector = method([text], prompt=prompts[kind], batch_size=1, show_progress_bar=False,
                                    convert_to_numpy=True, normalize_embeddings=False)[0].tolist()
                require(len(seen) == 1)
            finally:
                model.tokenize = original_tokenize
            result = {"vector": vector, "tokenIdsSha256": digest(ids), "truncated": False}
        wire = json.dumps({"id": request["id"], "manifestSha256": args.manifest_sha256, "result": result}, separators=(",", ":"), allow_nan=False).encode() + b"\n"
        require(len(wire) <= LIMIT)
        sys.stdout.buffer.write(wire)
        sys.stdout.buffer.flush()

if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Do not leak source text, filesystem locations or dependency diagnostics.
        sys.stderr.write("EMBEDDING_WORKER_FAILED\n")
        sys.exit(1)
