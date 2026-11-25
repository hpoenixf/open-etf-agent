**English** | [简体中文](v070-self-host-diagnostics.zh-CN.md)

# v0.70.0 · Self-host deployment diagnosis

Separate missing dependencies, runtime version, configuration, directory access and the local listener.

- [Usage and reproducible example](../self-host-diagnostics.md)
- [Implementation PR #43](https://github.com/hpoenixf/open-etf-agent/pull/43) at candidate `5f6b5244fec1acdd30470ec0518906910edbbcc9`, merged source `7b7e3a586c8bae962359654247680a2fe3db3e54`.
- Node 26.11.1 and 6 focused tests. [Full GitHub Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45538212719).
- The checks distinguish first launch, missing configuration, dependency drift, version mismatch and a real loopback service. The HTTP probe does not expose the serving version.
- No model calls or changes to the GUI and stored formats. To roll back, restore the previous stable installation.

This records source verification. The GitHub Release, Stage and production have separate readbacks.
