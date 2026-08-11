# Independent LLM audit brief: Skia-native procedural world VFX specification

## Audit target

Audit this specification before implementation:

- `docs/specs/2026-08-11-skia-procedural-vfx.md`
- Draft base SHA recorded in the specification: `1e246ebf550f4bc10a042fe38a488699ac222830`
- Status: proposed product and engineering contract

The target specification is currently a working-tree document. The repository contains many unrelated art and evidence changes. Do not attribute the entire dirty tree to this VFX specification, and do not use unrelated changes as evidence that this specification has already been implemented.

This is a **read-only pre-implementation audit**. Do not edit the specification or source code. Treat every concern as a hypothesis and verify it against the specification and live repository before reporting it.

## Product request that produced the specification

The requested feature was a procedural VFX system inspired by a Three.js Elemental Sandbox demonstration. The desired effects were:

### Environmental effects

- rain particles and splashes;
- wet-street shimmer;
- neon signs softly illuminating nearby tiles;
- smoke from chimneys, fires, and cigarettes;
- dust kicked up while running;
- ocean foam and ferry wake;
- electrical sparks from broken equipment;
- leaves and paper moving through streets;
- heat distortion around fires.

### Contextual violence

- directional swipe or impact arc;
- short debris burst;
- expanding impact rings;
- shattered glass;
- dust and smoke;
- restrained pixel blood particles;
- one-frame lighting flash;
- subtle camera recoil;
- temporary ground mark.

The gameplay outcome must remain determined entirely by the rules engine. VFX only presents the committed result.

### Police and dangerous situations

- red/blue police-light washes across ground and buildings;
- flashing search cones;
- crime-scene highlighting;
- fire and smoke from damaged locations;
- electrical taser arcs;
- warning-zone circles;
- suspicion or witness markers that animate rather than remain static.

### Social and quest moments

- conversation initiation ring;
- relationship-change particles;
- discovery/revelation pulse;
- quest-completion sweep;
- evidence-acquired glint;
- emotional-stress or intoxication screen treatment.

The requested direction was the recommended approach for SI World, not a literal copy of the Three.js project.

## What the specification author did

The author took the following approach:

1. **Inspected the live renderer and project contracts.**
   - Confirmed React Native Skia is the world renderer.
   - Confirmed the game uses one Skia canvas, pixel-art atlases, `32×32` tiles, `24×30` characters, integer `1×`/`2×`/`3×` zoom, and nearest-neighbor sampling.
   - Confirmed the world already has an `effect` depth layer and map-authored `fire | sparkle` effects, currently rendered as simple circles.
   - Confirmed domain commands emit typed `DomainEvent` records.
   - Confirmed operating-system/browser reduced motion is already read by `useReducedMotion()`.
   - Confirmed the packaged renderer has a rounded `60 FPS` maximum-load gate.

2. **Rejected a second Three.js/WebGL renderer.**
   - The specification locks React Native Skia as the only world renderer.
   - It avoids a transparent Three.js overlay, second camera, synchronization layer, or conversion to 3D.
   - It translates the reference techniques into pixel-first Skia primitives, batched particles, and bounded SKSL shaders.

3. **Separated gameplay authority from presentation.**
   - Domain events and authoritative state decide outcomes.
   - VFX cannot create damage, evidence, witnesses, police attention, relationship changes, quests, movement, collision, or AI behavior.
   - The specification adds information-safety rules so effects cannot reveal hidden evidence, witnesses, suspicion, locations, or statuses.

4. **Defined a typed VFX architecture.**
   - Map ambient emitters.
   - Deterministic visual-weather presentation.
   - Committed domain-event adapters.
   - Transient movement samples.
   - Immutable cues, an explicit presentation clock, pooled particles, budget arbitration, semantic render passes, shader fallbacks, roof/interior masking, and culling.

5. **Translated every requested effect into a product contract.**
   - Each family has a trigger, visual components, boundaries, reduced-motion behavior, and rules preventing false gameplay implications.
   - Contextual violence is staged only after an exact outcome commits.
   - The existing Linda quest is used as the first consequential-effect proof.

6. **Preserved the pixel-diorama art direction.**
   - Crisp hard-pixel primary marks carry meaning.
   - Glow, blur, gradients, light washes, and distortion are secondary.
   - Native-`1×` review is mandatory.
   - Ambient motion must stay quieter than characters, interactions, and important outcomes.

