# Halcyra presentation improvement

Status: Review from the art bible plus live play on 2026-08-13.  
Locked rule: stay 2D, stay minimal, keep a RimWorld feel. No 3D. No high-detail paint.

Evidence folder: `docs/art/review-2026-08-13/`

## 1. Score

**3.5 / 10 against a AAA product.**  
**5 / 10 against the real target: a finished 2D RimWorld-like island.**

AAA here means The Sims 4, Cities: Skylines, or a big-budget life sim. That bar is the wrong north star. Those games win with 3D rooms, camera drama, and huge art teams. Halcyra must not chase them.

The better bar is RimWorld, Stardew Valley, Dwarf Fortress, Oxygen Not Included, and Factorio. Players love those games for readable worlds, strong people, and stories. Not for pixel count.

Current Halcyra is a real playable prototype with a strong pipeline. It is not yet a place that feels lived in.

| Layer | Score | Why |
|---|---:|---|
| New-game first look | 6.5 | Tone, type, and island pitch are already good. |
| HUD and journal chrome | 6 | Compact, readable, on-brand. |
| Character roster | 6 | Two-feature oddballs exist. Many still share one body. |
| Sunward at play zoom | 5 | Grass, roofs, and people exist. Rooms and yards stay empty. |
| Other three districts | 3 | Four big boxes. Same furniture kit. Weak identity. |
| Conversation as a scene | 4 | Log plus portrait. Not yet a meeting with a person. |
| Occupancy and daily life | 3 | People idle in grass. Furniture is unused set dressing. |
| AAA spectacle | 2 | Correct. Do not raise this on purpose. |

## 2. Locked constraints

These do not change.

- The game stays 2D.
- Tiles stay `32x32`. Characters stay `24x30`.
- Nearest-neighbor sampling. Whole-pixel placement.
- RimWorld-like simulation clarity over decorative detail.
- Warm-noir resort, not a copied RimWorld or Stardew look.
- No 3D render. No high-detail painted art. No neon wash.
- Source layers compile into a flat atlas. No runtime paper-doll.
- Art cannot change collision, portals, or save layout unless a later map pass is explicit.

The art bible already says this. The live game still fails the bible on density, district identity, and empty rooms.

## 3. What I looked at

Live web build from `dist/` on 2026-08-13:

- new-game arrival card
- Sunward Villas at play zoom
- journal side sheet

Current district overviews from `artifacts/terrain-redesign/*/final/`:

- Sunward, Neon Crescent, Palm Exchange, Harbor Authority

Also reviewed: full-cast 1x board, art bible, atlas revision 13, and older phase-32 smoke shots. The old smoke shots are stale. Do not judge from those.

## 4. What the current game does well

- The arrival screen already sells the island. Dark comedy. Prize. Catch.
- The HUD is now one compact card, not a button farm.
- Energy and health are quiet bars. That is the right life-sim load.
- The journal is a caseboard, not a wall of text.
- Characters are small enough to sit inside a settlement view.
- Many named looks have a real silhouette hook: hair, hats, bags, coats.
- Atlas revision 13 has 609 cells, 81 ground bases, 280 world character cells.
- Roofs, grass, lamps, and planted edges exist. The old empty sand yard is gone.
- The runtime path is sound: compile art once, draw flat cells.

This is a strong indie foundation. The limit is scene composition, not the engine.

## 5. What still reads as prototype

### 5.1 Giant empty rectangles

Sunward still has huge empty grass and huge empty brown slabs.  
A "beach market" has almost no stalls. A "promenade" is a blank paver field.  
A "public beach" has no water in the live camera.

Neon, Palm, and Harbor are the same plan: four big boxes around a plus-shaped road.

That is a blockout, not a town.

### 5.2 Rooms are too big for the furniture

Villa interiors have a sofa, two tables, and a plant in a hall.  
Club Strip has the same sofa-table-plant kit.  
Market Hall and Food Arcade look like copies.  
Harbor rooms are benches in a dark grid.

RimWorld rooms feel finished because furniture fills the use of the room.  
Halcyra rooms feel like test boxes with a few props dropped in.

### 5.3 District identity is a palette swap

The bible wants:

- Sunward: warm resort, water, planted edges, hidden service doors
- Neon: worn doors, small neon pools, clubs
- Palm: awnings, storefront modules, market walks
- Harbor: concrete, ferry kit, civic mass

What I saw:

- Sunward: green park with brown roofs
- Neon: purple boxes, confetti dots, tiny lamp posts
- Palm: red dirt and the same counters
- Harbor: gray boxes, a thin pier, flat teal water

Palette changed. Building grammar did not.

### 5.4 People do not occupy the world

