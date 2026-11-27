# Optional third provider: owner-only Gemini free API

The owner launch config can select exactly one certified model by adding:
```json
{
  "geminiFreeBackup": {
    "model": "gemini-4-hydrogen",
    "maxOutputTokens": 3072,
    "maxAttempts": 10
  }
}
```
Keep the existing owner Go and OpenAI Terra route profiles. If Hydrogen is unavailable on the verified project, the only alternative accepted is `gemini-3.8-flash`, set deliberately instead. The adapter never changes models automatically.

Set `ETF_GUI_GEMINI_FREE_API_KEY` from the restricted project's credential store and set `ETF_GUI_GEMINI_FREE_PROJECT_VERIFIED=1` **only** after independently confirming the account is on the free Gemini Developer API tier with no billing enabled. The switch is an operator attestation, not an API capable of enforcing Google's billing configuration. Remove the switch/config before enabling paid billing. Do not place credentials in JSON, logs, or command-line arguments. Do not expose this owner launch without the existing access boundary. If the key is invalid, the configured launch fails closed.

Free API terms allow Google to use data submitted to the service to improve products and allow human review. Do not send private material, personal information, investment holdings, attachments, conversation history, tool outputs, or memory. Every qualifying first message requires a fresh intentional check of the public-only box. It sends only that exact question, without Google Search grounding, tools, or tenant context; the answer is not equivalent to researched output. Automatic route choice never copies the prompt from an already-dispatched request.

For a new root, only when Go health is unavailable, check the Terra owner's local attempts/credential and (as needed) bounded authenticated model metadata GET. Skip generation on both primary routes only if this observed predispatch check indicates known transport or transient service unavailability. Ambiguous, unauthorized, rate-limited, and model-not-found metadata results do not authorize switching. All generation attempts, even uncertain outcomes, consume the selected owner's durable cap. There is no automatic replay.
