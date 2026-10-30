# Contracts

## One immutable result owner
- ResultStore lives beneath the safe Run directory and owns a durable content index and immutable original snapshot records. Host's old source Map must be removed, not mirrored.
- Host constructs ResultRef from intrinsic document/version/page/name/media-type/content identity; neither model text nor an external candidate chooses a path. sourceId cannot be rebound to different intrinsic identity even when text hash matches.
- add/read verifies actual UTF-8 text/hash and exact identity. Duplicate identical acquisition may return the existing original record. Per-call transport identities are acquisition observations, not rewritten document identity.
- Unknown refs, corruption, symlink/path escapes and identity conflicts fail explicitly. Reread returns old bytes, not a fresh fetch of latest material. A new store instance can read existing refs using a bounded durable content index; no execution cursor is persisted.
- Main's child import accepts only explicitly validated original snapshots from allowed documents. It cannot ingest child summaries as pages or turn arbitrary refs into paths. Existing sourceId save calls resolve through this owner; saved manifest snapshots are delivery copies of stored original records, not a second mutable source registry.

## Context is a bounded next-request projection
- Keep original user question and needed restrictions. Treat each assistant calls plus all corresponding tool results as an indivisible ordered group. Preserve call IDs, statuses and error/permission information; never truncate JSON/schema or forge results. The original history is never discarded. Since this Runtime projects only at settled request boundaries, an incomplete/unsettled input group is rejected rather than fabricated or partially projected.
- Only successful settled original-source payloads actually stored may be replaced with usable exact ResultRefs and identifying metadata. A normal reread tool resolves those refs. No model summary or semantic compression occurs.
- If minimum required groups cannot fit, fail rather than erase original requirements. Label the limit as local UTF-8 bytes, not Provider tokens. Enforce a final encoded-request byte cap including tool definitions/wrappers at the Gateway; messages-only length is not sufficient.

## Real lexical retrieval and citations
- Query candidate selection occurs only within the explicitly allowed synthetic documents. Return ranked page locators, not acquired source claims; stable tie-break for equal scores. Zero/one-sided hits remain visible gaps.
- The retrieve-reread fixture must derive subsequent ordinary read_page calls from candidates, not fixed pages. Changing query or material wording changes the returned candidates and actual reads. Injection-shaped/scoped candidates cannot enlarge the grant.
- Numbered report citations map to actual acquired refs; invalid markers/refs reject. Numerical derived-result references retain actual inputs, units, denominator convention and code identity and must not masquerade as original pages.

## Exit boundaries
Default four questions, skill-mcp, batch-read and fixture-child remain executable. New result/retrieval/context mechanisms have separate tests and an independent install/build/demo. Original frozen versions stay unchanged. Live/model semantics, root license and formal publication remain separate open gates; no completion.json, resume or latest-provider guarantee.

## Review clarifications
Source records preserve the first actual acquisition; later calls returning the same intrinsic source retain their own adapter/protocol receipt in the tool observation without rebinding the document ref. A stored read_result returns the old source's provenance and is not a new upstream MCP call. Context replacement requires an explicit Host ResultRef, matching lookup ref, actual text hash and all intrinsic identity fields; arbitrary lookalike tool objects are not acquired sources. Numeric calculations use separate typed refs and never enter the original-source namespace.
