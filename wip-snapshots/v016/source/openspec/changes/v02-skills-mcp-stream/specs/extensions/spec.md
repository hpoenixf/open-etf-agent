# ADDED Requirements

## Requirement: Skills are data, not authority
An operator-selected local Skill root MUST expose only a supported frontmatter subset (name and description) in a catalog. A normal Tool Host call reads the body on demand, returning skill ID/version/content hash. No scripts execute. Body/resource paths MUST stay beneath a validated nonsymlink skill root; absolute/traversal/symlink paths, excessive bytes, malformed metadata and duplicate names MUST be rejected. Discovery, actual reading and model use MUST remain distinguishable.

### Scenario: malicious resource reference
Given an allowed skill, when its content asks for ../secret or shell execution, then no extra authority is granted and the path/tool is rejected.

## Requirement: Actual stdio MCP uses the official SDK
Trusted assembly MUST pin executable/args, spawn the original synthetic server and complete the SDK handshake. Discovery MUST follow pages with bounded cursors, reject duplicate names/unsupported schemas, and register only explicitly allowlisted tools. Discovering a tool never grants execution authority. Model call identity and SDK request identity MUST not be conflated. MCP text/structuredContent must be interpreted explicitly; unsupported image/audio/resource blocks MUST not become empty successful text.

### Scenario: process failure
On initialization failure, stdout protocol pollution, call failure, cancellation or normal completion, the adapter MUST close the client/transport and check the child terminates. No automatic command download or restart occurs.

## Requirement: Same Host, same source truth
The Skill and MCP tools MUST enter the ordinary Tool Host dispatch/receipt path and consume the same Runtime budget. A successfully read MCP page may become a source only after its document/version/page/text/hash shape is validated. The save tool MUST cite the actual returned snapshot, never a parallel copy. Removing extensions MUST leave the original default offline case usable.

## Requirement: Complete bounded model SSE
Gateway MUST assemble UTF-8/SSE fragments and function-call arguments by index/ID under a byte limit. Both a supported finish reason and the final DONE marker are required before any proposal is returned. EOF, missing terminal markers, duplicate IDs, malformed argument JSON, mismatched tool/text completion or oversized input MUST reject the whole proposal. Usage absent remains unknown. Cancellation aborts assembly and no partial tool is dispatched.

### Scenario: parseable partial call
Given argument text that happens to parse as JSON before completion, when the network ends without DONE, then zero calls reach the Host.

## Requirement: Independent evidence
The common four cases retain their denominator and real local readback. Additional skill-mcp evidence MUST show actual child-process tools plus ordinary model/Host routing; in-memory mocks do not satisfy stdio evidence. Fixture behavior and a provider's reasoning remain different claims. No live, semantic, release or recovery claim follows from local test success.