7. **Added determinism, persistence, accessibility, and performance contracts.**
   - Stable seeded tuples and no `Math.random()`.
   - Explicit elapsed-time stepping and pause behavior.
   - Transient effects are not saved and old event-ledger cues must not replay on load.
   - Presentation preference schema v2 adds VFX quality, intensity, camera motion, screen effects, and violence controls.
   - Reduced motion overrides those preferences where necessary.
   - Particle ceilings, shader ceilings, degradation order, update-time budgets, and the existing `60 FPS` packaged gate are specified.

8. **Scoped a smallest quality prototype.**
   - A rainy Neon Crescent street proves rain, splashes, wet shimmer, neon light/reflection, smoke, windblown paper, sparks, roof clipping, quality levels, and reduced motion.
   - Linda quest outcomes prove event-driven impact, debris, ring, flash, recoil, restrained injury pixels, temporary marks, nonviolent alternatives, determinism, and no replay after load.

9. **Added implementation impact and acceptance coverage.**
   - The specification names expected source-of-truth, runtime, preferences, maps, renderer, content, tests, evidence, and art-bible surfaces.
   - It defines unit, integration, native-`1×`, responsive, package, accessibility, information-safety, and maximum-load acceptance.

10. **Performed structural verification only.**
    - The draft contains 22 numbered sections and 1,045 lines.
    - A mechanical checklist found all 33 requested topic phrases.
    - UTF-8, headings, tabs, and trailing whitespace were checked.
    - This verifies completeness and formatting, not architectural correctness, runtime feasibility, visual quality, or performance. Those are the purpose of this independent audit.

## Intended architecture in one paragraph

The proposed system keeps one React Native Skia canvas. A pure coordinator receives authored ambient emitters, deterministic presentation weather, newly committed domain events, and transient movement samples. It converts them into seeded typed cues, advances bounded pooled particle state using explicit elapsed time, and renders crisp primary marks plus limited local shader treatments in semantic ground/depth/aerial/screen passes. It never mutates domain state. Quality and accessibility settings alter only presentation cost and motion. Ambient state reconstructs from current map/state/time, while historical one-shot events do not replay after load.

## Files to inspect

Read the complete target specification first, then inspect the live repository rather than trusting this brief.

### Required

- `docs/specs/2026-08-11-skia-procedural-vfx.md`
- `package.json`
- `src/render/WorldScene.tsx`
- `src/render/world-frame.ts`
- `src/render/depth.ts`
- `src/world/maps/schema.ts`
- `src/world/maps/compiled-v2.ts`
- `src/world/presentation/art-presentation.ts`
- `src/domain/events/types.ts`
- `src/domain/commands/reducer.ts`
- `src/application/runtime/world-runtime.ts`
- `src/application/runtime/tick.ts`
- `src/application/runtime/transitions.ts`
- `src/application/presentation/preferences.ts`
- `src/application/accessibility.ts`
- `docs/specs/2026-08-11-art-quality.md`
- `docs/specs/2026-08-11-natural-movement.md`
- `docs/specs/2026-08-10-world-readability-collision-responsive.md`

### Evidence and neighboring tests

- `src/render/responsive-evidence.ts`
- `src/render/art-quality-evidence.ts`
- `tests/electron/art-quality-smoke.test.ts`
- `tests/electron/natural-movement-smoke.test.ts`
- `scripts/electron/run-art-quality-package-smoke.ts`
- `scripts/electron/run-responsive-package-smoke.ts`
- `src/domain/__tests__/linda-quest.test.ts`
- `docs/art/halcyra-art-bible.md`

Inspect additional callers and tests whenever a finding depends on them. File line numbers in the specification are not authoritative; use current live locations and symbols.

## Primary audit questions

### 1. Product coherence

- Does this VFX direction fit SI World's warm-noir pixel diorama, or does it risk turning the game into an over-signaled fantasy/arcade presentation?
- Are the requested effects divided correctly between atmospheric, consequential, informational, and screen treatment?
- Does purely visual weather create misleading expectations if weather has no gameplay effect?
- Are search cones, warning zones, witness markers, evidence glints, police washes, stress, and intoxication constrained enough to avoid false mechanics or hidden-information leaks?
- Is the contextual-violence treatment appropriate, readable, and restrained?

