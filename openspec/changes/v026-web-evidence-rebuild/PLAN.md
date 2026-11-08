# v0.26: bounded Web evidence acquisition

Status: reconstruction started, not implementation or release qualification.
Baseline: released v0.25.0, `99485ed3e7d45d462f9908e53ff5653a8c0791c1`.

## One module and a usable path

The user explicitly selects a finite set of public HTTPS pages. The acquisition
owner validates destinations and robots rules, fetches bounded inert content,
retains original bytes and extraction facts, and admits an immutable source
manifest to the existing research project. Ordinary Main tools read those
sources; Result, Report, Artifact and Reader retain their provenance. Reopening
a saved project or Run reads local immutable bytes and never silently refetches.

The first profile accepts static `text/html` and UTF-8 `text/plain`, not XHTML.
No search provider, recursive crawler, authenticated browser, JavaScript
execution, model-selected URL authority, remote PDF expansion, new Web UI,
isolated Python, scheduler or second execution engine is introduced.

## Contracts to implement and verify

1. Exact bounded selection and explicit redirect authority; HTTPS only, no
   credentials or fragments, public destination classification, finite DNS,
   pinned validated address, original hostname TLS verification, and no
   automatic proxy, resolver, certificate or account fallback.
2. One bounded request path for pages and robots. Redirects are revalidated;
   byte, time, redirect and parser-work limits apply to actual consumption.
   Cancellation closes owned resources. Failures and uncertain transport
   outcomes are recorded honestly and do not trigger automatic replay.
3. Robots rules are parsed as data. Reject excessive work before dependency
   expansion; count cumulative work and preserve group, wildcard and encoded
   octet semantics. Access/robots rejection does not become a fetch fallback.
4. An HTML data parser does not execute scripts or fetch linked resources.
   Extraction is bounded and explicitly not rendering, layout or visual
   inspection. Unsupported encoding/content is rejected rather than guessed.
5. Content identity and acquisition-occurrence identity remain distinct.
   Provenance binds admitted URL, final URL, time, original bytes, extraction
   identity/coverage and page hashes. Identical bytes from different URLs do
   not silently collapse their acquisition identity.
6. The exact admitted base manifest is bound into append/receipt validation.
   Legacy v1 catalog/manifests retain their original bytes and hashes; new Web
   provenance cannot disappear at catalog read or collide with a custom v1 ID.
7. Real Source -> Result -> Report/Artifact -> Reader consumers validate the
   same evidence. Original HTML exports remain inert download bytes. Cold
   inspection and source tamper negatives must not dispatch new network work.

## Reconstruction and evidence discipline

Earlier local-only v0.26 source became unavailable. Its test numbers and failed
public-fetch attempt are historical, not evidence for this reconstruction.
This branch starts fresh from the published baseline; preserve earlier failures
without replaying their operation IDs. Stage checkpoints are remotely read back
before they count as saved. Keep the task WIP until a verified release preserves
its content, then remove it under the applicable deletion permission.

Use standard-library owners plus small pinned mature dependencies where they
replace risky bespoke parsing. Dependency selection, integrity/license/source
review and lockfile authorization remain explicit. No installed packages,
credentials, private source, databases or raw live logs enter publication.

## Qualification

Start with independent scope/lineage review and targeted adversarial tests of
the real consumers, then a fixed-source aggregate/build and implementation
review. Record public-network acquisition separately from synthetic transport
tests. Real model qualification uses ten prospectively frozen logical tasks,
Runtime >= 9/10 and no unresolved applicable Runtime defect; content quality,
transport failure and Runtime contracts are separate axes. Do not count HTTP
requests or offline tests as real tasks. Shared provider budget is reserved
before calls, old unknowns remain held, and no overage is enabled.

At this checkpoint no new dependency, product implementation, test, public
acquisition, model request or qualification result is claimed.

## Later checkpoint: explicit supported network profile

The initial planning status above is historical. WIP `3a090329` preserves the
reconstructed direct-profile implementation, 1,066 passing local tests and build.
Its public acquisition attempts failed at DNS before HTTP dispatch; no public
or model qualification was claimed.

A reviewed prospective increment adds an explicit `platform-doh-pinned@1`
profile, not an error-triggered fallback. It retains existing proxy/trust
configuration, validates both DNS families, pins CONNECT destinations, retains
original hostname certificate checks and shares finite request/byte/deadline
limits. Old @1 records remain unchanged; new plan/transport/terminal @2 bind
profile and resolver evidence. The source identity remains hash-bound through
its existing admission/transport references. The implementation's targeted
103-test run passed. Independent review then identified an IPv6 cold-record
normalization mismatch, now corrected with an expanded/uppercase IPv6-only
roundtrip. A separate 24-test focused run passed, including actual native Agent
CONNECT-200 progression into fake target TLS and cancellation. These are offline
seams, not successful public TLS handshakes. Aggregate and real-network verification
of this increment remain separate, not inherited from the prior WIP. No new
dependency is added.

## Existing NO_PROXY compatibility increment

The saved c4bcbeb2 profile completed 1,090 local tests and build. Its first new public operation was refused locally before HTTP because existing NO_PROXY CIDRs were unsupported. That durable zero-dispatch failure remains unchanged. A limited reviewed correction now parses bounded exclusion rules before claiming: matching host/address/CIDR still refuses; legal nonmatching CIDR does not erase configuration. Complete bare IPv6 is not truncated as a port. A separate 46-test targeted run passed after this correction, including the old platform/consumer cases and 22 new selector boundaries. It is not a new aggregate or a public-network success, and no model requests have been made.
