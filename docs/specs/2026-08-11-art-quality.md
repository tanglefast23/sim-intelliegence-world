---
title: "Original pixel-diorama art quality"
type: specification
date: 2026-08-11
status: council-review-draft
base_sha: bae2fb2a7b18490491ad53a7a2b3f9f58378969d
---

# Original pixel-diorama art quality

## 1. Outcome

Halcyra must look like a compact, attractive island with a dark underside. It must not look like a large test grid with a few sprites on it.

This program improves the source art, build-time art generator, deterministic ground presentation, characters, buildings, roofs, props, and review evidence. It keeps the current efficient runtime: original source layers compile into flat atlas cells, and Skia draws those cells in batches.

The target style is an **original warm-noir pixel diorama**:

- simple and cute at first glance;
- readable at native `1×`;
- warm, attractive, and controlled in Sunward Villas;
- dirtier, louder, and more dangerous in vice and service areas;
- detailed through material variation, edges, shadows, props, and local storytelling;
- visually compatible with dark comedy, crime, betrayal, and adult stories without requiring realistic or graphic art.

RimWorld is a reference for scale, density, material hierarchy, edge treatment, and scene readability. HFM is a reference for compact character silhouettes, face and hair separation, palette ramps, and generated outline discipline. SI World must not copy either game's assets, exact palette, characters, buildings, or identifiable designs.

## 2. Confirmed baseline and cause

The current runtime architecture is suitable. The current source art is the limit.

- The generated atlas is one `512×426` RGBA image with one-pixel gutters.
- The renderer batches visible floor, prop, character, wall, roof, and effect cells by depth layer.
- Phase 22 passed the packaged maximum-load gate.
- World tiles are `32×32` pixels.
- World characters are `24×30` pixels on one `32×32` tile.
- The current atlas has only ten ground cells for all four `64×48` neighborhoods.
- Each major ground material repeats one cell across large rectangular regions.
- Ground regions identify one sprite. They have no visual-variant or material-transition contract.
- Roofs use the boardwalk cell with a hard-coded color overlay instead of an authored roof material.
- The current ten world-character sources use the same small command grammar. Several named residents are generated from one generic body with limited shape changes.
- Existing tests prove dimensions, bounds, reachability, and deterministic output. They do not prove material quality, repetition control, character identity, or scene hierarchy.

The Phase 15 measurement remains authoritative: character-to-tile scale is already suitable. Enlarging characters does not fix repeated ground, weak materials, sparse local detail, or generic buildings.

The current screenshot differs from the supplied RimWorld reference in six material ways:

1. Current ground has one-cell repetition. The reference uses several values and detail scales within one material.
2. Current material boundaries are rectangular and abrupt. The reference uses edges, curbs, stains, debris, and irregular local transitions.
3. Current roofs and walls have little material identity. The reference separates top faces, side faces, openings, and cast shadows.
4. Current props have simple flat fills and limited contact shading. The reference uses readable silhouettes, internal value changes, and grounding shadows.
5. Current large areas have little low-contrast visual information. The reference uses controlled clutter without making every detail interactive.
6. Current characters are clear but small, similarly proportioned, and less internally shaded than HFM characters.

## 3. Locked contracts

The following contracts do not change in this program:

- `32×32` world tiles.
- `24×30` world-character cells.
- Eight final world cells per character: front, rear, left, and right, with two walk frames each.
- The existing rear-frame generation method.
- Lateral cells made from two lateral leg shapes plus front head and torso layers.
- Approximately `145 ms` per walk frame at world speed `1`.
- Discrete `1×`, `2×`, and `3×` world zoom.
- Nearest-neighbor sampling and integer final screen placement.
- Source-layer composition at build time and flat atlas cells at runtime.
- No runtime paper-doll composition.
- No full side profiles in the first art-quality program.
- Four `64×48` neighborhood maps.
- Existing click movement, collision, door, object-footprint, roof-hide, depth, save, local-model, and responsive contracts.
- Sunward Villas remains the fully authored prototype district.
- The other three districts receive shared material and readability upgrades. This work does not silently turn them into fully authored story districts.

An art-only change must not increment `layoutRevision`, change static solids, move a portal, move a spawn, change an approach cell, or require a save migration.

