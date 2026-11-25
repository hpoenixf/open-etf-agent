**English** | [简体中文](v068-etf-snapshot-comparison.zh-CN.md)

# v0.68.0 · ETF snapshot comparison

Recompute fees, holdings and sector overlap, and same-basis returns from local snapshots.

- [Usage and reproducible example](../etf-snapshot-comparison.md)
- [Implementation PR #42](https://github.com/hpoenixf/open-etf-agent/pull/42) at candidate `4914e1259a978b8af6a3b4cea858c5ee7a84b078`, merged source `0d46ab558e64328cc860319e8bc2b995ae5ea4e8`.
- Node 26.11.1 and 4 focused tests. [Full GitHub Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45537538107).
- The reference inputs reproduce a 10 bps fee difference, 8,000 bps holding overlap, 9,000 bps sector overlap, and an 8% versus 3% return.
- No model calls or changes to the GUI and stored formats. To roll back, restore the previous stable installation.

This records source verification. The GitHub Release, Stage and production have separate readbacks.
