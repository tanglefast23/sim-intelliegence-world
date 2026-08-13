# Halcyra quality gap review and improvement plan

Date: 2026-08-13
Status: review and proposal. Not yet an approved phase plan.
Scope: measured against [docs/art/halcyra-art-bible.md](../art/halcyra-art-bible.md) and [spec.md](../../spec.md).

## 0. Locked constraints

These do not change. Every proposal below obeys them.

- The game stays 2D. No 3D rendering, no camera tilt, no depth buffer.
- The look stays minimal and RimWorld-like. No painted art, no high detail per object.
- No sprite grows past `32x32` tiles, `24x30` world cells, `24x29` portraits.
- No copied silhouettes, textures, UI, or fonts from a reference game.

One clarification drives this whole document: **minimal is not the same as empty.**
RimWorld draws each object with very few pixels. It then puts a lot of those cheap objects
on screen. Halcyra currently draws few objects and few of them. That is the gap.

## 1. How this review was done

- Installed the locked dependencies and ran `npm run export:web`.
- Served `dist/` and played the real build in a headless browser pane. No visible Electron
  window was opened, per `AGENTS.md` and [CLAUDE.md](../../CLAUDE.md).
- Played from the arrival screen through name entry, walking, selection, a full conversation
  with Sora Tan, the journal, the social record, day/night, and zoom `100%` to `300%`.
- Panned the whole Sunward Villas district at `1x`.
- Read the compiled map catalog, the atlas budget report, and the content tree for exact counts.

Everything numeric below comes from committed source or the compiled catalog, not from an estimate.

## 2. Rating

**4.5 / 10 against a best-in-class commercial simulation game.**

The bar used is RimWorld and Stardew Valley, not literal AAA budget. Those are the games a
Steam buyer will compare Halcyra to.

| Area | Score | Evidence |
|---|---:|---|
| Engineering and determinism | 8.5 | Layer boundaries enforced, save chain `v1`→`v6`, locked Electron security, golden first-hour replay |
| Art pipeline | 7.0 | Atlas budget report, generated cast, revisioned pixel baselines, review boards |
| Character art | 6.0 | 35 identities, 280 world cells, 53 portraits — but they read as coloured blobs at `1x` |
| World composition and density | 3.0 | No paths, roads, curbs, fences, or building shadows anywhere |
| Environment art variety | 3.0 | **3 roof cells total** for four districts; 62 prop cells total; one enterable interior in the whole game |
| Lighting and time of day | 3.5 | Full-screen colour wash plus 3 hard-coded pools per district; lamp props emit no light |
| Audio | 1.0 | 4 vocal `.wav` cues. No music, no ambience, no footsteps, no UI sound |
| Content volume | 2.0 | 1 quest, 9 named NPCs, ~5-line biographies, 9-line authored dialogue |
| Conversation feel | 5.0 | Works, tone is genuinely good, but no expressions, no visible stakes, no barks |
| Onboarding and game feel | 4.0 | No camera follow, no tutorial, no map, no objective marker |

### What is already strong

- The technical base is better than most shipped indie sims. Determinism, migrations, and
  security are real, tested, and enforced by the build.
- The HUD, journal, and social record are clean, legible, and consistent.
- The writing tone lands. Sora Tan's opener — a jab about the protagonist's viral meme —
  is exactly the darkly funny register the spec asks for.
- The character generator is a genuine asset. 35 identities from compact look records is
  the right architecture.

### What a buyer would refund over

- Four districts that look like one green field with brown rectangles on it.
- Silence.
- One quest.

## 3. Measured evidence

### 3.1 Map density (compiled catalog, today)

| District | Tiles | Blocked | Blocked % | Wall tiles | Objects | Solid object tiles | Doors | Roof groups |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `northwest_residential` | 3072 | 277 | 9.02% | 129 | 19 | 48 | 7 | 1 |
| `northeast_downtown` | 3072 | 314 | 10.22% | 230 | 25 | 84 | 4 | 0 |
| `southwest_commercial` | 3072 | 315 | 10.25% | 193 | 37 | 122 | 3 | 0 |
| `southeast_docks` | 3072 | 776 | 25.26% | 153 | 46 | 107 | 3 | 0 |

Blocked share has improved a lot since the Phase 15 measurement (`3.42%` → `9.02%` in the
northwest). Blocked share is no longer the problem. **Variety is.**

| District | Distinct ground sprites | Distinct object kinds | Distinct render sprites |
|---|---:|---:|---:|
| `northwest_residential` | 20 | 12 | 17 |
| `northeast_downtown` | 19 | 7 | 19 |
| `southwest_commercial` | 19 | 15 | 25 |
| `southeast_docks` | 20 | 18 | 27 |

Seven object kinds carry the entire nightlife district. Ten of its 25 objects are parked cars.

### 3.2 Atlas budget (`assets/generated/atlas-report.json`, `artRevision 13`)