## 4. Non-goals

This program does not add:

- combat, sitting, romance, job, swimming, or vehicle animation;
- a dynamic day-and-night lighting engine;
- weather simulation;
- skeletal animation;
- normal maps, shaders, texture filtering, or fractional zoom;
- physics-driven props or particles;
- procedurally generated map geometry;
- new businesses, quests, interiors, or population systems for placeholder districts;
- licensed or copied game art;
- image-generator output as unreviewed production pixels.

Concept images can inform an original design. Every production cell must have a known source and must be reproducible by the repository art build.

## 5. Art direction

### 5.1 Visual hierarchy

Every scene uses this priority from strongest to quietest:

1. selected character, urgent effect, or active interaction;
2. other characters, doors, and interactive objects;
3. building walls, major furniture, and landmarks;
4. paths, material boundaries, and non-interactive props;
5. ground texture, small decals, and background variation.

Ground detail must not have the same contrast or outline weight as a face, door, or interactive prop. A more detailed scene must remain easier to read, not noisier.

### 5.2 Light direction

All authored day art uses one light direction from the upper left.

- Top and upper-left faces use the light or highlight value.
- Lower and right faces use the shadow value.
- Static cast shadows fall down and right.
- Contact shadows remain close to the object's foot or base.
- Character shadows keep the Phase 23 movement behavior and follow the same visual direction.
- A material can be glossy, rough, worn, or wet, but it cannot reverse the light direction.

The first implementation proves daytime art. Night palettes and dynamic light sources are a later program.

### 5.3 Palette system

Each material family has a controlled ramp with at least:

- outline or deepest shadow when that material needs one;
- shadow;
- base;
- light;
- optional accent.

Characters use shared semantic ramps for outline, skin, hair, clothing, and accessories. Hair and skin cannot share an ambiguous dark token when they touch. Each important material must remain distinguishable in grayscale and under common color-vision simulations.

The total color count is not a goal. A new color is allowed only when it creates a visible material, identity, or hierarchy improvement at `1×`.

### 5.4 Outline rules

- Characters and interactive props use one controlled dark outer contour.
- The contour can open at the bottom of a moving foot when a closed outline would erase the footfall.
- Interior seams use material shadow, not a full black line, unless the seam represents a real gap.
- Terrain cells do not receive a dark box outline.
- Adjacent parts of one multi-tile object cannot show an unintended outline seam.
- The final contour pass is generated after world-character layers are composed. Small internal identity marks remain authored.

### 5.5 Shape language

- Characters use rounded heads, compact torsos, clear feet, and one or two memorable asymmetries.
- Buildings use strong rectangular structure with softer plants, fabric, water, litter, and wear around it.
- Sunward objects look cared for and designed.
- Downtown objects look repaired, reused, advertised, and worn.
- Commercial objects look abundant and inviting.
- Docks and civic objects look heavy, regulated, wet, rusty, or functional.

## 6. Neighborhood identity

### 6.1 Sunward Villas

Use honey sand, pale limestone, terracotta, spa blue, teal water, and palm green. Detail is groomed: raked sand, shell paths, planters, towels, umbrellas, clean water edges, small flowers, and controlled wear.

The result must feel safe and desirable without looking sterile.

### 6.2 Neon Crescent

Use charcoal asphalt, worn concrete, bruised purple, magenta and cyan sign accents, warm street-light amber, and dirty metal. Detail can include posters, patched paving, stains, bottles, cables, vents, bins, and service doors.

The result must look fun from a distance and unsafe in specific corners.

### 6.3 Palm Exchange

Use warm cream, coral awnings, shop green, fruit and sign accents, ceramic tile, and clean wood. Detail can include market baskets, menus, display tables, plants, cartons, shade cloth, and small delivery clutter.

The result must look active and commercial, not like another residential palette.

### 6.4 Harbor Authority

Use salt gray, navy water, civic blue, rust, weathered timber, dark rubber, and sodium amber. Detail can include ropes, bollards, chains, crates, drainage marks, painted safety lines, police and government signs, and water-edge wear.

The result must feel controlled on the surface and useful to an underworld below it.

## 7. Ground-material system

### 7.1 Material families

