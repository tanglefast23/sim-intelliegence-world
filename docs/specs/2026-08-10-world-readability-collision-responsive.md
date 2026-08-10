# Phase 16: World readability, collision, and responsive desktop specification

Date: 2026-08-10

Status: proposed product and engineering contract

Depends on: `docs/measurements/2026-08-10-rimworld-scale-density.md`

## 1. Outcome

SI World must keep its simple HFM character art while making Halcyra feel compact, populated, solid, and readable.

The active game must use most of the available desktop window. Characters must not cross walls or solid objects. Buildings must read as buildings instead of large floor-color rectangles. Each player-visible area must contain enough solid objects, decorative detail, and clear routes to communicate its purpose.

This work must preserve deterministic simulation, click-to-move controls, four `64×48` neighborhoods, local-model conversations, save recovery, and the existing eight-frame character atlas.

## 2. Locked decisions

The following decisions are final for this work:

- World tiles remain `32×32` pixels.
- Character world cells remain `24×30` pixels.
- Each character keeps front, rear, left, and right walk directions with two frames each.
- Runtime world-art zoom remains discrete `1×`, `2×`, and `3×`.
- World art uses nearest-neighbor sampling and integer screen positions.
- The map contract remains `64×48` tiles per neighborhood.
- Controls remain left-click movement, middle-button pan, wheel zoom, `F` center, and `Escape` cancel.
- Sunward Villas remains the fully authored prototype neighborhood.
- Neon Crescent, Palm Exchange, and Harbor Authority receive a structural readability pass. They do not become fully authored content districts in this work.
- No sitting, combat, romance, or job animations are added.
- No full character side-profile redraw is added.

## 3. Terms

- **World surface:** the responsive input and rendering area that contains the map and all in-world overlays.
- **World zoom:** the integer `1×`, `2×`, or `3×` scale applied to world art.
- **UI scale:** the independent size of text, buttons, panels, and spacing.
- **Floor tile:** a walkable or terrain tile rendered below objects and walls.
- **Wall cell:** one tile owned by a wall run. A closed wall cell is always solid.
- **Door cell:** an opening in a wall run with explicit visual and traversal state.
- **Object:** one authored entity with one or more render parts and an optional multi-tile solid footprint.
- **Detail cell:** a tile that contains a non-ground visual part, whether solid or non-solid.
- **Approach cell:** a walkable tile from which an interaction can occur.
- **Structural placeholder:** a district that is safe and believable to traverse but does not yet contain its final businesses, stories, or interiors.

## 4. Spatial and camera contract

### 4.1 Character scale

Character art is already the correct size relative to a tile. The renderer must continue to place a `24×30` character inside a `32×32` tile with its existing shadow, lean, bounce, and walk timing.

Collision is tile based. The character visual may overlap empty pixels at the edge of its current tile, but its authoritative feet remain on one walkable tile.

### 4.2 Responsive world surface

The active game must not use a fixed `1120×620` card.

- The application root fills the available content width and height.
- The active world surface fills the remaining content rectangle after one `8–16` CSS-pixel outer margin on each side. It therefore consumes at least `90%` of available content width and `85%` of available content height at every supported target size.
- Responsive-matrix sizes refer to the application content rectangle, not the operating-system window frame.
- Outer game margins do not grow with monitor size.
- The prototype title, subtitle, and runtime line do not remain below the active game. Runtime information can move to a development-only overlay.
- The world surface width and height are whole CSS pixels derived from the current content rectangle.
- The Canvas backing store accounts for device pixel ratio, but world transforms remain integer CSS pixels and use nearest-neighbor atlas sampling.
- A resize updates rendering, pointer transforms, camera bounds, hit testing, and UI layout from the same measured world-surface rectangle.

### 4.3 Automatic starting zoom

New games use an automatic starting zoom selected from `1×`, `2×`, and `3×`.

For each zoom `z`, calculate `visibleWidth(z) = floor(surfaceWidth / (32 × z))` and `visibleHeight(z) = floor(surfaceHeight / (32 × z))`. Calculate its normalized error as:

