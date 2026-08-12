# Southwest Sunset Market Layout Spec

## Target

`southwest_commercial` is a coral-and-gold sunset market district. It must reach the established `9.7/10` environment bar without copying another district palette. The district uses warm clay stone, gold light, dark warm interior grids, flowering planters, fabric canopies, produce stalls, cafe furniture, market signs, petals, herbs, and quiet stone wear. It must read as a pedestrian market before labels are considered.

## Binding 64x48 layout

Human-readable coordinate ranges in this document are inclusive. Every implementation `TileRect` uses an exclusive end. Use the binding conversion table below; do not infer widths from prose.

| Element | Bounds or line | Bound sprite or wall material | Purpose |
|---|---|---|---|
| Default market stone | full map | `tile.sunset-cobble` | warm coral service stone with grouped wear and quiet areas |
| Northwest market apron | `x3-29, y4-22` | `tile.sunset-paver` | connected front plaza for the market hall |
| Northeast food apron | `x35-63, y4-22` | `tile.sunset-paver` | connected front plaza for the food arcade |
| Southwest courtyard apron | `x3-29, y28-47` | `tile.sunset-paver` | outdoor bazaar and planted courtyard |
| Southeast restaurant apron | `x35-63, y28-47` | `tile.sunset-paver` | restaurant frontage and terrace |
| East-west promenade | `x0-63, y23-27` | `tile.sunset-promenade` | five-tile pedestrian boulevard between the west plaza and east portal |
| North-south promenade | `x30-34, y0-47` | `tile.sunset-promenade` | five-tile route from the north portal to the south edge |
| Central mosaic | `x28-36, y21-29` | `tile.sunset-mosaic` | passable nine-by-nine market landmark at the promenade crossing |
| Market hall shell | `x6-27, y7-20` | Tier B `commercial` wall + `tile.sunset-floor` | boutique and indoor market hall |
| Market hall door | `x17, y20`, opening `market-hall-entrance` | `tile.open-door`, state `open` | recessed horizontal door |
| Food arcade shell | `x39-59, y7-20` | Tier B `commercial` wall + `tile.sunset-floor` | indoor food and craft arcade |
| Food arcade door | `x49, y20`, opening `food-arcade-entrance` | `tile.open-door`, state `open` | recessed horizontal door |
| Restaurant shell | `x39-59, y32-43` | Tier B `commercial` wall + `tile.sunset-floor` | cafe and restaurant row |
| Restaurant door | `x49, y43`, opening `restaurant-row-entrance` | `tile.open-door`, state `open` | recessed horizontal door |

Apply ground in this order: cobble, four aprons, two promenades, central mosaic, and interior floors. Interior floors overwrite the apron inside each shell. The central mosaic overwrites both promenades and remains fully passable.

### Binding `TileRect` conversion table

| Named rectangle | Compiler value `{x,y,width,height}` |
|---|---|
| Northwest market apron | `{x:3,y:4,width:27,height:19}` |
| Northeast food apron | `{x:35,y:4,width:29,height:19}` |
| Southwest courtyard apron | `{x:3,y:28,width:27,height:20}` |
| Southeast restaurant apron | `{x:35,y:28,width:29,height:20}` |
| East-west promenade | `{x:0,y:23,width:64,height:5}` |
| North-south promenade | `{x:30,y:0,width:5,height:48}` |
| Central mosaic | `{x:28,y:21,width:9,height:9}` |
| Market hall shell and area | `{x:6,y:7,width:22,height:14}` |
| Food arcade shell and area | `{x:39,y:7,width:21,height:14}` |
| Restaurant shell and area | `{x:39,y:32,width:21,height:12}` |
| North portal route | `{x:30,y:0,width:5,height:7}` |
| East portal route | `{x:57,y:23,width:7,height:5}` |
| Market hall approach | `{x:16,y:21,width:3,height:9}` |
| Food arcade approach | `{x:48,y:21,width:3,height:9}` |
| Restaurant exterior approach | `{x:48,y:44,width:3,height:4}` |
| Courtyard vertical spine | `{x:27,y:29,width:3,height:19}` |
| Courtyard west link | `{x:4,y:29,width:26,height:3}` |
| Restaurant east connector | `{x:60,y:23,width:4,height:25}` |
| Restaurant frontage link | `{x:48,y:46,width:16,height:2}` |
| Market hall internal route | `{x:16,y:9,width:3,height:11}` |
| Food arcade internal route | `{x:48,y:9,width:3,height:11}` |
| Restaurant internal route | `{x:48,y:33,width:3,height:10}` |
| Sunset courtyard area | `{x:4,y:29,width:26,height:19}` |