The art source replaces a one-sprite concept with named material families. A family owns:

- one stable public base sprite ID for map compatibility;
- four to eight base variants for common natural materials;
- two to four base variants for strongly structured materials when more variants would break alignment;
- one palette ramp;
- a texture-density band;
- a seam mode;
- an edge mode;
- an optional decal family;
- a stable transition priority.

The public base sprite IDs in existing maps remain valid. Generated variant and transition IDs are implementation details and cannot become simulation identifiers.

### 7.2 Stable visual selection

Visual variation is selected by a pure presentation hash of:

`mapId + tileX + tileY + materialId + artRevision`

The selector:

- never reads or advances the simulation random-number generator;
- never reads wall-clock time;
- returns the same output after resize, zoom, restart, save load, and map transition;
- is not stored in the save;
- is independent of device-pixel ratio and frame rate.

`artRevision` is an art-build constant. Changing it can change presentation, but it cannot change collision, routes, schedules, or replay commands.

### 7.3 Variant rules

- Variants preserve the material's main value, path readability, and structure.
- Natural materials vary clusters, ripples, grains, pebbles, tufts, stains, and small value patches.
- Structured materials keep joins aligned across tile boundaries. Their variants change wear and grain, not the structural grid phase.
- No variant places a landmark-like mark often enough to become an obvious stamp.
- No variant changes whether a tile appears walkable.
- A continuous `12×12` board of a common material must use at least four variants.
- No `2×2` block can contain four identical variants unless the material explicitly uses coordinate-phased structure.
- The selector cannot produce a visible diagonal or checkerboard cycle.

### 7.4 Material edges

Every material family declares one of these edge modes:

- `soft`: irregular transition for sand, soil, grass, and water margins;
- `built`: aligned curb, trim, plank end, tile border, or road edge;
- `hard`: a deliberate platform or authored boundary that needs no blend.

The first implementation supplies sixteen orthogonal edge masks per soft or built family. It adds corner-aware masks only when the review board proves that an orthogonal mask leaves a visible rectangular defect.

An edge is presentation only. Neighbor checks can select an edge cell, but they cannot change terrain ownership or walkability. Every supported neighboring material pair must have one reviewed example. A hard rectangular seam is allowed only when the material declares `hard` or supplies a visible curb, wall, platform, or trim.

### 7.5 Decals and macro variation

Sparse decals can include cracks, grass groups, pebbles, shells, sand ripples, stains, leaves, board knots, tire marks, and drainage wear.

- Decals are transparent atlas cells in the existing static floor or prop batch.
- They are non-solid and non-interactive.
- They use a separate stable presentation hash or an explicit authored visual placement.
- They do not enter save state, hit testing, location bindings, pathfinding, density validation, or simulation events.
- They remain lower contrast than characters and interactions.
- One decal cannot cross a wall or appear inside a roofed room unless its placement rule permits that area or material.
- Large-scale value variation uses sparse authored clusters or deterministic multi-tile masks. It does not use a visible repeating mega-tile.

## 8. Buildings, roofs, walls, and doors

### 8.1 Wall materials

The existing adjacency masks remain authoritative. Each wall palette gains an art recipe with:

- a readable top face;
- a darker front or lower face;
- left-light and right-shadow treatment;
- terminal caps;
- clear inner and outer corners;
- aligned openings;
- material-specific trim or wear that does not change the wall footprint.

The four wall families must be visibly different at `1×`, not only recolored.

### 8.2 Roof materials

Replace the boardwalk-as-roof fallback. Each building group references an authored roof material. A roof material supplies:

- base and variant cells;
- outer edge and corner cells;
- optional ridge, vent, stain, or patch decals;
- a value that separates the roof from surrounding ground and from exposed interior floor.

Roof hide, restore, union masks, and building ownership remain unchanged. A roof material is presentation data. It does not change the roof cell mask.

### 8.3 Doors and openings

- A door reads as a door in open, closed-unlocked, and closed-locked states when those states become active.
- The visible opening stays aligned to the one walkable opening cell.
- Door frames use the parent wall material.
- Sign, shadow, or trim pixels cannot make an open door look blocked.
- A closed door's visible mass covers enough of its solid cell to explain collision.

