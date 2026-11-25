# Compare two ETF snapshots locally

Each input represents one share class. The example combines a JSON file with a CSV file.

```sh
node src/etf-compare-cli.mjs --left fixtures/etf-compare/alpha.json --right fixtures/etf-compare/beta.csv --start 2026-10-01 --end 2026-10-31
```

| Result | Hand calculation |
| --- | --- |
| Annual fee difference | 20 − 10 = 10 bps |
| Holding overlap | min(6,000, 4,000) + min(4,000, 6,000) = 8,000 bps |
| Sector overlap | min(5,000, 4,000) + min(5,000, 6,000) = 9,000 bps |
| Total returns | 108 ÷ 100 − 1 = 8%, 206 ÷ 200 − 1 = 3%, difference 5 percentage points |

Provide a fund ID, share-class ID, currency and date. Fees are integer basis points and have an explicit annual expense-ratio or management-fee basis. Each complete weight group must sum to 10,000 bps and declare its identifier system. Match identifiers exactly within the same system. For returns the supplied series repeats its share class and currency, uses one basis, and must have observations for the two exact endpoints. Return values are decimals rounded to 12 decimal places.

The CSV schema uses UTF-8 `kind,key,value` rows. The fixture lists the metadata keys and demonstrates a quoted identifier. Omit a complete section or leave a fee or observation value empty to report missing data. An explicit zero fee is valid. A snapshot date or currency mismatch withholds all comparisons. An incompatible basis or classification withholds only its own metric. File or shape errors exit nonzero. A well-formed partial comparison exits zero with per-metric statuses.

This command takes local read-only inputs and emits JSON without state or dependencies. Revert the change to remove it while preserving input files and previously saved calculations. Run `node --test test/etf-compare.test.mjs` to reproduce the reference results.
