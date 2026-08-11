# Halcyra art bible

Status: Phase 29 full-cast contract

## 1. Style target

Halcyra uses an original warm-noir pixel-diorama style.

- The island looks attractive at first sight.
- Warm sun, clean water, and inviting businesses sell the public image.
- Deep shade, worn service routes, guarded doors, and selective neon show the hidden vice economy.
- The result must stay readable at native `1x` zoom.
- The art must not copy another game's shapes, palette, texture, or interface.

## 2. Fixed scale

- One world tile is `32x32` pixels.
- One world character cell is `24x30` pixels.
- One portrait cell is `40x44` pixels.
- World zoom is exactly `1x`, `2x`, or `3x`.
- All final placement is on whole screen pixels.
- Runtime sampling is nearest neighbor.
- Source layers compile into flat atlas cells before play.

## 3. Light and depth

- Primary light comes from the upper left.
- Top and left edges can use one lighter value.
- Bottom and right edges can use one darker value.
- Contact shadows sit on the lower-right side of a solid object.
- A cast shadow can extend farther only when the object is tall enough to justify it.
- Do not put independent light directions in adjacent cells.
- Night lighting uses small local pools. It does not recolor every object with saturated neon.

Depth order remains:

1. ground base;
2. ground transition;
3. ground decal;
4. low prop and contact shadow;
5. character and tall object;
6. wall and door face;
7. roof and canopy;
8. temporary effect.

## 4. Contours

- Use a dark warm contour, not pure black, for ordinary forms.
- Keep the outer silhouette stronger than interior seams.
- Use one-pixel contour steps. Avoid noisy single pixels around smooth shapes.
- A solid object's lower edge must be easy to find because it supports collision readability.
- Do not outline every ground variation. Ground must stay behind actors and objects.
- Transparent pixels must have RGB `0,0,0`.

## 5. Palette system

Use compact material families. A family contains a base, light, shade, deep contour, and one restrained accent.

### Island daylight

| Role | Direction |
|---|---|
| Sun | pale amber, low saturation |
| Sand | warm ochre and tan |
| Stone | warm gray with a small olive bias |
| Water | muted teal, not electric blue |
| Foliage | dusty green with yellow-green sun edges |
| Wood | amber brown with dark umber seams |

### Warm noir

| Role | Direction |
|---|---|
| Deep shade | brown-violet or blue-charcoal |
| Vice accent | magenta, red-orange, or cyan in small areas |
| Civic accent | muted brass and cold gray |
| Police accent | dark navy with a restrained pale-blue mark |
| Warning | dirty amber or muted red |

Rules:

- One object family should use no more than five main values before small identity accents.
- Saturated accents must occupy less area than neutral material colors.
- UI colors do not define world-material colors.
- Character skin, hair, and clothing values must remain separate in shade.

## 6. Material grammar

Each shipped material family needs:

- at least three base variants when the material covers a large area;
- declared `soft`, `built`, or `none` edge behavior;
- a stable coordinate rule for structured patterns;
- restrained decals that do not change collision or gameplay state;
- one tested native-zoom sample on both a light and a dark neighbor.

### Sand

- Use broad value groups, small ripples, and sparse pebbles.
- Avoid evenly spaced dots.
- Sand meets water with a soft edge.
- Sand meets a built floor with a controlled built edge.

### Wood and boardwalk

- Planks continue across tile boundaries by coordinate phase.
- Seams use long grouped lines, not a full square grid on every tile.
- Add small wear near doors and traffic lanes.

### Stone, paver, and concrete

- Use grouped slabs or pavers with stable phase.
- Put dirt and chips near edges and contact points.
- Do not cover the full surface with uniform grain.

### Asphalt

- Keep the base low contrast.
- Use rare patched areas, drainage wear, and tire marks.
- Road marks must stay legible above texture.

### Water

- Use slow grouped bands and rare light glints.
- Do not animate every tile independently.
- The shoreline edge must read at `1x`.

## 7. Buildings, walls, and roofs

- Wall faces must show thickness and a stable lower contact edge.
- Corners and joins use generated adjacency cases.
- Doors must remain clear in open and closed states.
- Roofs use district-specific material families. They must not all reuse boardwalk art.
- Roof edges need one visible overhang or fascia line.
- Interior floors must not visually merge with outside ground.
- Collision remains simulation data. Art supports it but does not create it.

## 8. Props and landmarks

- Small props can fit one tile. Large props are composed first, then split into atlas cells.
- Multi-tile seams must be invisible after composition.
- Tall props declare an anchor tile and full transparent bounds.
- A character must pass behind the upper area and in front of the lower area when the scene requires it.
- Contact shadows must touch the prop. Floating shadows are rejected.
- A landmark needs one clear large shape before micro-detail.

## 9. Character proportions

- Keep the current `24x30` cell and eight walking cells.
- The head and hair own the clearest identity silhouette.
- Torso, clothing block, and accessory give a second identity signal.
- Feet must change in both walking frames.
- Lateral movement keeps the current front-body method until a native-zoom test proves it unclear.
- If lateral identity is unclear, add one mirrored three-quarter head and hair view before a full side body.
- Do not reduce face contrast below native-zoom readability.
- Portrait and world sprite must share hair, skin, clothing, and accessory identity tokens.

