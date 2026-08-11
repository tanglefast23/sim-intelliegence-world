---
title: "Skia-native procedural world VFX"
type: specification
date: 2026-08-11
status: proposed product and engineering contract
base_sha: 1e246ebf550f4bc10a042fe38a488699ac222830
audit_status: ready after the corrections recorded in the independent council audit
---

# Skia-native procedural world VFX

## 1. Outcome

SI World must use procedural visual effects to make Halcyra feel wet, windy, electrical, dangerous, inhabited, and emotionally responsive without changing the authoritative simulation or abandoning the original pixel-diorama art direction.

The VFX system must add:

- environmental life: rain, splashes, wet-street shimmer, neon light, smoke, movement dust, ocean foam, ferry wakes, electrical sparks, windblown leaves and paper, and localized heat distortion;
- short abstract contextual-violence presentation: directional impacts, debris, rings, glass, dust, smoke, restrained pixel blood, one-frame light, camera recoil, and temporary ground marks;
- police and danger presentation: red/blue light washes, search cones, crime-scene emphasis, damaged-location fire and smoke, taser arcs, warning zones, and authorized suspicion or witness markers;
- restrained social and quest punctuation: conversation rings, relationship-change particles, discovery pulses, quest-completion sweeps, evidence glints, and emotional-stress or intoxication screen treatment.

The recommended implementation is **React Native Skia-native 2D VFX**:

- pure TypeScript cue selection and particle updates;
- packed, pooled particle data;
- batched Skia drawing rather than one React component per particle;
- Skia RuntimeEffect/SKSL shaders for wetness, distortion, light washes, and other bounded per-pixel effects;
- integer world zoom, nearest-neighbor source-art sampling, and pixel-snapped final placement;
- no Three.js runtime, no second canvas, and no conversion of SI World into a 3D game.

The deterministic rules engine decides what happened. VFX presents that committed result and never decides damage, evidence, witnesses, police attention, relationships, quest outcomes, movement, collision, or AI behavior.

## 2. Confirmed baseline

The repository already has most of the architectural seams this program needs:

- `@shopify/react-native-skia` is the world renderer.
- `WorldScene` owns one Skia canvas and an animation-frame-driven movement presentation.
- `WORLD_LAYER_ORDER` already contains an `effect` layer.
- `WorldMapV2.effects` currently supports only static `fire` and `sparkle` points.
- `WorldScene` currently draws those effects as simple colored circles.
- Domain commands return typed `DomainEvent` records and append them to an event ledger.
- Existing events already expose relationship deltas, discovery, quest resolution, evidence, witnesses, police-attention changes, actor movement, transitions, and conversation commits.
- `useReducedMotion()` already reads operating-system and browser reduced-motion state.
- The art-quality system locks `32×32` tiles, `24×30` character cells, integer `1×`/`2×`/`3×` zoom, nearest-neighbor atlas sampling, deterministic presentation selection, and native-`1×` review.
- The packaged maximum-load scene already has a rounded `60 FPS` gate.

The earlier art-quality specification excluded shaders, weather simulation, and physics-driven particles from that art-production program. This specification is a later, separate runtime-presentation program. It permits bounded Skia shaders and procedural particles while preserving the earlier source-art, map, collision, save, and performance contracts.

## 3. Locked decisions

### 3.1 Renderer and art direction

- Keep React Native Skia as the only world renderer.
- Do not add Three.js, Babylon.js, PixiJS, a transparent WebGL overlay, or a second world camera.
- Keep `32×32` world tiles and `24×30` character cells.
- Keep integer `1×`, `2×`, and `3×` world zoom.
- Keep nearest-neighbor sampling for atlas art.
- Keep final world placement snapped to the physical-pixel grid.
- Effects must look authored for the original warm-noir pixel diorama, not pasted from a smooth realistic 3D demo.
- Hard pixel shapes carry the action. Blur, bloom, distortion, and gradients are supporting layers, not the primary silhouette.
- The upper-left authored light direction remains the default for opaque art. Dynamic light may brighten or tint nearby pixels but cannot reverse static material shading.

### 3.2 Simulation authority

- The domain event or authoritative state is the only source for consequential VFX.
- A VFX cue cannot apply or modify domain state.
- VFX cannot call the domain reducer, advance the simulation RNG, create evidence, choose witnesses, alter police attention, change a relationship, move an actor, or resolve a quest.
- VFX quality, frame rate, device-pixel ratio, camera position, and reduced-motion state cannot change gameplay outcomes.
- If an authoritative source lacks enough information to present an effect honestly, the renderer omits or simplifies the effect. It does not invent a target, injury, witness, hazard, or emotional state.

### 3.3 Runtime scope

- Ambient environmental VFX may be continuous.
- Consequential cues are short one-shot sequences, normally `150–1,200 ms`.
- Ambient and movement-derived VFX freeze while effective world speed is `0` or a pause token is active.
- Accepted `critical`, `action`, and authorized `social` one-shots continue to age while a conversation or panel holds a world pause. A committed result must not become invisible because the movement animation loop is stopped.
- Application suspension freezes every VFX channel. Resume clamps the first delta and never fast-forwards missed time.
- Map transitions clear transient one-shot particles after the transition completes. The destination reconstructs only its ambient emitters and currently authoritative persistent conditions.
- VFX do not block save, load, quit, or recovery.
- This program does not add a combat system. Contextual violence remains a short abstract presentation of an already-resolved authored action.

## 4. Terms

- **Emitter:** an authored or derived source that can create repeated particles or light, such as rain, a chimney, a neon sign, a fire, or broken equipment.
- **Cue:** one typed request to present an effect at an anchor, along a path, or over the screen.
- **Effect instance:** one active runtime realization of a cue.
- **Primary mark:** the hard-edged pixel shape that communicates the action, such as a bolt core, impact arc, search-cone edge, ring, spark, or splash.
- **Secondary treatment:** supporting glow, blur, smoke, color wash, distortion, or camera recoil.
- **World effect:** an effect anchored to map coordinates and transformed by the camera.
- **Screen effect:** an effect composited in viewport coordinates, such as stress vignette or a one-frame flash.
- **Ambient effect:** repeated presentation whose source exists independently of one domain event.
- **Consequential effect:** one-shot presentation derived from a committed domain event or authoritative condition.
- **Presentation clock:** an explicit elapsed-time input used only for transient animation.
- **Visual weather:** presentation-only rain, wind, wetness, and related atmosphere. It has no gameplay effect until a future authoritative weather domain says otherwise.
- **Critical cue:** a short effect that communicates an important committed result and must retain its primary mark under load.

