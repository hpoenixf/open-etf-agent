# Synthetic CLI verification

```sh
fnm exec --using 26.11.1 node --version
fnm exec --using 26.11.1 node --test test/action-reminders-cli.test.mjs
openspec validate a15-action-reminders --strict
fnm exec --using 26.11.1 npm run docs:check
fnm exec --using 26.11.1 npm run build
```

The three CLI cases cover the complete lifecycle across fresh processes, read-only behavior before initialization, exact occurrence after defer, wrong time or stale commands, concurrent adds, unsafe linked storage and unchanged synthetic daily progress. The tests exercise local storage only. Each command in the design example invokes a new CLI process.
