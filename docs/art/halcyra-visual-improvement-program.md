---
date: 2026-08-13
status: proposed
topic: halcyra-visual-improvement
---

# Halcyra visual improvement program

## Decision

Halcyra should stay a minimal 2D simulation.

The target is not visual realism.

The target is premium authorship, strong atmosphere, and instant simulation clarity.

The game should feel like a warm-noir cousin of RimWorld. It should never look like a copy.

The shortest route forward is better composition and visible life. More texture is not the answer.

## Non-negotiable rule

Every improvement must preserve all four points:

1. The game stays fully 2D.
2. The world stays minimal at native `1x` zoom.
3. Simulation information stays clearer than decoration.
4. Halcyra keeps its original warm-noir resort identity.

Do not add 3D models, painted detail, global bloom, or dense prop clutter.

Do not copy another game's pixels, UI, silhouettes, or color layout.

## Review scope

This review used the canonical [Halcyra art bible](./halcyra-art-bible.md).

It also used a fresh web export from commit `44dc266`.

The game was captured headlessly at `1600x900` and device scale `1`.

The capture covered the intro and all four districts.

The district images use deterministic effect-fixture cameras.

They prove each map renders. They do not prove whole-district population behavior.

All game resources rendered. The local server logged one missing favicon request.

This score covers visible art and presentation. It does not score the full simulation depth.

## Current screenshots

### New game

![Current new-game screen](../../output/playwright/halcyra-review-2026-08-13/current-new-game.png)

### Sunward Villas

![Current Sunward Villas view](../../output/playwright/halcyra-review-2026-08-13/current-sunward-villas.png)

### Neon Crescent

![Current Neon Crescent view](../../output/playwright/halcyra-review-2026-08-13/current-neon-crescent.png)

### Saffron Bazaar

![Current Saffron Bazaar view](../../output/playwright/halcyra-review-2026-08-13/current-saffron-bazaar.png)

### Greywake Harbor

![Current Greywake Harbor view](../../output/playwright/halcyra-review-2026-08-13/current-greywake-harbor.png)

## Current rating: 5.9 out of 10

This compares Halcyra with a finished premium simulation at an AAA polish bar.

It does not compare Halcyra with early prototypes.

| Area | Weight | Score | Finding |
|---|---:|---:|---|
| Art direction | `20%` | `7.5` | Warm-noir island identity is clear and memorable. |
| Character art | `10%` | `7.5` | People read well and have strong silhouettes. |
| World readability | `15%` | `7.0` | Routes, actors, and major surfaces remain clear. |
| Composition and density | `20%` | `4.0` | Large spaces lack purpose, rhythm, and focal hierarchy. |
| Lighting and depth | `10%` | `4.5` | Local mood exists, but forms still feel flat. |
| Interface | `10%` | `6.0` | The UI is coherent, but it covers too much world space. |
| Motion and visible reaction | `5%` | `5.0` | Ambient effects help, but most spaces do not look active. |
| Finish consistency | `10%` | `4.5` | The intro, maps, and districts show different polish levels. |

The raw weighted result is `5.85`. It rounds to `5.9`.

This is a promising mid-production presentation.

It is not yet a premium finished presentation.

### What already works

- The characters are the strongest visual asset.
- Each district has a recognizable base palette.
- The world stays readable at `1x`.
- The UI uses one consistent visual language.
- Sunward Villas already suggests a social simulation.
- The new-game screen has a strong hook and clear tone.

### What holds the score down

- Large rectangles dominate every district.
- Empty interiors look unfinished, not minimal.
- Evenly spread ground marks create noise without meaning.
- Buildings share similar box shapes across districts.
- Entrances rarely become strong visual focal points.
- Neon Crescent changes color more than spatial character.
- Saffron Bazaar does not yet feel commercially active.
- Greywake Harbor does not yet feel operational.
- Most district views show too little visible social life.
- The intro says `17:30`, while play begins near `08:00`.
- The flat intro backdrop does not match the pixel-diorama world.
- Small interface text becomes hard to scan at desktop size.

## Minimalism is not emptiness

Minimalism removes marks that do not help.

Emptiness removes evidence that a place is used.

Halcyra needs fewer isolated props and more purposeful groups.

A bench, lamp, planter, and two people can define a social corner.

Twenty scattered decals cannot.

Each view should contain:

- one clear focal shape;
- two to four purposeful prop groups;
- one obvious route through the view;
- visible people doing understandable things;
- enough quiet ground for the scene to breathe.