## 5. Non-goals

This program does not add:

- 3D characters, 3D buildings, skeletal animation, perspective camera, normal maps, or physically based materials;
- a second renderer or camera synchronization layer;
- gameplay weather, temperature, wind physics, wetness penalties, fire spread, stealth cones, electrical damage, or destructible geometry;
- free-running rigid-body physics;
- realistic blood, gore, dismemberment, prolonged suffering, or cinematic combat;
- screen-filling bloom or continuous full-screen blur;
- subpixel-filtered pixel art or fractional world zoom;
- VFX-authored collision or hit boxes;
- invisible-information leaks through witness, suspicion, evidence, search, or quest markers;
- copied character, environment, HDR, texture, or other third-party assets from the Elemental Sandbox repository.

The MIT-licensed Elemental Sandbox is a technical reference for layering procedural geometry, particles, shaders, and post-processing. Any source code later ported from it must retain its required copyright and MIT notice. SI World should independently author its Skia implementation unless a reviewed port is materially better.

## 6. Architecture

### 6.1 Four input classes

The VFX coordinator accepts four explicit input classes:

1. **Map ambient emitters**
   - fire, smoke, neon, sparkle, electrical fault, water-edge foam, chimney, and windblown-debris zones;
   - authored in map presentation data;
   - presentation only and excluded from `layoutRevision`.

2. **Authoritative environment presentation**
   - current map, authoritative absolute minute, roof/interior masks, water and ground-material masks, and a deterministic visual-weather profile;
   - may determine whether rain, wetness, wind, or harbor motion is visible;
   - cannot alter the domain state.

3. **Committed domain events and state transitions**
   - relationship change, conversation commit, villa discovery, quest resolution, police-attention advance, movement, evidence visibility, and future typed events;
   - adapted to cues only after the reducer commits them.

4. **Transient movement presentation**
   - actor visual foot position, direction, distance moved, surface material, and current speed;
   - used for dust, splashes, cigarette-smoke attachment, and wake attachment;
   - cannot commit movement or influence pathfinding.

### 6.2 Map emitter contract

`WorldMapV2.effects` evolves from the current `fire | sparkle` point into a presentation-only tagged emitter union. Existing authored entries remain accepted through defaults or normalization.

Every emitter declares:

- stable `id`;
- `kind`;
- point anchor, line, or tile bounds;
- stable `seedSalt`;
- intensity band: `subtle | standard | strong`;
- activation source: `always`, visual-weather profile, authored object state, authoritative object condition, or explicit development fixture;
- palette token family rather than arbitrary per-frame colors;
- indoor/outdoor policy;
- optional material or water mask requirement;
- optional attachment owner ID;
- culling bounds including the complete particle and glow reach;
- quality-floor behavior.

Emitter entries cannot declare damage, collision, detection, witness state, quest state, or other simulation outcomes.

### 6.3 Cue contract

The coordinator normalizes every transient request into one immutable `VfxCue` with:

- stable cue ID;
- cue kind;
- source type and source ID;
- map ID;
- world anchor and optional target or bounded region;
- committed event sequence when event-derived;
- start policy;
- duration;
- intensity;
- deterministic seed;
- priority: `critical`, `action`, `social`, or `ambient`;
- visual layer: `ground`, `depth`, `aerial`, or `screen`;
- palette token family;
- indoor/outdoor and occlusion policy;
- reduced-motion substitute;
- quality degradation policy;
- optional semantic tags used by evidence and review tooling.

Event-derived cue construction also receives a `VfxEventContext`. This presentation-only envelope contains the committed event plus anchors resolved from the post-commit visible world: current map ID, visible source foot point, optional visible target foot point, optional authorized marker bounds, and the result or entry identifier used by the recipe. Missing context is not guessed. A mapping that needs an unavailable anchor returns no world cue and can use HUD feedback only when the product already exposes the result there.

Cue creation is a pure function. It cannot read wall-clock time, camera state, React state, the DOM, Skia, or `Math.random()`.

### 6.4 Event adapter

A pure `domainEventToVfxCues()` adapter maps committed events to presentation. It must be exhaustive for the event types it supports and return an empty list for events that have no honest VFX.

Initial mappings include:

| Authoritative source | Permitted cue |
|---|---|
| `relationship-changed` | restrained positive, negative, or mixed relationship particles at the visible participant |
| `conversation-committed` | small conversation-close pulse when that conversation was on screen |
| `linda-villa-discovered` | discovery pulse only at the now-authorized exact location |
| `linda-quest-resolved` with `protect_linda` | deferred until the authored target is active and visible and the adapter has exact source/target anchors |
| `linda-quest-resolved` with `betray_linda` | restrained social fracture/quest resolution cue; no invented physical strike |
| `linda-quest-resolved` with `withdraw` | quiet quest-close cue; no violent presentation |
| `police-attention-advanced` | police-state punctuation tied to an authorized visible source, otherwise HUD-only feedback |
| `journal-entry-upserted` with exact visible marker | evidence or discovery glint at that marker |
| `protagonist-moved` / `npc-moved` | no direct event burst; movement dust uses transient movement samples instead |

The adapter consumes the existing append-only `WorldState.eventLedger` through one presentation cursor because the mounted runtime helpers currently discard most `CommandResult.event` values.

- On initial mount, loaded-save mount, fatal recovery, and renderer remount, initialize the cursor to the final existing sequence without producing cues.
- After each normal state commit, consume only the contiguous ledger tail whose `sequence` is greater than the cursor.
- Advance the cursor across supported and unsupported events so an empty mapping cannot block later cues.
- Reset to the new ledger end before presenting a replaced or loaded state.
- Use event ID and sequence for delivery identity and duplicate suppression, not for recipe geometry.
- Do not persist the cursor in `WorldState`.

Direct event delivery can replace this cursor only after every runtime command path carries `CommandResult.event` through one tested mounted interface. The first release does not depend on that refactor.

### 6.5 Explicit presentation clock

One dedicated VFX animation-frame driver supplies bounded elapsed milliseconds to a pure clock. It is mounted independently from the movement driver in `WorldScene`; opening a conversation, opening a panel, or selecting world speed `0` must not stop this driver.

