# Phase 25 Grok implementation-plan closure audit

## Status

- Reviewer: Grok 4.5.
- Reasoning effort: high.
- Mode: named-file, evidence-only, read-only audit.
- Target: final art-quality specification, corrected Phase 25 plan, and three-model council record.
- Initial result: one confirmed high finding.

## Confirmed finding and correction

Grok confirmed that Phase 27 required a same-package legacy/enhanced maximum-load comparison in its work and stop rules, but the formal command used only `smoke:responsive:qualification` without an explicit dual-mode maximum-load contract.

Codex verified the ambiguity. The plan now requires:

- explicit `--compare-art-modes` and `--include-maximum-load` flags;
- the Phase 22 maximum-load camera in both modes from the same package;
- matching machine, camera, window, DPR, and zoom inputs;
- a validated report with FPS, median frame time, draw counts, package provenance, and tested source commit;
- a Phase 27 stop when the report is missing, invalid, below `60 FPS`, or above the `10%` median-frame-time regression limit.

## Correction audit

Pending. Grok 4.5 must recheck the corrected Phase 27 gate before Phase 25 can merge.
