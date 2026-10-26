# Maintenance: report only acquired-page facts

Frozen v0.2 baseline 2e5c21166f61f772e9738bc52782d10fbadfb662 remains unchanged on its original phase branch. Static review found skill-mcp asserted the offline-editing condition from synthetic page 2 despite acquiring only A/B page 1. The statement is true of the full fixture but unsupported by this Run's acquired sources; semanticStatus unreviewed is not a waiver.

Minimal correction: remove that phrase, keep the supported enterprise-PDF condition, and strengthen the existing real CLI/report-readback test. Do not expand the case's reads, budget or feature scope. Preserve old receipts/hashes as historical observations and record a separate maintenance check. No live call, new dependency, formal release or publication is authorized by this patch.
