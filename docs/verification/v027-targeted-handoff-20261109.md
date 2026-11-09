# v0.27 targeted Child handoff: historical failure and offline correction

## Actual historical observation

The fixed integrated source `12b93` was used by `live-v027-targeted-two-20261109-080758`. T01 selected comparison-profile revision 2 / method version 2, admitted a real Child and read both synthetic sources. Three actual model requests were Go-billed and adopted, with zero unknown outcomes. The Child completed its answer, but its 4357 UTF-8 bytes exceeded the then-frozen 4000-byte method setting. The original parent rejected the handoff with `CHILD_METHOD_OUTPUT_LIMIT` and ended `TOOL_FAILED`; Main did not consume a successful derived result or publish a final report. T02 was never dispatched.

The inspection path also attempted the same handoff and threw the output-limit error. The test worker exited 1; its coordinator asserted exit 0 and reported `ERR_ASSERTION` plus generic `BRIDGE_NATIVE_REJECTED`. Those secondary labels were not a provider outage or an unknown paid request. Historical failure evidence and budget records remain unchanged.

## Subsequent user-directed change

The user explicitly requested cancellation of this limit. Both Child execution paths now deliver intact string summaries without a dedicated summary-byte ceiling. New method descriptors use `output: {}`; the built-in comparison method has version 3. Old valid `maxSummaryBytes` values remain exact immutable identity metadata only. Existing stored questions and bindings are not rewritten; legacy question wording is reconstructed identically for recovery. New methods do not include that wording. The earlier diagnostic-only `handoffFailure` catch is not part of this change.

This does not reopen the failed T01, replay any request, run T02, or establish live success. Existing Runtime final-answer capacity, Gateway input capacity, context, authorization, source identity, call counts, deadlines and cost boundaries remain. No automatic truncation, paginated handoff or continuation is added.

## Offline evidence

A directed eight-module run passed 81 tests before two additional legacy-value cases were added; the final affected child-execution module then passed all 34 tests. Coverage includes complete 18000-byte Chinese summaries with new and legacy 4000/8000/16000 descriptors, exact legacy prompt reconstruction, unchanged descriptor identity, cold readback, malformed outcome rejection, source/handoff integrity, real independent-process recovery, and profile/CLI operations. These are offline fixtures with zero provider requests, not additional live qualification. Remaining unrelated limits are not claimed to be removed.

Compatibility boundary: legacy descriptors and prompt bytes were checked under the new implementation, and its fixtures were closed/reopened. This run did not generate a checkpoint with the old 12b93 binary and then recover that same checkpoint using the new binary; cross-binary recovery is not claimed here.