In the live Sunward shot, people stand in grass.  
Furniture sits unused.  
Some props sit on roofs.  
Clone-looking residents still cluster in rows on the overview.

A loved sim sells life by showing people *using* the place.

### 5.5 Conversation and inspect UI are still overlays

The journal sheet is good.  
The inspect card is useful.  
Conversation is still a dark log with a tiny portrait.

The fantasy is "talk to a person who remembers you."  
The current panel looks like a debug transcript.

## 6. What the most loved sims actually teach

These games are loved. They are not AAA spectacle machines.

| Game | Proof people love it | Lesson for Halcyra |
|---|---|---|
| RimWorld | 97% of 118,478 English Steam reviews are positive. Metacritic PC 87, Xbox One 92. IGN 9/10.[1][2] | 2D top-down. Small pawns. Dense rooms. Story comes from people, jobs, and events. Graphics stay readable, not fancy. |
| Stardew Valley | 98% of 392,004 English Steam reviews are positive. Metacritic PC 89. About 50 million copies by Feb 2026.[3][4][5] | Pixel art. Named places. Daily schedules. NPCs feel local. Charm comes from layout and routine, not extra detail. |
| Dwarf Fortress | 94% of 24,048 English Steam reviews are positive. Steam page calls it an inspiration for RimWorld.[6] | Depth beats fidelity. Players forgive plain art if the world has memory and consequence. |
| Factorio | 98% of 117,161 English Steam reviews are positive.[7] | 2D, readable, low-detail sprites. Players stay for the loop, not the paint. |
| The Sims 4 | Metacritic PC 70. Mixed launch reviews. Still the AAA life-sim reference.[8] | AAA fidelity is expensive and still gets mixed scores. Do not copy this look. Copy occupancy: people sit, cook, talk, and use rooms. |
| Oxygen Not Included | Metacritic 85 from 5 critic reviews. User score 8.2 from 281 ratings.[9] | Cute small bodies. Systems make the colony feel alive. Art stays simple on purpose. |

Shared pattern:

1. The camera stays readable at a glance.
2. A room has a job. Furniture proves that job.
3. People have jobs, routes, and faces you can spot.
4. The world creates stories. Art only makes those stories easy to see.
5. Extra texture is a last step, not the first.

Schell: decide the feeling, then cause it.  
The feeling here is "cute people on a pretty island with a rotten underside."  
Current maps cause "I am looking at a test grid with better HUD."

Swink: polish is physicality.  
A used chair and a contact shadow beat a new ground tile.

Adams and Dormans: start from aesthetics.  
Wanted aesthetics: warm resort, hidden vice, dark comedy.  
Needed dynamics: people at work, doors that matter, neon as a small accent, rooms that look used.  
Mechanics already exist: schedules, click-move, journal, conversation, roofs.

Nystrom: keep the atlas and component setup.  
Do not add a 3D layer or a runtime paper-doll to chase quality.

## 7. Gap versus the art bible

The bible is already the right contract. The live game under-delivers these clauses.

| Bible rule | Live result |
|---|---|
| The island looks attractive at first sight. | New-game card does. Play view does not yet. |
| A playable area must not look like an empty grid. | Fail. Huge unused floors and yards. |
| Use building mass, planted edges, paths, and prop groups to form outdoor rooms. | Fail. Random trees. Weak paths. |
| Keep main routes wide, but give them edges. | Partial. Roads exist. Edges are thin. |
| Neon is an accent, not a wash. | Fail in the other direction. Almost no neon mass. |
| A landmark needs one clear large shape. | Fail. No fountain, ferry, club, or market mass that reads at 1x. |
| Interior floors must not merge with outside ground. | Pass in villas. Weak elsewhere. |
| Review at native 1x first. | Pass as a process. 1x still shows empty rooms. |
| Two-feature character identity. | Partial. Accessories help. Shared body and face grid remain. |

Do not rewrite the bible. Ship the bible.

## 8. What to build, in order

Do one layer at a time. Stop when a scene reads at 1x.

### Phase A. Sunward composition only

Goal: one neighborhood that looks like a compact resort, not a park with boxes.

1. Shrink rooms to furniture scale. A social room should feel full with one sofa group, one table, one lamp, one plant, and walk space.
2. Break the promenade and beach market into outdoor rooms. Use planters, lamps, stall rows, and shade, not more ground noise.
3. Put water back on the public beach. One shoreline. Soft sand-to-water edge. Rare glints.
4. Group trees into hedges and courtyards. Stop sprinkling them like stamps.
5. Keep roofs on until the player enters. Do not leave tables on roof tiles.
6. Add one landmark the eye can find at 1x: fountain, spa court, or villa terrace.
7. Keep the same tile budget. Move existing props. Do not invent a new material family yet.