- It must not call `Date.now()` or `performance.now()` internally.
- One submitted delta is clamped to `50 ms`.
- A world-pause flag freezes ambient age, ambient emission, ambient shader phase, and movement-derived particles.
- Accepted `critical`, `action`, and authorized `social` cues use the same submitted delta but continue during world pauses unless reduced motion replaces them with a static mark.
- Application suspension freezes both channels. Resume continues from the prior presentation age.
- A suspended window does not fast-forward thousands of particles.
- Ambient phase reconstructs from a stable visual-time origin derived from map ID, absolute-minute window, VFX revision, and emitter ID.
- One-shot cue age begins only when the newly committed cue is accepted by the coordinator.

### 6.6 Renderer passes

The first production release preserves the current seven-member `WorldLayer` order and the single character `Atlas`. Semantic VFX passes are explicit canvas insertion points, not new `WorldLayer` enum values:

1. render current `floor`, `prop`, and `shadow` world batches;
2. `ground-effect` — wet shimmer, puddle ripple, and other marks that must remain below feet;
3. render the current single character atlas and current `effect`, `wall`, and `roof` batches;
4. `aerial-effect` — outdoor rain, chimney smoke, leaves, and high sparks, clipped by compiled masks;
5. `screen-effect` — approved viewport treatments that cannot receive pointer events.

This boundary avoids the unproven claim that character sprites and arbitrary effects can share the current layer-first depth comparator. Character-interleaved depth effects are deferred. A later prototype must sort by float visual foot Y or `shadowWorldY`, preserve stable ID tie-breaking, split the character atlas only at measured effect boundaries, record the added draw calls, and pass the packaged frame gate before that path ships.

Adding VFX evidence does not silently change the current `drawCounts` contract. The first release publishes a separate strict `VfxEvidence` version `1` record. A later merge into responsive evidence must increment that schema and its strict package-smoke fixtures together.

### 6.7 Skia implementation primitives

Use the lowest-cost primitive that preserves the effect:

- `Path`, `Line`, `Circle`, `Rect`, and generated vertices for hard primary marks;
- batched atlas/vertex drawing for particles and repeated debris;
- one pooled packed array per particle family rather than object churn;
- `Picture` or cached drawing commands for repeated static marks;
- gradients and blend modes for restrained light falloff;
- one small blur layer for glow where a hard expanded halo is insufficient;
- `Skia.RuntimeEffect`/SKSL for bounded wet shimmer, heat distortion, local light wash, and screen treatment;
- offscreen surfaces only when the effect cannot be expressed in the normal canvas pass.

A particle is never its own React component. The first renderer uses one stable `VfxOverlay` child and one batched Skia `Path`, `Vertices`, or `Atlas` node per effect family. Its dedicated driver updates only that child at the recipe's stepped rate; it does not update `WorldScene` React state once per particle. Reanimated shared values or lower-level Skia picture updates are optional later optimizations and require a measured cross-platform proof before adoption.

### 6.8 Shader contract

Every runtime shader must:

- compile during initialization or fail to a non-shader fallback;
- use explicit uniforms for time, bounds, intensity, palette, seed, and resolution;
- operate only inside its declared local bounds unless it is an approved screen effect;
- preserve nearest-neighbor atlas sampling outside the effect;
- avoid reading undefined pixels outside its source image;
- expose a static fallback for reduced motion and low quality;
- have deterministic sampled-frame tests at named uniform values;
- avoid full-screen high-frequency noise or flicker.

Shader failure cannot blank the world. The renderer logs one bounded diagnostic, disables that shader family, and continues with hard pixel marks or no secondary treatment.

### 6.9 Culling, roofs, and interiors

Map compilation, not the frame loop, derives stable presentation masks. The compiled presentation payload must expose `outdoorKeys`, `interiorKeys`, `waterKeys`, `groundMaterialByKey`, opaque wall/roof bounds, and one presentation hash. `interiorKeys` may derive from existing roof-group interior cells; water and ground material derive from authored map/presentation data. A material VFX registry explicitly declares `acceptsWetShimmer`, `acceptsDust`, and `acceptsSplash`. Missing metadata means the effect is off for that cell.

- Cull emitters and active effects against their full transparent bounds, not only their anchor tile.
- Do not spawn ordinary particles while an emitter is beyond the culling margin.
- Rain and outdoor debris are clipped out of authored interior cells.
- If the player enters a building and its roof hides, rain does not appear inside the revealed interior.
- Chimney smoke can render above its roof because the emitter is authored as exterior/aerial.
- Neon and police light use wall, roof, and area masks so a glow does not uniformly paint through an opaque building.
- Evidence glints and witness markers obey visibility and roof rules and cannot reveal hidden information through a wall.
- Offscreen critical cues can fall back to a restrained HUD punctuation only when the underlying player-facing system already exposes the event.

## 7. Visual style contract

### 7.1 Pixel-first construction

- Primary particles use integer-sized marks of `1–3` native world pixels at `1×`.
- Keep particle positions unrounded for motion calculations and snap only the final draw coordinate to the physical-pixel grid.
- Primary outlines remain crisp at `1×`, `2×`, and `3×`.
- A glow can be smooth, but its crisp core must remain readable when glow is disabled.
- Procedural noise must resolve into coherent pixel clusters rather than television-like grain.
- Avoid dense white particles over faces, dialogue targets, doors, and interaction markers.

### 7.2 Hierarchy

The scene priority remains:

1. urgent committed outcome or active interaction;
2. selected character and important characters;
3. interactive objects and doors;
4. buildings and landmarks;
5. ambient VFX;
6. ground texture and background motion.

Ambient rain, smoke, leaves, shimmer, and neon cannot compete with faces or consequential cues. The VFX budget manager reduces ambient effects first.

### 7.3 Palette and light

- Every effect uses an authored semantic palette family.
- Fire uses warm core, amber edge, dark smoke, and at most one pale highlight.
- Electricity uses a pale core plus one controlled cyan/blue halo; it does not fill the screen with saturated blue.
- Police cues pair color with alternating side, shape, or directional motion so meaning is not color-only.
- Positive and negative social effects differ in trajectory and shape, not only green versus red.
- Smoke inherits local context: pale steam, gray chimney smoke, dark damaged-location smoke, or subtle cigarette smoke.
- Dynamic lights tint and raise local values but do not erase sprite outlines or material identity.

### 7.4 Timing

