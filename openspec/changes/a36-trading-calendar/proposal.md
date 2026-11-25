# A36 Trading Calendar

Extend fixed task time with an opt-in, explicitly supplied venue calendar. The temporal owner validates dated session rows and coverage, resolves the last venue session whose explicit close is no later than the admitted anchor, and projects the result as trusted temporal context during the existing Runtime lifecycle.

The natural task-local yesterday remains unchanged. The market result carries the venue date, phase, session date, explicit session bounds, revision and SHA-256 identity for the accepted calendar input. Missing coverage and gaps that could affect the answer resolve to `unknown`; the system does not invent weekends, holidays, hours, or future rows.

Scope is the temporal module, the existing research task-time JSON path, and the temporal fixture CLI/tests. No provider, network lookup, new dependency, session scheduler, or general calendar access tool is introduced.
