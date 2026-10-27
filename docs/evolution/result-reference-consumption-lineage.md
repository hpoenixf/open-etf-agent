# Result / Reference: preserve the original consumption contract

Status: planning only, 2026-10-27. This is a controlled adaptation of ETF Agent's existing Result/Reference responsibilities, not a verbatim source release or a new same-named architecture. Detailed original-source pins and restricted review remain outside this public repository. No private code, SQL, Spec prose or payload is copied here.

| Original responsibility retained | Existing public reuse / smallest increment | Explicitly excluded |
| --- | --- | --- |
| Immutable original result identity and precise selection/coverage | Existing `results.mjs` keeps raw source text; add only one bounded table/window binding to exact operand rows. | General stored-query language, refresh catalogue, new storage or acquisition platform. |
| Calculation receives the selected original bytes and records observed relationships | Existing calculator resolves bound operands, records their real input bindings and limitations. Equal values do not prove lineage. | Generic Python dataflow, inferred per-output dependence from a source union, new arithmetic library. |
| Stored, materialized, submitted and cited are separate facts | Exercise existing Runtime and actual Gateway serialization; compare exact submitted result/metadata, not just a tool-success label. | Claims about model reasoning, financial truth or real-provider receipt from fixtures. |
| Original references, derived values and artifacts have different purposes | Existing numeric report projection and CSV Artifact consume the original derived ref; source citations remain original source facts. | A second citation registry, generated values gaining original-source authority, narrative policing. |
| Local failure does not erase independent delivery | Reuse Publication/Artifact authority and readback; unavailable numeric/attachment material stays local and truthful. | New body/finish gate, repair loop, current-permission framework or full recovery redesign. |

The public baseline already has immutable ResultRefs, explicit arithmetic, actual next-step scripted consumption and downloadable CSV. This increment joins their currently separate facts; it must not announce them as newly invented modules. The existing [result-consumption article](https://hpoenixf.com/eff-agent-article/articles/financial-agent-python-result-consumption) explains why execution success, numeric qualification, actual model input and final delivery differ. It was read at article source `fc5b8c7147404a1ef17a7c8c1840e440abe8efb6`. Its Python and financial-method scope is substantially wider than this proposed public JavaScript slice.

No new dependency or system prerequisite is proposed. Reuse the current Node, locked Zod, Result, calculator, Gateway, Artifact serializer and Reader. If a new module/dependency becomes necessary, stop that expansion for scope review rather than hiding it as an adapter.
