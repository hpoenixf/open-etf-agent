## ADDED Requirements

### Requirement: Reproducible share-class comparison

The CLI SHALL compare an annual fee on the same basis, complete holding and sector weight distributions on matching identifiers, and returns with exact endpoints on the same return basis. It SHALL expose snapshot identity, as-of date, currency, requested window, inputs, formulas and missing data. A share-class or currency mismatch inside a series SHALL reject that input. A date or currency mismatch across snapshots SHALL withhold the comparisons. An absent value SHALL remain missing and SHALL NOT become zero.

#### Scenario: Recompute from the example files

- GIVEN the two public synthetic snapshots
- WHEN the caller compares 2026-10-01 through 2026-10-31
- THEN fee difference is 10 basis points and holding and sector overlaps are 8,000 and 9,000 basis points
- AND the returns are 8% and 3%, with a difference of 5 percentage points