### 8.4 Interiors

Floors, walls, furniture, and roof materials must identify the room without relying on a label. A spa, villa social room, shop, bar, police room, and dock office require different material or prop cues when those authored rooms exist.

This art program improves existing rooms. It does not authorize new room layouts.

## 9. Objects, vegetation, and landmarks

### 9.1 Object art recipe

Every object family uses:

- an outer silhouette;
- internal material separation;
- one light-side change;
- one shadow-side change;
- a contact shadow or base connection when appropriate;
- controlled asymmetry or wear when it improves recognition;
- continuous art across multi-tile parts.

One multi-tile object is composed and reviewed as a complete object before it is split into atlas cells. The generator adds gutters after splitting. It cannot create an outline or alpha seam at an internal split.

### 9.2 Collision agreement

- Every solid footprint cell has a visible blocking form.
- Decorative overhang can extend outside the footprint, but the foot-level silhouette must not imply a different route.
- A non-solid decoration cannot look like a full-height wall or large impassable crate in a walking lane.
- Tall props preserve correct front/behind depth behavior.
- New art does not modify a footprint. A footprint change requires a separate geometry phase and `layoutRevision` review.

### 9.3 Vegetation

Vegetation uses two or more values per leaf mass, one trunk or stem value, and a readable ground connection. Palm, shrub, planter, grass, and crop art must not be recolors of one silhouette.

### 9.4 Landmarks

Fountain, ferry, major signs, and civic fixtures use multi-tile composition, one strong silhouette, and a local accent color. A landmark cannot be generated as a repeated micro-decal.

## 10. Character system

### 10.1 Shared identity source

One character source remains authoritative for both world cells and portrait. It owns:

- skin ramp;
- face shape;
- eye and brow set;
- mouth or resting expression;
- hair shape and ramp;
- torso and clothing silhouette;
- outfit ramp and material;
- accessory;
- optional held item;
- body build or stance;
- front legs and lateral leg shapes.

World cells and portraits can use different detail levels, but they cannot disagree about hair shape, skin value, key facial feature, primary outfit, or accessory.

### 10.2 Silhouette and identity

- The ten current character visuals include at least three clear torso or body silhouettes.
- Each named character differs from every other named character by at least two non-color features at `1×`.
- Valid features include head shape, hair silhouette, facial-hair silhouette, glasses, hat, accessory, torso width, outfit shape, or held-item silhouette.
- Hair color alone does not count.
- A named character cannot be only a palette and hair replacement of the generic resident.
- The protagonist, Linda, and generic resident receive the first quality proof.

### 10.3 Rendering rules

- Keep the `24×30` cell and eight final world cells.
- Keep two front leg frames and two lateral leg shapes.
- Keep generated rear cells and composed lateral cells.
- Add a generated one-pixel outer contour after layer composition.
- Use separate three-value skin and hair ramps where their shapes touch.
- Use at least two outfit values when the garment is large enough to show them.
- Keep eyes, mouth, glasses, and small accessories readable without making the head larger.
- Preserve rows `21–29` foot differences and the Phase 23 movement contract.
- Test the front-head lateral compromise at native `1×`. Add one mirrored three-quarter head and hair view only if the proof fails. Do not redraw the full body unless that smaller fix also fails.

### 10.4 Portraits

Portraits remain `40×44`. They can show more face, hair, clothing, and expression detail than world cells. Portrait lighting and palette must match the world identity.

The conversation panel tests the portrait against the current dark UI at every supported UI scale. Portrait quality cannot reduce transcript or input readability.

## 11. Build-time art pipeline

### 11.1 Source form

Production art remains declarative and reproducible. The source grammar can add reusable primitives, masks, outlines, ramps, material recipes, variant recipes, and multi-tile composition. Large hand-written arrays can remain when they are the clearest source.

Source layers are not drawn as separate runtime objects. The build creates flat RGBA atlas cells.

### 11.2 Build stages

The build performs these deterministic stages:

1. validate source IDs, dimensions, palettes, and command bounds;
2. compose character, material, wall, roof, object, and portrait source layers;
3. apply derived variants, edges, contours, and contact shadows;
4. compose each multi-tile object before cell splitting;
5. split final cells and add one-pixel extruded gutters;
6. pack cells in stable order;
7. write the atlas image and versioned index together;
8. generate review boards and semantic measurements;
9. reject an index or image version mismatch.

