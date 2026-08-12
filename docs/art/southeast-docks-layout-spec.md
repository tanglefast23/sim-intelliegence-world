# Southeast Docks Layout Spec

## Target

`southeast_docks` is a grey, eerie working harbor. It must reach the established Northwest and Northeast environment bar of `9.7/10` without copying their palettes. The district uses dark water, wet concrete, weathered timber, cold lamps, rust accents, cargo clusters, and large quiet gaps that feel intentional.

## Binding 64x48 layout

All bounds are inclusive.

| Element | Bounds or line | Bound sprite or wall material | Purpose |
|---|---|---|---|
| Default harbor yard | full map | `tile.harbor-yard` | dark wet service concrete with grouped stains and cracks |
| Government apron | `x4-29, y5-22` | `tile.harbor-concrete` | three-tile front walk and side apron |
| Government shell | `x7-26, y7-19` | Tier B `civic` wall + `tile.dock-floor` | harbor authority and clinic building |
| Government door | `x17, y19`, opening `government-yard-entrance` | `tile.open-door`, state `open` | recessed horizontal doorway without added collision |
| Quay apron | `x35-51, y0-47` | `tile.harbor-quay` | continuous waterside work strip |
| Warehouse shell | `x38-49, y7-19` | Tier B `civic` wall + `tile.dock-floor` | non-interactive cargo building mass |
| Warehouse door | `x44, y19`, opening `cargo-warehouse-entrance` | `tile.open-door`, state `open` | recessed horizontal doorway without added collision |
| Main service road | `x0-51, y23-27` | `tile.dock-route` | five-tile west-to-quay vehicle route |
| North-south service road | `x30-34, y0-47` | `tile.dock-route` | five-tile route from the north portal |
| Cargo yard | `x3-29, y28-43` | `tile.harbor-yard` | open industrial room for crane and cargo clusters |
| Ferry terminal shell | `x36-49, y29-40` | Tier B `civic` wall + `tile.dock-floor` | terminal building beside the main pier |
| Ferry terminal door | `x43, y40`, opening `ferry-terminal-entrance` | `tile.open-door`, state `open` | recessed horizontal doorway without added collision |
| Harbor water | `x52-63, y0-47` | `tile.harbor-water` | dark animated-looking but static water field |
| North pier | `x50-61, y9-11` | `tile.dock-boardwalk` | three-tile weathered timber pier |
| Ferry pier | `x50-61, y33-35` | `tile.dock-boardwalk` | three-tile passenger and mooring pier |
| West portal walk | `x0-6, y20-22` | `tile.harbor-concrete` | connects the west portal crossing to the government apron |
| Service roads | all route bounds above | unpainted textured `tile.dock-route` | no dotted center lines or crosswalk bars; route geometry remains readable from material and apron boundaries |

Apply ground in this order: harbor yard, aprons, roads, service marks, crossings, water, piers, and interior floors. Crossings overwrite any paint at their bounds. Piers overwrite water visually and are excluded from the water collision rectangles.

## Material contracts

- `harbor-yard`, `harbor-concrete`, `harbor-quay`, `dock-route`, and `dock-floor` each ship at least three distinct base variants.
- `harbor-water` ships four dark teal-grey variants with slow grouped bands and rare cold glints. It must not use a bright tropical blue.
- `dock-boardwalk` ships three coordinate-phased variants. Plank groups continue across cell edges and use desaturated grey-brown wood with small rust stains.
- `dock-floor` uses a dark industrial grid with matching grout and restrained scuff texture.
- Road and concrete texture uses broad grouped patches, cracks, drain wear, and quiet areas. Reject repeated dots, repeated puddle stamps, and full-cell noise.
- The quay meets water through material contrast only. Do not draw thin peach, tan, or bright transition outlines around Docks ground regions, buildings, piers, roads, or water.
- Automatically scattered dock decals are passable-only. Solid cargo, bollards, lamps, benches, and machinery enter through explicit `objects[]` placements.
- The atlas phase must add these public ground families before map generation: `tile.harbor-yard` with `-b/-c`, `tile.harbor-concrete` with `-b/-c`, `tile.harbor-quay` with `-b/-c`, `tile.dock-route` with `-b/-c`, `tile.dock-floor` with `-b/-c`, `tile.harbor-water` with `-b/-c/-d`, and `tile.dock-boardwalk` with `-b/-c`.
- Do not place crosswalk or center-line ground overlays in Docks. The legacy atlas cells can remain available, but this map does not bind them.
- Add one passable-only `dock-surface-life` decal family using `tile.decal-dock-oil`, `tile.decal-dock-rope`, `tile.decal-dock-drain`, `tile.decal-dock-salt`, `tile.decal-dock-gull`, and `tile.decal-dock-fog`. Density must keep protected routes quiet.
- Add explicit solid atlas compositions for a four-cell cargo crane, two-cell cargo stacks, mooring bollards, cold dock lamps, and amber warning lamps. Every solid footprint cell needs visible blocking art at the same offset.
- Before adding these 25 ground cells, raise the `ground-base` maximum from `64` to `96` in both `assets/source/art/manifest.json` and the `TileCollectionSchema` ground-cell array. Raise the raw forecast limit from `70%` to `75%`; keep the stricter packed limit at `80%`. This preserves the required three-variant material quality and reserves room for the final Southwest district while both atlas checks remain active.

