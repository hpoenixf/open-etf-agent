# v0.6 maintenance: filesystem error identity survives wrappers

This is a narrow Runtime maintenance change, not a v0.7 recovery claim. The reviewed storage source matches the public MIT main baseline `ea84f5b64d56b355c1d058b9f00dd31617250646`, blob `4b7ef2b410328d991bf9c856971c37c695c44137`.

## Failure observed before the change

The existing Artifact path recognized only a bare `error.code === 'EEXIST'` before checking the old bytes. A wrapper that preserved the native error as `cause`, or reconstructed an Error using its native message, caused identical immutable publication to fail. The mkdir-race path had the same outer-code assumption.

A local diagnostic performed real filesystem link/mkdir operations, then wrapped their actual EEXIST errors. The native-code Artifact control succeeded. Both wrapper forms rejected an already correct Artifact and a safely created directory: four actual failure observations, not missing imports or fabricated filesystem return values. This reproduces the failure class, not every external wrapper environment.

## Changed boundary

Only `storage-files.mjs` changes. At its own failed link/mkdir operation, the helper examines a bounded cause chain. It accepts the expected errno with matching available syscall/path metadata, or the exact native EEXIST message for that specific operation and its actual paths. It does not search arbitrary error text for an errno.

The helper does not turn publication into success. A recognized link conflict remains a typed EEXIST for the existing Artifact owner, which must still reopen bounded nonsymlink bytes and compare every byte. Different bytes, unreadable files and symlinks remain errors. A directory race still passes through `safeDirectory`. Cancellation, unknown errors, different errnos and mismatched operation/path identities cannot become success.

Memory writer-lock and one-use-intent semantics are unchanged. Existing locks are not stolen; a known consumed intent is still refused. ResultStore's unknown/orphan outcome is not relabelled a settled result. ENOENT handling is unchanged. The exact-message fallback is intentionally narrow, not a general localized-message or all-platform compatibility promise.

## Targeted qualification

On Node **26.11.1**, one serial worker and 512 MiB maximum Node heap:

```sh
node --test --test-concurrency=1 test/storage-files-errors.test.mjs
```

The final portable test passed **13/13**; the isolated v0.6 aggregate passed **184/184** (171 existing tests plus 13 maintenance tests). It covers raw/cause/message real link and mkdir EEXIST; unknown text, different errno and cyclic causes; different immutable bytes; artifact symlink; cancellation after conflict; mkdir symlink race; incorrect syscall/source/destination metadata in both direct and cause errors; and preservation of unknown null/undefined rejection reasons. A review first reproduced a null rejection being replaced by a TypeError; optional property access fixed that specific loss of evidence. The source and test hashes are in [the safe receipt](v06-errno-maintenance.safe.json).

The aggregate ran the original v0.6 source/test/fixture snapshot plus this storage patch and test on Node 26.11.1, resolving the existing pinned dependency directory. It was not a new npm installation and does not qualify the new SQLite profile. A reported Node 26.8.1 success remains separately identified as user-reported; this executor had no existing 26.8.1 binary and did not download one. Static review found no 26.11 patch gate or SQLite import in v0.6 application/build code; the old patch floor existed in root package metadata, not executable version checks.

All diagnostic inputs were original synthetic text and owned local temporary files. No model calls, private source, credentials or production database were used. Raw logs and disposable files are excluded from publication.