## 10. District identity

### Sunward Villas

- relaxed beach-resort materials;
- warm stone, pale wood, fabric shade, clean water, dense planted edges;
- hidden service doors and darker private paths add the noir layer.

### Neon Crescent

- dark pavement, controlled neon pools, worn entrances, bar and club signs;
- neon is an accent, not a full-screen wash.

### Palm Exchange

- shaded shopping walks, awnings, market signs, varied storefront materials;
- use repeated commercial modules with identity accents.

### Harbor Authority

- heavy concrete, metal, ferry equipment, civic brass, police navy;
- larger solid forms and controlled open work zones.

## 11. Density

- A playable area must not look like an empty grid.
- Use building mass, planted edges, paths, small material changes, and prop groups to form outdoor rooms.
- Keep main routes wide enough for pathfinding and click targets.
- Dense art cannot add a solid or an interaction without map data.
- Tier B districts receive art upgrades only on existing placements in this program.

## 12. Good sample rules

A good sample:

- reads at native `1x` without zoom help;
- has one clear focal shape;
- keeps characters separate from the ground;
- uses grouped texture instead of uniform noise;
- shows the upper-left light direction;
- preserves solid-object and door readability;
- stays coherent next to two neighboring tiles.

## 13. Rejected sample rules

Reject a sample that has any of these defects:

- a visible repeated checker or dot field;
- texture stronger than collision or route cues;
- outlines on every ground mark;
- different light directions in one scene;
- a character face that disappears at `1x`;
- a prop that appears to float;
- a multi-tile seam through the main shape;
- neon over most of the image;
- a copied silhouette, palette, texture, or interface from a reference game.

## 14. Imitation limits

Reference games can teach scale, density, contrast, depth order, and review methods. They cannot supply production pixels.

- Do not trace screenshots.
- Do not copy named material textures.
- Do not copy a character silhouette or face design.
- Do not copy UI framing, icons, fonts, labels, or color layout.
- Keep Halcyra's warm-noir resort identity and HFM-derived character source method original.

## 15. Review gate

Every changed cell must appear on a review board at native `1x` and nearest-neighbor `3x`. Review it on dark and light backgrounds. A generated-pixel change requires an `artRevision` bump and a new revisioned pixel baseline in the same phase.

## 16. Phase 28 prototype family ledger

This ledger is the source contract for the hard Sunward prototype. All entries use upper-left light, a warm dark contour, whole pixels, and nearest-neighbor sampling.

### 16.1 Characters

| Family | Primary shape | Second non-color feature | Portrait match | Direction rule |
|---|---|---|---|---|
| Protagonist | swept side-part hair | diagonal gold strap | hair, teal shirt, strap, skin, and face marks match | front body stays; feet move laterally; rear keeps hair mass and strap-free back |
| Linda | long side hair columns | paired gold earrings | hair columns, coral dress, earrings, skin, and mouth match | hair columns and earrings survive front and lateral cells; rear keeps the long hair mass |
| Generic resident | high swept quiff | wide glasses | quiff, glasses, blue shirt, skin, and face marks match | quiff and glasses survive front and lateral cells; rear keeps the asymmetric hair mass |

Source margins stay open on the top, left, and right. The bottom row stays open under world-sprite feet. A one-pixel outward contour is generated after layer composition. Full side profiles are not used because the native `1x` prototype keeps all three identities readable.

### 16.2 Materials

| Family | Ramp | Density | Edge | Variant rule | Good native sample | Reject |
|---|---|---|---|---|---|---|
| Warm sand | pale amber, tan, ochre, muted umber | low | soft | four broad ripple and pebble variants | grouped ripples with open calm areas | even dots or a one-cell stamp |
| Dune grass | sand, dusty green, deep leaf green | high in small clusters | soft | four irregular planted clusters | clustered blades with visible sand | a full green carpet or checker |
| Villa floor | pale amber wood, umber seam | medium | built | two coordinate-phased board patterns | long board groups that continue visually | a dark square grid |
| Spa stone | warm sage-gray, pale edge, deep joint | low | built | two coordinate-phased slab patterns | grouped slabs with quiet centers | uniform grain on every pixel |
| Shallow water | muted teal, pale glint, deep band | medium | soft | four slow horizontal band variants | calm bands with rare glints | electric blue or noisy waves |

The soft transition uses broken triangular edge groups. The built transition uses a continuous light, mid, and shade curb. Both families provide masks `1` through `f`; the review board covers straight, inner, outer, saddle, island, strip, unequal-priority junction, and equal-priority tie cases.

### 16.3 Building and roof

| Family | Shape and material | Contact or edge cue | States |
|---|---|---|---|
| Villa wall | warm pale stucco on a brown-gray core | darker lower and right faces show thickness | all 16 orthogonal joins |
| Villa door | amber timber panels with brass detail | dark threshold remains readable | open, closed-unlocked fixture, closed-locked fixture |
| Sunward roof | terracotta groups with pale fascia | dark five-pixel overhang and light fascia | base, edge, corner |