## Water and pier collision

The water visual occupies `x52-63, y0-47`. Deep-water collision uses these five rectangles:

1. `x52-63, y0-8`
2. `x62-63, y9-11`
3. `x52-63, y12-32`
4. `x62-63, y33-35`
5. `x52-63, y36-47`

This leaves `x52-61, y9-11` and `x52-61, y33-35` walkable as the two pier extensions. Keep each pier center row clear from the quay to `x60`.

## Road and pedestrian network

- Keep the north portal and staging path clear through `x30-34, y0-5`.
- Keep the west portal and staging path clear through `x0-6, y20-28`.
- Government entrance approach: `x16-18, y20-29`, plus the single open door tile `x17, y19`.
- Government-to-yard link: `x16-29, y28-30`, joining the government crossing to the cargo-yard spine.
- Warehouse entrance approach: `x43-45, y20-28`, plus the single open door tile `x44, y19`. Stop before the ferry terminal north wall at `y29`.
- Ferry entrance approach: `x42-44, y41-43`, plus the single open door tile `x43, y40`; its west approach is `x30-41, y41-43`.
- West crossing: `x1-2, y23-27`.
- Government crossing: `x16-18, y23-27`.
- Warehouse crossing: `x43-45, y23-27`.
- A two-tile cargo-yard spine at `x28-29, y28-43` connects the government crossing, service road, and ferry approach.
- Worn pale service marks occupy `x32, y1-21`, `x32, y29-47`, and `y25` on `x4-14`, `x20-29`, `x35-40`, and `x47-51`. The main intersection `x30-34`, all crossings, and road ends stay free of center paint.

## Harbor-life placement

- Place one solid `2x2` cargo crane in the southwest yard at `x20-21, y32-33`. Its arm can overhang without adding extra collision.
- Place six solid two-tile cargo stacks at `x5-6, y31`, `x10-11, y35`, `x5-6, y39`, `x23-24, y37`, `x38-39, y3`, and `x47-48, y22`.
- Place eight solid mooring bollards at `x51, y9`, `x51, y11`, `x59, y9`, `x59, y11`, `x51, y33`, `x51, y35`, `x59, y33`, and `x59, y35`. Both pier center rows stay clear.
- Place cold-blue lamps along the quay at `x50, y4`, `x50, y16`, `x50, y29`, and `x50, y42`. Add two amber warning lamps at the cargo-yard edge.
- Place the two amber warning lamps at `x27, y32` and `x27, y40`, west of the protected cargo-yard spine.
- Mount passable signs on wall cells beside each door: government `x16/18, y19`, warehouse `x43/45, y19`, and ferry `x42/44, y40`. Place solid frontage lamps outside the protected door paths. Government lamps use `x14, y20` and `x20, y20`; warehouse lamps use `x41, y20` and `x47, y20`; ferry lamps use `x46, y41` and `x48, y41`. No frontage object enters a protected path.
- Place the two-cell ferry landmark at `x56-57, y36` in deep water beside the ferry pier, not on the walking spine.
- Cluster passable oil stains, small rope coils, drain marks, salt streaks, gull marks, and low fog traces near cargo and quay edges. Keep the middle of primary routes quiet.

## Area, binding, spawn, and density contracts

