# v0.28 integrated candidate, not a release

The explicit advisory Report Review module is integrated on the released v0.27.0 source `96dba6123e337f54552c7c27bcb835929238a3d0`. This preserves the native Gateway session metadata and saved-report visibility fixes. The only changes to existing production files are allowing an explicitly empty tool allowlist in Session validation and the tool host. An empty list disables tools; it does not restore default tools.

Node 26.11.1 serial aggregate validation completed: 1,283 tests, 1,279 passed, zero failed, four compatibility skips. The 18 focused Review tests and build also passed. Independent read-only review found no reproduced permission expansion or integration regression. These are offline checks, not real-provider acceptance or evidence of reviewer accuracy.

The original ten source/report cases have been prepared under distinct new request identities for this integrated source. No new model call has been made for this candidate. Historical failed and unknown attempts remain preserved. The applicable shared provider window and cumulative accounting must permit dispatch before real qualification starts; local preparation does not grant an exception.

Runtime completion, valid structured findings and semantic usefulness are separate observations. Raw model output and original report bytes remain available even when findings fail validation. Nothing in this candidate certifies a report or authorizes rewriting or publishing it.

Package version remains 0.27.0 until release qualification. This document records an integrated WIP, not a tag, release or main merge.
