# Explicit public Web sources (development)

This module adds a finite, operator-selected HTTPS acquisition to an existing research project. It is not a search agent or a browser. These development instructions do not claim public-network or model qualification.

```sh
node src/research-cli.mjs source acquire --project ./research-project \
  --acquisition selected-web-01 --urls ./selected-urls.json --approve-public-fetch
node src/research-cli.mjs source acquisition --project ./research-project \
  --acquisition selected-web-01
```

`selected-urls.json` is a JSON array of exact public HTTPS page URLs. Use `--redirects` with a second JSON array to admit exact redirect destinations, and `--base-manifest` to append to one explicitly selected immutable source manifest. An omitted base means no base, not “whichever manifest is latest.” Acquisition does not select a manifest for later tasks automatically: submit the returned manifest hash explicitly using the ordinary research task interface.

## One owner, no automatic replay

The project claims the acquisition ID before any network request, then persists its immutable plan. A concurrent attempt with the same ID cannot fetch. Success records the exact resulting manifest; failure or interruption does not grant retry permission. Inspection is read-only, never resumes a request, and validates terminal counters against successful source receipts. A claimed ID without a complete terminal is unknown, not evidence that no request occurred. Use a new operation only after reviewing the old outcome and obtaining appropriate authority; a new ID is not permission to bypass a denial or rate limit.

## Bounded and fail-closed

- At most 4 selected pages, 16 total HTTP requests, and 3 redirects per page. Redirect destinations must already be admitted. HTTPS only; no credentials, IP-literal host, non-default port, or fragment.
- Every resolved address must be public unicast. The accepted address is pinned to the actual HTTPS request while the original hostname remains the TLS/SNI/Host identity. No proxy, alternate resolver, or authentication fallback is added.
- Robots rules are checked before each origin's page. A missing robots file (404/410) is allowed; access denial, rate limiting, unsupported responses, malformed/oversized rules, and a positive crawl delay fail closed. The deliberately limited robots profile does not promise unrestricted RFC compatibility.
- UTF-8 HTML or text only. No JavaScript, nested-resource fetch, login, remote PDF, or visual inspection. HTML uses pinned parse5 with parsing-time structure/work guards and text extraction limits.
- Each original page is at most 256 KiB; each robots body is at most 64 KiB. A selected source catalog permits 512 KiB of Web originals and 512 KiB of extracted text. These are **stored content limits**, not a claim that all network traffic is at most 512 KiB. Each page acquisition separately bounds accepted HTTP bodies, including robots, to 512 KiB; the whole operation also has the request/page bounds above. A received chunk crossing a limit is rejected, not stored as a valid source.
- The operation has a cooperative 30-second deadline and aborts owned HTTP requests. OS DNS callbacks can arrive later but cannot cause dispatch after cancellation. Synchronous parsing is structurally bounded, not a hard CPU-preemptive sandbox; no all-descendant or remote-settlement guarantee is implied.

## Evidence stays attached

The source identity includes the acquisition and project, exact admitted base, requested/final URL, retrieval time, original-byte hash and size, extraction profile, and page-map hashes. Equal body bytes fetched from distinct occurrences do not silently become the same source. HTTP redirects and robots observations are archived separately and hash-bound to that receipt.

The ordinary Source → tool result → Result → Report → Artifact → cold Reader path retains this Web provenance. Originals are inert attachment downloads, with `nosniff` and a restrictive content policy, rather than active HTML rendered by Reader. A report containing real Web evidence is not labelled synthetic. Cold reads validate persisted bytes and do not refetch or reparse the public page.

This is an evidence transport contract. It does not guarantee the model's factual reasoning, citation choice, or research completeness. Those observations must be reported independently of Runtime contract results.