- `government-yard` uses `active-public`, entrance `x17, y19`, internal primary route `x16-18, y9-18`, and binds both `priya_clinic` and `tomas_marina`.
- `cargo-warehouse` uses `service-docks`, entrance `x44, y19`, internal primary route `x43-45, y9-18`, and has no location binding.
- `ferry-terminal` uses `active-public`, entrance `x43, y40`, internal primary route `x42-44, y31-39`, and binds `ferry_terminal`.
- `cargo-yard` uses `service-docks`, entrance `x28, y28`, and primary routes `x28-29, y28-43` and `x16-29, y28-30`.
- Preserve required work spawns on clear interior cells: `priya_nair` at `x12, y12` and `tomas_reed` at `x41, y34`. Preserve ambient spawn IDs on verified clear cells.
- Government furniture supplies 21 solid/detail cells in separate clusters: counters `x9-14, y10` and `x19-24, y10`, desks `x9-10, y15` and `x23-24, y15`, and benches `x11-12, y17` and `x21-23, y17`. Keep `x16-18` clear.
- Warehouse cargo supplies 16 solid/detail cells: four three-cell cargo clusters at `x39-41, y9`, `x46-48, y9`, `x39-41, y14`, and `x46-48, y14`, plus two two-cell locker clusters at `x39-40, y17` and `x47-48, y17`. Keep `x43-45` clear.
- Ferry furniture supplies 14 solid/detail cells in separate clusters: benches `x37-39, y32`, `x46-48, y32`, and `x37-39, y35`, counter `x37-40, y37`, and kiosk `x48, y37`. Keep `x42-44` clear.
- Cargo-yard solids total at least 28 cells: the four-cell crane, four in-yard two-cell cargo stacks, two warning lamps, two four-cell pallet racks at `x13-14, y31-32` and `x16-17, y38-39`, and three additional two-cell supply clusters. The two remaining cargo stacks sit on the quay.
- Add at least 13 explicit passable surface-detail cells to the cargo-yard area object so density measurement sees at least 35 detail cells. Use quiet clusters outside protected paths at `x8,y29`, `x12,y30`, `x18,y31`, `x25,y31`, `x7,y34`, `x15,y34`, `x24,y34`, `x8,y38`, `x18,y36`, `x26,y37`, `x12,y41`, `x20,y42`, and `x25,y41`.

## Collision

- Deep water, walls, cargo stacks, the crane base, mooring bollards, street lamps, benches, large machinery, and large planters are solid.
- Piers, roads, sidewalks, puddles, oil stains, fog traces, rope marks, salt streaks, gull marks, drains, and small debris are passable.
- Both sides of every wall opening stay clear of generated solid objects.
- No solid can occupy a protected portal path, entrance path, crossing, cargo-yard spine, or pier center row.
- Tests must prove that both portals, all three doors, both pier ends, and the ferry approach remain connected after all solid footprints are applied.

## 9.7 screenshot acceptance

At native `1x`, the final captures must visibly prove:

1. Dark water, a continuous quay, and two real timber piers make the district read as a dock before labels are considered.
2. Wet concrete, road wear, drains, salt marks, oil clusters, and quiet gaps produce RimWorld-like environmental density without a repeated stamp field.
3. Government, warehouse, and terminal walls remain continuous at straight runs and corners. Their recessed open doors match the Northwest door bar.
4. The industrial interior grid is darker than the exterior concrete and keeps subtle scuff texture.
5. A crane, ferry, cargo stacks, bollards, cold lamps, and warning lights create an eerie working-harbor identity.
6. Large equipment is solid. Small surface detail is passable. No route, crossing, opening, or pier spine is blocked.
7. Both portals and both pier ends are visibly connected by a coherent five-tile service-road and quay network.
8. Live renderer, route, collision, atlas, and type tests pass. Tests assert three open doors, two walkable piers, five water-solid rectangles, six cargo stacks, one crane, eight bollards, valid portals, and passable scattered detail.

Required native screenshots:

- `artifacts/terrain-redesign/southeast/final/overview-1x.png`
- `artifacts/terrain-redesign/southeast/final/government-front-1x.png`
- `artifacts/terrain-redesign/southeast/final/ferry-pier-1x.png`
- `artifacts/terrain-redesign/southeast/final/cargo-yard-1x.png`
- `artifacts/terrain-redesign/southeast/final/north-pier-1x.png`

The overview must show the complete 64x48 map at native `1x` with the `1x` renderer status visible. The two additional detail captures must show the full cargo yard and the entire north-pier walk spine with all four bollards.

Score the exact screenshots beside the full RimWorld reference, the Northwest final screenshot, and the Northeast final overview. Do not score from memory or from an enlarged crop.