- Ambient motion is slow enough to read as atmosphere.
- Important impacts use a clear anticipation/core/recovery shape even when the total sequence is under one second.
- A consequential primary mark must remain readable for at least two submitted frames unless reduced motion replaces it with a static cue.
- No effect may flash more than three times per second.
- Police lights use softened alternating washes rather than full-screen strobing.

## 8. Environmental effect catalogue

### 8.1 Rain particles and splashes

**Trigger:** deterministic visual-weather profile is `rain` and the visible tile is outdoors.

**Presentation:**

- sparse diagonal hard-pixel streaks in the aerial pass;
- separate depth bands with small speed and length differences;
- short splash crowns or two-pixel bursts when streaks meet visible outdoor ground or water;
- occasional puddle rings on compatible surfaces;
- no rain inside revealed roof interiors.

**Rules:**

- Rain direction comes from the visual-weather wind vector.
- Spawn positions derive from emitter/window seed, not frame order.
- The player and NPCs do not become wet and movement does not change in this program.
- Reduced motion keeps a sparse static/slow streak field and disables fast splash animation.

### 8.2 Wet-street shimmer

**Trigger:** visual-weather wetness is active and the material opts into wet response.

**Presentation:**

- low-contrast elongated highlights aligned to the authored light direction;
- very slow bounded SKSL shimmer or stepped highlight phase;
- small puddle reflections near neon and police lights where the ground mask permits them;
- no mirror-quality screen-space reflection.

**Rules:**

- Never apply one full-screen wet filter.
- Do not make sand, carpet, wood interiors, or non-wet materials look like polished asphalt.
- Low quality and reduced motion use stable authored highlight clusters without animated distortion.

### 8.3 Neon signs softly illuminating nearby tiles

**Trigger:** an authored neon emitter is active. A full day/night system is not required; each sign declares when its visual light is enabled.

**Presentation:**

- crisp sign sprite remains the source;
- one restrained local gradient or shader wash reaches nearby exterior tiles;
- wet compatible ground can receive a broken, vertically stretched reflection;
- subtle pulse is allowed only when authored for a faulty or animated sign.

**Rules:**

- Clip or attenuate through walls and roof masks.
- Preserve nearby character outlines and skin-tone readability.
- Do not stack enough signs to turn the entire district into uniform magenta/cyan fog.

### 8.4 Smoke from chimneys, fires, and cigarettes

**Trigger:** authored emitter or authoritative attached source is active.

**Presentation:**

- pooled pixel clusters expand, drift with wind, darken or lighten by smoke family, and dissolve;
- chimney smoke begins above the chimney cap;
- fire smoke rises from the fire anchor and can include embers;
- cigarette smoke stays thin, intermittent, and attached near the authorized actor hand/head anchor.

**Rules:**

- Cigarette smoke is omitted when no authored behavior says the actor is smoking.
- Smoke cannot reveal an offscreen fire that the game intends to keep hidden.
- Reduced motion uses fewer, slower clusters with no turbulent side-to-side noise.

### 8.5 Dust kicked up while running

**Trigger:** an actor is moving above the authored dust threshold over a material that supports dust.

**Presentation:**

- small rear-foot puffs and two-to-six hard particles;
- color sampled from the material's semantic dust palette;
- emission follows travel distance, not render-frame count.

**Rules:**

- No dust on water, wet asphalt, clean interior tile, or other excluded materials.
- Walking can use no dust or a much smaller cue than running.
- Dust cannot affect traction, stealth, witnesses, or AI.

### 8.6 Ocean foam and ferry wake

**Trigger:** visible water-edge emitter, authored wave edge, or moving ferry visual footprint.

**Presentation:**

- broken white/blue foam segments along water boundaries;
- slow phase variation driven by stable water-emitter time;
- ferry wake uses two widening trails from the stern plus short dissolving bubbles;
- wake length derives from visual ferry speed and is clipped to water.

**Rules:**

- No foam on land or beneath opaque dock geometry.
- The visual wake does not drive ferry movement or collision.
- A stationary ferry loses its wake gradually rather than emitting indefinitely.

### 8.7 Electrical sparks from broken equipment

**Trigger:** an authored equipment emitter is active because an authoritative object condition is `broken`, or an explicit development fixture enables it.

**Presentation:**

- one-to-three-frame pale core spark;
- short cyan/blue branch or arc;
- a few falling hot particles;
- tiny local light response and optional smoke puff.

**Rules:**

- Do not infer that decorative equipment is broken.
- Sparks do not deal damage in this program.
- Timing is irregular but seeded and bounded; no uncontrolled strobing.

### 8.8 Leaves and paper moving through streets

**Trigger:** authored open-air debris zone and nonzero visual-weather wind.

**Presentation:**

- sparse leaf or paper silhouettes travel in short curved/stepped paths;
- occasional lift, settle, and re-entry rather than constant screen-wide flow;
- palette and item family match the district.

**Rules:**

- Spawn only in reviewed open routes or decorative margins.
- Cull or settle before passing visibly through walls or large solids.
- Do not make every particle collectible or interactive.
- Reduced motion uses occasional short translations without spin.

### 8.9 Heat distortion around fires

**Trigger:** visible strong fire or other explicitly authored heat source.

**Presentation:**

- small local SKSL displacement field above the source;
- slow upward phase with low amplitude;
- hard ember and flame marks remain readable without the distortion.

**Rules:**

- Maximum displacement is `1` native world pixel at `1×` in ordinary play.
- The field cannot distort HUD, dialogue, or the entire viewport.
- Disabled in reduced motion and low quality.

## 9. Contextual-violence effect catalogue

### 9.1 Authority and staging

A contextual-violence sequence begins only after a violent authored action commits its exact outcome. It receives:

- event ID and sequence;
- committed result ID;
- visible source and target anchors when available;
- direction from source to target;
- surface material;
- injury/health delta;
- authored breakable-object tags;
- violence-presentation setting;
- deterministic seed.

If source or target is not visible in the current map, do not stage a fake physical confrontation. Use the existing result panel and, if appropriate, one restrained screen/HUD punctuation.

### 9.2 Directional swipe or impact arc

- Draw one hard arc or tapered path oriented source-to-target.
- Use a pale impact core and one contextual accent, not a fantasy sword trail unless an authored weapon exists.
- Duration: `90–220 ms`.
- Reduced motion: show one static directional mark for `120–200 ms` with no travel.

