#!/usr/bin/env bash
set -euo pipefail
umask 022
[[ $# == 4 ]] || { printf 'usage: %s GIT_CHECKOUT FULL_COMMIT EXPECTED_TREE EMPTY_OUTPUT_DIRECTORY\n' "$0" >&2; exit 2; }
repo=$(realpath "$1"); commit=$2; tree=$3; out=$(realpath -m "$4")
[[ "$commit" =~ ^[0-9a-f]{40}$ && "$tree" =~ ^[0-9a-f]{40}$ ]]
[[ $(git -C "$repo" rev-parse "$commit^{commit}") == "$commit" ]]
[[ $(git -C "$repo" rev-parse "$commit^{tree}") == "$tree" ]]
mkdir "$out" # fail rather than mixing old artifacts with this build
mkdir "$out/source"
git -C "$repo" archive "$commit" | tar xf - -C "$out/source"
(
  cd "$out/source"
  node_version=$(node -p 'process.versions.node')
  [[ "$node_version" == '26.11.1' ]]
  npm_version=$(npm --version)
  version=$(node -p 'require("./package.json").version')
  npm ci --ignore-scripts --no-audit --no-fund
  npm run build
  npm prune --omit=dev --ignore-scripts --no-audit --no-fund
  node dist/src/cli.mjs --case document-compare --output "$out/smoke-runs" > "$out/cli-smoke.txt" 2>&1
  node --input-type=module -e 'import { readFileSync } from "node:fs"; const r = JSON.parse(readFileSync(process.argv[1], "utf8")); if (r.mode !== "fixture" || !r.cases?.length || r.cases.some(c => c.status !== "completed")) process.exit(1);' "$out/cli-smoke.txt"
  lock=$(sha256sum package-lock.json | cut -d' ' -f1)
  printf 'version=%s\ncommit=%s\ntree=%s\nnode=%s\nnpm=%s\nplatform=%s\nlock_sha256=%s\n' \
     "$version" "$commit" "$tree" "$node_version" "$npm_version" "$(node -p 'process.platform + "/" + process.arch')" "$lock" > release.receipt
  # Ship only build outputs, runtime dependencies, and required package metadata.
  tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -cf - \
    dist node_modules package.json package-lock.json release.receipt | gzip -n > "$out/open-etf-agent.tar.gz"
  cp release.receipt "$out/"
)
(cd "$out" && sha256sum open-etf-agent.tar.gz > SHA256SUMS)