`max(abs(visibleWidth(z) / 40 - 1), abs(visibleHeight(z) / 22 - 1))`

Select the zoom with the smallest normalized error. Ties select the lower zoom.

The automatic choice applies only until the player explicitly changes world zoom. Before that first explicit choice, the automatic selection runs after every world-surface resize and preserves the world point under the old viewport center. After the first explicit choice:

- resizing keeps the player's selected zoom;
- neighborhood transitions keep the selected zoom;
- recentering keeps the selected zoom;
- a later session restores the saved presentation preference.

World zoom is presentation state. It does not affect deterministic simulation or replay state.

### 4.4 Resize anchoring

When the world surface changes size:

1. Preserve the world point under the old viewport center.
2. Recalculate the automatic zoom when it is still active, or keep the player's selected zoom after an explicit choice.
3. Recalculate the camera for the new measured viewport and effective zoom.
4. Clamp against map bounds.
5. If the viewport is larger than the rendered map at the effective zoom, center the map in a themed non-interactive backdrop.
6. Reject pointer input in that backdrop.

The camera must not jump to the map origin only because a window becomes larger.

## 5. Responsive UI contract

UI scale is independent from world zoom.

### 5.1 Minimum sizes

- Persistent HUD and status text: at least `12 px`.
- Secondary labels: at least `11 px`.
- Button labels and normal panel text: at least `14 px`.
- Conversation transcript and input text: at least `16 px`.
- Pointer targets: at least `36×36` CSS pixels.
- Primary actions and text fields: at least `44` CSS pixels high.
- Focus outlines remain at least `3 px` and must not be clipped.

### 5.2 UI scale preference

The player can select `100%`, `125%`, or `150%` UI scale. This preference is local presentation data, not deterministic world state. The default is selected from window size and operating-system scale, but the player's explicit choice wins.

### 5.3 Layout behavior

- HUD, time controls, world zoom, journal, and social controls stay inside the world surface.
- At narrower widths, control groups compact or wrap. They must not overlap each other or hide the player without a dismissible state.
- The bottom status plate can use two lines. It must not reduce text below the minimum size.
- Conversation, journal, and relationship panels fit inside the current world surface with at least `16 px` clearance.
- Panel content scrolls when it cannot fit vertically. Primary input and dismissal controls remain visible.
- The conversation input remains usable at `1280×720` with `150%` UI scale.
- Opening a modal continues to pause simulation and lock world navigation.

## 6. Authoritative map geometry

This work replaces map schema v1 with map schema v2. Every v2 map has a required positive integer `layoutRevision`. Any change to static solids, wall openings, doors, object footprints, interaction approaches, location bindings, spawns, staging cells, portals, or other walkability data increments that map's revision. Art-only changes that do not affect these fields keep the revision.

### 6.1 One source for solid tiles

Rendered walls and objects must not rely on a separate hand-maintained collision rectangle that can drift from the art.

The compiled map owns one `staticSolidOwnerByTile` index. Each static blocked tile identifies exactly one primary owner:

- terrain;
- wall;
- closed door;
- object.

Static `blockedKeys` is derived from `staticSolidOwnerByTile`. A separate runtime `dynamicBlockerByTile` index owns temporary actor occupancy. Pathfinding combines these two indexes for a movement request, but dynamic actors never enter map compilation.

Invisible static collision is not allowed in production maps except for authored non-walkable terrain such as water or cliffs. Debug-only invisible collision must be labeled and excluded from production validation.

### 6.2 Wall authority

Wall runs own collision directly.

- Every non-opening wall cell is solid.
- A wall opening is not solid unless a closed door occupies it.
- Collision rectangles must not duplicate wall runs.
- The compiler rejects a wall opening outside its wall run.
- The compiler rejects an opening or door that leaves no walkable tile on one required side.
- Wall art variants are derived from orthogonal neighboring wall cells. Authored maps do not select corner and junction art manually.