The build must return byte-identical PNG and JSON output for identical sources and tool versions.

### 11.3 Atlas budget

- Keep one generated world atlas in this program.
- The default hard maximum is `1024×1024` RGBA, including gutters.
- The maximum decoded texture cost is about `4 MiB`.
- Atlas overflow is a build failure.
- A proposal to split atlases requires measured evidence and a new renderer review. It is not an automatic fallback.
- Stable public sprite IDs remain reachable. Generated internal variant IDs can change only with the art build and its semantic tests.

### 11.4 Runtime budget

- Keep the existing Skia atlas batches and depth order.
- Deterministic ground variants, transitions, and decals are resolved before or during compiled presentation-data creation, not as one React node per visual layer.
- This program can add no more than one static world-art batch.
- It cannot add a per-cell component, timer, random call, or simulation command.
- Culling includes the complete transparent bounds of a tall or multi-tile sprite.
- The Phase 22 maximum-load scene remains at least `60 FPS` and cannot regress median frame time by more than `10%` on the same machine, window, zoom, and camera.

## 12. Presentation data and determinism

The compiled map can gain a presentation-only index with:

- selected ground variant per tile;
- selected material-edge cell per tile;
- selected deterministic decal placements;
- roof material cells;
- complete visual bounds for culling.

This index is derived from the parsed map and art metadata. It cannot change:

- `blockedKeys`;
- `staticSolidOwnerByTile`;
- door state;
- interaction approaches;
- density metrics;
- location bindings;
- pathfinding;
- actor reservations;
- save data;
- replay or simulation random-number state.

Fresh start, save load, resize, zoom, map transition, and restart must produce the same presentation index for the same map and art revision.

## 13. Player-visible flows

### 13.1 Start and load

The new art appears on a fresh start and an existing compatible save without migration. Stable map, character, portrait, and public sprite IDs continue to resolve.

### 13.2 Enter every neighborhood

Shared materials, walls, roofs, objects, and character rules remain consistent. Each neighborhood keeps its separate palette and detail identity. Placeholder districts do not gain hidden story content.

### 13.3 Pan and zoom

At `1×`, `2×`, and `3×`, all cells remain crisp with no atlas bleed, softened edge, gutter line, or fractional-screen wobble. Native `1×` is the strict quality gate. Enlarged views support inspection but cannot hide a `1×` failure.

### 13.4 Walk

New character art preserves continuous movement, direction selection, two-frame feet, bounce, lean, shadow movement, curve safety, reservation behavior, and stable depth. Large art does not disappear at viewport edges.

### 13.5 Enter and leave a building

Roof art hides and restores on the same cells as before. Wall and door art remains aligned with collision. Exposed interiors retain clear material hierarchy.

### 13.6 Talk

The world character and portrait represent the same person. The conversation panel remains readable at every supported resolution and UI scale.

### 13.7 Resize and restart

Visual variants and decals do not move. Camera, pointer mapping, integer zoom, and saved presentation preferences retain the Phase 22 behavior.

## 14. Acceptance criteria

### 14.1 Art bible

The repository contains one tracked art bible with:

- target style and forbidden imitation rules;
- neighborhood palettes;
- semantic palette ramps;
- light and shadow direction;
- contour rules;
- material texture-density examples;
- transition examples;
- character proportions and identity rules;
- prop, wall, roof, vegetation, and landmark examples;
- good and rejected native-`1×` samples.

### 14.2 Terrain repetition

For every common material, generate a `12×12` board at `1×` and `3×`.

- Common natural materials use at least four variants.
- Structured materials use at least two variants or a coordinate-phased wear system.
- No unapproved one-cell stamp dominates the board.
- No visible checkerboard, diagonal cycle, or repeated `2×2` macroblock appears.
- The material still reads as one surface.

An automated distribution test supports this gate. A tracked native-`1×` visual review is also required because a good count does not prove a good pattern.

### 14.3 Transitions

