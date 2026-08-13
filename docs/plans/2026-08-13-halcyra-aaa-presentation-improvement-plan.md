# Halcyra AAA-presentation improvement plan

Status: Assessment and roadmap. Written 2026-08-13 against commit `44dc266`, from fresh hidden-window
packaged screenshots, the four district overviews, a source audit, and research into the most-loved
simulation games.

## 0. The locked rule

Every idea in this plan obeys one unchangeable constraint, set by Joe and already encoded in
[the art bible](../art/halcyra-art-bible.md) §1:

- Halcyra stays 2D.
- Halcyra stays minimalistic, with RimWorld-like simulation clarity.
- No idea below adds per-tile art detail. Improvement comes from sound, light, motion, density
  of *placement*, and simulation-visibility UI.

The research backs this constraint. RimWorld (Steam ~98% positive) treats abstraction as a feature:
simple pawns let players project stories onto them. The gap between Halcyra and a top-rated sim is
not pixels. It is motion, audio, and making the simulation visible.

## 1. Where Halcyra stands today: 4.5 / 10 vs an AAA bar

"AAA" for a 2D sim means the polish bar of the genre's best (RimWorld, Stardew Valley,
Factorio, Dwarf Fortress Steam edition), not photorealism. Scorecard:

| Area | Score | Evidence |
|---|---|---|
| UI art direction | 7/10 | Coherent warm-noir chrome, Silkscreen type, district-tinted accents (amber in Sunward, pink in Neon Crescent, teal in Greywake). The arrival screen is genuinely strong. |
| Character art | 7/10 | 35-identity cast with enforced two-feature oddities, portraits + expressions, shared-source world cells. The strongest asset. |
| World art (tiles, buildings) | 5/10 | Good palette discipline and wall/roof grammar. But ground textures repeat visibly, the big terracotta roof reads as a flat orange field, and path plazas have abrupt color-patch seams. |
| World density and life | 3/10 | The bible's own rule ("a playable area must not look like an empty grid", §11) is violated. Interiors are near-empty rooms with the same desk/table rows copy-pasted. Plazas are vast blank fields. 34 NPCs across an island this size means most screens show zero or one person. Sunward has a "Public Beach" label with no visible water. |
| Motion and feel | 4/10 | Walk cycles, protagonist wobble, and 8 deterministic ambient VFX kinds (steam, leaves, neon, insects, water, fire, sparkle, palm) exist. But no camera easing, no idle animations, no UI transitions, no permanence (footprints, wear, residue). |
| Lighting and atmosphere | 5/10 | A 4-period day/night wash and per-district night light pools exist and are tasteful. But neon reflection puddles render on dry streets at 8 AM (see §3), and there is no weather at all. |
| Audio | 1/10 | Four generated vocal chirps. No music, no ambient soundscape, no footsteps, no UI sounds. This is the single biggest gap. |
| Simulation visibility | 4/10 | The selected-character card (portrait, mood chip, NOW/GOING) is a great start. But there is no mood ledger, no needs beyond energy/health, no event/alert stack, no at-a-glance state for unselected NPCs. |
| Onboarding and shell | 3/10 | The arrival screen is excellent. But the app boots straight from a plain loading screen into it — no title menu, no save-slot UI, no pause menu, no settings beyond zoom/UI scale. |

**Overall: 4.5/10.** The foundations (determinism, art pipeline, review gates, character system,
UI chrome) are unusually strong for this stage. The presentation layers that make players *love*
minimal sims — audio, density, visible simulation, juice — are mostly absent.

For calibration: Dwarf Fortress ran the identical simulation for 20 years at roughly this
presentation level and most players quit at first launch. The Steam remaster added a readable
tileset, mouse support, a tutorial, and a soundtrack — and earnings rose 46,000%. Presentation is
the access layer to depth that already exists. Halcyra's depth (LLM conversations, deterministic
consequences, persistent memory) deserves that access layer.

## 2. What the most-loved sims teach

Condensed from research across RimWorld, Dwarf Fortress, Stardew Valley, Prison Architect,
Oxygen Not Included, Factorio, Project Zomboid, Kenshi, Caves of Qud, Shadows of Doubt, and
The Sims. Full sources at the end.

1. **Audio is invisible detail.** Players call Stardew's soundtrack "the game's unsung hero." A
   pool of non-looping ambient one-shots keyed to place/time/weather makes a static map feel alive
   without one new pixel. Abrupt music transitions are worse than silence (Project Zomboid's
   documented complaint) — crossfade or stay quiet.
