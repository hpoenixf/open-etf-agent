"""Independent CPU reference using the model card's tokenizer/mean-pool recipe.
Run explicitly with the separately pinned local environment; never downloads.
"""
import argparse
import json
from pathlib import Path
import torch
from transformers import AutoModel, AutoTokenizer

parser = argparse.ArgumentParser()
parser.add_argument('--model-dir', required=True)
parser.add_argument('--inputs', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
inputs = json.loads(Path(args.inputs).read_text())
root = str(Path(args.model_dir).resolve())
tokenizer = AutoTokenizer.from_pretrained(root, local_files_only=True, trust_remote_code=False, token=False)
model = AutoModel.from_pretrained(root, local_files_only=True, trust_remote_code=False, token=False, use_safetensors=True).to('cpu').eval()
rows = []
with torch.no_grad():
    for item in inputs:
        text = ('passage: ' if item['kind'] == 'document' else 'query: ') + item['text']
        batch = tokenizer([text], add_special_tokens=True, truncation=False, return_tensors='pt')
        ids = batch['input_ids'][0].tolist()
        assert 0 < len(ids) <= 512
        hidden = model(**batch).last_hidden_state
        mask = batch['attention_mask']
        hidden = hidden.masked_fill(~mask[..., None].bool(), 0.0)
        pooled = hidden.sum(dim=1) / mask.sum(dim=1)[..., None]
        vector = torch.nn.functional.normalize(pooled, p=2, dim=1)[0].tolist()
        rows.append({'kind': item['kind'], 'text': item['text'], 'tokenIds': ids, 'vector': vector})
overflow = len(tokenizer('passage: ' + 'hello ' * 600, add_special_tokens=True, truncation=False)['input_ids'])
assert overflow > 512
with Path(args.output).open('x') as f:
    json.dump({'rows': rows, 'overflowTokenCount': overflow, 'device': 'cpu', 'recipe': 'model-card masked mean pooling + L2 normalization'}, f)
