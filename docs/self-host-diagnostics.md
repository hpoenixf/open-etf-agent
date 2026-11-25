# Diagnose an Open ETF Agent installation

Run the standalone command from the checked-out release. Use the same account and Node executable as your launcher for a meaningful directory permission and Runtime check.

```sh
node src/deploy-doctor-cli.mjs --project ./local-project
node src/deploy-doctor-cli.mjs --json --project ./local-project --port 8787 --expect-node 26.11.1
node src/deploy-doctor-cli.mjs --mode live --project ./local-project --live-config ./live-launch.json
```

The five checks distinguish the installation and its direct dependencies, the supported Node range and optional expected versions, launch config, directory access, and the local listener. The installed app version is read from its package manifest. The existing HTTP listener exposes no running version to this check. A responding homepage only establishes that the local listener can serve its application route.

Choose `--port` only for an existing GUI bound to 127.0.0.1. The command issues one bounded HEAD to `/` without redirects or a response-body read. Without a port, health is skipped. Live config is only checked when requested, using the existing configuration validator. Environment values and business content are excluded from the report. A missing project on first launch is informational when its location is accessible.

Output exits 0 with no failed checks, 1 with one or more failed checks, and 2 for invalid command options. For automation, parse the `deploy-doctor@1` JSON schema's check IDs, statuses and codes. Recommendations are human-readable text.

This command creates no files and starts no services. Reverting it leaves your deployment and stored data intact. Run `node --test test/deploy-doctor.test.mjs` to reproduce the first-launch, malformed setup, secret redaction, version, working GUI, redirect and connection-failure checks.