- Every supported neighboring material pair appears on a transition board.
- A soft edge does not make a perfect rectangular line across the full cell.
- A built edge has a continuous curb, trim, plank end, or road border.
- A hard edge is explicitly declared and visually intentional.
- There are no transparent gaps, double-dark seams, or cross-cell gutter lines.

### 14.4 Character identity

- The protagonist, Linda, and generic resident pass first at native `1×`.
- All named character pairs differ by at least two documented non-color features.
- At least three body or torso silhouettes exist across the ten current visual sources.
- Front, rear, left, and right cells show the same identity.
- Both walk cells preserve readable foot exchange.
- Portrait and world matrices match hair shape, skin value, key facial feature, primary outfit, and accessory.

### 14.5 Scene hierarchy

At native `1×` in each neighborhood:

- a reviewer can find the protagonist, nearest door, and active interaction without labels;
- paths and open doorways remain visually open;
- ground details do not look collectible or solid;
- solid objects explain their footprints;
- the selected character remains the strongest local focus;
- floors, walls, roofs, objects, and characters remain separable in grayscale.

### 14.6 Collision and depth

- Existing compiled geometry tests remain unchanged unless the source geometry intentionally changes in a separate approved phase.
- Every solid cell has visible blocking art.
- Test each tall-prop class with the player in front and behind it.
- Test open doors, room entrances, roof hide, roof restore, and portals with the new cells.
- Test multi-tile objects for internal seams and correct depth anchor.

### 14.7 Atlas integrity

- Identical sources produce identical atlas and index bytes.
- Public sprite IDs remain stable and reachable.
- Every cell is inside bounds and has a one-pixel gutter.
- Transparent pixels have controlled RGB values and cannot bleed a neighbor color.
- Atlas and index versions match.
- The atlas is no larger than `1024×1024` RGBA.
- There is no filtering at any supported zoom or DPR.

### 14.8 Performance

- The packaged Phase 22 maximum-load scene remains at least `60 FPS`.
- Median frame time regresses by no more than `10%` against a same-machine, same-camera baseline.
- No more than one static render batch is added.
- Atlas decoded memory remains at or below about `4 MiB`.
- Responsive proof passes at `1280×720`, `1440×900`, `1920×1080`, `2560×1440`, and `1600×720`, at DPR `1` and `2` where the harness supports them.

### 14.9 Lifecycle and save compatibility

- Fresh start, compatible save load, map transition, resize, zoom, and app restart keep identical visual selections.
- No art-only phase increments `layoutRevision`.
- No art-only phase requires a save migration.
- A stale atlas or index fails closed with a clear build or boot error. It cannot silently draw the wrong cell.

## 15. Required review matrix

| Area | Required cases |
|---|---|
| Window | `1280×720`, `1440×900`, `1920×1080`, `2560×1440`, `1600×720` |
| Display density | DPR `1` and DPR `2` |
| World zoom | `1×`, `2×`, `3×` |
| Neighborhood | All four maps |
| Character state | Idle, walk, talk |
| Direction | Front, rear, left, right |
| Walk cell | Cell 1 and cell 2 |
| Building state | Outside, doorway, inside, roof restored |
| Lifecycle | Fresh start, loaded save, transition, resize, restart |
| Load | Standard scene and Phase 22 maximum-load scene |
| Color | Full color, grayscale, common color-vision simulations |

## 16. Smallest quality prototype

The first production proof uses the existing Sunward start composition and includes:

- protagonist;
- Linda;
- one generic resident;
- one outfit each;
- eight generated world cells each;
- one `40×44` portrait each;
- warm sand, dune grass, villa floor, spa stone, shallow water, and one roof material;
- one soft natural transition and one built transition;
- villa wall and door art;
- sofa, table, planter, palm, lamp, and one multi-tile landmark;
- deterministic micro-decals;
- fixed-camera before and after captures at `1×`, `2×`, and `3×`;
- ordered Phase 23 walking frames with full and reduced motion.

The prototype is successful only if it improves material depth and character identity at `1×` while keeping routes, collision, text, performance, and save behavior unchanged.

## 17. Evidence contract

New evidence goes under `artifacts/phase-24/art-quality/`. It cannot overwrite Phase 4, 19, 22, or 23 evidence.

