# Develop and preflight a local Skill

Copy the example directory to try writing your own fund-research method.

```sh
cp -R fixtures/skill-preflight ./my-skills
node src/skill-preflight-cli.mjs validate --root ./my-skills
node src/skill-preflight-cli.mjs preview --root ./my-skills --skill fund-research
node src/skill-preflight-cli.mjs test --root ./my-skills --case fixtures/fund-research-skill-case.json
```

Validation uses the Runtime catalog's directory and frontmatter rules. Preview shows the exact text and hash that the local catalog returns on demand through `read_skill`. Use the actual directory ID in the command. The frontmatter supports exactly `name` and `description`, in that order. A local catalog must be selected by a Host and the Skill must be read before its text reaches a model. Copying a folder or passing this command does not enable it in the GUI.

An optional `## Suggested tools` section can list one backticked tool name per bullet. This documents intent. The Runtime frontmatter has no tool declaration field. The synthetic test reports which suggestions are absent from its sample Host list, then checks the expected text and reads the named resources as data through the existing loader. It does not execute a resource, contact an MCP service, call a model or score how a model would follow the method.

Run `node --test test/skill-preflight.test.mjs test/skills.test.mjs test/skill-composition.test.mjs` for the reproducible developer checks. The CLI does not install or change a Skill. Reverting this version removes the CLI and example while leaving previously configured Skills readable by the existing catalog.