### 2. Scope and sequencing

- Is a 1,045-line specification covering all these effect families too broad for one implementation program?
- Is the two-scene smallest-quality prototype genuinely sufficient to validate the architecture?
- Which requirements should be mandatory for the first release, deferred, simplified, or removed?
- Does the delivery sequence create safe merge and rollback boundaries?

### 3. React Native Skia feasibility

- Verify that the specified Skia primitives, RuntimeEffect/SKSL behavior, batching strategy, blend modes, local shaders, offscreen surfaces, and fallbacks are feasible in this repository's installed stack and Electron/web target.
- Challenge any assumption that comes from Three.js/GLSL but does not translate cleanly to React Native Skia/SKSL.
- Determine whether packed CPU-updated particles plus batched Skia drawing are the right architecture or whether UI-thread/worklet/GPU alternatives are necessary.
- Check whether shader compilation, child shaders, source-image sampling, clipping, and cross-platform behavior need stronger contracts.

### 4. Live event wiring

- Trace how mounted runtime actions call reducers and whether newly committed `CommandResult.event` values actually reach `WorldScene`.
- Several runtime helpers may return only `WorldState`. Identify any event-loss chokepoints that make `domainEventToVfxCues()` impractical without broader runtime changes.
- Verify whether current events contain sufficient source, target, map, anchor, visibility, and object-state data for every proposed cue.
- Specifically inspect relationship, Linda quest, police, journal/evidence, conversation, movement, and transition paths.
- Flag any proposed event mapping that would require guessing from global state or hard-coding quest-specific identities.

### 5. Renderer layering and occlusion

- Audit the proposed ground/depth/aerial/screen passes against the current stable layer and depth model.
- Can character-and-depth effects be sorted correctly without merging character rendering and effect rendering into an expensive or unstable path?
- Will aerial rain, smoke, police light, and leaves interact correctly with walls, roofs, hidden interiors, tall props, and camera culling?
- Are wall/roof/material/water masks available or expensive to derive at runtime?
- Are neon and police light clipping requirements technically realistic in the current 2D renderer?

### 6. Determinism and timing

- Look for contradictions between:
  - presentation time versus authoritative absolute minute;
  - ambient reconstruction versus pause freezing;
  - fixed sampled evidence versus variable frame delivery;
  - pool reuse versus stable particle results;
  - quality-specific particle counts versus deterministic captures;
  - visual-weather transitions versus large simulation-time jumps.
- Is the proposed seed tuple sufficient and unambiguous?
- Can one-shot cues remain nonreplayed after load while newly committed events are never missed?
- Should visual determinism promise byte-identical geometry, bounded invariants, or something weaker across platforms?

### 7. Persistence and rollback

- Verify that VFX can stay out of `WorldState` without breaking continuity players expect.
- Audit the presentation-preference v1-to-v2 migration under the current strict Zod schema.
- Challenge the rollback claim: can an older strict v1 reader safely encounter a v2 preference document, or will rollback require reset/strip logic?
- Determine whether emitter/revision changes need any content/map schema version or migration beyond defaults.
- Check whether existing `layoutRevision`, `artRevision`, and proposed `vfxRevision` ownership is clear and nonoverlapping.

### 8. Performance realism

- Challenge the high-quality ceiling of 650 ambient + 200 reserved particles, four local shader fields, one screen shader, and eight one-shot sequences.
- Is the `60 FPS` requirement during local-model generation measurable and realistic on the named qualification hardware?
- Are the `1.5 ms` median / `3 ms` p95 update limits and `10%` median-frame regression internally consistent?
- Are CPU particle updates, Skia buffer updates, clipping masks, local shaders, high-DPI backing stores, and garbage collection all included?
- Does the degradation order preserve important cues without causing visual discontinuity?
- Are separate macOS and Windows graphics-path risks adequately covered?

### 9. Testability and evidence

- Would the proposed tests fail if the real mounted runtime were unwired?
- Are any acceptance tests source-only, helper-only, or screenshot-hash checks that could pass vacuously?
- Are exact screenshot hashes realistic across Skia, GPU, DPR, OS, and driver differences?
- Are bounded pixel masks and semantic geometry assertions specified enough?
- Does the capture matrix explode combinatorially without a required pairwise/case-manifest strategy?
- Are shader-failure, reduced-motion first paint, save/load cursor, culling, pool exhaustion, and quality degradation tested through real consumers?