All prop footprints use the inclusive cells stated in Market-life placement. A two-cell horizontal stall at `x12-13,y34`, for example, compiles as `{x:12,y:34,width:2,height:1}`.

## Material and atlas contracts

- Add `sunset-cobble`, `sunset-paver`, `sunset-promenade`, `sunset-mosaic`, and `sunset-floor` with at least three distinct base variants each.
- This district is art revision `10`. Bump `artRevision` to `10` in the atlas manifest and every material, roof, decal, and transition recipe source; regenerate `src/world/presentation/generated-recipes.json`; set `ART_REVISION = 10`; add `assets/source/art/revision-10-pixel-hashes.json`; repoint both generated-art checks to revision 10; and update exact atlas cell-count tests to the generated totals.
- The coral-and-gold palette uses deep terracotta, rose clay, warm cream, muted gold, and small teal-green plant accents. Reject neon magenta, tropical blue, and Docks grey as dominant colors.
- `sunset-floor` uses a dark warm square grid with matching dark grout and restrained scuff texture.
- Cobble, paver, and promenade texture uses grouped discoloration, worn seams, chips, and quiet areas. Reject uniform dots, one repeated crack stamp, and full-cell noise.
- Southwest ground regions meet through color and texture contrast only. Do not draw thin white, cream, peach, or bright transition outlines around aprons, promenades, interiors, buildings, or map edges.
- The central mosaic uses three edge-identical, seamlessly tiling cream-and-gold micro-variations of one broad motif. It reads as one landmark through repetition and cannot create a false collision boundary.
- Add a passable-only `sunset-market-life` family using flower petals, herb sprigs, fallen leaves, chalk marks, small paper, and tiny fruit leaves. Automatic market-life scatter attaches to `sunset-cobble` and `sunset-paver`. A separate low-density passable `sunset-route-wear` family attaches to `sunset-promenade` and `sunset-mosaic`; `sunset-floor` uses `decalFamily: null`. Automatically scattered details never add collision.
- Add explicit solid atlas compositions for a `2x2` fabric canopy, two `2x1` produce/food stalls, a `2x2` warm fountain, a flowering planter, a festival lantern, and a market bench. Every solid footprint cell needs visible blocking art at the same offset.
- Reuse the Tier B `commercial` wall family and the approved oriented recessed doors. Keep at least one full wall tile between any two doors.

### Binding material recipes

All five recipes use three logical variants and the matching three public sprites named from the material ID: base, `-b`, and `-c`.

| ID | Palette ramp | Density | Seam | Edge | Decal | Priority | Selection salt |
|---|---|---|---|---|---|---:|---|
| `sunset-cobble` | `#7f4037,#b85f4d,#dc9170,#f0c39a` | `natural-medium` | `coordinate-phase` | `hard` | `sunset-market-life` | 80 | `sunset-cobble-v1` |
| `sunset-paver` | `#8f493c,#c96c55,#e8a477,#f5cf9b` | `structured-medium` | `coordinate-phase` | `hard` | `sunset-market-life` | 88 | `sunset-paver-v1` |
| `sunset-promenade` | `#9b5544,#d27a59,#edb277,#ffe0a3` | `structured-low` | `coordinate-phase` | `hard` | `sunset-route-wear` | 95 | `sunset-promenade-v1` |
| `sunset-mosaic` | `#87503e,#d38a55,#f0c36f,#fff0b2` | `structured-low` | `coordinate-phase` | `hard` | `sunset-route-wear` | 97 | `sunset-mosaic-v1` |
| `sunset-floor` | `#3d2528,#593238,#78434a,#9a5d58` | `structured-low` | `coordinate-phase` | `hard` | null | 84 | `sunset-floor-v1` |

