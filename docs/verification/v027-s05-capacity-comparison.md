# v0.27 S05: normal-capacity comparison

Fixed product: `a05693843abddf89f4396bbbb9feb7420828f387` (`host-results@3`). Batch: `live-v027-s05-20261109-115927`.

## Verified result

The new 128 KiB comparison completed Main, one Child, persisted report delivery, and a separate cold-reader process. Original owner, work, and cold-reader exits were 0. Six real subscription-covered requests were adopted (Main 4, Child 2); this batch recorded zero unknown and zero unadopted requests, with reported cost 0. Its permanent reservation of 24 remains held; historical unknowns are unchanged.

The report is 9,223 UTF-8 bytes. Actual persisted bytes, hot report, cold report, and receipt agree on SHA256 `eba2ceb1f3b84d4f35cccbfbbb135d410de8b777dd25481fe182c1151690e63a`.

## Content limitation

Independent semantic review is only a partial pass. Three synthetic stations marked “retest passed” were listed as eligible for formal use, although an approval record was absent. A footnote correctly recognized this uncertainty and the necessary-versus-sufficient distinction, but did not fix the table's affirmative conclusion. Retest status is supported; formal eligibility remains unestablished. Do not overwrite this outcome or rerun solely to obtain a better score.

## Coverage boundary

- No `read_result` call occurred in this batch: no new real paging claim.
- Configuration bound `host-results@3`, and terminal completion after report save is verified. Final safe state alone does not independently establish that report-input projection was applied to an actual outgoing model view.
- This is a synthetic 128 KiB capacity comparison, not a change to the product default, not the private project's default, and not proof that the 16 KiB pressure case was repaired.
- Preserve S04's measured capacity failure and S02's unknown outcome. Earlier qualification and semantic scores remain unchanged.
- One targeted real closure does not qualify v0.27 for release.

## Next valuable work

Keep the capacity finding separate from semantic quality. Check existing source-faithfulness guidance and evaluation assertions for necessary-versus-sufficient eligibility conclusions before proposing any versioned guidance change. A future release decision needs fixed-version qualification and explicit coverage evidence, not more repeats of this same case. Avoid forced tool choices or shortened outputs merely to pass the test.

Independent final-review receipt SHA256: `48cb2d35236bfc8eacccde875a88e370479d44a22ce962e351b44893d39bf4ea`. Summary contains no credentials, database files, request bodies, or raw logs.