Required evidence includes:

- original reference-analysis notes with no copied production assets;
- native-`1×` and enlarged-`3×` atlas review sheets;
- all-character direction, walk-cell, and portrait matrix;
- terrain repetition boards;
- material-transition board;
- multi-tile object seam board;
- wall, door, and roof board;
- fixed-camera before and after images;
- all four maps at `1×`, `2×`, and `3×`;
- responsive and DPR matrix;
- ordered movement frames;
- roof hide and restore frames;
- maximum-load performance report;
- deterministic atlas hashes and semantic art measurements;
- save-load and restart report.

Every screenshot records commit SHA, package provenance, map, camera, zoom, DPR, window size, and art revision.

## 18. Test strategy

### 18.1 Generator tests

- schema and command bounds;
- source ID uniqueness;
- stable packing order;
- deterministic PNG and JSON bytes;
- public ID reachability;
- gutter extrusion;
- transparent-pixel hygiene;
- material variant distribution;
- edge-mask coverage;
- multi-tile split continuity;
- character contour and foot-open rules;
- portrait and world identity tokens;
- atlas dimension and decoded-memory budget.

Old exact hashes that freeze the weak cells are replaced deliberately. New versioned hashes are paired with semantic tests. A hash change without an approved art-revision change fails.

### 18.2 Pure presentation tests

- stable visual hash across lifecycle events;
- no simulation PRNG use;
- no change to static solids, path routes, density, or save shape;
- material-neighbor edge selection;
- decal eligibility by material and area;
- culling bounds for tall and multi-tile sprites;
- stable depth order.

### 18.3 Player-visible tests

- native-`1×` identity and hierarchy review;
- `1×`, `2×`, and `3×` crispness;
- DPR `1` and `2` sampling;
- all four neighborhoods;
- walk, talk, roof, portal, restart, resize, and save-load flows;
- standard and maximum-load performance.

## 19. Failure behavior and rollback

- Invalid source art fails the build before it overwrites the last valid generated atlas.
- Atlas overflow fails with required width, height, cell count, and largest source IDs.
- An atlas-index mismatch blocks boot and identifies both versions.
- An unknown public sprite ID fails map compilation.
- A missing internal variant falls back only to that material's public base cell and emits a development error. Production qualification treats this as a failure.
- A failed transition mask falls back to the base material without changing collision. Production qualification treats this as a failure.
- A performance or `1×` readability failure rolls back the affected art family or presentation layer. It does not remove collision or change a save.
- Generated files are never the only editable source.

## 20. Main risks

1. Visual variants consume simulation randomness and break replay behavior.
2. Richer texture hides characters, paths, doors, or collision edges.
3. Too many dark lines reveal the tile grid.
4. Material variants break structural seams.
5. Multi-tile objects show split lines.
6. Tall art disappears because culling uses only the anchor cell.
7. Named variants overwrite hand-authored identity during regeneration.
8. Portrait and world art drift because they use separate identity data.
9. The atlas exceeds its texture or memory budget.
10. Roof art changes while roof ownership remains the boardwalk fallback.
11. Placeholder-district polish becomes an unapproved content expansion.
12. Exact hash tests protect old weak pixels instead of the new art contract.
13. An art reference becomes imitation instead of an original design.

## 21. Council questions

Fable 5, Opus 5, and Grok must review the same draft independently and answer:

1. Is the warm-noir pixel-diorama direction distinct, achievable, and suitable for the game's dark comedy?
2. Will the material-family, stable-variant, edge, and decal system remove visible tiling without creating runtime or memory problems?
3. Is sixteen orthogonal masks the correct first step, or does the prototype require a different transition method?
4. Do the character rules improve SI World toward HFM quality without requiring new cell size, side profiles, or runtime layers?
5. Are the `1024×1024`, one-atlas, one-extra-batch, and performance limits realistic?
6. Which acceptance gates are subjective, weak, contradictory, or missing?
7. Which part of the scope should be removed, deferred, or prototyped before broad implementation?
8. Can art-only changes remain fully separate from collision, saves, and deterministic simulation under this design?

Codex will verify each proposed finding against the repository. The final specification will accept only findings that are correct, in scope, and supported by evidence.