### 6.3 Door authority

A door owns one wall opening and has explicit state:

- `open`: walkable;
- `closed-unlocked`: can be opened by movement or interaction, then becomes walkable;
- `closed-locked`: solid until an authored action unlocks it.

The map compiler records door ownership and authored initial state. Runtime traversal derives an effective solid overlay from that state. The first implementation can use only `open` doors, but the data and compiled ownership must not require a later wall/collision redesign.

### 6.4 Object authority

An object can occupy more than one tile.

Each object declares:

- one anchor tile;
- one or more render parts with tile offsets and atlas sprite IDs;
- zero or more solid-footprint rectangles relative to the anchor;
- optional interaction IDs;
- zero or more authored approach cells relative to the anchor;
- a depth anchor used for stable rendering order.

A simple one-tile object is the same structure with one render part and zero or one solid cell. `blocksMovement: boolean` is not sufficient for the new contract.

The compiler expands each footprint to tiles and rejects:

- out-of-bounds parts or footprints;
- undeclared overlap between solid owners;
- any solid local tile that is not also covered by a visible render part;
- an interaction with no walkable approach cell;
- an approach cell inside any static solid;
- an object that blocks a required portal, staging tile, spawn, or door route.

### 6.5 Interaction reachability

An interaction targets an object or door, not an unrelated hit tile.

At least one approach cell must be reachable from the area's required entrance without crossing a solid. If more than one approach cell is valid, click-to-move chooses the deterministic shortest path and then stable tile order.

### 6.6 Location bindings

Every `locationId` used by world state, schedules, invitations, quests, or transfers must resolve through the compiled map's `locationBindingById` index.

- A map v2 location binding declares one stable location ID, one or more area IDs, and zero or more preferred object or door interaction IDs.
- The map ID itself is implicitly bound to all walkable cells on that map.
- A more specific location such as `protagonist_villa` or `linda_villa` must have an explicit binding.
- The compiler expands the referenced areas into a stable set of candidate walkable tiles and expands preferred interactions into their valid approach cells.
- A binding with preferred interactions resolves to valid approach cells first. A binding without them resolves to walkable cells inside its referenced areas.
- The compiler rejects an unknown location ID, area ID, interaction ID, or binding with an empty candidate set.

## 7. Building and wall presentation

### 7.1 Building shell

A building requires:

- a floor or ground footprint;
- an outer wall loop with explicit openings;
- at least one reachable entrance;
- room or area bounds;
- a roof group when the building has an interior;
- a complete solid-owner result after compilation.

The compiler rejects a roofed building whose outer shell has an unintended gap, whose entrance is solid, or whose interior cannot be reached from its entrance.

### 7.2 Wall art

Walls use a generated orthogonal adjacency mask. The art set must distinguish at least:

- isolated cell;
- horizontal and vertical runs;
- four corners;
- four T-junctions;
- cross junction;
- terminal caps.

Wall art shows a top face, a darker lower edge, and clear openings. It must not look like the floor tile below it. The same simple modular wall set can be recolored for villa, downtown, commercial, and civic buildings.

### 7.3 Roof behavior

Existing roof-hide behavior remains. A roof group can use a union of rectangles or an explicit cell mask so one roof can match an L-shaped or otherwise non-rectangular building shell.

- Outside a building, its roof hides interior objects.
- On the entrance or inside, the roof hides and the walls, doors, and objects remain visible.
- Leaving restores the roof.
- Resize and zoom do not change which roof group is hidden.

## 8. Density profiles

Each authored area declares one density profile. The validator measures unique cells, not raw sprite count.

Map schema v2 adds a required `densityProfile` enum to every area and an optional `intentionalOpenAreas` list of tile rectangles. A map passes density validation only when every named area passes its own declared profile. Overlapping areas are measured independently. A structural-placeholder district assigns the structural-placeholder profile to its placeholder areas; it does not use one map-wide average to hide an empty area.

