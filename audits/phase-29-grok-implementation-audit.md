# Phase 29 Grok implementation audit

## Scope

- Branch: `codex/phase-29-full-cast-art`
- Base SHA: `1e246ebf550f4bc10a042fe38a488699ac222830`
- Packaged source SHA: `f3691cd041a3a5460d3e50e051a2f60ad08dae3e`
- Model: Grok 4.5
- Reasoning effort: high
- Access: subscription-backed, read-only audit wrapper
- Evidence boundary: named source files and compact schema-validated reports. Raw responsive and natural-movement reports stay outside the Grok pack because each is larger than the wrapper's `256 KiB` per-file safety limit.

## First implementation audit

Verdict: `FINDINGS`

Grok reported five findings. Local verification confirmed four and rejected one:

1. Confirmed. The first dry-run evidence still named the Phase 28 source commit. Phase 29 source is now committed, and all final evidence was rebuilt from `f3691cd041a3a5460d3e50e051a2f60ad08dae3e`.
2. Confirmed. Art-bible section 17 interrupted the last rows of section 16.4. The Phase 28 table and paragraph now finish before section 17 begins.
3. Confirmed. The new tests proved identity features in world frames but did not explicitly compare world and portrait identity tokens. The full-cast test now requires matching identity tokens and front-visible source layers for both outputs.
4. Confirmed. The art-quality evidence tests proved that an absent revision-3 portrait matrix failed, but did not include a valid revision-3 positive fixture. A 30-entry positive matrix test now covers all ten characters at UI scales `1`, `1.25`, and `1.5`, with unique screenshots.
5. Rejected. Grok read `capturePolicy.absoluteDeadlineMilliseconds` as a duration field. The field intentionally stores one absolute epoch deadline. The runner derives the remaining duration before each child process. This matches the Phase 25 plan's one-absolute-deadline contract.

## Applied corrections

1. Rebuilt the Electron package and all Phase 29 evidence from the committed source SHA.
2. Corrected the Phase 28 and Phase 29 art-bible section boundary.
3. Added explicit world-to-portrait identity-token agreement checks.
4. Added a valid revision-3 30-entry matrix validator test.
5. Kept the absolute deadline contract unchanged.

## Final correction audit

Verdict: `NO_CONFIRMED_FINDINGS`

Grok rechecked the four corrections, the rejected deadline claim, commit and package binding, portrait-matrix completeness, movement-independence validators, portrait wiring, and the compact proof reports. It found no remaining confirmed defect. The raw responsive and movement reports stayed outside the audit pack by design; Grok reviewed their validators and compact rollups instead, and Codex separately schema-validated the complete generated reports.

## Verified local results

- Source commit: `f3691cd041a3a5460d3e50e051a2f60ad08dae3e`
- Packaged payload SHA-256: `721f942fa66dc8c7004039a8fff9bc8dd9444789e8057d78bfc0debe073b6c22`
- Atlas SHA-256: `fd2dfda480c01384dfc7fbc8b7f19cdcdcacd9f99274c9e3b6483ae33f789be3`
- Atlas index SHA-256: `4ccb0ec537cc9a3b05066eca3158eac80f6c415977dfc60e9ffde3cb993c9730`
- Art manifest SHA-256: `442a2833dc4080b650753215bbea522ab5ebdd1774437ed4dc14f72e1ff45c03`
- Full-cast proof: `10` characters, `8` world directions each, and `30` packaged conversation portraits.
- Identity proof: minimum `2` pairwise non-color layer differences and `4` torso silhouettes.
- Lateral proof: the cheap lateral method passed, so a three-quarter head is not required.
- Performance: `119.9 FPS` movement qualification, `8.3 ms` legacy and enhanced median frame time, ratio `1.0`, and one allowed added static batch.
- Tests: `52` suites and `447` tests passed before the evidence-only audit record update.