## Portal, entrance, and pedestrian network

- North portal: `{id:'from-residential', edge:'north', tile:{x:32,y:0}}`; staging tile `{x:32,y:1}`; protected route `x30-34, y0-6`.
- East portal: `{id:'to-docks', edge:'east', tile:{x:63,y:24}}`; staging tile `{x:62,y:24}`; protected route `x57-63, y23-27`.
- Market hall approach: `x16-18, y21-29`, plus open door `x17, y20`.
- Food arcade approach: `x48-50, y21-29`, plus open door `x49, y20`.
- Restaurant exterior approach: `x48-50, y44-47`, plus open door `x49, y43`.
- Courtyard vertical spine: `x27-29, y29-47`.
- Courtyard west link: `x4-29, y29-31`.
- Restaurant east connector: `x60-63, y23-47`.
- Restaurant frontage link: `x48-63, y46-47`.
- Keep the full central mosaic `x28-36, y21-29` clear of solid objects. Surface decoration can be passable but must stay visually quiet in the center five tiles.
- Both portals, all three doors, the courtyard, and the restaurant terrace must remain connected after every solid footprint is applied.

## Area, binding, spawn, and density contracts

- `market-hall` uses bounds `{x:6,y:7,width:22,height:14}`, profile `active-public`, entrance `x17,y20`, internal primary route `{x:16,y:9,width:3,height:11}`, binds `sora_boutique`, and requires portals `['from-residential','to-docks']`.
- `food-arcade` uses bounds `{x:39,y:7,width:21,height:14}`, profile `active-public`, entrance `x49,y20`, internal primary route `{x:48,y:9,width:3,height:11}`, has no location binding, and requires portals `['from-residential','to-docks']`.
- `restaurant-row` uses bounds `{x:39,y:32,width:21,height:12}`, profile `active-public`, entrance `x49,y43`, internal primary route `{x:48,y:33,width:3,height:10}`, binds `rafael_cafe`, and requires portals `['from-residential','to-docks']`.
- `sunset-courtyard` uses bounds `{x:4,y:29,width:26,height:19}`, profile `active-public`, entrance `x28,y29`, primary routes `{x:27,y:29,width:3,height:19}` and `{x:4,y:29,width:26,height:3}`, and requires portals `['from-residential','to-docks']`.
- Preserve required work and schedule spawns on clear cells: `sora_tan x14,y14`, `rafael_cruz x44,y36`, `linda-shop x17,y17`, `linda x17,y16`, and `generic_resident x44,y34`.
- Market hall furniture supplies 24 solid/detail cells in separate clusters: counters `x8-13,y10` and `x20-25,y10`, displays `x8-10,y15` and `x23-25,y15`, and benches `x10-12,y18` and `x21-23,y18`. Keep `x16-18` clear.
- Food arcade furniture supplies 22 solid/detail cells in separate clusters: counters `x41-46,y10` and `x52-57,y10`, stalls `x41-43,y15` and `x54-56,y15`, and benches `x42-43,y18` and `x55-56,y18`. Keep `x48-50` clear.
- Restaurant furniture supplies 20 solid/detail cells in separate clusters: counters `x41-46,y35` and `x52-57,y35`, tables `x41-43,y39` and `x54-56,y39`, and benches `x42,y41` and `x56,y41`. Keep `x48-50` clear.
- Courtyard object/effect detail totals at least 40 cells inside its exact bounds. Use at least 24 solid cells in at least five separated clusters: one four-cell canopy, four two-cell stalls, one four-cell fountain, four one-cell flowering planters, and four one-cell benches or lanterns. Add at least 16 explicit passable object/effect detail cells. Presentation-only decals do not count toward this compiler density floor.
- Compiler density ranges are closed on both sides. For the pinned eligible-cell counts, keep: market hall `5-28` solid and `20-57` object/effect detail cells; food arcade `5-27` solid and `19-54` detail cells; restaurant row `4-22` solid and `16-45` detail cells; sunset courtyard `10-59` solid and `40-118` detail cells. Do not exceed a maximum while adding visual life.