### 10. Accessibility and visual safety

- Verify reduced-motion behavior for rain, recoil, expansion, distortion, screen effects, police lights, leaves, and impacts.
- Is “no more than three flashes per second” sufficient, and are local one-frame flashes still safe?
- Are color-independent police, social, evidence, warning, and witness cues concrete enough?
- Do screen stress/intoxication effects need additional vestibular, photosensitivity, legibility, or user-control limits?

### 11. Art-direction specificity

- Are the current pixel size, timing, palette, glow, distortion, recoil, blood, and hierarchy limits enough to produce a coherent result?
- Which effects need stronger authored anti-examples or district-specific rules?
- Does “hard primary mark plus supporting glow” translate into an actionable art pipeline?
- Should any effects be pre-rendered or atlas-authored rather than procedural?

### 12. Licence and provenance

- Is the MIT/reference language sufficient if no source is copied?
- If code is later ported from the reference project, does the spec identify the necessary licence/provenance controls?
- Are third-party bundled assets clearly excluded?

## Known assumptions to challenge

Do not accept these merely because the specification states them:

1. One Skia canvas can support every proposed pass without architectural or performance trouble.
2. Current domain events are rich enough to locate and stage consequential cues.
3. A presentation-only weather system will feel coherent without gameplay weather.
4. Stable seeded particle geometry is practical with pooled slot reuse and quality scaling.
5. Runtime shader output can be reviewed deterministically across macOS and Windows.
6. High-quality particle/shader ceilings are compatible with high-DPI `2560×1440`, local-model generation, and `60 FPS`.
7. The current map can cheaply provide roof, wall, water, material, outdoor, and visibility masks.
8. Pausing all world VFX, including rain and smoke, is the best product behavior.
9. The proposed preference migration and rollback behavior are safe under strict schemas.
10. The full catalogue belongs in one program rather than a smaller environmental-VFX foundation followed by separate consequential-VFX phases.

## Required audit output

Start with findings, ordered by severity. Report only claims supported by the specification and live repository. Do not invent weaknesses merely to appear thorough.

For each finding use:

### N. Short finding title

- **Severity:** blocker | high | medium | low
- **Confidence:** high | medium | low
- **CLAIM:** Quote or accurately paraphrase the specification and cite its section/line.
- **REALITY:** Cite live repository files, symbols, and line numbers, or explain the unresolved feasibility evidence.
- **IMPACT:** Explain the concrete product, implementation, performance, determinism, accessibility, or test risk.
- **FIX:** Give the smallest specific specification change that resolves it. Do not rewrite the entire design.

Then provide:

## Overall opinion

- **Implementation readiness:** READY | READY AFTER CHANGES | NOT READY
- **Overall score:** `/10`
- **Product coherence:** `/10`
- **Technical feasibility:** `/10`
- **Determinism/persistence:** `/10`
- **Performance realism:** `/10`
- **Testability:** `/10`
- **Accessibility:** `/10`
- A concise explanation of whether this is the right VFX direction for SI World.

## Highest-value improvements

Provide a ranked table:

| Rank | Change | Why it improves the specification | Required before prototype? |
|---:|---|---|---|

## Scope recommendation

State which effect families should be:

- in the smallest prototype;
- in the first production VFX release;
- deferred to a later consequential/police/social program;
- removed or replaced.

## Sound areas

List only the major contracts that are already strong. Keep this section brief.

If there are no material findings, say `NO MATERIAL FINDINGS`, but still provide the overall opinion, scores, and highest-value optional improvements.

## Audit constraints

- Read-only: do not edit files.
- Do not assume implementation exists.
- Do not judge unrelated dirty-tree work.
- Do not use the original Elemental Sandbox visuals as proof that React Native Skia can implement the same architecture.
- Do not recommend changing gameplay rules merely to justify a VFX effect unless you label that as a separate product proposal.
- Prefer exact, testable contract corrections over broad advice such as “optimize more” or “add tests.”
- Distinguish a true blocker from a polish preference.
- Treat the author's structural checklist as completeness evidence only, not correctness evidence.
