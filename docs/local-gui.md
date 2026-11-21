# Local research workspace (v0.39 candidate)

The desktop and mobile browser workspace is a **local, single-operator offline demo**, not a hosted service or a live-model integration. The public v0.38.0 Research Project, Conversation, Worker and Publication owners are unchanged. The browser never holds provider configuration or credentials.

## Start

Use Node 26.8.1–26.x and the locked dependencies. Point the GUI at a new home for its synthetic demo; it refuses a different existing research project. The second invocation may reuse that exact directory.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run gui -- --project ./test-output/local-gui
```

Open the exact `http://127.0.0.1:PORT` origin printed by the command. Create a conversation, choose the fee or tracking synthetic ETF source, and enter a question. The script reads only the selected pinned original and constructs a labeled persisted report. It does not interpret the question, evaluate investments, access external data, call a model, or incur provider fees. Select **核对来源 [1]** to read the saved source. Reload the page or stop/restart the process with the same directory to see the same completed turn and source. The GUI never dispatches work from a read. It stops cooperatively on SIGINT/SIGTERM and never automatically starts a new Run after reload.

Desktop shows History, conversation and source evidence; phone layout uses a collapsible History panel and a source sheet. Search conversations by the displayed first question or conversation ID, reuse a past question as an editable draft, and copy or download the exact saved report as Markdown. Report download does not start new work. Draft questions and source selections stay in this browser, separated by Project and conversation. To keep drafts across stopping and restarting the server, keep the exact origin, for example by adding `--port 4179`. They do not sync with another browser or device. Projects are private to this local process/OS user; do not publish the port, proxy it, or share the directory. Use one GUI process per Project. The browser separately records the Project-scoped retry envelope in session storage until acknowledged, to preserve the original message ID and payload after a missing response. A draft never replaces that envelope; any legacy envelope without a Project identity is never retried automatically or adopted by the new GUI. The backend stores conversation identity, Run, output and source proof.

## Development

```sh
node --test test/local-gui.test.mjs
npm run build
```

`local-gui@1` is a thin host view, not a new runtime or a replacement for Reader. The HTTP routes bind to loopback, strict Host and Origin; allowed same-origin mutations carry only a local conversation/message identity, typed action, or an explicit synthetic-manifest selector. The report download is an allowlisted read of the verified saved report, not a general file route. Raw source/report text is rendered as text. There is no public login, raw path/file route, upload, provider selection, private plugin import, runtime replacement, domain/DNS deployment, or extra dependency. Real browser-device and production qualification are separate.