| Category | Used | Cap | Free |
|---|---:|---:|---:|
| `ground-base` | 81 | 96 | 15 |
| `ground-transition` | 30 | 64 | **34** |
| `ground-decal` | 27 | 64 | **37** |
| `wall-door` | 73 | 80 | 7 |
| `roof` | **3** | 32 | **29** |
| `object-landmark` | 62 | 64 | **2** |
| `world-character` | 280 | 280 | 0 |
| `portrait` | 53 | 53 | 0 |
| `effect-reserve` | 0 | 16 | 16 |

Packed size is `1024x595` at `97.6%` occupancy. The hard limit is `1024x1024`.
There is roughly `430` pixel rows of vertical headroom — enough for about 350 more `32x32`
cells before a second atlas page is needed.

Two facts matter most here:

1. **`roof` has 29 free slots and only 3 are used.** Every district reuses the same roof.
   This is the single cheapest large visual win available.
2. **`object-landmark` is effectively full at 62 / 64.** Any new prop family needs the cap
   raised in `scripts/art/art-manifest.ts` first. This is the gate on all density work.

### 3.3 Content volume

| Item | Count |
|---|---:|
| Quests | 1 (`linda-boyfriend.json`, 107 lines) |
| Named characters | 9 directories |
| Longest character biography | 5 lines |
| Authored dialogue per character | ~9 lines |
| Enterable building interiors, whole game | 1 |
| Audio files | 4 vocal cues, 0 music, 0 ambience |
| Schedules | 1 prototype file, 1256 lines |

### 3.4 Lighting

`src/render/atmosphere.ts` applies four period washes over the entire screen.
`src/render/district-lighting.ts` adds exactly **three hard-coded light pools per district**,
at fixed tile coordinates. They are not attached to lamp, sign, or window props.

Observed at `21:11` in game: the villa interior went cool and dark, the lamp props stayed
unlit, and the grass outside barely changed. The art bible says night should use "small local
pools" and should not recolour every object. Today it does the opposite.

## 4. What the loved simulation games actually do

Research summary, mapped to Halcyra decisions.

