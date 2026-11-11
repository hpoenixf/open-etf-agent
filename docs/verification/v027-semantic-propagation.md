# v0.27 semantic propagation: four retained cases

Read-only diagnosis of `live-v027-guidance-cohort-20261109-123038`, fixed executable source `4bfa7f9d979a344e89e16ed5b15eaead195ac3e7`. Inputs were the four synthetic `RESULT.safe.json` records and public product source. No original runtime log, credential, private database or new model call was used. Hashes and call IDs are in `EVIDENCE.safe.json`.

## What can and cannot be concluded

This identifies the first *observed* appearance of an erroneous proposition in the persisted delegation → Child answer → Main report sequence. It is not a counterfactual proof that a particular prompt caused the error, nor proof that removing it will cure model reasoning. The records establish more than one failure mode; attributing all four to delegation would be incorrect.

| Case | Source distinction | First observed strengthening | Propagation |
|---|---|---|---|
| N05 | “试行方案不等于已生效” prevents inferring effectiveness from trial-plan status; it is not an explicit finding of non-effectiveness. | Main's `delegate_child.question` asks for “关于‘试行方案是否已生效’的明确否定性表述及其范围”. The premise already classifies the source as an explicit negative before the independent read. | Child labels it “否定性状态表述” and says it negates “已生效”, while partly qualifying this as inability to confirm. Main's table hardens it to “原文明确否定” and “直接否定”, and its conclusion repeats that classification. Main says its own review found the Child's negative scope consistent, so the final review did not catch the inherited premise. |
| N07 | “提前七天取消可申请退回使用费” supplies permission to apply under that condition, not guaranteed payment and not an exclusive necessary condition for applying. “临时取消只退押金” limits that case's refundable items. | The delegation requests condition classification but does not explicitly assert the wrong direction. Child first says advance cancellation is “至多是申请退使用费的必要前提”, conflating permission to apply with obtaining a refund. Child also says one cannot infer non-refund of the usage fee under “只退押金”, blunting the source's explicit exclusivity. | Main copies the necessary-condition account into its table and conclusion and states that its review retained the Child's “必要条件” strength. This is an independently introduced Child reasoning defect that Main failed to correct, not demonstrated Main premise injection. |
| N09 | “受理咨询，不代表资格审核通过” establishes no sufficiency; it does not establish that reception is *not necessary*. | Delegation requests boundaries and prerequisite classification without asserting “not necessary”. Child says the reception/review connection, including whether it is mandatory, is not specified. | Main's final section states “受理咨询既不充分也不必要” although its next sentence says necessity cannot be inferred. The clearest unsupported non-necessity assertion first appears in Main's final report, not in the Child's conclusion. |
| N10 | “预约可提交借阅申请” grants a conditional ability, without saying booking is the only route. “馆际运输与续借资格分别审核，批准条件不得混用” distinguishes two approval subjects, not all numbered situations. | Main's delegation already extends the second rule to “跨情境” and asks whether conditions can be applied from one situation to another. Separately, Child first turns the first rule into “预约之下才可提交”. | Child repeats a cross-situation prohibition; Main promotes it to a numbered restriction. Main also calls booking a prerequisite and argues from the absence of a non-booking route. Thus the scope error is first visible in Main's delegation, while the permission-to-necessity error is first visible in Child. |

These are not source-loss findings: both original synthetic pages remain in each handoff and report's source basis. Correct citation identity did not make the inference valid.

## Does Child lose the original question?

No. That diagnosis is contradicted by the current implementation:

- `src/child-execution.mjs:33–37` selects `question:selected.question` from the original bound parent scope and separately sets `localQuestion:value.question` from Main's delegation.
- `src/child.mjs:38–46` serializes both `originalQuestion` and `localQuestion`. In active `host-context@1`, method text, original question, local question, authorized documents and budget are siblings in one JSON task input.
- `child-execution.mjs:60,74` verifies the parent's question against the bound scope and reconstructs the Child question exactly for identity validation. Existing recovery does not silently substitute today's parent question.
- The tool description already tells Main not to strengthen the question; handoff already marks Child analysis derived and semantically unreviewed. Those natural-language warnings and labels did not prevent the observed errors.

The narrower structural issue is that free-form **Main-authored interpretation is included in the Child task channel alongside the original question**. The envelope keeps provenance as field names but does not make an independent read operationally independent of Main's premise. N05 and N10 demonstrate how this available channel can carry an unsupported proposition. Merely adding more prose to that same channel is not a strong isolation mechanism.

## Recommended mechanism, not another list of warnings

Introduce an explicit, versioned **independent evidence-review mode** for the existing original Child owner, rather than changing every delegation or creating a second execution system:

1. For this mode, Main selects an existing admitted method and authorized document subset. The Host builds the Child task from the immutable original research question, frozen operator method and original source identifiers. Do **not** forward Main's free-form interpretation as the Child's task text in this mode.
2. Retain any Main hypothesis unchanged in original history for audit, but not in the blind first-pass Child input. If hypothesis review is needed, expose it as a separately typed derived artifact only after the independent extraction, never as original evidence or an instruction to affirm it. This is a product-design option, not a claim that two model calls are always required.
3. Keep normal narrow delegation available under its existing frozen contract; some legitimate subtasks require a local question. Do not globally discard local questions or replace them with a regex-sanitized version. Pin the new mode in new task/binding identities; historic tasks must reproduce their old exact Child input bytes.
4. Where the existing task genuinely requires structured adjudication, make claims and their source spans distinguishable from reviewed conclusions. A typed support state can prevent the code from treating “no support found” as an explicit contradiction, but the Host must not pretend that JSON shape validation proves semantic truth. A structured record alone cannot repair N07 or N09.

Before implementation, align this mode with private's existing research/review ownership rather than invent a competing review framework. Tests should establish input separation, exact frozen original question, unchanged grants/budgets, historic recovery, and honest derived provenance. A deterministic fixture with a biased Main delegation must show the new independent Child wire input does not contain the biased local text while the audit history still does. Then use a fixed, newly disclosed semantic evaluation; do not relabel this cohort's defects or rerun until favorable answers appear.

## Limits of the proposed repair

Blind input can address the observed premise-contamination route, but it cannot alone fix Child's own logical inversion (N07 and part of N10) or Main's post-handoff strengthening (N09). Final review requires separate attention to support direction and conclusion consistency. No current evidence justifies claiming universal semantic safety, automatic contradiction detection, or a verified quality improvement. Release/runtime success and content quality remain separate.