### 9.3 Short debris burst

- Emit material-correct debris from the impact anchor.
- Typical count: `4–18` primary fragments plus optional dust.
- Debris is visual and disappears; it does not create inventory, collision, or permanent map damage.
- Never emit glass, wood, masonry, or metal without a matching authored surface/object tag.

### 9.4 Expanding impact rings

- One incomplete pixel ring expands across the ground or depth plane.
- Keep it broken and directional rather than a magical perfect circle.
- Maximum ordinary radius: about `0.75` tile; strong authored impact can reach `1.5` tiles.
- Duration: `180–420 ms`.

### 9.5 Shattered glass

- Allowed only when an authored glass object or window participates in the committed action.
- Use small hard triangular/line fragments, one pale glint, and short gravity-like fall.
- The VFX cannot permanently remove the window. Any persistent broken state must come from the authoritative object system.

### 9.6 Dust and smoke

- A short low cloud can bridge impact and recovery.
- Use surface-context color and keep faces visible.
- Duration: `300–900 ms`.
- Smoke cannot imply fire unless the committed or authored state contains fire.

### 9.7 Restrained pixel blood

- Default violence setting: `restrained`.
- Use at most `4–12` small dark red pixels for an authored physical injury.
- No mist cloud, arterial spray, body deformation, gore, or lingering pool.
- No blood for a miss, social betrayal, withdrawal, taser-only event, or non-injury result.
- `violenceVfx: off` replaces blood with neutral dark debris/impact marks.

### 9.8 One-frame lighting flash

- A single submitted render frame can raise local light around the impact.
- The flash is local where possible and never an unbounded white viewport.
- Maximum held time under a slow frame is `34 ms`.
- Disabled or replaced by a stable outline in reduced motion.

### 9.9 Subtle camera recoil

- Presentation-only offset; never writes saved camera position.
- Ordinary maximum: `2` world pixels.
- Strong authored maximum: `4` world pixels.
- Duration: `70–180 ms` with no oscillating shake loop.
- Disabled when reduced motion or camera motion is off.

### 9.10 Temporary ground mark

- Select a material-correct scuff, soot, dust, or restrained injury mark.
- Lifetime: `3–8` presentation seconds, then fade or step away.
- Not saved and not interactive.
- A persistent crime scene, broken object, blood stain, or fire scar requires a future authoritative world-state feature and is outside this VFX-only contract.

### 9.11 Initial Linda-quest mapping

- `protect_linda + linda_protected`: directional impact, modest debris/dust, local flash, restrained recoil, optional injury pixels because the committed target condition is injured.
- `protect_linda + injured_escape`: stronger player-centered impact/recovery cue reflecting committed player health loss; do not imply the boyfriend lost when he did not.
- `betray_linda`: social fracture and quest-completion cue; no automatic physical strike.
- `withdraw`: quiet quest-close sweep; no violence.

The visual sequence cannot change the already-committed reward, relationship delta, faction delta, evidence, witness list, police transition, health delta, elapsed time, or target condition.

## 10. Police and dangerous-situation effects

### 10.1 Red/blue police-light washes

- Anchor washes to an authored vehicle, beacon, station fixture, or authorized offscreen source.
- Alternate left/right local gradients at a photosafe rate.
- Wet compatible ground can receive broken reflections.
- Pair color with direction/shape so the signal remains readable under color-vision differences.
- Do not run a full-screen strobe.

### 10.2 Flashing search cones

- Render a crisp-edged translucent cone with a brighter border and soft interior falloff.
- A cone is only gameplay-significant if an authoritative detection system supplies its origin, direction, bounds, and active state.
- Until then, an authored cone is decorative and must not suggest a traversable safe/unsafe boundary during player control.
- Decorative cones should stay away from routes where players could reasonably mistake them for stealth mechanics.

### 10.3 Crime-scene highlighting

- Highlight only evidence or a location the player is authorized to inspect.
- Use a slow perimeter pulse, evidence glint, or ground bracket rather than a magical pillar.
- Do not reveal hidden evidence, exact location, witness identity, or ownership through walls, roofs, or fogged knowledge.

### 10.4 Fire and smoke from damaged locations

- Require an authored damaged/burning condition or map emitter.
- Combine hard flame marks, embers, local light, and context-appropriate smoke.
- Fire remains visual unless a future authoritative hazard system exists.
- Warning copy or interaction state must not claim damage-over-time when none exists.

### 10.5 Electrical taser arcs

- Require a committed taser action and visible source/target anchors.
- Draw a short branched pale/cyan path, a few sparks, and a local flash.
- No chain lightning, fantasy aura, or electrical damage beyond the committed result.
- Reduced motion uses one stable zigzag for a short hold.

### 10.6 Warning-zone circles

- Use broken floor rings, corner brackets, or striped bounds.
- A warning zone must come from authoritative hazard/interaction bounds.
- If the zone is only an interaction preview, label it through existing UI and use a different palette/shape from danger.
- Never teach the player that a decorative VFX region has collision or damage.

### 10.7 Suspicion and witness markers

- Animate an existing player-authorized marker rather than exposing hidden AI state.
- A witness marker appears only when the rules/UI already tell the player that the NPC witnessed the event.
- Suspicion can use a short rise/pulse, directional glance line, or bracket; it cannot expose a hidden numeric meter unless that meter is part of the product design.
- Markers remain legible without color and do not cover the face.

## 11. Social and quest effects

### 11.1 Conversation initiation ring

- One restrained ring contracts or resolves under the selected conversation target.
- It confirms which visible NPC is being engaged.
- Duration: `180–350 ms`.
- It does not imply consent, relationship gain, or conversation success.

### 11.2 Relationship-change particles

- Derive direction and intensity from committed nonzero relationship deltas.
- Positive change rises or draws inward with warm/soft shapes.
- Negative change falls, separates, or fractures with cooler/darker shapes.
- Mixed deltas use a restrained mixed cue rather than falsely summarizing the result as wholly positive or negative.
- Do not expose hidden values beyond what the relationship UI already permits.

### 11.3 Discovery/revelation pulse

- Trigger only after exact discovery becomes authorized.
- Use a map-ground pulse, bracket expansion, and short landmark glint.
- Vague journal information cannot produce an exact-location pulse.
- Faction revelation can use a restrained panel/screen punctuation unless a visible world anchor is authoritative.

### 11.4 Quest-completion sweep

