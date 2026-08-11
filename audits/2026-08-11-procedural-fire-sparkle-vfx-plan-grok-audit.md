---
title: "Grok audit: procedural fire and sparkle VFX implementation plan"
type: audit
date: 2026-08-11
target: docs/plans/2026-08-11-feat-procedural-fire-sparkle-vfx-plan.md
model: grok-4.5
effort: high
status: complete
---

# Grok audit: procedural fire and sparkle VFX implementation plan

Grok 4.5 completed a read-only, schema-validated high-effort audit of the implementation plan against the corrected specification and council audit. Codex checked all five claims against the live repository.

## Reconciled findings

### 1. Clarify effective pause authority

- **Grok claim:** Passing `speed > 0` could miss conversation and transition pause tokens.
- **Local reality:** `WorldScene.speed` already equals `effectiveSpeed(runtime.worldState.clock)`, and `effectiveSpeed()` returns `0` when any pause token exists.
- **Disposition:** The claimed runtime defect is rejected. The plan wording was ambiguous, so it now requires the explicit `effectiveSpeed(...) > 0` expression and forbids raw selected speed.

### 2. Reset shared age on map entry

- **Grok claim:** One persistent shared value can carry source-map age and paths into the destination because no reset trigger was specified.
- **Local reality:** `WorldScene` stays mounted across normal neighborhood transitions while `mapId` changes.
- **Disposition:** Confirmed. The plan now requires a map-entry identity, age/last-frame reset, and an exact destination age-`0` assertion.

### 3. Keep logical item counts separate from render-node counts

- **Grok claim:** `drawCounts.effect === visibleEffects.length` conflicts with batched rendering.
- **Local reality:** Existing `drawCounts` values count logical world items. For example, thousands of floor cells render through one atlas node. They are not Skia draw-call counts.
- **Disposition:** The proposed deletion is rejected. The plan now labels `drawCounts.effect` as the logical authored-anchor count and requires actual fixed render-node counts in separate strict VFX evidence.

### 4. Specify hybrid per-emitter fallback

- **Grok claim:** A global procedural component did not explain how one invalid recipe falls back without disabling every emitter.
- **Local reality:** The plan required isolation but did not define the hybrid batch/circle path.
- **Disposition:** Confirmed. Procedural mode now validates each emitter, omits only failed IDs from procedural paths, draws circles for those IDs, records bounded diagnostics, and keeps valid emitters procedural.

### 5. Add enforceable motion-rate and grayscale gates

- **Grok claim:** The acceptance criteria stated a three-changes-per-second limit and grayscale distinction, but no command could fail on either defect.
- **Local reality:** The draft tests covered sample geometry and screenshots but did not require step-spacing or luminance/silhouette assertions.
- **Disposition:** Confirmed. The plan now requires `333 ms` minimum step spacing, color-independent primary-silhouette tests, and packaged grayscale proof.

## Coverage

- Primary target: `docs/plans/2026-08-11-feat-procedural-fire-sparkle-vfx-plan.md`.
- Context: corrected VFX specification and council audit.
- Scope: six existing authored fire/sparkle anchors only.
- Explicitly excluded: weather, event VFX, shaders, new preferences, and character-depth work.
