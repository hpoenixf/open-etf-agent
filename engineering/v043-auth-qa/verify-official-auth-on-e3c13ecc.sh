#!/bin/sh
# Disposable fixture checkout only; never run in a deployed tree.
set -eu
if [ "$#" -ne 4 ]; then
  printf '%s\n' 'usage: verify-official-auth-on-e3c13ecc.sh AUTHOR_CHECKOUT APP_PATCH OFFICIAL_DEP_ROOT NODE26' >&2
  exit 2
fi
APP=$1 PATCH=$2 DEP=$3 NODE=$4
for path in "$APP" "$PATCH" "$DEP" "$NODE"; do
  case "$path" in /*) ;; *) printf '%s\n' 'canonical absolute paths required' >&2; exit 2;; esac
done
[ "$(realpath -e -- "$APP")" = "$APP" ]
[ "$(realpath -e -- "$DEP")" = "$DEP" ]
[ "$APP" != "$DEP" ]
[ "$("$NODE" --version)" = v26.11.1 ]
unset NODE_OPTIONS NODE_PATH OPEN_ACCOUNT_REAL_TEST
printf '%s  %s\n' 'd606e815aa01742b1528c08b71c83d12ecb6f1b858f2771ec1c617e508160821' "$PATCH" | sha256sum --check --strict -
printf '%s  %s\n' '39621684167a28102e617b8cbf6a0a6c87233e2f3bcd4ec2a64199502cb3c611' "$DEP/package-lock.json" | sha256sum --check --strict -
"$NODE" --input-type=module - "$DEP" <<'JS'
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const dep=process.argv[2];
const lock=JSON.parse(await readFile(join(dep,'package-lock.json'),'utf8'));
const exact=JSON.parse(await readFile(join(dep,'node_modules/better-auth/package.json'),'utf8'));
const root=lock.packages['node_modules/better-auth'];
assert.equal(exact.name,'better-auth');assert.equal(exact.version,'1.7.27');
assert.equal(root.version,'1.7.27');
assert.equal(root.resolved,'https://registry.npmjs.org/better-auth/-/better-auth-1.7.27.tgz');
let checked=0;
for(const [path,pkg] of Object.entries(lock.packages)){
 if(!path)continue;
 assert.ok(/^[a-zA-Z0-9@._/-]+$/.test(path)&&!path.split('/').includes('..'));
 assert.equal(new URL(pkg.resolved).origin,'https://registry.npmjs.org');
 assert.match(pkg.integrity,/^sha512-[A-Za-z0-9+/]+={0,2}$/);
 checked++;
}
console.log(JSON.stringify({version:exact.version,registry:'https://registry.npmjs.org',integrityEntries:checked}));
JS
cd -- "$APP"
BASE=0c39fd1f4ad9b8dca9f811a77bb2c0a4f3bc86d3
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  # Base commit must be the actual published commit for normal checkout.
  test "$(git rev-parse HEAD)" = e3c13ecc736c3a70312e73b1796faa52ec9bf3af
  test "$(git rev-parse HEAD^{tree})" = "$BASE"
else
  # Alternatively, a newly staged archive may carry the exact index without a commit.
  test "$(git write-tree)" = "$BASE"
  git diff --quiet
fi
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  test -z "$(git status --porcelain)"
else
  test -z "$(git ls-files --others --exclude-standard)"
fi
test -d node_modules
test ! -L node_modules
test "$(realpath -e -- node_modules)" = "$APP/node_modules"
test ! -e node_modules/better-auth
test ! -L node_modules/better-auth
git apply --check --whitespace=error "$PATCH"
git apply --whitespace=error "$PATCH"
ln -s -- "$DEP/node_modules/better-auth" node_modules/better-auth
"$NODE" --input-type=module - "$DEP" <<'JS'
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const dep=process.argv[2];
assert.equal(fileURLToPath(import.meta.resolve('better-auth')),join(dep,'node_modules/better-auth/dist/index.mjs'));
const {getMigrations}=await import('better-auth/db/migration');
assert.equal(typeof getMigrations,'function');
JS
OPEN_ACCOUNT_REAL_TEST=1 "$NODE" --test --test-concurrency=1 test/account-site.test.mjs