2. **The simulation must be visible or it does not exist.** Shadows of Doubt's 1.0 critics called a
   deep sim "an empty shell" because consequences did not surface. RimWorld surfaces everything:
   severity-tiered alerts, an itemized mood ledger ("Ate without table −3"), event letters with
   tone. The ledger *is* the storytelling.
3. **One glyph per character, one panel per question.** The Sims' plumbob answers "how is this
   person" from across the room; needs bars answer "why did they do that." Both are pixel-cheap.
4. **Juice is code, not art.** The documented difference between prototype-feel and polished-feel:
   tween everything, sound on every interaction, scale pops, camera lerp toward focus, hitstop on
   big beats ("Juice It or Lose It"; "The Art of Screenshake"). A sim wants easing, not shake.
5. **Noir is lighting plus weather, not geometry.** Shadows of Doubt sells exceptional noir
   atmosphere over crude voxels with neon-through-steam, rain, and grading. Halcyra's warm-noir
   identity can be carried the same way.
6. **Permanence tells stories.** Footprints, wear near doors, a glass left on the bar, blood
   stains in RimWorld. The map should remember what happened.
7. **Combinatorial variety must map to behavior.** Prison Architect's trait-and-appearance
   assembly works because visual variety mirrors behavioral variety. Halcyra's two-feature cast
   rule already nails the visual half.
8. **Onboarding is co-equal with graphics.** DF's tutorial and mouse support shared headline
   billing with the tileset. Halcyra's "No tutorial. Follow your curiosity." is a bold stance —
   it can work, but the first 10 minutes must teach through the world itself.

## 3. Fix first: regressions found during this review

These are not style work. They block trust in everything else.

1. **The packaged smoke gate is broken at HEAD.** Three renderer changes shipped without updating
   the driver in [electron/main/index.ts](../../electron/main/index.ts): the compact HUD moved
   `#world-ui-zoom-value` behind a SETTINGS drawer, `#world-ui-talk` was removed with the
   selected-character rework, and the talk button label is now uppercase ("Talk to LINDA"). CLAUDE.md
   says "update both sides together"; that rule was broken three times. This worktree branch carries
   driver fixes for all three (plus a hidden-window smoke mode per AGENTS.md). Land them. With those
   fixes the run reaches `complete`, but three assertions still fail and need triage:
   `newGameFlow` (the cinematic arrival likely reveals its text after the driver reads it),
   `closedFerry` (the "FERRY TERMINAL · CLOSED" body text is not found), and `relationshipPanel`.
2. **Neon puddles glow on dry streets at 8 AM** in Neon Crescent. Night-only (or rain-justified)
   gating for the neon/reflection ambient effects. The bible (§3) already says night lighting is
   local pools — daytime confetti undermines it.
3. **Committed evidence screenshots are stale.** The last four feature commits (compact HUD,
   journal board, ambient motion, cinematic arrival) shipped no refreshed evidence, so
   `artifacts/phase-14/macos/current/` misrepresents HEAD.

## 4. The roadmap

Ordered by leverage per unit of work. Each phase respects the repo's phase/evidence conventions
(review boards, `artRevision` bumps, smoke updates on both sides).

### Phase A — Audio identity (biggest single lever, zero art-bible risk)

The game is silent today. Target state:

1. **District/time music sets.** One calm daytime theme and one noir night theme per district
   mood family (resort, neon, civic) — even 6 short looping tracks transform the game. Crossfade
   over 4-8 seconds on district change and day/night boundary. Never cut.
2. **Ambient one-shot pool.** Gulls, waves, and palm rustle in Sunward; distant bass, glass
   clinks, and scooter passes in Neon Crescent; rope creak, hull thuds, and horns in Greywake;
   market murmur in Saffron. 20-40 short sounds, played sparsely and non-predictably, keyed to
   district + period. This is the Stardew trick and it is pure code + cheap assets.
3. **Interaction SFX.** Soft click/confirm for every button, footstep variation by material
   (sand/boardwalk/stone/asphalt already exist as material families), door open/close, save chime,
   money tick. One sound per interaction, quiet and warm.
4. **Conversation voice blips.** Extend the existing 4 vocal cues into per-character pitch-varied
   blips during text reveal (The Sims / Animal Crossing pattern). Sentiment-tinted (the consequence
   system already classifies tone). Makes LLM text feel voiced for free.

