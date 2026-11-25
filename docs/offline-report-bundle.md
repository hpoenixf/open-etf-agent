# Verify a published research report offline

Use an existing project and the Run ID of a report you can already open. Run from the checked-out repository with the supported Node version.

```sh
node src/report-bundle-cli.mjs export --project /path/to/project --run my-run --out ./portable-report
node src/report-bundle-cli.mjs verify --bundle ./portable-report
```

Open `report.md` in any text editor. `citations.json` maps original reference numbers to recorded public HTTPS URLs. A Web extraction chunk is the position within the saved static text. The physical page and section fields are null when the original record lacks those locations. Files imported locally, links with queries, and unverified sources are represented only in the omitted count. Source excerpts, file paths, runtime-generated source footers and operational IDs do not travel with the bundle. Authored report text is retained verbatim, so handle it within the original report's sharing scope.

Copy all three files. Keep the export's `manifestSha256` in a separate trusted note if you need to detect a replacement of the entire bundle.

```sh
node src/report-bundle-cli.mjs verify --bundle ./portable-report --expect-manifest YOUR_SAVED_SHA256
```

The offline check reads only the bundle. It checks integrity of the stored bytes and does not visit citations or assess the research. The destination must be a new directory. The manifest is written last, so an interrupted export without a manifest fails verification. Retry into a new directory.

Existing reports retain their storage and permissions. A Run with an unverifiable save record or without a committed publication cannot be exported. Reverting the candidate removes the CLI, and the original reports and created bundles remain readable as ordinary text and JSON.

For a reproducible example containing both public and local references, run `node --test test/report-bundle.test.mjs`. The example uses synthetic data, calls the real readback and CLI, and verifies a copy after removing the synthetic project.