**RimWorld** ([Steambase](https://steambase.io/games/best-colony-sim-steam-games), 97 player score)
wins on emergent story and on readable graphics. Its top-down tile visuals let players read a
colony layout at a glance, and its minimal art deliberately leaves room for imagination.
The lesson is not "draw less". It is "draw simple things, then show many of them, and make
every one of them mean something".

**Stardew Valley** ([Steambase](https://steambase.io/games/best-simulation-steam-games), 98 player
score, one million reviews) proves that pixel art is a design decision, not a budget decision
([CNN, Feb 2026](https://www.cnn.com/2026/02/26/style/stardew-valley-video-game-anniversary)).
Its pull is breadth of activity — farming, mining, fishing, socialising — inside one small,
dense, hand-placed town. Halcyra has four maps, but one thing to do.

**Colony sim readability research** ([PC Gamer](https://www.pcgamer.com/games/strategy/the-challenges-of-developing-the-colony-sim-from-dungeon-keeper-to-dwarf-fortress-and-beyond/),
[Dwarf Fortress tileset history](https://dwarffortresswiki.org/index.php/Tilesets)):
tiles must be recognisable from a distance, functional clarity must beat decoration, and the
real failure mode is drowning the player in complexity. Halcyra has the opposite failure:
not enough information on screen.

**LLM NPC games** ([Frisson Labs, 2026](https://www.frisson-labs.com/ai-npcs-2026); Suck Up! sits
at [62% positive on Steam](https://store.steampowered.com/app/2726370/Suck_Up/)):
generated dialogue that is pleasant, correct, and forgettable is the standard failure. What
saves it is strong character constraints and conversations that change game state. Halcyra's
validation layer and relationship values are the right defence — they just need more to bite on.

**Sentiment warning** ([Quantic Foundry via Frisson Labs](https://www.frisson-labs.com/ai-npcs-2026)):
players are strongly negative when AI reads as a cost-cutting shortcut. Halcyra should market
the local model as a *character* feature, and the authored quests, art, and writing must
visibly carry the game.

## 5. Improvement plan

Ordered by visual impact per unit of work. Each item names its cost driver.

### P0 — three changes that fix "empty" without adding detail

**P0.1 Circulation. Give every district paths.**
Right now the northwest is a green field with buildings dropped on it. NPCs stand in open grass.
Add authored path networks: villa walkways, a coast road, market lanes, quay routes.
- Uses `ground-transition` (34 free) and `ground-base` (15 free). No cap change needed.
- Mostly map JSON, not new art.
- Rule from the art bible already covers it: "Use building mass, planted edges, paths, small
  material changes, and prop groups to form outdoor rooms."

**P0.2 Roof identity. Spend the 29 free roof slots.**
Four districts share three roof cells. Give each district one roof family
(Sunward terracotta, Neon Crescent tar-and-vent, Palm Exchange awning-tile, Harbor Authority
corrugated metal) with base, edge, and corner. That is 12 cells for a four-times increase in
district legibility.
- 12 of 29 free `roof` slots. No cap change, no atlas resize.

**P0.3 Building contact shadow.**
No building casts anything. Generate a one-to-two pixel dark band on the lower and right edge
of every wall run and roof edge, from the existing upper-left light rule. This is a generator
change, not new authored pixels, and it makes flat rectangles read as solid mass instantly.
- Touches `scripts/art/build-world-atlas.ts` and the roof/wall render order. Zero new cells.

### P1 — density and places to go

**P1.4 Raise the `object-landmark` cap and grow the atlas.**
This is the gate on everything below. Move the cap from 64, grow the packed atlas toward
`1024x1024`, and bump `artRevision`.
- Requires a new pixel baseline in the same phase, per art bible section 15.

**P1.5 Add roughly 40 prop cells, chosen for silhouette not detail.**
Priority order: fence and low wall runs, benches and bus stops, bins and crates, hedges,
parked bicycles, awnings, market crates, hanging signs, laundry lines, potted plants,
street bollards, café chairs. Each is one flat cell with a strong outline.
- Target: every `100` outdoor tiles contain at least one prop group and one material change.

**P1.6 Give three districts real interiors.**
Today `northeast`, `southwest`, and `southeast` have `0` buildings. The spec's whole social
loop depends on bars, clubs, shops, clinics, and the police desk. Add two to three enterable
interiors per district using the approved Tier B wall and door grammar.
- Each interior needs a roof group so the existing hide-on-enter behaviour works.

**P1.7 Furnish rooms to a stated occupancy band.**
Phase 15 measured the villa at `2.34%` solid prop occupancy. Set explicit bands and enforce
them in content validation:
- solid furniture `8–12%` of room floor,
- passable decoration `10–15%`,
- deliberate clear walking lanes at least `2` tiles wide.

### P2 — light and sound

**P2.8 Attach light pools to props.**
Replace the three hard-coded pools per district with pools derived from lamp, sign, window, and
fire props at their real tile positions. Reduce the full-screen night wash as local pools take
over. This is what makes "warm noir" read at night, and it is already the bible's stated rule.

**P2.9 Ship audio. This is the largest single perceived-quality gap.**
Currently four `.wav` cues and nothing else. Minimum shippable set:
- one ambience bed per district (surf, traffic and bass, market chatter, gulls and cranes),
- footstep sets by ground material (sand, wood, stone, asphalt),
- UI clicks, panel open/close, journal entry added,
- one music track per district plus one menu track,
- a day/night ambience crossfade.

A silent game reads as unfinished to a Steam buyer within thirty seconds, regardless of art.

### P3 — the loop

**P3.10 Quests: 1 → 12–15.**
The spec's repeating loop is "talk, discover leads, complete risky quests, change standing".
One quest cannot demonstrate it. Target three per district plus a spine that links them.

**P3.11 Character depth.**
Five-line biographies cannot constrain a local model well enough to avoid the
"ChatGPT in costume" failure. Expand `personality.md`, `biography.md`, and `knowledge.md`
toward the spec's intent, and grow `authored-dialogue.json` so first contact is always authored.

**P3.12 Conversation stakes on screen.**
Show the relationship deltas a reply caused, switch the portrait between `rest`, `joy`, and
`upset` (all three already generate), and add short world barks so NPCs speak without a panel.

**P3.13 Game feel.**
- Optional camera follow. Today the camera never follows the protagonist; you must press `F`
  or click Center after every move.
- An objective marker for validated journal leads.
- A district minimap or a district name card on transition.
- A short guided first ten minutes. "No tutorial" is a fine philosophy, but the arrival screen
  currently drops the player into a field with no first action.

## 6. Explicitly out of scope

Do not do these, even if they seem to raise quality:

- 3D, isometric tilt, or any perspective change.
- Higher-resolution sprites or more detail inside a single object.
- A real-time lighting or shadow engine. Baked contact shadows and pool overlays only.
- Outlines on ground variation, or texture that competes with collision cues.
- Full-screen neon. Accents stay smaller in area than neutral materials.

## 7. Suggested phase order and gates

| Phase | Content | Gate |
|---|---|---|
| A | P0.1 circulation, P0.2 roof families, P0.3 contact shadows | `art:check`, `content:check`, new `1x` review board per district |
| B | P1.4 atlas headroom, P1.5 prop cells | `artRevision` bump, new pixel baseline, atlas occupancy under limit |
| C | P1.6 interiors, P1.7 occupancy bands | `validate:content` enforces the bands; roof hide/show smoke |
| D | P2.8 prop-driven light, P2.9 audio | Night `1x` board; `audio:check` |
| E | P3.10–P3.13 quests, characters, feel | `verify:first-hour` golden run extended past the Linda quest |

Every phase keeps the existing rule: review changed cells at native `1x` first, on both a dark
and a light neighbour, before the `3x` board.

## 8. If only three things get done

1. **Roof families and building contact shadows.** Twelve new cells plus a generator change.
   Turns four flat brown fields into four distinct districts.
2. **Audio.** Zero to one ambience bed, footsteps, and one track per district.
   The largest perceived-quality jump per hour of work in this entire list.
3. **Paths and prop groups in the northwest.** Prove the density band on one district before
   spending it on four.