### 16.4 Props, vegetation, and landmark

| Family | Focal shape | Depth and collision cue | Multi-tile rule |
|---|---|---|---|
| Sofa | long rose cushion and two arms | dark lower cushion and feet | compose the `2x1` object, then split |
| Table | long amber top with two pale place settings | dark legs touch the lower edge | compose the `2x1` object, then split |
| Planter | terracotta box with three leaf masses | dark lower pot edge | one cell |
| Palm | wide dusty-green crown over one narrow trunk | trunk reaches its anchor and uses a dark base | one tall cell |
| Lamp | small amber lantern on a charcoal post | broad dark foot marks the blocker | one tall cell |
| Fountain landmark | pale stone square, teal basin, brass center | dark outer rim and lower band define the footprint | compose the `2x2` object, then split |

The sofa, table, palm, lamp, and fountain are tall-prop review classes. Each needs player-in-front and player-behind proof. Contact shadows stay attached to the object. Ground decals never become solids or interactions.

## 17. Phase 29 full-cast identity ledger

All ten source files are authoritative. Each row has one shape that survives front, rear, left, and right generation. The second feature gives a separate non-color signal. Empty means the character has no hat or held item; do not add an item only to increase difference counts.

| Character | All-direction identity feature | Second feature | Hair or hat | Glasses | Outfit or accessory | Held item |
|---|---|---|---|---|---|---|
| Devon Price | compact flat-top | broad epaulet jacket | all directions | none | jacket all directions | none |
| Elise Moreau | curled side hair | asymmetric temple ribbon | all directions | front and lateral | ribbon all directions | none |
| Generic resident | high swept quiff | wide glasses | all directions | front and lateral | blue shirt all directions | none |
| Linda | long side hair | paired earrings | all directions | none | earrings front and lateral | none |
| Mina Park | straight side hair | right-side bag | all directions | front and lateral | bag all directions | none |
| Priya Nair | high center bun | left scarf tail | all directions | none | scarf all directions | none |
| Protagonist | swept side hair | diagonal chest strap | all directions | none | strap front and lateral | none |
| Rafael Cruz | cropped textured hair | double shoulder band | all directions | none | bands all directions | none |
| Sora Tan | rounded bob | paired sleeve tabs | all directions | front and lateral | tabs all directions | none |
| Tomas Reed | low side-part | square headphones | all directions | none | headphones all directions | none |

The cast keeps the generated rear method and front-body lateral method. Phase 29 did not need the three-quarter-head fallback. Review `full-cast-identity-1x.png` before the scaled board. The `3x` board is inspection help, not proof of native clarity.

## 18. Phase 30 complete Sunward family ledger

Phase 30 completes only art that the authoritative `northwest_residential` map already uses. The map source SHA-256 stays `a831fbbe8f3a9d379a15aaa5be81fb17b3c2248cfde697e4d6e9bd7867386982`. No room, wall run, object placement, solid footprint, interaction, route, or story content changes.

### 18.1 Materials and ground detail

| Family | Public variants | Native rule | Reject |
|---|---:|---|---|
| Warm sand | 4 | short, irregular ripple groups with quiet space and rare pebbles | a dominant diagonal cycle, checker, or uniform noise |
| Villa floor | 4 | warm horizontal plank groups with controlled board-length and highlight changes | square grid, broken seams, or texture that competes with a character |
| Plaza paver | 2 | pale masonry courses with small, offset wear marks | one-cell stamp or high-contrast grout |
| Boardwalk | 2 | aligned vertical boards with continuous horizontal construction seams | a variant that breaks a shared seam or creates a false blocker |

The `sand-traces` presentation family can select the shell decal. All decals stay non-solid and non-interactive. Material selection uses a deterministic avalanche mix and rejects identical `2x2` blocks and diagonal runs longer than four cells on the fixed warm-sand review board.

### 18.2 Villa shell and openings

| Family | Required visual mass | Opening or state rule |
|---|---|---|
| Villa walls | pale stucco face, terracotta band, dark core, and lower contact shadow | all 16 unique adjacency cells keep one-cell geometry and show at least 600 opaque pixels |
| Villa doors | timber panel, brass detail, and dark threshold | open, closed-unlocked, and closed-locked states use the same one-cell opening |
| Sunward roof | grouped terracotta courses, pale fascia, and controlled wear | base, edge, and corner remain presentation-only and keep the existing roof group |

Villa wall source modules are local to the `villa` palette. Downtown, commercial, and civic wall pixels stay at revision 3 until their Tier B phase.

### 18.3 Existing props and signs

Beds, sofas, tables, counters, spa signs, market signs, lamps, planters, and palms use the warm-noir resort palette. Each solid footprint offset must have a render part at the same offset with at least 128 visible pixels. Decorative overhangs can use transparent pixels, but they cannot add collision or close a walk lane.

Review all changed cells on `sunward-architecture-1x.png` first. The `3x` board is only an inspection aid. Review the four material boards at native size before the scaled copies.