- A narrow authored accent travels across the quest result surface or briefly around the player.
- Success, failure, betrayal, and withdrawal use distinct shape/timing, not only different colors.
- The sweep starts after the terminal quest state commits.
- It cannot conceal consequence text or delay save availability.

### 11.5 Evidence-acquired glint

- Trigger only for newly visible/interactable evidence.
- Use one or two crisp glints plus a low-frequency outline pulse.
- Stop after acknowledgment or a bounded duration.
- Never repeatedly sparkle every evidence object like loot.

### 11.6 Emotional stress or intoxication treatment

- Require an authoritative player status or authored scene state.
- Stress may use a restrained edge vignette, slight stepped pulse, and reduced peripheral saturation.
- Intoxication may use bounded local offset/soft doubled edges and slow color separation.
- Do not use uncontrolled camera sway, nausea-inducing warping, or full-screen blur that prevents play.
- Reduced motion and `screenEffects: off` replace these with a stable HUD/status treatment.
- These effects do not diagnose a condition or create one from dialogue sentiment.

## 12. Visual weather contract

A pure `visualWeatherAt(mapId, absoluteMinute, vfxRevision)` function can provide presentation-only weather until a gameplay weather system exists.

It returns a versioned profile containing:

- `kind`: `clear | rain | windy`;
- wetness intensity;
- rain intensity;
- integer wind vector band;
- transition start/end absolute minute;
- semantic palette modifiers.

Rules:

- Identical map, absolute minute, and VFX revision return identical weather.
- It never reads or advances simulation RNG.
- Save/load at the same minute reconstructs the same profile.
- A large time jump selects the new profile without simulating every missed raindrop.
- Weather changes presentation only. Journal, NPC schedules, movement speed, dialogue, health, and AI do not infer weather effects.
- The UI does not claim gameplay consequences that do not exist.
- A future authoritative weather domain can replace this source without changing renderer cue contracts.

## 13. Preferences and accessibility

The first production release keeps the strict existing presentation-preference schema at version `1`. It honors operating-system reduced motion and a non-persisted development/release VFX-only fallback. It does not write unknown VFX fields into `presentation-preferences.json`.

Player-selectable VFX settings are a later change. They use a separate strict `vfx-preferences.json` document at schema version `1`, or another persistence design with a proven downgrade path. An older build must be able to run and save camera/window preferences without deleting newer accessibility choices. Qualification must include upgrade, downgrade, old-build save, and re-upgrade recovery before these controls ship.

The later VFX-preference document can add:

- `vfxQuality: auto | low | medium | high`;
- `vfxIntensity: reduced | standard`;
- `cameraMotion: off | subtle`;
- `screenEffects: off | reduced | standard`;
- `violenceVfx: off | restrained`.

Defaults:

- quality: `auto`;
- intensity: `standard`;
- camera motion: `subtle`;
- screen effects: `standard`;
- violence: `restrained`.

Reduced-motion authority overrides preferences:

- disable camera recoil;
- disable heat distortion and rapid local displacement;
- replace traveling/expanding critical cues with short static marks where necessary;
- reduce rain speed and particle count;
- remove spin from leaves and paper;
- soften police alternation;
- retain the informational primary mark so reduced motion does not hide outcomes.

Additional accessibility rules:

- no effect flashes more than three times per second;
- no full-screen white flash;
- no meaning conveyed only by red/green or red/blue color;
- critical markers remain recognizable in grayscale and common color-vision simulations;
- effects cannot obscure conversation text, controls, focus rings, or pointer targets;
- when the later preference store is qualified, settings are available from the same presentation/settings surface as world and UI scale;
- first paint honors operating-system reduced-motion state without a full-motion flash.

## 14. Performance and quality scaling

### 14.1 Required gate

The packaged Phase 22 maximum-load scene remains at least a rounded `60 FPS` with ordinary world layers, a scripted concurrent local-model generation fixture, and the VFX stress fixture enabled on the qualification baseline.

Against a same-machine, same-camera, same-DPR, same-package VFX-off baseline:

- median frame time may regress by no more than `10%`;
- the end-to-end submitted frame-time regression is the authoritative gate and includes JavaScript updates, React work, Skia buffer/path updates, clipping, GPU drawing, DPR cost, and garbage collection;
- the pure VFX update step target of `1.5 ms` median and `3 ms` p95 is diagnostic inside that end-to-end gate, not a separate substitute for it;
- no recurring particle allocation/collection spike may exceed `5 ms` because of ordinary emission;
- a shader compile cannot occur during active play;
- no VFX path creates one React element per particle.

Hosted platform-shell runs record metrics but do not replace the named local renderer qualification.

### 14.2 Budgets

Prototype stress inputs, not pre-approved release ceilings:

| Quality | Ambient particles | Action/critical reserve | Total hard ceiling |
|---|---:|---:|---:|
| Low | 120 | 48 | 168 |
| Medium | 240 | 72 | 312 |
| High | 360 | 96 | 456 |

Additional ceilings:

- at most one measured local shader field in the smallest weather prototype; later releases can raise this only with packaged evidence;
- at most one screen shader/treatment at once;
- at most eight active one-shot cue sequences;
- at most one camera-recoil owner; higher priority replaces lower priority;
- decoded texture increase for VFX-only masks or particles stays at or below `1 MiB` unless a measured review approves more.

These values define the maximum input to the prototype stress fixture. The shipped caps are the highest values that pass the end-to-end packaged gate and visual review, and can therefore be lower. Raising them requires new packaged measurements and visual proof.

### 14.3 Degradation order

When the budget is exceeded, degrade in this order:

1. stop spawning offscreen ambient particles;
2. reduce rain, smoke, leaves, paper, foam, and secondary spark density;
3. remove secondary glow/blur from ambient effects;
4. disable heat distortion and animated wet shimmer;
5. shorten noncritical trails;
6. collapse duplicate ambient emitters into one batched field;
7. keep the hard primary mark of critical, action, and authorized social cues.

Quality scaling cannot remove an authoritative warning marker or make a committed outcome unreadable.

### 14.4 Pooling and lifecycle

- Preallocate or grow particle pools in bounded chunks.
- Reuse packed slots after expiry.
- Clear map-owned pools on transition.
- Clear all transient pools on new game, loaded-save mount, fatal recovery, or renderer remount.
- Do not retain Skia images, shader children, paths, or buffers after their owner unmounts.
- Development evidence records active counts, culled emitters, dropped ambient spawns, shader fields, update time, and render-frame metrics.

