---
title: "Council audit: Skia-native procedural world VFX specification"
type: audit
date: 2026-08-11
target: docs/specs/2026-08-11-skia-procedural-vfx.md
base_sha: 1e246ebf550f4bc10a042fe38a488699ac222830
status: complete
---

# Council audit: Skia-native procedural world VFX specification

Council status: complete. Claude Fable 5 used `xhigh`, Claude Opus 5 used `xhigh`, and Grok 4.5 used `high`. Each reviewer inspected the named specification, audit brief, and relevant live repository files in read-only mode. Codex then checked each retained finding against the repository.

## Findings

### 1. The Linda physical prototype has no honest visible target

- **Severity:** blocker
- **Confidence:** high
- **CLAIM:** The original specification used `linda-quest-resolved` and Linda's boyfriend as the first physical contextual-impact proof.
- **REALITY:** The event has result data but no map, source anchor, or target anchor (`src/domain/events/types.ts:108`). Linda's boyfriend starts with `presence.kind: inactive` (`src/domain/state/initial-state.ts:94`). The current atlas and visible-NPC path do not provide a distinct active boyfriend sprite.
- **IMPACT:** The renderer would have to invent a location, strike direction, or target. It could show false story information and could not pass a truthful visual test.
- **FIX:** Defer Linda physical VFX. Require an active visible target plus exact post-commit source and target anchors before this mapping can produce a world cue. Keep betrayal and withdrawal nonviolent.

Agreement: Fable 5, Opus 5, and Grok 4.5.

### 2. The mounted runtime has no reliable consequential-cue delivery and clock path

- **Severity:** high
- **Confidence:** high
- **CLAIM:** The original specification allowed direct delivery of newly committed events and reused the existing animation-frame driver.
- **REALITY:** `CommandResult` contains an event and the reducer appends it to `eventLedger` (`src/domain/commands/reducer.ts:27`, `src/domain/commands/reducer.ts:46`). Common runtime helpers return only state (`src/application/runtime/tick.ts:9`). The mounted movement driver does not run at speed `0`, during transitions, during conversations, or while a panel is open (`src/render/WorldScene.tsx:387`). Quest, conversation, and police commits can occur under those UI states.
- **IMPACT:** A consequential cue can be dropped or accepted but never age. Save/load behavior would differ by command path, and a committed result could have no visible feedback.
- **FIX:** For the later consequential phase, consume only the post-mount contiguous ledger tail with a presentation cursor. Mount a separate VFX driver. Freeze ambient time during world pause, but allow accepted critical/action cues to finish while panels or conversations pause the world.

Agreement: Fable 5, Opus 5, and Grok 4.5 on the missing delivery contract; Opus 5 identified the mounted clock gate.

### 3. Character-interleaved depth effects conflict with current batching

- **Severity:** high
- **Confidence:** high
- **CLAIM:** The original specification put characters and depth effects into one stable interleaved pass.
- **REALITY:** The current order is the fixed seven-layer `WORLD_LAYER_ORDER` (`src/render/world-frame.ts:10`). `compareDepth()` sorts by layer before integer tile Y (`src/render/depth.ts:11`). Characters use float `shadowWorldY`, but `WorldScene` draws all characters in one `Atlas` call (`src/render/WorldScene.tsx:901`). Responsive evidence and package smoke also use a strict seven-layer count schema.
- **IMPACT:** A direct implementation would either draw effects on the wrong side of actors, split the atlas into an unmeasured number of batches, or break strict evidence parsing.
- **FIX:** Keep the seven world layers and character atlas in the first release. Use separate ground, aerial, and screen insertion points later. Require a measured float-foot-Y atlas-split prototype and an evidence-schema version change before character-interleaved effects ship.

Agreement: Fable 5, Opus 5, and Grok 4.5.

### 4. The proposed preference migration was not downgrade-safe

- **Severity:** high
- **Confidence:** high
- **CLAIM:** The original specification advanced `presentation-preferences.json` to strict schema version `2` and stated that an older renderer could ignore the new fields or reset safely.
- **REALITY:** The current schema is strict and accepts only version `1` (`src/application/presentation/preferences.ts:6`). The repository catches any parse failure and loads defaults (`electron/persistence/presentation-preferences.ts:25`). A later normal renderer patch writes those defaults back to the same file (`electron/persistence/presentation-preferences.ts:50`).
- **IMPACT:** Downgrade can silently lose world zoom, UI scale, camera state, and future accessibility choices. A later old-build save can destroy the newer document.
- **FIX:** Keep the current preference file at version `1` for the first release. Put later VFX choices in a separate strict store or prove upgrade, downgrade, old-build save, and re-upgrade recovery before changing the existing file.

