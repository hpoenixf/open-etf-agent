**English** | [简体中文](v069-skill-author-preflight.zh-CN.md)

# v0.69.0 · Skill author preflight

Validate and preview a Skill, then run a synthetic authoring case.

- [Usage and reproducible example](../skill-author-preflight.md)
- [Implementation PR #44](https://github.com/hpoenixf/open-etf-agent/pull/44) at candidate `9ba582177fabe413278e91b07b55317c6a9d802b`, merged source `1e9f4d300b6dbef5df5ea2262891020acb4bb193`.
- Node 26.11.1 and 8 focused tests. [Full GitHub Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45538632742).
- The fund-research fixture validates the real loader output, missing resources and advisory tool suggestions. Executable content is only read as data.
- No model calls or changes to the GUI and stored formats. To roll back, restore the previous stable installation.

This records source verification. The GitHub Release, Stage and production have separate readbacks.
