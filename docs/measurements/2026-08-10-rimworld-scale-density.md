# Phase 15: RimWorld scale, density, and display measurements

Date: 2026-08-10

Status: measurement record, not an implementation specification

## Decision

Keep the current `32×32` world tile and `24×30` character cell. The character-to-tile scale is already close to the supplied RimWorld reference. Do not redraw or enlarge the characters to solve the reported open-space problem.

The large visual gap comes from three other causes:

1. Rooms and outdoor areas contain too few real objects.
2. Three neighborhood placeholders have almost no walls or solid object footprint.
3. The game uses a fixed `1126×626` outer world frame, so large windows leave most of the display unused and keep the UI at its small prototype size.

Phase 16 must specify density, starting field of view, wall and object collision, and responsive display behavior together. A camera-only or character-only change will not solve the combined problem.

## Evidence and confidence

The source-derived current-game measurements are exact. They come from committed source, map JSON, and atlas metadata. The `1280×688` image size is a separate artifact-derived measurement from the committed Phase 14 PNGs.

The supplied RimWorld screenshot was available in the task at a displayed size of `1200×627`. Its original Desktop path was no longer present when Phase 15 started. The RimWorld values below are rounded visual bands from that supplied image. They are suitable for relative scale decisions, but they are not subpixel measurements.

## Character and camera scale

| Measure | RimWorld reference | SI World now | Result |
|---|---:|---:|---|
| Ground-cell pitch in the reference image | about `28–32 px` | `32 px` at native `1×` | close |
| Standing adult height | about `0.8–1.0` cell | `30/32 = 0.94` cell | match |
| Standing adult width | about `0.5–0.7` cell | `24/32 = 0.75` cell | slightly wider; acceptable for HFM art |
| Approximate cells visible | `38–42 × 19–22` | default `2×`: `17.5 × 9.7`; optional `1×`: `35 × 19.4`; `3×`: `11.7 × 6.5` | `1×` is close; the default is much tighter |
| Supported zoom | screenshot-specific | discrete `1×`, `2×`, `3×` | keep |

The current protagonist-to-villa ratio also overlaps the reference. The protagonist is `30 px` high. The villa is `18` tiles across, so character height is about `5.2%` of the building width. In the supplied RimWorld image, a pawn against the largest connected building groups is also about `5–7%` of the group width.

The character-to-cell ratio does not change with camera zoom, so the current art does not need a new base size. Enlarging the characters would make doors, furniture, paths, collision, and every existing atlas placement inconsistent while leaving empty rooms empty.

The starting field of view is a separate concern. The game starts at `2×`, which shows about one quarter of the cell area shown at `1×`. Phase 16 must test whether a responsive viewport can give the default camera a RimWorld-like useful field of view while preserving integer art. It must not treat the optional `1×` comparison as proof that the current starting camera is already correct.

## Room and object scale

The supplied RimWorld image uses several room scales at once:

- Small rooms have a short side of about `4–6` cells.
- Ordinary shared rooms are about `6–10` cells on a side.
- Large work, storage, or animal rooms reach about `10–18` cells on one side.
- Outdoor passages between built zones are usually about `1–4` cells wide.
- Beds use about `2×1` cells. Chairs, lamps, doors, and small fixtures use about one cell or less. Tables and stockpiles use multi-cell footprints.

Most Sunward villa rooms overlap those room-size bands. The `3×6` bathroom is a below-band service-space exception:

| Area | Current cells |
|---|---:|
| Bedroom | `6×6` |
| Bathroom | `3×6` |
| Storage | `5×6` |
| Kitchen | `6×9` |
| Social room | `9×9` |
| Whole villa shell | `18×18` |
| Villa interior footprint | `16×16 = 256` cells |

Room size is not the primary defect. Object occupancy is. Only six blocking props are inside the `256`-cell villa interior footprint: a bed, bath, storage crate, two counter cells, and one sofa. That is `6/256 = 2.34%` of the interior footprint. The footprint also contains `31` blocked internal-wall cells; against the remaining `225` floor-and-prop cells, the six props occupy `2.67%`. The props reuse floor-like `32×32` tiles, so they read as patches instead of furniture silhouettes.

The RimWorld reference uses furniture, stock, lights, crops, rocks, animals, and work objects to break up almost every built or worked zone. The later specification should define separate bands for:

- solid furniture and object footprint;
- non-solid visual detail footprint;
- deliberate clear walking lanes.

It must not use one total-prop count as a substitute for those three different needs.

## Exact current map density

Each neighborhood contains `64×48 = 3,072` cells.

| Neighborhood | Blocked cells | Blocked share | Wall cells | Solid props | All props | Main finding |
|---|---:|---:|---:|---:|---:|---|
| Sunward Villas | `105` | `3.42%` | `98` | `7` | `14` | Villa walls are solid, but rooms and the wider map are sparse. |
| Neon Crescent | `2` | `0.07%` | `0` | `2` | Functional transition placeholder, not a believable downtown. |
| Palm Exchange | `2` | `0.07%` | `0` | `2` | Functional transition placeholder, not a believable commercial district. |
| Harbor Authority | `580` | `18.88%` | `0` | `4` | Water creates a large blocked count, but there are no authored building walls. |