Agreement: Fable 5 and Grok 4.5; Opus 5 confirmed the silent-loss behavior during reconciliation.

### 5. The two-scene prototype assumed masks and budgets that do not exist yet

- **Severity:** high
- **Confidence:** high
- **CLAIM:** The original smallest prototype combined rain, wetness, neon, smoke, debris, sparks, Linda impact VFX, up to 850 particles, four local shaders, and broad package proof.
- **REALITY:** Current authored effects are only validated `fire | sparkle` points (`src/world/maps/schema.ts:181`). Current material recipes do not declare wet, dust, or splash capabilities. The map compiler does not expose the full outdoor, water, blocker, and light-mask contract. Existing packaged performance gates measure end-to-end frames, while the original VFX budgets were not measured in this renderer.
- **IMPACT:** The first implementation would combine content schema, compiler, renderer, shader, event, persistence, accessibility, and performance risks. A failure would not identify which contract was wrong.
- **FIX:** Make the six existing authored fire and sparkle points the first production vertical slice. Keep the existing effect layer and legacy circles. Measure the pure geometry, pause, reduced-motion, deterministic, native-`1x`, responsive, and packaged art-mode comparison gates before adding weather.

Agreement: Grok 4.5 identified missing masks, Fable 5 and Opus 5 identified performance and scope gaps, and local research confirmed the six-anchor slice.

## Overall opinion

- **Implementation readiness:** READY AFTER CHANGES
- **Overall score:** 6.5/10
- **Product coherence:** 8.5/10
- **Technical feasibility:** 5.5/10
- **Determinism/persistence:** 6/10
- **Performance realism:** 5/10
- **Testability:** 7/10
- **Accessibility:** 8/10

Skia-native 2D VFX is the correct direction for SI World. It preserves the pixel diorama, one camera, one renderer, and deterministic simulation boundary. The original specification was too broad for its first proof and treated several desired seams as if they already existed. The corrected specification is ready for a fire-and-sparkle vertical slice. Weather and consequential VFX need separate measured gates.

## Highest-value improvements

| Rank | Change | Why it improves the specification | Required before prototype? |
|---:|---|---|---|
| 1 | Replace Linda with the six existing fire/sparkle anchors | Removes false targets and uses live authored data | Yes |
| 2 | Separate ambient and action clock policy | Prevents lost cues under panel and conversation pauses | Yes for event VFX; ambient policy is required now |
| 3 | Keep current world layers and atlas batching | Removes an unproven renderer rewrite | Yes |
| 4 | Keep presentation preferences at version 1 | Prevents downgrade data loss | Yes |
| 5 | Define compiler-owned masks before weather | Makes roof, water, and material clipping deterministic | Before weather |
| 6 | Split event delivery identity from semantic recipe seed | Keeps deduplication stable without changing visual geometry | Before event VFX |
| 7 | Make packaged end-to-end frame time authoritative | Measures the real renderer, GPU, DPR, React, and collection cost | Yes |

## Scope recommendation

- **Smallest prototype:** deterministic procedural fire and sparkle at the six existing authored points, existing effect layer, static reduced-motion form, and legacy-circle fallback.
- **First production VFX release:** the same fire/sparkle slice after native `1x`, responsive, pause, deterministic, and packaged comparison proof.
- **Later environmental program:** rain, splashes, wet shimmer, neon, smoke, dust, foam/wakes, paper/leaves, sparks from new conditions, heat distortion, masks, and shaders.
- **Later consequential program:** contextual violence, police/danger, social, quest, evidence, stress, and intoxication after event delivery and anchor contracts exist.
- **Remove or replace:** remove Linda physical impact from the initial prototype; replace it with a development-only anchored event fixture when the event cursor is built.

## Sound areas

- Skia-native 2D is a coherent renderer choice.
- Domain state remains authoritative and VFX remains presentation-only.
- Pixel-first marks, restrained secondary glow, and native `1x` review fit the art direction.
- Explicit elapsed-time input, no `Math.random()`, deterministic evidence, and transient-save exclusion are strong contracts.
- Reduced motion, non-color-only meaning, information safety, and shader fallback are well specified.
- Licence guidance correctly treats Elemental Sandbox as an MIT reference, not an asset source.
