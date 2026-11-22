"""Stage Open's existing E5 snapshot only; never run inference or change service config."""
import argparse, hashlib, json, os, re, shutil, subprocess
from pathlib import Path

pins = {
    "model-manifest.json": "943e6f6e81786dcbddbebd3d52f7f3df8ea535abf24e9823b5ec8374249bf3de",
    "model-download-receipt.json": "6d96875f38b1596f43478b174c132dad1181d92e18f32fcd7de4915e1ff20a28",
}
p = argparse.ArgumentParser()
p.add_argument("--metadata", type=Path, required=True)
p.add_argument("--stage", type=Path)
a = p.parse_args()

def sha(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()

for name, expected in pins.items():
    if sha(a.metadata / name) != expected:
        raise SystemExit(f"Pinned metadata mismatch: {name}")
manifest, receipt = [json.loads((a.metadata / name).read_text()) for name in pins]
identity = ("intfloat/multilingual-e5-small", "614241f622f53c4eeff9890bdc4f31cfecc418b3")
assert tuple(manifest[k] for k in ("model", "revision")) == identity
assert tuple(receipt[k] for k in ("model", "revision")) == identity
assert manifest["dimensions"] == 384 and manifest["maxTokens"] == 512
files = receipt["files"]
assert len(files) == 9 and {f["path"]: f["sha256"] for f in files} == manifest["files"]
base = f"https://huggingface.co/{identity[0]}"
prefix = f"{base}/resolve/{identity[1]}/"
assert sum(f["bytes"] for f in files) == 492795290
card = receipt["modelCard"]
assert card["url"] == f"{base}/raw/{identity[1]}/README.md"
for f in files:
    relative = Path(f["path"])
    assert not relative.is_absolute() and ".." not in relative.parts
    assert re.fullmatch(r"[A-Za-z0-9_./-]+", f["path"])
    assert f["url"] == prefix + f["path"]
if a.stage is None:
    print("Pinned checked-in metadata verified; no download or inference")
    raise SystemExit(0)
if not a.stage.is_absolute() or a.stage.parent.resolve(strict=True) != a.stage.parent:
    raise SystemExit("Use a new absolute staging directory with a real, operator-owned parent")
os.umask(0o077)
a.stage.mkdir(mode=0o700)
model = a.stage / "model"
model.mkdir()
(model / "2_Normalize").mkdir()
shutil.copyfile(a.metadata / "model-manifest.json", a.stage / "model-manifest.json")
shutil.copyfile(a.metadata / "model-download-receipt.json", a.stage / "model-download-receipt.json")

def download(url, dest, expected, size):
    dest.parent.mkdir(exist_ok=True)
    part = dest.with_name(dest.name + ".partial")
    # Disable user curlrc and avoid any cookie/auth forwarding. Follow only HTTPS for official artifact redirects.
    subprocess.run(["curl","--disable","--proto","=https","--proto-redir","=https","--fail",
        "--location","--max-redirs","6","--connect-timeout","15","--max-time","1200",
        "--max-filesize",str(size),"--silent","--show-error","--output",str(part),url], check=True)
    if part.stat().st_size > size or sha(part) != expected:
        raise SystemExit(f"Artifact checksum or size mismatch: {dest.name}")
    part.rename(dest)

for f in files:
    dest = model / f["path"]
    download(f["url"], dest, f["sha256"], f["bytes"])
    if dest.stat().st_size != f["bytes"]:
        raise SystemExit(f"Artifact size mismatch: {dest.name}")
download(card["url"], a.stage / "upstream-README.md", card["sha256"], 1048576)
(a.stage / "MODEL-STAGED").write_text(pins["model-manifest.json"] + "\n")
print("Staged nine checksum-matched official files and model card; no inference")
