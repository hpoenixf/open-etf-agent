# Source-fidelity guidance: two-task diagnostic

Date: 2026-11-09 UTC. This is an experiment, not release qualification.

## Scope

The generic `source-faithful-report@1` profile was overlaid on the frozen v0.26
Web candidate. The five-leaf guidance change is available at
[`e73b960b`](https://github.com/hpoenixf/open-etf-agent/commit/e73b960b106db11aca31dfff0330093557b2aee3).
That WIP starts from released v0.25.0; it is not the complete Web execution
snapshot, and its standalone tests must not be presented as combined-version
qualification.

Both new tasks used the same previously acquired RFC 3986 text and original
Project, source reader, model Gateway, persisted report and cold-reader paths.
No answer-specific instructions were added to the guidance, no source text was
changed, and no new public acquisition occurred. The question limit, 1 MiB
serialized context configuration and 128 KiB Web-page profile were unchanged.
These byte limits are not the model's token window.

- G01 repeated the previously completed W06 question about merging relative
  paths and removing dot segments. It was a new diagnostic task, not a replay
  of an unknown request or a replacement score for W06.
- G02 asked for the merge strings, dot-segment steps and final URIs for `g`,
  `../g` and `g/../h`, using base `http://a/b/c/d;p?q`. Source examples and the
  model's explanatory derivations had to be distinguished.

## Observed result

Both tasks completed and produced reports that were read back cold. Each used
three physical model requests. All six complete responses reported original
Go billing with cost zero and were adopted by the original Session. No new
unknown outcome was recorded. The unused four requests in the maximum-ten
allocation remain held; this observation does not erase earlier accounting.

| Task | Content observation |
| --- | --- |
| G01 | The earlier operand-order reversal did not recur: the report appends the reference path to the retained base prefix. `/a/g` and `mid/6` and their steps are correct. However, it incorrectly treats it as unknown whether the rootless second example could come from the authority-plus-empty-base-path special case. That case necessarily adds `/`, so it can be excluded. Its final summary also does not clearly say the retained base prefix includes the rightmost `/`. |
| G02 | The merge strings, dot-segment steps and final URIs `http://a/b/c/g`, `http://a/b/g` and `http://a/b/c/h` are correct. The report distinguishes RFC examples from its own intermediate derivations. One peripheral statement is too narrow: these results are not exclusive to the section 5.2 algorithm; permitted alternative algorithms must produce the same results. |

The model's proposals already contained these statements. Runtime persistence
and readback do not turn model reasoning into a semantic correctness guarantee.
The original W06 content error and all previous cohort results remain unchanged.

## Limits of the finding

This is one observation of each question, without a randomized or repeated
control comparison. It does not establish that the guidance caused the
improvement, that the error is eliminated, or that other research tasks are
correct. G01 still contains a reasoning defect. There was no retry to select a
better answer, and these two tasks are not added to an earlier release score.

Two earlier preparation attempts stopped before any credential read or model
request. The first rejected a stale expected configuration. The second stopped
when check-only validation exited nonzero; its original error code was not
retained. Independent inspection separately established that its frozen closure
lacked the required configuration-pointer file and therefore could not pass
admission. Those failures and their allocations are retained separately. The
successful preparation checks the actual generated claim before allocation;
prospective validation cannot mint runtime authority.

Reference: [RFC 3986, sections 5.2–5.4](https://www.rfc-editor.org/rfc/rfc3986#section-5.2).
