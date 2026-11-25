## ADDED Requirements

### Requirement: Read-only Skill author preflight

The CLI SHALL validate with the existing catalog loader and preview the selected Skill's exact read result. It SHALL distinguish catalog discovery, on-demand loading and Host tool admission. It SHALL run local synthetic case assertions without executing Skill scripts, connecting to tools or requesting models. Unsupported frontmatter, inactive IDs, missing resources and failed case assertions SHALL have actionable diagnostics.

#### Scenario: A valid Skill suggests a tool the Host did not provide

- GIVEN a valid Skill with a matching synthetic case and advisory tool mentions
- WHEN the case reviews supplied Host tool names
- THEN the output includes the unprovided tool as a diagnostic
- AND neither the Skill nor the preflight grants it
