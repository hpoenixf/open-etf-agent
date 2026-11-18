# v0.33: research-material asset lifecycle (A17)

Status: implementation proposal; no release or parity claim.
Open baseline: `c0411d751ea0a54356b1ee4bfe13007652d49531`.

## Why this module follows v0.32

The November 12 roadmap provisionally put A17 at 0.32 and A14 at 0.33.
The later v032 proposal records the November 17 direction to complete the A20
scope cut from v0.31 **before moving to A17**. v0.32 delivered that continuation.
This proposal therefore moves the next module, not the old table's version label,
forward. It does not assert that the user specified the API design below.

## Existing owners and actual gap

`project-sources.mjs` already safely imports selected text/PDF files, persists
original bytes and extraction snapshots, validates hash bindings, and restores an
immutable manifest without reopening the original path. `research-project.mjs`
freezes that exact manifest into each admitted task. These are not replaced.

There is no durable, discoverable logical-source/version lifecycle above these
snapshots. `source list` requires an already-known manifest hash. Changed files
produce unrelated selectable snapshots, rather than an explicitly versioned
material with a current selection and retained previous versions.

The original research-material owner establishes useful contracts: equivalent content is idempotent, activation is scoped, derived
material retains provenance, and failed replacement must preserve the last valid
active version. They are behavioral references, not code or data to copy.

## Proposed public loop

Explicitly register one local selected text or PDF material under a bounded
logical ID; inspect/list its version history; replace using expected revision;
select a specific version's existing manifest for the existing task API; remove
from future active selection without deleting immutable evidence. Reopening a
project must reproduce that selection and version history. A failed or cancelled
import must not publish a replacement. Concurrent updates must not silently win.

The first implementation must expose a real CLI and exercise existing task
submission/readback, not only a new standalone registry helper. Historical task
bindings remain unchanged. Material removal is not claimed to revoke historical
admitted snapshots: a separate current-permission design is required for that.

## Boundaries

Reuse the current text/PDF formats, byte/page limits, provenance and explicit-file
selection. No arbitrary network fetch, automatic directory crawl, OCR, DOCX/XLSX,
new model calls, financial-account import, multi-tenant ACL, or MCP onboarding.
A material ID is not a path or URL and cannot grant access. Project identity is a
local persistence boundary, not authenticated tenancy. No raw user data, source
paths, or test logs belong in the public change.

The lifecycle must be complete within these stated boundaries. Format expansion
and A19 parser work are separate; this version is not full Private parity.
