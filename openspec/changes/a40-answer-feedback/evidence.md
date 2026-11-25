# Synthetic CLI verification

```sh
fnm exec --using 26.11.1 node --version
fnm exec --using 26.11.1 node --test test/answer-feedback-cli.test.mjs test/publication-cli.test.mjs
openspec validate a40-answer-feedback --strict
fnm exec --using 26.11.1 npm run docs:check
fnm exec --using 26.11.1 npm run build
```

The synthetic feedback check uses three original committed publications and separate CLI processes. It covers exact earlier revisions, concurrent initial duplicate submissions, cold readback, payload conflicts, wrong hash/revision, unknown Run, Child and protected-profile exclusion, withdrawal and replay, read with no feedback file, and unchanged original Session bytes.