Do not use a raw prop count as the goal.

## Research: what loved simulation games teach

Review percentages below are Steam snapshots from August 13, 2026.

They show broad player love. They do not prove one visual choice caused that love.

| Game | Steam signal | Useful lesson for Halcyra |
|---|---|---|
| [Factorio](https://store.steampowered.com/app/427520/Factorio/) | `98%` of `116,803` English reviews | Simple parts become rich when every part shows a system. Repetition needs function. |
| [RimWorld](https://store.steampowered.com/app/294100/RimWorld/) | `97%` of `118,391` English reviews | Clear pawns, rooms, needs, and events let players read stories immediately. |
| [Oxygen Not Included](https://store.steampowered.com/app/457140/OxygenNotIncluded/) | `95%` of `49,202` English reviews | Expressive people and visible material states make complex systems approachable. |
| [Against the Storm](https://store.steampowered.com/app/1336490/Against_the_Storm/) | `95%` of `18,801` English reviews | Strong biome mood and focal lighting make repeated play spaces feel authored. |
| [Dwarf Fortress](https://store.steampowered.com/app/975370/Dwarf_Fortress/) | `94%` of `24,046` English reviews | Simulation depth creates value. Pixel art should expose that depth, not compete with it. |
| [Prison Architect](https://store.steampowered.com/app/233450/Prison_Architect/) | `88%` of `33,992` English reviews | Simple 2D rooms work when crowd flow and consequences remain visible. |

### Shared pattern

These games make state visible.

Workers carry things. Rooms show purpose. Bottlenecks appear. People react.

The world becomes attractive because it is understandable and alive.

Halcyra should borrow that principle.

It should not borrow their surface art.

## Recommended approach

Use authored simulation rooms.

An authored simulation room is a small place with one visual purpose.

It combines a landmark, a route, useful props, and scheduled people.

Examples include a villa patio, nightclub door, market corner, and cargo checkpoint.

This approach gives better results than a map-wide detail pass.

It also fits the current atlas, maps, schedules, and renderer.

No renderer rewrite is needed.

## Improvement order

### 1. Join the intro to the real game

This is the highest player-facing priority.

- Make the arrival time match the first playable time.
- Use the same warm-noir pixel grammar on both screens.
- Reuse atlas materials and characters in the intro vista.
- Carry the same sun direction into the first world view.
- End the intro on the exact first playable composition.
- Keep the name form and current strong copy.

The intro should feel like the first camera shot, not separate marketing art.

### 2. Build one hero route through Sunward Villas

Sunward is the first quality promise.

The route should run from arrival to villa, patio, spa, and public beach.

- Give each stop one large readable shape.
- Put residents near believable social anchors.
- Break huge roof masses with meaningful edges and service gaps.
- Make villa rooms read from furniture groups, not labels.
- Keep planted borders dense and walking lanes calm.
- Use warm local light at social areas.

Do not fill every lawn tile.

### 3. Turn Saffron Bazaar into a real market

Saffron Bazaar has the largest gap.

Its current salmon ground and cross-shaped path feel like a blockout.

- Make Sunset Courtyard the district landmark.
- Enlarge the fountain or canopy into one dominant shape.
- Group stalls into short market rows.
- Use awnings to frame routes and shop entrances.
- Add delivery edges behind customer areas.
- Schedule visible buyers, sellers, and diners.
- Reduce empty ground without blocking clear paths.

Color alone cannot carry this district.

### 4. Make Greywake Harbor look operational

The harbor needs work stories.

- Create a clear ferry route and a separate cargo route.
- Group crates, pallets, carts, and safety marks by task.
- Use one crane, ferry, or warehouse face as the main landmark.
- Put workers near cargo and passengers near the terminal.
- Preserve wide vehicle and pedestrian lanes.
- Use contact shadows to ground heavy objects.
- Reduce repeated open concrete where nothing happens.

Do not turn the yard into random industrial clutter.

### 5. Give Neon Crescent spatial nightlife

Neon Crescent already has a strong palette.

Its next need is form, not more neon.

- Make each venue entrance distinct at `1x`.
- Create short queues and guarded thresholds.
- Use light pools around doors and signs.
- Keep most walls and pavement neutral.
- Cut the evenly scattered cyan and magenta marks.
- Give club interiors bars, seating islands, and service edges.
- Use parked cars and alleys to define public and risky space.

Neon must stay an accent.

### 6. Make people carry the simulation

The cast is already good enough.

Do not start another full character redraw.

- Place scheduled people where their activity makes sense.
- Make facing direction support conversations and tasks.
- Show short state-linked reactions near important events.
- Keep speech and status marks temporary.
- Give each ordinary-hour hero view several visible people.
- Avoid fake background crowds that do not exist in state.

The best visual improvement is often one believable activity.

### 7. Add depth with the existing lighting system

Reuse the current atmosphere and district-lighting code.

- Keep the upper-left light direction everywhere.
- Add attached contact shadows to tall props.
- Use light, base, and shade planes on major forms.
- Darken service routes without hiding walkability.
- Use small warm or neon pools around important entrances.
- Keep effects behind characters and interaction cues.

Do not add a second lighting engine.

### 8. Let the world occupy more of the screen

The UI is consistent, but two large panels cover the map.

- Collapse the self card when no special detail is needed.
- Keep full cards for selected residents and active events.
- Preserve time, money, health, and energy at a glance.
- Raise the smallest persistent text to a readable size.
- Use one compact location entrance message.
- Keep settings secondary until opened.

Do not hide important simulation state for visual cleanliness.

### 9. Polish motion only where state changes

Motion should explain cause and effect.

- Keep water glints, steam, insects, and restrained sparkles.
- Add brief door, pickup, exchange, and reaction feedback.
- Let important lights pulse slightly, not constantly flash.
- Use district ambience to support active spaces.
- Keep the screen calm when nothing important happens.

Avoid weather systems and full-screen particles for now.

## District target sheet

| District | Keep | Improve | Avoid |
|---|---|---|---|
| Sunward Villas | greenery, warm walls, visible residents | first-hour route, furniture groups, patio life | filling every lawn gap |
| Neon Crescent | dark base, controlled magenta and cyan | entrances, queues, alleys, local light | full-screen neon and colored pavement noise |
| Saffron Bazaar | coral warmth, central courtyard | stalls, awnings, vendor activity, landmark scale | one flat salmon carpet |
| Greywake Harbor | concrete, teal water, heavy forms | work zones, cargo stories, ferry hierarchy | scattered industrial decals |

## Quality gates

### Gate A: reach 7 out of 10

- Intro and first playable view match.
- No district hero view reads as a placeholder.
- Every district has one dominant landmark.
- Ordinary hours show believable visible activity.
- Large empty interiors have clear room purpose.
- Ground noise is reduced.

### Gate B: reach 8 out of 10

- All four districts have several authored simulation rooms.
- Lighting creates a clear focal hierarchy.
- Character activity matches schedules and locations.
- UI text remains readable at common desktop sizes.
- Every transition preserves the district's visual promise.
- Major interactions have immediate visual feedback.

### Gate C: approach 9 out of 10

- Every major time phase has an intentional composition.
- Panels, conversations, and world views feel like one product.
- Repeated assets are hidden through meaningful placement.
- No effect weakens simulation readability.
- The first hour looks consistently premium.
- Later districts maintain the same standard.

A `10` is not a useful production target.

The final point is subjective and can cause endless rework.

## Screenshot acceptance test

Use the current dev harness and headless web capture.

Do not build a new screenshot application.

For each improvement loop:

1. Capture the same state, camera, time, and window before editing.
2. Capture the same view after editing.
3. Check the view at native `1x` first.
4. Check grayscale focal hierarchy.
5. Check `1280x720` and `1600x900` layouts.
6. Confirm characters, routes, doors, and interactions stay clear.
7. Confirm no console or resource errors appear.

Each accepted hero view should pass five questions:

- Can I name the district in two seconds?
- Can I find the main route in two seconds?
- Can I find the important person or event in two seconds?
- Can I tell what this place is used for?
- Does the view still breathe?

## What not to build

- No 3D renderer.
- No renderer rewrite.
- No high-resolution texture pack.
- No procedural clutter generator.
- No global post-processing stack.
- No dynamic weather system.
- No full-cast redraw.
- No second UI framework.
- No detailed object that disappears at `1x`.
- No copy of RimWorld's interface or art.

## First implementation slice

Start with the arrival-to-villa route.

It touches the first screen, first district, characters, light, and UI continuity.

Limit the slice to these outputs:

1. One matched intro and first-playable composition.
2. One improved villa interior.
3. One improved patio social room.
4. One state-driven resident activity cluster.
5. One before-and-after screenshot set.

That slice will prove the direction without changing the game's 2D foundation.