## 15. Determinism, replay, and persistence

### 15.1 Seed contract

Every procedural recipe derives geometry from a stable length-prefixed semantic tuple such as:

`(vfxRevision, mapId, recipeId, semanticSourceId, anchorOrBounds, resultIdOrMinuteWindow, seedSalt)`

- Use the repository stable hash utility or an equivalent exported stable hash.
- Never use `Math.random()`.
- Never read object iteration order as randomness.
- Particle spawn order and pool reuse cannot change the sampled result for the same cue.
- Event ID and ledger sequence identify delivery and deduplication only. They do not perturb semantic geometry when the same authored result occurs at the same anchor.

### 15.2 Deterministic evidence

Given the same cue, quality, reduced-motion mode, and explicit elapsed time, the coordinator returns byte-identical primary geometry and stable sampled particle data.

Quality levels may use different secondary-particle counts. They must preserve:

- cue kind;
- anchor and target;
- start and end;
- primary mark direction;
- semantic palette;
- authorized information;
- reduced-motion substitute contract.

### 15.3 Save/load

Transient VFX are not saved in `WorldState`.

On load:

- initialize the event-consumption cursor to the final existing event sequence;
- do not replay old relationship, quest, violence, evidence, police, or conversation cues;
- reconstruct ambient emitters from map presentation data and current authoritative state;
- reconstruct visual weather from current map/minute/VFX revision;
- do not restore temporary impact debris, camera recoil, short particles, or ground marks;
- preserve the existing version-1 presentation preferences; preserve later VFX choices only after their separate downgrade-safe store is qualified.

No world-save schema change is required for VFX. The first release does not change the existing presentation-preference schema.

### 15.4 Revisioning

- `vfxRevision` versions procedural recipes and deterministic captures.
- Changing a visual recipe increments `vfxRevision` when it changes deterministic evidence.
- VFX-only changes do not increment map `layoutRevision`.
- VFX-only changes do not invalidate routes, replay commands, saves, evidence, or quest state.

## 16. Information-safety rules

VFX must not become an accidental cheat layer.

- Do not mark a witness until the player-facing rules expose that witness.
- Do not glint hidden evidence or an undiscovered exact location.
- Do not render a police search cone as a danger boundary without an authoritative detection contract.
- Do not show fire, smoke, blood, broken glass, or damaged equipment unless authored or committed state supports it.
- Do not infer hidden attraction, hostility, intoxication, stress, guilt, faction membership, or criminal status from model-generated dialogue.
- Do not display offscreen actor anchors simply because their coordinates exist in state.
- Do not show an effect through a roof/wall when the underlying item or NPC is intentionally hidden.
- Development-only debug markers must be visibly labeled and disabled in production packages.

## 17. Validation and acceptance

### 17.1 Unit tests

Test pure modules for:

- emitter and cue schemas;
- old `fire`/`sparkle` normalization;
- domain-event-to-cue mapping;
- unsupported event returns no cue;
- duplicate event produces no duplicate cue;
- stable seed and sampled geometry;
- no `Math.random()` in VFX source;
- explicit elapsed-time stepping and `50 ms` clamp;
- pause/resume continuity;
- particle-pool reuse and hard ceilings;
- priority arbitration and degradation order;
- semantic pass insertion without changing the seven-member `WorldLayer` order;
- culling by complete bounds;
- reduced-motion substitutions;
- later VFX-preference upgrade/downgrade recovery, when that separate store is implemented;
- load cursor prevents ledger replay;
- shader-failure fallback.

### 17.2 Integration tests

Prove:

- rain is absent from revealed interiors and present outdoors;
- wet shimmer appears only on compatible wet materials;
- neon and police washes do not uniformly paint through walls;
- movement dust follows distance and material, not frame count;
- ferry wake remains clipped to water and fades after stopping;
- broken-equipment sparks require the correct source condition;
- the event-ledger cursor consumes only post-mount events and continues critical cues while a panel or conversation pauses the world;
- Linda physical cues remain absent until exact visible source and target anchors exist;
- betrayal and withdrawal do not receive physical-impact VFX;
- violence-off removes blood without changing the result;
- evidence/witness markers do not appear before authorization;
- map transitions clear old transient effects;
- save/load reconstructs ambient state without replaying one-shots;
- quality changes presentation cost only, never domain state or command traces.

### 17.3 Native-`1×` visual review

Every effect family must pass a tracked `1×` capture before larger zoom review.

Review questions:

1. Is the primary mark readable without glow?
2. Does the effect match the warm-noir pixel diorama rather than a smooth 3D game?
3. Can the player still read faces, doors, routes, interaction markers, and dialogue targets?
4. Does the effect communicate only authorized information?
5. Does ambient motion stay quieter than critical action?
6. Does the reduced-motion version preserve meaning?
7. Does the effect remain recognizable in grayscale and common color-vision simulations?
8. Does it avoid obvious repeated cycles or screen-space noise?

### 17.4 Capture matrix

Capture and compare:

- `1×`, `2×`, and `3×` world zoom;
- DPR `1` and `2` where supported;
- `1280×720`, `1440×900`, `1600×720`, `1920×1080`, and `2560×1440`;
- all four neighborhoods;
- exterior, doorway, interior with hidden roof, and roof-restored states;
- clear, rain, and windy visual-weather profiles;
- standard and reduced motion;
- low, medium, and high VFX quality;
- standard and violence-off contextual outcomes;
- ordinary and maximum-load scenes.

Every evidence capture records commit SHA, package provenance, map, camera, zoom, DPR, window size, art revision, VFX revision, visual-weather profile, VFX quality, reduced-motion mode, active counts, and cue IDs.

### 17.5 Packaged runtime acceptance

The Electron package must prove:

- shader initialization and fallback;
- no blank canvas after renderer start;
- no console error during every catalogue fixture;
- crisp primary marks at every integer zoom;
- correct pause, resize, camera pan, map transition, save, load, and restart behavior;
- no input/hit-test change from screen effects;
- maximum-load performance gate;
- deterministic screenshot hashes or approved bounded pixel-difference masks at named sample times;
- Windows and macOS package behavior before release qualification.

## 18. Smallest quality prototype

The first production implementation upgrades only the six existing authored `fire | sparkle` map points. This is the smallest visible Skia-native proof that avoids every unresolved event, mask, preference, and character-depth contract.

