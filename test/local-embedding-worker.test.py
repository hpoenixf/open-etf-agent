"""Offline contract tests; injected fake is NOT a real embedding implementation."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('worker', 'scripts/local-embedding-worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class Array:
    def __init__(self, value): self.value = value
    def tolist(self): return self.value
    def __getitem__(self, key): return Array(self.value[key])

class FakeModel:
    calls = []
    def __init__(self, path, **kwargs):
        assert kwargs['local_files_only'] and not kwargs['trust_remote_code'] and kwargs['token'] is False
        assert kwargs['model_kwargs']['use_safetensors']
        self.max_seq_length = 8
        self.tokenizer = lambda text, **kw: {'input_ids': [ord(c) for c in text]}
    def get_sentence_embedding_dimension(self): return 2
    def tokenize(self, texts, **kwargs):
        ids = [ord(c) for c in texts[0]]
        return {'input_ids': Array([ids]), 'attention_mask': Array([[1] * len(ids)])}
    def encode_document(self, texts, **kwargs): return self.encode('document', texts, kwargs)
    def encode_query(self, texts, **kwargs): return self.encode('query', texts, kwargs)
    def encode(self, role, texts, kwargs):
        self.tokenize([kwargs['prompt'] + texts[0]])
        self.calls.append(role)
        return Array([[1, 0] if role == 'document' else [0, 1]])

class PromptProbeModel(FakeModel):
    def encode(self, role, texts, kwargs):
        # SentenceTransformer 5.1.2 probes the prompt length before the batch.
        self.tokenize([kwargs['prompt']])
        return super().encode(role, texts, kwargs)

class WrongBatchModel(FakeModel):
    def encode(self, role, texts, kwargs):
        self.tokenize([kwargs['prompt']])
        self.tokenize([kwargs['prompt'] + texts[0][:-1]])
        return Array([[1, 0]])

class StrippingPromptModel(PromptProbeModel):
    def tokenize(self, texts, **kwargs):
        return super().tokenize([text.strip() for text in texts], **kwargs)

class WorkerTest(unittest.TestCase):
    def run_worker(self, requests, module_type='sentence_transformers.models.Transformer', model_class=FakeModel, extra_files=None, prompts=None):
        Path('test-output').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir='test-output') as temp:
            root = Path(temp).resolve(); model = root / 'model'; model.mkdir()
            files = {'modules.json': json.dumps([{'type': module_type, 'path': ''}]).encode(), 'model.safetensors': b'SYNTHETIC-NOT-WEIGHTS'}
            files.update(extra_files or {})
            for name, value in files.items(): (model / name).write_bytes(value)
            manifest = {'schemaVersion': 'local-embedding-model@1', 'revision': 'test', 'prompts': prompts or {'document': 'D', 'query': 'Q'}, 'maxTokens': 8, 'dimensions': 2, 'files': {name: hashlib.sha256(value).hexdigest() for name, value in files.items()}}
            data = json.dumps(manifest).encode(); path = root / 'manifest.json'; path.write_bytes(data); digest = hashlib.sha256(data).hexdigest()
            wire = b''.join((json.dumps(dict(r, manifestSha256=digest))+'\n').encode() for r in requests)
            inp = io.TextIOWrapper(io.BytesIO(wire)); out = io.TextIOWrapper(io.BytesIO())
            fake = types.ModuleType('sentence_transformers'); fake.SentenceTransformer = model_class; FakeModel.calls = []
            with patch.dict(sys.modules, {'sentence_transformers': fake}), patch.object(sys, 'argv', ['worker', '--model-dir', str(model), '--manifest', str(path), '--manifest-sha256', digest]), patch.object(sys, 'stdin', inp), patch.object(sys, 'stdout', out):
                worker.main()
            return [json.loads(x) for x in out.buffer.getvalue().splitlines()]
    def test_roles_and_full_tokens(self):
        requests = []
        for i, role in enumerate(['document', 'query']):
            ids = [ord(c) for c in ('D' if role == 'document' else 'Q')+'cash']
            requests.append({'id': i, 'operation': role, 'input': {'kind': role, 'text': 'cash', 'truncation': False, 'tokenIds': ids, 'tokenIdsSha256': worker.digest(ids)}})
        result = self.run_worker(requests)
        self.assertEqual(FakeModel.calls, ['document', 'query']); self.assertEqual(result[1]['result']['vector'], [0, 1])
    def test_oversized_tokens_do_not_encode(self):
        with self.assertRaises(ValueError): self.run_worker([{'id': 1, 'operation': 'document', 'input': {'kind': 'document', 'text': 'long text', 'truncation': False}}])
        self.assertEqual(FakeModel.calls, [])
    def test_custom_modules_rejected(self):
        with self.assertRaises(ValueError): self.run_worker([], 'untrusted.CustomModule')
        self.assertEqual(FakeModel.calls, [])
    def test_prompt_length_probe_keeps_full_batch_token_guard(self):
        ids = [ord(c) for c in 'Dcash']
        request = {'id': 1, 'operation': 'document', 'input': {'kind': 'document', 'text': 'cash', 'truncation': False, 'tokenIds': ids, 'tokenIdsSha256': worker.digest(ids)}}
        self.assertEqual(self.run_worker([request], model_class=PromptProbeModel)[0]['result']['vector'], [1, 0])
        with self.assertRaises(ValueError): self.run_worker([request], model_class=WrongBatchModel)
    def test_large_tokenizer_is_bounded_and_custom_config_still_rejected(self):
        large = json.dumps({'padding': 'x' * (3 * 1024**2)}).encode()
        self.run_worker([], extra_files={'tokenizer.json': large})
        for name, content in [('other.json', large), ('tokenizer.json', b' ' * (32 * 1024**2 + 1)), ('tokenizer.json', json.dumps({'auto_map': {}, 'padding': 'x' * (3 * 1024**2)}).encode())]:
            with self.assertRaises(ValueError): self.run_worker([], extra_files={name: content})
    def test_standard_transformer_strips_only_prompt_probe_whitespace(self):
        ids = [ord(c) for c in 'D cash']
        request = {'id': 1, 'operation': 'document', 'input': {'kind': 'document', 'text': 'cash', 'truncation': False, 'tokenIds': ids, 'tokenIdsSha256': worker.digest(ids)}}
        self.run_worker([request], model_class=StrippingPromptModel, prompts={'document': 'D ', 'query': 'Q '})

if __name__ == '__main__': unittest.main()