Water and wall cells are excluded from eligible floor denominators. A solid multi-part object counts each unique solid tile once for solid coverage. A detail cell counts only a tile covered by a visible non-ground render part, decoration, effect, or wall-adjacent fixture. A solid tile with no visible render-part coverage fails validation and cannot increase detail coverage.

### 8.1 Furnished interior

Examples: bedroom, kitchen, social room, office, shop interior.

- Solid-object footprint: `8–30%` of eligible floor cells.
- Detail coverage, including solid objects: at least `12%`.
- Walkable floor after solid objects: at least `55%`.
- A room larger than `24` eligible cells has at least three object render parts and two distinct object types.
- An empty rectangle larger than `6×6` cells requires an explicit `intentionalOpenArea` marker.
- Every door and interaction keeps at least one connected clear route.

### 8.2 Active street or public plaza

Examples: downtown strip, market, shopping concourse, civic forecourt.

- Solid-object footprint: `2–12%` of eligible floor cells.
- Detail coverage: `8–24%`.
- At least two visually distinct object clusters per named area.
- A primary route stays `2–4` cells wide.
- Required entrances and portals have at least two route choices when the area geometry permits it.

### 8.3 Relaxation or natural public area

Examples: beach, garden, spa exterior.

- Solid-object footprint: `1–8%` of eligible floor cells.
- Detail coverage: `5–18%`.
- Deliberate open sand, water edge, or lawn can exceed the ordinary empty-rectangle rule.
- Open space must still have boundaries, landmarks, vegetation, furniture, or effects that show its purpose.

### 8.4 Service yard or docks

- Solid-object footprint: `5–22%` of eligible non-water floor cells.
- Detail coverage: `8–25%`.
- Water collision does not count as object density.
- Civic and dock routes remain at least two cells wide.

### 8.5 Structural placeholder

A named placeholder area must have, at minimum:

- one readable enclosure, boundary, or object cluster;
- six solid object or wall cells not supplied by water;
- eight detail cells;
- one reachable entrance and one clear route to every required portal;
- a development label that says the area is a structural placeholder.

Meeting this profile does not satisfy a production-content gate.

## 9. Neighborhood requirements

### 9.1 Sunward Villas

Sunward is the full acceptance neighborhood.

- Keep the five-room protagonist villa and its existing story functions.
- Replace floor-like prop placeholders with readable modular objects.
- Bring each villa room into its declared density profile.
- Keep the bed, storage, front door, and social interaction reachable.
- Add enough exterior furniture, plants, signs, beach objects, and solid boundaries that the starting field of view reads as a neighborhood.
- Sunward declares a map v2 `startComposition` with camera anchor tile `{ x: 23, y: 26 }`, required actor IDs `protagonist`, `linda`, and `generic_resident`, at least twelve exact required non-floor detail-part IDs excluding walls, and required landmark area IDs `protagonist-villa` and `sunward-patio`.
- A new game applies automatic zoom and centers the initial camera on that declared anchor. `F` still centers later on the protagonist.
- The map compiler and an initial-state integration test must prove that all declared actors, detail parts, and landmark areas intersect the computed starting viewport at the initial clock minute for every §14.3 target while automatic zoom is active. This includes at least one target that selects `1×` and one that selects `2×`. Each proof uses that target's measured world-surface rectangle and exact §4.3 zoom result. The build fails if schedules, map edits, or a responsive breakpoint move the declared composition out of view.

### 9.2 Neon Crescent

Keep the downtown area a structural placeholder, but add readable club or bar shells, street boundaries, entrance gaps, and solid street objects. The map must no longer have only two blocked sign tiles.

### 9.3 Palm Exchange

Keep the commercial area a structural placeholder, but add readable shop or restaurant shells, entrances, counters or stalls, and solid concourse objects. The map must no longer have only two blocked sign tiles.

### 9.4 Harbor Authority

Keep the docks area a structural placeholder, but add readable police, civic, and ferry structures with walls and entrances. Water remains terrain collision and must not be reported as building density.

## 10. Navigation and collision behavior