Existing hooks: `expo-audio` is already a dependency; `src/audio/vocal-cues.ts` and the
captioned-audio smoke checks give the pattern to extend. Keep captions for accessibility.

### Phase B — Make the simulation visible (the RimWorld heart)

1. **Event feed / alert stack.** A right-edge stack of small, severity-tinted, expiring cards:
   "Linda headed to Shoreglass Spa", "Rent due tomorrow", "Someone watched you at the marina".
   Click jumps the camera. Tier and dedupe from day one (RimWorld's alert spam is a known failure).
2. **Mood ledger on the selected card.** The card already shows a mood chip (CURIOUS) and
   NOW/GOING. Add the itemized *why*: "+10 spa visit, −5 overheard gossip". The consequence and
   relationship systems already produce these facts; render them.
3. **Plumbob-lite state gem.** The protagonist already has a diamond marker. Extend it: hovered or
   conversation-relevant NPCs get a tiny state gem (color = disposition toward you). One authored
   glyph, no new art language.
4. **Needs surfacing.** Energy and health exist. If hunger/social/hygiene exist in the domain,
   show them as thin bars on the selected card; if not, do not invent them for the UI.
5. **Schedule legibility.** NOW/GOING text is already there — add "opens at 18:00" state to
   business labels and doors so closed buildings read as scheduled, not broken.
6. **Use the generated portrait expressions.** The art pipeline already produces `rest`, `joy`,
   and `upset` portraits for every named character (bible §9.5), and the conversation system
   already classifies tone — but the UI only ever shows `rest`. Wiring sentiment to expression is
   the cheapest emotional-fidelity win in the codebase: the assets exist and are reviewed.

### Phase C — Density pass (fill the empty grid, not the tiles)

The bible's §11 is the spec; the current world fails it. No new art fidelity — more *placement*
of existing families, plus a handful of new prop compositions in the same grammar.

1. **Shrink perceived open space.** Break the giant plazas into "outdoor rooms" with planted
   edges, awning lines, benches, market stalls, and path material changes. The Saffron and
   Promenade plazas should read as three or four distinct places each.
2. **Interior identity.** Club Strip, Arcade Row, Market Hall, and the warehouses are near-empty
   boxes with identical desk rows. Each interior needs one focal composition (bar counter + stools
   + shelf wall; arcade cabinets; market tables with goods) built as multi-tile props per §8.
   Two rooms must never share the same layout.
3. **Sunward needs its shoreline.** A beach-resort district with no visible water fails the
   bible's first-sight rule ("warm sun, clean water"). Bring sand-to-water transition and the pier
   into the northwest map edge, with the existing shallow-water family.
4. **Population presence.** 34 NPCs on maps this large reads as abandoned. Either concentrate
   ambient residents into public hubs on schedule (plaza at noon, club strip at night) or add
   cheap non-cast extras (silhouette-light background pedestrians). Concentration is cheaper and
   more deterministic — do that first.
5. **Fix the seams.** The path-crossing color patches and the flat roof field are §13 rejects
   (visible repeats, multi-tile seams). Roof needs course variation within the existing terracotta
   family.

### Phase D — Juice (feel, not fidelity)

1. **Camera easing.** Lerp toward click-move targets and panel-focus jumps; slight look-ahead in
   the movement direction. Never snap unless the player scrubs.
2. **UI transitions.** Side sheets slide, cards fade+rise 4-8 px, money counts up, save status
   pulses once. 100-160 ms, eased. Respect `prefers-reduced-motion` (the accessibility policy
   check already exists).
3. **Selection/interaction pops.** Buttons and the selection ring scale 1.0→1.06→1.0; context
   menu items stagger in 30 ms apart.
4. **Beat pauses.** On quest resolution or a relationship milestone: 300 ms hold, a small sting
   (Phase A), and the journal stamp animating in. One authored moment per major beat.
5. **Idle life.** 3-5 exaggerated idle loops shared by the cast (stretch, fidget, look around,
   check bag). ONI proves few-but-overacted beats many-but-subtle at small sprite sizes.

### Phase E — Living world (weather, critters, permanence)

1. **Weather as grading.** Rain = darker wash + streak overlay + puddle reflections (which then
   *justify* the neon pools at night), overcast = flattened contrast, heat shimmer at noon on
   asphalt. All shader/overlay work on the existing atmosphere system; zero new tile art.
2. **Ambient critters with rarity.** Gulls that scatter, crabs on the sand line, moths at lamps
   at night, a rare heron on the pier. A handful of 1-cell sprites in the existing VFX emitter
   system, deterministic like everything else.
3. **Permanence.** Footprints in sand that fade, wear decals that accumulate near busy doors
   (the material grammar already defines wear), the protagonist's towel left on the beach chair.
   The map should remember the day.

### Phase F — Shell and onboarding

1. **Title screen.** The arrival illustration style, island at dusk, one music track, three
   buttons (Continue / New Game / Settings). First impressions are currently a developer loading
   screen with a generic system font.
2. **Save-slot and settings surfaces.** Audio sliders (Phase A makes them necessary), display
   settings (already exist), key hints.
3. **First-ten-minutes pass.** Keep "no tutorial", but make the world teach: the first journal
   entry points at the board, the first alert card demonstrates click-to-jump, Linda's opener
   invites a reply. DF's lesson: guided entry is co-equal with graphics.
4. **Steam presentation** (when relevant): capsule art from the arrival-screen style, screenshots
   at authored moments (night neon, dawn beach, conversation close-up).

## 5. Guardrails — what NOT to do

- No higher-fidelity tiles, no painted backgrounds, no 3D, no shaders that repaint materials
  (bible §1, §14, and the locked rule).
- Neon stays an accent. If a screen is mostly neon, it is a §13 reject.
- No alert spam: cap simultaneous cards, dedupe, expire. RimWorld needed a mod ecosystem to fix
  this; design it in.
- No music that cuts. Crossfade or silence.
- Detail must never outshout collision and route cues (§13). Density work adds *places*, not noise.
- Every visual state indicator needs a text/caption twin (the accessibility pattern already in
  place for audio captions).
- Ambient population must stay deterministic — no random crowd spawns that break replay evidence.

## 6. Suggested order and why

1. **Fix regressions (§3)** — half a day. Nothing else is trustworthy until the smoke gate runs.
2. **Phase A audio** — the largest perceived-quality jump per hour invested. A silent sim reads
   as a prototype no matter how good it looks.
3. **Phase B simulation visibility** — this is what makes it *RimWorld-feel* rather than
   RimWorld-look. It also multiplies the value of the LLM conversations by surfacing consequences.
4. **Phase C density** — the screenshots' most visible weakness.
5. **Phase D juice** — cheap, cross-cutting, best done once panels/alerts from B exist.
6. **Phase E living world** — atmosphere multipliers on top of a now-alive base.
7. **Phase F shell** — before any external playtest or store page.

Rating trajectory if executed: A+B ≈ 6/10, +C ≈ 7/10, +D+E ≈ 8/10, +F and a real playtest
polish loop ≈ 8.5-9/10 — which is where the best minimal 2D sims live. RimWorld ships at ~87
Metacritic with less per-tile art than Halcyra already has.

## 7. Research sources

- RimWorld: Metacritic 87, Steam ~98% — story generator design, alert stack, mood ledger,
  deliberate abstraction (Tynan Sylvester's stated art goals).
- Dwarf Fortress Steam (2022): ~93 Metacritic, 800k+ sales — presentation as access layer;
  tileset + tutorial + soundtrack = 46,000% earnings increase over identical free sim.
- Stardew Valley: Metacritic 89, at times Steam's highest-rated game — music-first development,
  non-looping ambient pool, seasonal deltas, one-sound-per-interaction.
- Prison Architect / Oxygen Not Included / Factorio: legibility machines — combinatorial
  characters, overlay lenses, alt-mode info, multi-year GUI polish program (Factorio FFF #191-348).
- Project Zomboid: context-keyed ambient events; documented complaint about abrupt music.
- Kenshi: environmental storytelling via placement; cautionary tale — "ugly but deep" polarizes
  (PC Gamer 84 vs CD-Action 50).
- Caves of Qud 1.0: prose as presentation — writing quality substitutes for visual fidelity
  (highly relevant to LLM conversations).
- Shadows of Doubt: noir = lighting + weather + steam over crude geometry; "empty shell" critique
  when sim depth fails to surface visibly.
- The Sims: plumbob, Simlish, needs bars — at-a-glance state and emotional projection.
- "Juice It or Lose It" (Jonasson & Purho, GDC 2012); "The Art of Screenshake" (Nijman, 2013);
  Swink, *Game Feel* — polish is feedback layers, not assets.
