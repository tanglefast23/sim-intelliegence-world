# Halcyra reference analysis

Status: Phase 26 measurement reference

## 1. Purpose

This analysis converts the supplied RimWorld screenshots and the existing HFM-derived assets into original Halcyra rules. It does not authorize copied art.

## 2. What the reference does well

### Scale and occupancy

- Characters are small enough to fit inside a dense settlement view.
- Buildings use many tiles, but rooms are not mostly empty.
- Furniture, walls, doors, fields, lights, rocks, and plants create intermediate scale.
- Open ground forms routes and work areas. It is not unused blank space.

### Material separation

- Floors, outdoor ground, walls, and roofs use different value groups.
- Large surfaces contain grouped variation.
- Transitions and edge wear break hard rectangular repetition.
- Objects use contours and contact shadows that separate them from the floor.

### Readable characters

- Each person has a simple strong silhouette.
- Hair, head shape, clothing mass, and equipment provide identity.
- The body does not need many animation frames to read as a person.
- Character contrast remains stronger than most ground texture.

### Depth and scene structure

- Walls and tall objects create outdoor and indoor rooms.
- Occlusion explains when an actor is behind or in front of an object.
- Light and shadow help group a scene without changing the simulation grid.

## 3. What the current Halcyra prototype lacks

- Ten base ground cells cover four `64x48` neighborhoods.
- Large surfaces repeat one full tile with little edge logic.
- Many regions have no intermediate-scale prop or material group.
- Current roof presentation uses the boardwalk cell as a general roof material.
- Current character sources contain useful identity layers, but their native-zoom contour and facial contrast need a later authored pass.
- Historical review generation is tied to old phase paths instead of an explicit current review root.

## 4. Why tiling lowers quality

Tiling is not the problem by itself. Uniform tiling is the problem.

A high-quality tile system uses:

1. several compatible base variants;
2. stable coordinate-phased structure for planks, slabs, or pavers;
3. transition cases at material edges;
4. sparse transparent decals;
5. grouped props and landmarks;
6. consistent lighting and contact shadows.

This keeps memory low because the map still references small atlas cells. It improves quality because the same cell is not visible as a repeated stamp.

## 5. Original Halcyra response

Halcyra will use a warm-noir island-diorama style instead of copying the reference look.

- Daylight sells a clean resort.
- Deep warm shade and small vice accents show the hidden economy.
- Sunward Villas uses planted edges, pale resort materials, water, and private service routes.
- Neon Crescent uses selective local light and worn entrances.
- Palm Exchange uses awnings and varied storefront modules.
- Harbor Authority uses heavier civic and industrial materials.

## 6. Character-art response

Keep the efficient HFM source-layer method:

- legs;
- torso and clothing;
- head and face;
- hair;
- accessory;
- optional held item.

Compile these layers into eight world cells and one portrait. Do not compose them each frame at runtime.

The later character pass should improve:

- outer contour consistency;
- skin, hair, and clothing value separation;
- hair silhouettes;
- one-pixel facial anchors;
- shoe motion in both walking frames;
- portrait-to-world identity match.

The front-body lateral method remains the first test. A mirrored three-quarter head and hair view is the first fallback. A complete side-body redraw is not the default.

## 7. Scene-density response

Use the supplied scale comparison as a relationship, not an exact copied measurement.

- A one-person path should usually have built or planted boundaries within a short visual distance.
- A room should contain functional furniture and circulation space, not a large empty floor rectangle.
- Large open areas need a clear use: beach, plaza, ferry work area, garden, or road.
- Decorative density cannot change collision or quests without authored map data.

## 8. Technical response

The Phase 26 atlas foundation keeps one RGBA atlas with:

- a hard `1024x1024` limit;
- a one-pixel owned extruded gutter;
- stable deterministic packing;
- a category forecast for all planned cells;
- exact PNG digest coupling to the runtime index;
- separate public and internal-review IDs;
- explicit evidence output under the current art program.

The planned ceiling is 634 cells and `714,744` raw packing pixels. The real packer must keep the projected bound under `80%` of `1024x1024` before broad authoring starts.

## 9. Review method

For each authored pass:

1. inspect native `1x` on dark and light neighbors;
2. inspect nearest-neighbor `3x` for pixel defects;
3. inspect one full Sunward scene for density and material repetition;
4. inspect solid boundaries, doors, and actor overlap;
5. compare baseline and enhanced performance from the same package and machine;
6. reject copied visual traits even when the technical result is strong.

## 10. Non-goals

- No traced reference pixels.
- No runtime paper-doll system.
- No full character side profiles in the first pass.
- No new Tier B map objects or interactions during the Tier B art pass.
- No atlas split without measured overflow evidence and a renderer review.