- Player and NPC pathfinding use the same compiled static solids.
- A click on a solid tile selects a valid adjacent interaction approach when one exists.
- A click on a non-interactive solid returns immediate blocked feedback and does not create a path through it.
- Movement never steps through a wall corner, closed door, or object footprint.
- NPC dynamic blockers cannot push another actor into a static solid.
- A route can pass through an open door and a declared wall opening.
- Portals remain reachable from the neighborhood's required staging tile.
- All scheduled NPC destinations are walkable or have a valid interaction approach.
- The full Linda quest route remains reachable after the layout changes.

## 11. Save and deterministic-state compatibility

Map layout changes can make saved positions or destinations solid. World state schema v6 adds `layoutRevisions: Record<mapId, number>` and persists the compiled map v2 `layoutRevision` used for each map in that save. The v5-to-v6 migration gives a missing map entry revision `0`, which forces full validation against the current compiled map. Recovery compares only the saved value with the authoritative `CompiledMap.source.layoutRevision`.

Geometry-only layout changes do not require a `CONTENT_VERSION` bump. If an implementation also bumps `CONTENT_VERSION`, the migration loader must accept the immediately previous supported content version before it performs strict v6 parsing. It must not reject an otherwise recoverable save before layout recovery runs.

When a save uses an older layout revision:

1. Validate every saved protagonist, active NPC, inactive NPC, staging, invitation, transfer entrance, transfer destination, transfer goal, NPC `scheduleGoal`, and schedule-block tile against the new compiled map.
2. Keep valid positions unchanged.
3. Process records in stable order: protagonist first, then NPC, invitation, transfer, schedule, and schedule-block records sorted by stable ID; process repeated blocks by ascending start minute and then array index.
4. Relocate an invalid actor from the old tile with deterministic breadth-first search restricted to the actor's existing compiled location-binding candidate tiles. Keep the actor's `locationId` unchanged. Fail that record when the binding is unknown or has no valid candidate.
5. Re-resolve an invalid location-scoped destination through its compiled location binding. If the binding has preferred interactions, choose the nearest valid approach cell. Otherwise choose the nearest valid walkable tile inside the binding's referenced areas. Use the same deterministic breadth-first search and fail that record when the binding's candidate set is empty. This rule does not apply to a tile owned by a portal identity.
6. Re-resolve a transfer's origin exit from its `edgePortalId` on the compiled origin map and its destination entrance from `destinationEntranceId` on the compiled destination map. In state schema v6, the origin-exit coordinates remain stored in the traveling NPC's `scheduleGoal.tileX` and `scheduleGoal.tileY`. When a transfer is `approaching_exit`, recovery identifies the owning NPC by `npcId`, verifies that its goal is the transfer's `travel` goal on `originMapId`, and rewrites that schedule goal to the current compiled `edgePortalId` tile. It rewrites `destinationEntranceTileX` and `destinationEntranceTileY` from the current compiled `destinationEntranceId` tile. Do not use a location binding for either portal identity. Fail recovery if the transfer, NPC, matching travel goal, or either stable portal ID no longer exists.
7. Search breadth-first cardinal neighbors in fixed north, west, east, south order.
8. Reject static solids, already claimed actor tiles, portal cells, interaction cells, and reserved staging cells as actor relocation destinations unless the actor owns that role. Portal-identity recovery can select its exact compiled portal tile.
9. Record the record ID, field, old tile, new tile, old and new map revision, and reason in migration evidence.
10. Update the saved revision only after every record for that map validates or relocates successfully.
11. Fail recovery without overwriting the old save if no valid tile exists.

The same input save, target layout revisions, and supported content version must always produce the same relocation result. Migration tests must cover a missing v5 revision field, a valid unchanged position, an actor moved off a new solid while remaining in its location binding, two actors competing for the same nearest tile, a blocked schedule goal, a blocked transfer destination, a blocked transfer entrance with a still-valid entrance ID, a missing portal ID, and a no-valid-tile failure that preserves the old save.

