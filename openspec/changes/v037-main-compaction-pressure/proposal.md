# A28: Main context-compaction admission

Main already projects older source results to immutable references and can
reuse a verified compacted frontier. The remaining gap is admission: the
legacy threshold inspects the in-process history rather than the request
that the Gateway will send. This change adds an opt-in, task-frozen mode
that uses the complete encoded request and avoids repeatedly summarizing
the same evidence when no net saving was possible.

This is one Main working-context change, not a new memory store, summary
provider, retrieval path or report format. Existing policies and durable
task identities remain readable and are not silently upgraded. The typed
Memory exclusion also protects existing managed profiles without changing
their identity. The option
does not estimate model tokens, raise context or spending limits, or
enable retries on ambiguous outcomes.
