# Owner GUI research depth
In owner live mode, choose **自动** to use the existing question flow, **普通** to prevent automatic routing without removing explicitly usable tools, or **深度研究** for a question that should be investigated against original sources. Auto is the default in the new GUI; there is no keyword rule. In the first normal model response, the model may take an optional structured local path: **Research** for a current evidence lookup or **Deep** for material multi-source analysis. Answering normally needs no extra model round. Choosing a route consumes one native local tool action and can need a next generation round, but never issues a separate classifier request. If no configured original-evidence tool can help, selection is not offered. Failed, malformed, unavailable and text-only claims never apply a route. Explicit Standard and Deep do not use the classifier. Standard does not auto-select the Chart Skill, but retains an explicitly selected, supported Skill.

Depth is a typed choice stored in the original immutable Conversation message. Admission freezes the versioned contract in Project and Run, injects it into a separate trusted system message, and History continues to show the exact user question separately. A repeat with the same message ID and mode acknowledges the same Run. Changing the mode is a new message, not a replay. Scheduled watches and local fixtures are unchanged.

The deep profile asks the model to check original sources, dates, comparability, disagreement and remaining gaps before delivering a single answer. Enabled web, Wind and PDF capabilities still follow existing trusted configuration and native source authority; nothing here adds a provider, changes tool rights or increases budgets. The model can finish as soon as the important claims are supported. A failed or unknown response retains native status; no automatic resubmission. If reliable evidence is unavailable, the expected result is an honest explanation, not a claim of access. Delivered reports are explicitly labeled unreviewed. Claims of verification inside model text never change that state. This is research guidance, not a deterministic financial quality guarantee.

The existing research-progress panel displays real tool/runtime events. It shows neither deliberation text nor fake percent-complete signals. API clients omitting the depth field retain the old fast behavior (also keeps pre-upgrade acknowledgements replayable). The GUI sends explicit Auto. This iteration does not change allowance, implement Private's staged delivery, or run the research reviewer/subagent workflow. No independently calibrated semantic quality is claimed from fake wire tests.

## Optional thinking effort

Thinking effort controls the provider request, independently of the research
route. By default the GUI sends no override. The trusted live-config opt-in
`"reasoningEffortProfile": "opencode-go-glm-5.3-flash-preview@1"` offers low,
high, and max only for the exact OpenCode Go owner GLM-5.3-Flash Chat
Completions route; do not turn it on for another model, provider or endpoint.
There is no generic medium mapping. An unverified route stays on Default.

The choice is frozen with the original message and its existing execution and
retry identity. When there is a recorded normalized model proposal after a
bound transport, History can label the value as serialized; missing evidence
does not prove anything was sent. An explicit setting or valid response does
not establish what the provider actually applied. History has no reasoning
content. The opt-in preview does not set a thinking toggle or preserve prior
reasoning. Use the original authorization and data policies. Synthetic wire
tests prove encoding and tool continuation through the harness, not successful
live Go adoption, improvement in research quality, or costs.