## Market-life placement

- Place the solid `2x2` fabric canopy at `x7-8,y33-34`.
- Place four solid two-cell stalls at `x12-13,y34`, `x19-20,y36`, `x7-8,y39`, and `x19-20,y41`.
- Place the solid `2x2` warm fountain at `x22-23,y32-33`. Keep it west of the courtyard spine.
- Place solid flowering planters at `x4,y32`, `x25,y35`, `x4,y43`, and `x25,y44`.
- Place solid festival lanterns along promenade edges at `x28,y6`, `x35,y6`, `x28,y18`, `x35,y18`, `x12,y22`, `x22,y22`, `x42,y22`, `x54,y22`, `x12,y28`, `x22,y28`, `x42,y28`, and `x54,y28`. They remain outside protected paths, wall cells, and the central mosaic.
- Mount passable market signs on wall cells beside each door: hall `x16/18,y20`, food arcade `x48/50,y20`, and restaurant `x48/50,y43`. Place solid doorway lanterns at hall `x14/20,y21`, food arcade `x46/52,y21`, and restaurant `x46/52,y44`; each pair stays outside its three-tile approach.
- Place four solid palms or large flowering bushes at `x4,y5`, `x28,y5`, `x36,y5`, and `x62,y5`. Small petals, herbs, leaves, paper, and chalk marks stay passable.
- Place four solid courtyard benches at `x10,y42`, `x14,y38`, `x23,y38`, and `x23,y43`. They complete the courtyard solid-density contract without entering a protected spine.
- Use the 16 authored passable courtyard object/effect parts for deliberate petals beside stalls, herb sprigs beside planters, and chalk near a wall. These parts supply clustering and compiler density. Automatic hash scatter does not claim authored placement; the promenade and mosaic use only low-density route wear, and the indoor floor remains free of automatic decals.

## Collision

- Walls, large palms, large bushes, flowering planters, benches, stalls, counters, the canopy base, fountain base, festival lanterns, and large market fixtures are solid.
- Promenades, pavers, mosaic, floor scuffs, petals, herbs, leaves, paper, chalk, tiny fruit leaves, and small stones are passable.
- No solid can occupy the north portal route `x30-34,y0-6`, east portal route `x57-63,y23-27`, any door approach, any internal primary route, courtyard spine `x27-29,y29-47`, courtyard west link `x4-29,y29-31`, restaurant east connector `x60-63,y23-47`, restaurant frontage link `x48-63,y46-47`, central mosaic `x28-36,y21-29`, either staging tile, or any door tile.
- Both sides of every wall opening stay clear of generated solid objects.
- Tests must prove both portals, three doors, four area routes, and the center mosaic remain connected after collision is compiled.

## 9.7 screenshot acceptance

At native `1x`, the final captures must visibly prove:

1. Coral stone, gold light, market fronts, and fabric canopies make the district read as a warm sunset market without labels.
2. Grouped stone wear, petals, herbs, chalk, and quiet gaps produce RimWorld-like surface density without a repeated stamp field.
3. Market hall, food arcade, and restaurant walls remain continuous at runs and corners. Their three recessed doors match the approved door bar.
4. Interior floors use a dark warm grid with related grout and subtle scuffs.
5. Canopy, stalls, fountain, planters, palms, signs, benches, produce, and lanterns fill the district with market life.
6. Large fixtures are solid. Small surface details are passable. No route, opening, or center-mosaic path is blocked.
7. The two five-tile promenades form a coherent connected district from both portals to all three doors and the courtyard.
8. Live renderer, route, collision, atlas, map, and type tests pass.

Required native screenshots:

- `artifacts/terrain-redesign/southwest/final/overview-1x.png`
- `artifacts/terrain-redesign/southwest/final/market-hall-front-1x.png`
- `artifacts/terrain-redesign/southwest/final/courtyard-1x.png`
- `artifacts/terrain-redesign/southwest/final/restaurant-front-1x.png`

The overview must show the complete 64x48 map at native `1x` with the `1x` renderer status visible. Score the exact screenshots beside the full RimWorld reference and the three accepted district overviews. Do not score from memory or from an enlarged crop.