### 18.1 Authored fire points

Include:

- the current exact authored anchors and current `effect` layer;
- a hard pixel flame core, stepped outer lick, restrained ember pixels, and a small warm halo;
- stable semantic seed from map ID, effect ID, anchor, recipe, and VFX revision;
- a bounded explicit ambient clock that freezes at effective world speed `0`;
- one batched Skia path or equivalent family node, with no React component per mark;
- a static reduced-motion form;
- the current circle renderer as a non-persisted VFX-only `circle` fallback while enhanced ground art stays fixed.

### 18.2 Authored sparkle points

Include:

- the current exact authored anchors and current `effect` layer;
- a crisp cross or diamond primary mark with a sparse stepped satellite twinkle;
- the same seed, clock, batching, reduced-motion, culling, and fallback contracts as fire;
- stable sampled geometry at named elapsed times.

The prototype does not add rain, wetness, shaders, map schema fields, preference fields, event cues, character-interleaved effects, or save data. It passes unit, native-`1×`, responsive, reduced-motion, pause, deterministic, and packaged VFX-only comparison gates before weather work begins.

## 19. Delivery sequence

### Phase A — Existing-emitter vertical slice

- add stable semantic seeds, pure fire/sparkle geometry, and a bounded explicit ambient clock;
- add one stable batched Skia overlay for the current authored effects;
- honor operating-system reduced motion and effective world pause;
- expose primitive/update diagnostics through existing evidence without changing `WorldLayer`;
- keep current simple map effects as the VFX-only `circle` fallback;
- change no domain event, map schema, preference schema, or save schema.

### Phase B — Weather and delivery contracts

- compile outdoor, interior, water, material, wall, and roof presentation masks;
- add ground/aerial/screen insertion points without changing `WorldLayer` or character atlas batching;
- add the ledger cursor and independent action-cue clock;
- add one local shader family with static fallback;
- complete a rainy Neon Crescent weather fixture and a development-only anchored event fixture.

### Phase C — Environmental catalogue

- complete rain, wetness, neon, smoke, dust, foam/wake, electrical sparks, leaves/paper, and heat distortion;
- author district palette tokens, masks, emitters, and review fixtures.

### Phase D — Consequential catalogue

- first add exact visible-anchor resolution and any required authoritative content/presentation data;
- measure a character-interleaved batching prototype before allowing depth effects around actors;
- complete contextual violence, police/danger, social, quest, evidence, stress, and intoxication cues;
- audit every mapping for authoritative source and information leakage.

### Phase E — Package and polish

- run complete visual matrix and package smoke;
- tune quality budgets from measured evidence;
- fix all high-impact visual, accessibility, determinism, and performance findings;
- retain VFX-off rollback until the new renderer passes release qualification.

## 20. Repository impact map

Expected source-of-truth and runtime work includes:

- `src/domain/events/types.ts` — authoritative event inputs; change only when an effect needs honest data that no existing event exposes.
- mounted `WorldScene` runtime path — first mount the fire/sparkle clock; later consume only the post-mount ledger tail through a presentation cursor.
- a separate future VFX-preference repository — add player settings only with upgrade/downgrade recovery; keep the current strict presentation store unchanged in the first release.
- `src/application/accessibility.ts` — preserve operating-system reduced-motion authority and first-paint behavior.
- `src/world/maps/schema.ts` — evolve presentation-only effect emitters while preserving old `fire`/`sparkle` content.
- `src/world/presentation/*` — compile emitter masks, semantic palettes, stable bounds, and presentation hashes.
- `src/render/world-frame.ts` — preserve the current seven layers; expose only stable world data needed by separate later VFX insertion points.
- `src/render/WorldScene.tsx` — mount one coordinator/clock, render batched Skia passes, apply camera-only recoil, and publish evidence.
- new focused `src/render/vfx/*` modules — cues, recipes, particles, pool, budget, event adapter, clock, shader registry, render batches, and diagnostics.
- `content/maps/*.json` or a dedicated presentation catalogue — authored emitters and activation metadata without collision changes.
- package/evidence scripts — visual fixtures, deterministic sampled captures, responsive matrix, maximum-load report, and shader-failure proof.
- tests beside domain adapters, map compilation, render modules, presentation preferences, and packaged Electron smoke.
- `docs/art/halcyra-art-bible.md` — semantic effect palettes, timing, intensity, district atmosphere, and anti-examples.

This map is directional, not permission for a monolithic `WorldScene` implementation. Pure cue, clock, particle, seed, and budget logic belongs in focused modules with direct tests.

## 21. Rollback and failure behavior

- A top-level development/release flag can disable the new VFX system and restore the current simple `fire`/`sparkle` fallback during qualification.
- A failed shader family falls back independently; it does not disable hard particles or blank the scene.
- An invalid emitter fails content validation with emitter ID, map ID, field, and reason.
- A malformed optional event mapping returns no cue and logs a bounded development diagnostic; it cannot block the committed domain result.
- Pool exhaustion drops ambient secondary particles first and records the drop count.
- A critical cue always retains a non-shader hard primary mark.
- VFX errors cannot corrupt saves because transient effect state is not serialized into `WorldState`.
- Rollback does not require a world-save migration. The first release leaves the existing strict presentation-preference document at version `1`; a later VFX-preference store cannot ship until downgrade recovery preserves accessibility choices.

## 22. Definition of done

This specification is complete only when:

- all requested environmental, contextual-violence, police/danger, social, and quest effect families exist or are explicitly deferred with evidence;
- the runtime remains Skia-native and uses no second world renderer;
- every consequential cue traces to an authoritative event or state source;
- the full domain command trace and final `WorldState` are identical with VFX off, low, medium, and high;
- transient cues do not replay on loaded saves;
- reduced motion, screen-effects-off, camera-motion-off, and violence-off preserve gameplay and required information;
- primary marks pass native-`1×` review without relying on glow;
- roofs, walls, materials, water, and culling masks behave correctly;
- every effect remains subordinate to characters, interactions, and consequence text;
- the packaged maximum-load `60 FPS` and median-frame-regression gates pass;
- macOS and Windows package smokes pass;
- source, licences, VFX revision, deterministic captures, performance reports, and art-review evidence are recorded;
- no high-impact determinism, information-leak, accessibility, performance, or visual-hierarchy finding remains open.
