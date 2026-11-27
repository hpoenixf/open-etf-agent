# Owner OpenAI backup
Owner GUI deployments using the exact OpenCode Go route may enable an independent
OpenAI Responses backup in trusted launch configuration. Supply
`ETF_OPENAI_API_KEY` only as a server credential. Never store it in project
configuration or pass it to the GUI. Use an explicit bounded operator setting:
```json
{"openAIBackup":{"profile":"owner-gpt-6-1-terra@1","maxOutputTokens":4096,"maxAttempts":100}}
```
The cap applies cumulatively to admission tickets in the existing project,
including unknown outcomes. There is one backup transport slot. Owner turns
without attached files can be routed before the first inference; scheduled
reports and tasks with stored Memory are not eligible. A short credential-free
HEAD probe and a 30-second cooldown from observed transport outages guide
selection. A dispatched request whose outcome is unknown is never replayed.
A later Run can use the backup independently. A Run that starts using Responses
keeps its model route for its remaining inference, including tool continuation;
answers publish through the same durable readback path. An explicit OpenCode
reasoning setting is not a promise of the same effective setting in Responses.

The same three-minute no-progress detection and terminal unknown capacity
maintenance apply to the separate OpenAI ledger. A local release leaves the
original unknown state and its accounting untouched. Continued research fits
its working context against the selected Responses request envelope before
reserving or sending its next inference.
