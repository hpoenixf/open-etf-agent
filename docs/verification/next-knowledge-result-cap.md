# Next-version Knowledge result cap (offline evidence)

Baseline: v0.31.0, `14be5d2fb29a537b75fcc36ac40774608e1393d8`.

New projects enabling `knowledge` now persist `knowledge.maxResults: 8` when
no explicit cap is supplied. An explicit smaller cap remains authoritative.
This is a new-project default, not a migration or a change to v0.31 evidence.

The v0.31 B03 model requested `limit: 5` against a maximum of four and was
rejected before retrieval. This change permits that argument in new default
projects. It does not establish that a real model will now complete B03 or
increase any published benchmark score.

## Compatibility and boundaries

- Historical omitted caps still normalize to four. No historical tool schema,
  definitions hash, task snapshot or source binding is rewritten.
- Existing projects opt in via a configuration revision explicitly setting
  `knowledge.maxResults: 8`. Newly admitted tasks use that revision; admitted
  tasks retain their original configuration and resume under it.
- Updating unrelated settings does not implicitly adopt the new default.
- Limits above eight are still rejected; the model may omit `limit` to use its
  frozen project cap. Invalid arguments are not silently clamped.
- Default source bytes remain 128000, page bytes 64000, encoded result budget
  768000, and context ceiling 1048576. More result slots do not promise eight
  complete pages will fit. Existing coverage and partial-result signals remain.
- Retrieval continues returning immutable whole-page source text, not
  automatically truncated evidence. No embedding/network dependency is added.

## Verification

New integration tests exercise default eight, `limit: 5`, explicit lower caps,
unchanged byte budgets, and a consumed-query interruption under a historical
omitted cap. After an explicit project upgrade to eight, the historical task
resumes without redispatching the consumed query or changing its binding.

Tests use deterministic fixtures only, with no provider call or credentials.