Camera zoom, UI scale, window size, and panel layout remain presentation preferences outside deterministic world state.

## 12. Rendering and performance

- Preserve the existing floor, prop, shadow, character, effect, wall, and roof depth contract.
- Multi-part objects sort from one stable depth anchor.
- Cull floors, wall cells, object parts, characters, and effects against the measured responsive viewport.
- Do not compose character source layers at runtime.
- The responsive renderer must keep the existing qualification-only rounded `60 FPS` gate during local-model generation.
- A separate maximum-load renderer check uses `2560×1440`, device-pixel ratio at least `2`, player-selected `1×` world zoom, the fully detailed Sunward map, and every ordinary world layer enabled. It must also pass the rounded `60 FPS` threshold.
- Hosted platform-shell jobs record FPS but do not replace baseline renderer qualification.
- Resize events are coalesced. They must not rebuild map compilation or deterministic state.

## 13. Accessibility and input

- Every visible control keeps an accessible name and keyboard focus state.
- UI scale does not change pointer-to-world coordinate results.
- Screen readers receive the current neighborhood, tile, time, speed, selected zoom, and selected UI scale.
- Reduced-motion mode removes nonessential resize and panel transitions.
- Captions remain visible above the bottom status plate at every target size.
- Error and blocked-route feedback remains visible without requiring audio.

## 14. Acceptance evidence

### 14.1 Structural validation

Automated validation must prove:

- every rendered static solid has a solid owner;
- every non-terrain static solid has matching visible art;
- every wall cell, opening, and door agrees with collision;
- no required spawn, staging tile, portal, door route, or approach cell is blocked;
- all four maps meet their declared density profile;
- all required story and schedule destinations are reachable;
- old-save relocation is deterministic and preserves recoverable saves.

### 14.2 Gameplay behavior

Automated gameplay checks must prove:

- click-to-move routes around a wall;
- the player cannot walk through a wall or solid object;
- an open door can be crossed;
- an interactive object chooses a reachable approach tile;
- an unreachable click gives feedback and does not move the actor;
- roof hide and restore still work;
- Linda's quest, all four portals, save, reload, and conversation input still work.

### 14.3 Responsive matrix

Capture and verify the active game at:

| Target | Required proof |
|---|---|
| `1280×720` | no clipping; record the exact §4.3 automatic result from the measured surface; input and panels usable |
| `1440×900` | no clipping; UI minimum sizes; stable camera center after resize |
| `1920×1080` | world surface meets coverage target; readable HUD and dialogue |
| `2560×1440` | responsive world use; integer art; density remains readable |
| `1600×720` short/wide | controls compact without overlap; panel scroll works |
| high-DPI capture | backing pixels are sharp; CSS hit testing matches visible tiles |
| `2560×1440`, DPR `≥2`, selected `1×` | maximum-load renderer records and passes rounded `60 FPS` with all ordinary layers enabled |

For each target:

- record measured world-surface width and height;
- record automatic and selected world zoom;
- record UI scale;
- capture `1×`, `2×`, and `3×` evidence;
- click a known tile and prove its authoritative result;
- open a conversation and prove transcript, input, and controls remain visible;
- assert no body-level horizontal or vertical overflow.

### 14.4 Visual review

The Sunward start must pass a direct visual comparison against the Phase 15 findings:

- character-to-tile scale stays unchanged;
- rooms read through walls, doors, and furniture rather than labels alone;
- large empty floor fields are removed unless explicitly intentional;
- the starting view contains people and multiple readable landmarks;
- the active game uses the window instead of sitting inside large empty margins;
- normal text is readable without browser zoom.

## 15. Non-goals

- No freeform building editor.
- No destructible walls or furniture.
- No dynamic door locking simulation beyond the declared data contract.
- No map size change.
- No fractional world-art zoom.
- No runtime character paper-doll composition.
- No final content-authoring pass for downtown, commercial, or docks.
- No new combat, romance, sitting, or job animation set.
- No release qualification claim from hosted display performance.