All `98` rendered Sunward wall cells currently overlap blocked collision cells. This means the reported wall problem is not that the existing villa wall can always be crossed. The actual gaps are:

- other districts have no rendered wall regions;
- wall and collision data are duplicated and can drift;
- many visual objects are non-solid signs or floor-like patches;
- no footprint larger than one cell exists for furniture or civic objects;
- a map can pass validation with almost no built collision.

The Phase 16 design must use one authoritative solid-footprint contract and validate that walls, doors, large objects, interaction approach cells, and pathfinding agree.

## Initial visible density

The actual starting camera is `2×`, centered on the protagonist at tile `18,18`. Its world bounds start at pixel `312,437` and cover `560×310` world pixels. That is about `17.5×9.7 = 169.5` cell-equivalents.

The starting view contains the protagonist, no active NPC, three solid props, and no effect. The props are two kitchen-counter cells and one sofa. This is one solid prop per `56.5` visible cell-equivalents. Walls divide the view, but the large social and kitchen floors still have very little furniture detail.

The optional `1×` viewport capacity is `35×19.375 = 678.125` cell-equivalents. It must not be called the initial camera. It is useful as the closest current field-of-view comparison to the supplied RimWorld image.

The runtime initial state contains `34` NPC records plus the protagonist. The map JSON supplies `33` NPC spawn entries plus the protagonist; `createInitialState` adds Linda's inactive boyfriend at tile `25,28`. Most residents start outside the default `2×` view. Phase 16 must therefore address both object density and the composition of the starting camera.

## Display use and text size

The world viewport is fixed at `1120×620`. Its outer border is fixed at `1126×626`. HUD text is mostly `8–10 px`; footer text is `9–10 px`; the page labels below the game use `12–22 px`. The Electron window starts at `1280×720`. The committed Phase 14 PNGs measure `1280×688`; that screenshot-derived content height includes platform-window behavior and is not a source-level constant.

The fixed world frame consumes the following display shares if one CSS pixel maps to one display pixel:

| Available content size | Frame width | Frame height | Frame area |
|---|---:|---:|---:|
| `1280×720` | `88.0%` | `86.9%` | `76.5%` |
| `1920×1080` | `58.6%` | `58.0%` | `34.0%` |
| `2560×1440` | `44.0%` | `43.5%` | `19.1%` |
| `3840×1688` | `29.3%` | `37.1%` | `10.9%` |

This source-level result explains the unused monitor area in the supplied screenshot. The layout centers the fixed card and adds a title, status line, and runtime line below it. The Phase 14 images show that lower information can be clipped in a `688 px` captured content area, but that height is artifact evidence, not a portable layout constant.

The later responsive design must treat the world surface and the UI text as separate scales:

- preserve integer, nearest-neighbor world art;
- use more of the window for the world frame;
- keep a stable number of useful world cells visible;
- enforce readable UI text and controls independently of camera zoom;
- define behavior for short, wide, high-DPI, windowed, and full-screen displays.

## Measurement-derived constraints for Phase 16

1. Keep `32×32` tiles, `24×30` character cells, and the eight-cell character atlas.
2. Keep `1×`, `2×`, and `3×` as world-art zoom levels. Do not add fractional art sampling.
3. Do not solve density by shrinking the `64×48` map contract before testing denser authored layouts.
4. Specify small, ordinary, and large room bands instead of one building size.
5. Specify solid and decorative occupancy per room and per outdoor zone.
6. Require walls and solid objects to own explicit collision footprints.
7. Require doors and interactions to own reachable approach cells.
8. Require each player-visible district to meet a minimum built-detail and path-choice density. A transition placeholder must be visibly labeled as such in development evidence and cannot satisfy a production gate.
9. Replace the fixed desktop card with a responsive container and explicit breakpoints or fit rules.
10. Test at least `1280×720`, `1440×900`, `1920×1080`, `2560×1440`, and one short/wide window. Include high-DPI capture evidence.

## Reproduction sources

- `src/render/atlas.ts`: `24×30` cells, `32`-pixel tiles, and discrete zoom contract.
- `src/render/WorldScene.tsx`: fixed `1120×620` viewport, `1126×626` frame, camera, rendering, and `8–10 px` in-world UI text.
- `src/render/SkiaProof.tsx`: centered fixed card and page labels.
- `src/domain/state/initial-state.ts` and `src/domain/state/production-cast.ts`: runtime population and the additional inactive boyfriend record.
- `electron/main/index.ts`: `1280×720` initial Electron window.
- `content/maps/*.json`: exact room, wall, prop, and collision counts.
- `src/world/maps/schema.ts`: current collision compilation and validation behavior.
- `artifacts/phase-14/macos/current/world-{1,2,3}x.png`: current `1280×688` visual evidence.
- Supplied RimWorld screenshot: rounded visual reference only; original local path was unavailable during this phase.
