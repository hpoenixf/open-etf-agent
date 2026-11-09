# v0.27 S06 condition-matrix observation

Fixed executable product: `4bfa7f9d979a344e89e16ed5b15eaead195ac3e7`, `source-faithful-report@2` and `host-results@3`. Batch: `live-v027-s06-20261109-122208`. This is a new synthetic matrix, not a replacement for S03/S05 or a release qualification.

## Independent result

Main and one Child completed, the report was consumed, and a separate terminal process cold-read the report. Original owner/work/cold exited 0. All six real requests were subscription Go, reported cost 0, and adopted; this batch had zero unknown/unadopted requests. Permanent reservation 24 and all historical unknowns remain unchanged.

Actual persisted report bytes, hot state, cold state and receipt agree: 9,435 bytes, SHA256 `71d5f99ca12e08838a2a340e3029dae4cd9241a748b53ae783e5fa710419c87d`.

The core semantic matrix passed independent review. Aster/Fir satisfy explicit sufficient conditions; Birch/Dahlia remain unconfirmed rather than rejected; Cedar has a known unmet condition. Elm correctly remains unconfirmed: a certificate for a removed device cannot transfer, but the sources do not establish that no separate certificate exists for the replacement. The preparation plan's expected negative for Elm was too strong; source evidence, not that expectation, governs review. Tables, body and summary agree.

Minor wording limitations remain: suggested next steps mention a sequence, an additional written authority conclusion, or a record procedure not established by the sources. They must not be promoted to mandatory eligibility conditions.

## Limits

No `read_result` call or paging occurred. Configuration and closure do not prove actual wire projection. The new source rules are clearer and differ from S05, so this pass does not establish a causal improvement from guidance v2 or erase prior semantic findings. Earlier scores and failures are retained.

The latest fixed product still requires its own complete ten-task Runtime cohort under the original threshold of at least 9/10, with fixed denominator, no failed-case replacement and separate lifecycle/coverage review. This targeted case is outside that denominator. No release, main merge or tag is announced.

Independent review receipt SHA256: `a7c8e59e9bbe31fb28b06bfbb584cf0a57d459717107b0f7c40bb591d6ed1345`. No credentials, raw provider bodies, logs or database files are included here.
