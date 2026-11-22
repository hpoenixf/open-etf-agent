# v0.39 Local Research GUI

**Candidate only; not a release or deployment.** Build a responsive browser surface for the original local Research Project. Private's familiar pattern (left History, central conversation, evidence on demand) informs the interaction, not implementation or code. Desktop and mobile share one UI and model.

## Contracts

| Boundary | Owner |
| --- | --- |
| Project and explicit sources | Existing Project and immutable source import |
| Message identity and selected source | Existing Conversation; duplicate original input returns the original Run |
| Running, completed, failed or cancelled | Existing Worker/Session state; GUI makes no new execution state or recovery proof |
| Answer and report | Existing Publication and Report; browser never recreates body or citations |
| Browser interaction | New local GUI view `local-gui@1`, no persistent browser authority |
| Provider, deployment, hosted accounts | Out of scope |

The initial vertical slice is explicitly synthetic and offline. It supports create/list/reopen, source selection, question submit, persisted result, and cold readback. It is not a financial answer-quality test. No new package dependency, private source, or external credential.

Final GUI qualification should test desktop Chromium and mobile Safari/WebKit, including same conversation reload/restart, one durable original report/run, source detail, offline/error states, keyboard navigation and bounded process cleanup. Release, any live-provider enablement and hosting are separate gates.

The local workspace supports first-question History search, Project- and conversation-scoped browser drafts, explicit reuse into an empty composer, and clipboard/download of the canonical saved Markdown report. Browser drafts are not a substitute for immutable pending submissions. Reads do not trigger research work.