Done when a 1x screenshot of Sunward looks like a place you would walk, not a layout test.

### Phase B. Occupancy

Goal: the world looks busy because people use it.

1. Put named NPCs on jobs: bar, stall, desk, spa, door.
2. Ambient residents walk routes and pause at props. They do not form a grid.
3. Sit, tend, wait, and talk can stay abstract. A one-pixel bob at a counter is enough.
4. Selected person keeps the gold ring. Nearby people need no extra chrome.
5. Conversation starts on the person, not only in a modal. Keep the world visible behind a smaller sheet.

This is the Sims lesson without Sims art. People using rooms sell a sim.

### Phase C. Three district identities, still one grammar

Do not author three new games. Change mass and accent only.

Neon Crescent

- Replace four identical halls with two or three street fronts.
- Give each club one big sign and one worn door.
- Keep neon in small pools. No floor confetti field.
- Leave alleys and a service door. That is the noir layer.

Palm Exchange

- Turn empty halls into stall rows and one food counter.
- Add awnings and one plaza tree cluster.
- Repeat a storefront module. Change only the sign and stall color.

Harbor Authority

- Keep heavy rectangles. That is correct.
- Make the pier a place: bollards, one crane, one waiting bench line, one closed ferry.
- Keep water calm. One shoreline. No wave noise.

Done when a player can name the district from a 1x crop with the HUD cropped out.

### Phase D. Conversation and inspect

Goal: talking feels like meeting someone.

1. Bigger portrait. Use rest, joy, upset.
2. One line on screen at a time, or a short transcript. Not a blank void.
3. Show the NPC name, job, and one known fact. Hide debug flags.
4. Keep typed input. Add two or three suggested lines, already in code.
5. First-token wait needs a face change or vocal cue. Latency is game feel.

Do not add voice acting. Short authored cues are enough.

### Phase E. Quiet polish last

Only after A–D.

- Contact shadows that touch feet and furniture.
- One district sound bed each.
- Footstep ticks and door clicks.
- Night as small local light pools. No full lighting engine.
- One more walk-frame polish if 1x identity fails.

Do not add weather, particles, or shader work to "feel AAA."

## 9. What not to build

- 3D, perspective tilt, or painted overworld.
- Bigger characters.
- More ground grain, dither, or checker texture.
- A different art style per district.
- Runtime paper-doll or skeletal animation.
- Full day-night recolor of every tile.
- Copying RimWorld walls, Stardew houses, or Sims UI.
- Filling every empty tile. Open sand, water, and roads are good if they have a use.
- New quests just to hide a bad map. Fix the map first.

## 10. Review gate

A pass needs all of these:

1. Native 1x screenshot of each district, HUD off.
2. One 3x crop of a door, a face, and a landmark.
3. A room photo where furniture explains the room.
4. A street photo where a person is using a prop.
5. Silhouette check: named people still read with color off.
6. No new collision, portal, or save change unless that pass is named.

Reject if the 1x shot still looks like four boxes or an empty yard.

## 11. Suggested first week

1. Sunward only. Compose rooms and outdoor rooms with current tiles.
2. Take 1x and 3x shots after each pass.
3. Move people onto existing furniture.
4. Stop. Compare to this doc before touching Neon.

Do not start a new atlas family until Sunward reads.

## 12. Bottom line

Halcyra is about 3.5/10 as a AAA product, and that is fine.  
It is about 5/10 as the 2D RimWorld-like game it is supposed to be.

The bible is right. The engine is right. The HUD is getting right.  
The maps are still blockouts.

Loved sims do not win by adding detail.  
They win by making a small world look used, named, and easy to read.

Next useful move: compose Sunward until a 1x shot looks like a resort.

## Sources

[1] https://store.steampowered.com/app/294100/RimWorld — RimWorld on Steam
[2] https://en.wikipedia.org/wiki/RimWorld — RimWorld - Wikipedia
[3] https://store.steampowered.com/app/413150/Stardew_Valley — Stardew Valley on Steam
[4] https://en.wikipedia.org/wiki/Stardew_Valley — Stardew Valley - Wikipedia
[5] https://www.metacritic.com/game/stardew-valley — Stardew Valley Reviews - Metacritic
[6] https://store.steampowered.com/app/975370/Dwarf_Fortress — Dwarf Fortress on Steam
[7] https://store.steampowered.com/app/427520/Factorio — Factorio on Steam
[8] https://en.wikipedia.org/wiki/The_Sims_4 — The Sims 4 - Wikipedia
[9] https://www.metacritic.com/game/oxygen-not-included — Oxygen Not Included Reviews - Metacritic
