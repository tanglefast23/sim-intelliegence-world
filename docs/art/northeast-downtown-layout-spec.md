# Northeast Downtown Layout Spec

## Target

`northeast_downtown` is an active neon nightlife district. It must reach the Northwest environment quality bar of `9.7/10` while keeping its own city identity. This revision includes the reconciled Grok 4.5 and Claude Opus 5 audits.

## Binding 64x48 layout

All bounds are inclusive.

| Element | Bounds or line | Bound sprite or wall material | Purpose |
|---|---|---|---|
| Default outdoor lot | full map | `tile.city-lot` | dark service concrete between the designed blocks |
| North street | `x0-63, y0-4` | `tile.dark-asphalt` | five-tile upper road |
| Club sidewalk block | `x5-31, y5-23` | `tile.neon-paver` | cement walk around the club, with a four-tile front walk |
| Club shell | `x8-29, y7-19` | `downtown` wall + `tile.neon-floor` | nightlife venue |
| Club door | `x19, y19`, opening `club-strip-entrance` | `tile.open-door`, state `open` | recessed horizontal doorway without added collision |
| Arcade sidewalk block | `x37-63, y5-23` | `tile.neon-paver` | cement walk around the northeast background venue |
| Arcade shell | `x40-59, y7-19` | `downtown` wall + `tile.neon-floor` | non-interactive urban building mass |
| Arcade door | `x50, y19`, opening `arcade-row-entrance` | `tile.open-door`, state `open` | recessed horizontal doorway without added collision |
| Main boulevard | `x0-63, y24-28` | `tile.dark-asphalt` | five-tile east-west road |
| Southwest sidewalk block | `x3-30, y29-43` | `tile.neon-paver` | cement walk around the southwest background venue |
| Studio shell | `x7-26, y32-40` | `downtown` wall + `tile.neon-floor` | non-interactive urban building mass |
| Studio door | `x17, y40`, opening `studio-row-entrance` | `tile.open-door`, state `open` | recessed horizontal doorway without added collision |
| Avenue | `x32-36, y0-47` | `tile.dark-asphalt` | five-tile north-south road |
| Market sidewalk block | `x37-63, y29-43` | `tile.neon-paver` | cement walk around the market, with a three-tile front walk |
| Market shell | `x39-56, y31-40` | `downtown` wall + `tile.neon-floor` | night market venue |
| Market door | `x48, y40`, opening `night-market-entrance` | `tile.open-door`, state `open` | recessed horizontal doorway without added collision |
| Market street | `x0-63, y44-47` | `tile.dark-asphalt` | four-tile one-way edge road |
| West portal walk | `x0-7, y20-23` | `tile.neon-paver` | connects the club block to the west crossing |

Apply ground in this order: default lot, sidewalk rectangles, asphalt rectangles, painted road cells, and interior floors. A later region can overwrite only the bounds declared above.

## Material contracts

- `tile.city-lot` is the dark service-concrete family. Author and bind `tile.city-lot`, `tile.city-lot-b`, and `tile.city-lot-c` with grouped patches, cracks, and quiet areas. It must not look like a flat fill or repeated dot field.
- `tile.neon-paver` is the grey-blue cement sidewalk family. It ships four variants. Its `built` edge and priority `95` own the visible transition against `dark-asphalt` at priority `90`.
- The asphalt family binds `tile.dark-asphalt`, `tile.dark-asphalt-b`, and `tile.dark-asphalt-c`. All three base cells contain texture only. Remove stale baked yellow lines from the source cell. Road paint is authored separately.
- The interior family binds `tile.neon-floor`, `tile.neon-floor-b`, and `tile.neon-floor-c`. Every variant has a dark grout grid and restrained wear inside each tile.
- Sidewalk base luminance is at least `18/255` above the asphalt and lot bases. Interior grout differs from the floor center by at least `12/255`; the grid and hue keep it separate from asphalt at native `1x`.
- Downtown roads are unpainted. Do not bind crosswalk or center-line ground overlays. The road geometry remains readable from the dark-asphalt field, sidewalks, parked cars, and building frontage.
- All automatically scattered downtown decal families are passable-only. Remove `tile.decal-neon-planter` from `neon-street-life` and `neon-interior-life`. Solid planters can enter this district only through explicit `objects[]` placements.
- The sidewalk-owned curb must form one continuous edge on the road boundary. Reject a double curb, an inward curb, or a missing curb at native `1x`.

## Road and pedestrian network

The pedestrian network is continuous through cement sidewalks and marked asphalt crossings. It is not a claim that cement covers the crossings.

- Keep the club door path clear through `x18-20, y18-30`.
- Keep the arcade door path clear through `x49-51, y18-30`.
- Keep the studio door path clear through `x16-18, y39-47`.
- Keep the market door path clear through `x47-49, y39-47`.
- Keep the south-transfer path clear through `x32-36, y42-43` and `x32-33, y44-47`.
- Keep the west-transfer path clear through `x0-2, y20-29`.
- West route: `x1-2, y24-28`. It joins the west portal and staging tile to both boulevard sidewalks without painted bars.
- Club route: `x18-20, y24-28`. It joins the club front to the south boulevard walk without painted bars.
- Arcade route: `x49-51, y24-28`. It joins the arcade front to the market-side boulevard walk without painted bars.
- Avenue crossing: `x32-36, y29-30`. It joins the south boulevard walk to the market sidewalk.
- The avenue routes at `x32-36, y29-30` and `x32-36, y42-43` remain passable but have no painted crossing.
- South portal route `x32-33, y44-47` reaches the existing `to-docks` portal at `x32,y47` and staging tile at `x32,y46` without painted bars or touching yellow marks.
- Studio route `x16-18, y44-47` extends the studio entrance route to the south edge without painted bars.
- Market route `x47-49, y44-47` extends the market entrance route to the south edge without painted bars.
- North-street center marks occupy `y2` on `x0-29` and `x39-63`.
- Boulevard center marks occupy `y26` on `x4-16`, `x22-29`, `x39-47`, and `x53-63`.
- Avenue center marks occupy `x34` on `y5-22` and `y31-41`.
- The four-tile market street is one-way and has no center mark.
- Center marks stop before crossings and road intersections. Crossings overwrite road texture and never overwrite a sidewalk.

## Street-life placement

- Place ten solid two-tile parked cars parallel to horizontal curbs: boulevard north curb at `x7-8`, `x24-25`, `x40-41`, and `x55-56` on `y24`; boulevard south curb at `x9-10`, `x40-41`, and `x55-56` on `y28`; market-street north curb at `x7-8`, `x39-40`, and `x54-55` on `y44`.
- Alternate cyan and coral cars. Keep each footprint at least two tiles from a crossing, portal, staging tile, or entrance path.
- Club-front paired exterior signs sit at `x17, y20` and `x21, y20`. Alternating cyan and magenta lamps can use `x11,15,23,27, y20`.
- Arcade-front paired exterior signs sit at `x48, y20` and `x52, y20`. Alternating lamps use `x41,45,55,59, y20`.
- Studio-front paired exterior signs sit at `x15, y41` and `x19, y41`. Alternating lamps use `x9,12,22,25, y41`.
- Market-front paired exterior signs sit at `x46, y41` and `x50, y41`. Alternating cyan and magenta lamps can use `x40,43,53,56, y41`.
- Solids can use only the building-side front rows: club and arcade `y20`, studio and market `y41`. Keep their curb-side walking spines clear at `y21-23` and `y42-43`.
- Cluster passable wet reflections, litter, manholes, drain marks, and light pools near curbs and entrances. Keep quiet gaps between clusters. Do not distribute details uniformly.

## Collision

- Parked cars, signs, street lamps, counters, benches, large planters, trees, and large bushes are solid.
- Puddles, light pools, litter, flowers, grass, leaves, small stones, manholes, road marks, and crossings are passable.
- Both sides of every wall opening stay clear of generated solid vegetation or planters.
- No solid can occupy a protected door or transfer path, either two-row sidewalk spine, any crossing, any portal, or any staging tile.
- Tests must prove the eight painted crossings and all four sidewalk spines remain connected after all solid footprints are applied.

## 9.7 screenshot acceptance

At native `1x`, the final captures must visibly prove:

1. One pedestrian network links four building fronts, the west portal, and the south portal through cement walks and eight painted crossings.
2. Asphalt reads as a road without neon: road proportions, one continuous curb edge, correct center marks, and intersections are clear.
3. Every building front has a building-side furniture row and at least two open curb-side walking rows.
4. Ten parked cars sit parallel to the curbs without blocking a crossing, entrance, portal, or staging tile.
5. Alternating cyan and magenta street lamps and paired exterior signs frame both entrances.
6. Downtown walls, corners, recessed doors, and rectangular handles meet the established Northwest wall and door bar.
7. Dark interior floors show a visible textured grid that stays separate from cement, service concrete, and asphalt.
8. Service concrete, sidewalk, asphalt, and interior floors use grouped texture and enough variants to avoid a repeated checker, dot field, or flat fill.
9. Wet reflections, litter, manholes, drains, and light pools form natural clusters without blocking routes.
10. Live renderer, route, collision, atlas, and type tests pass. Tests assert eight passable crossings, ten solid cars, alternating lamp colors, four clear spines, valid portals, and ground-layer road paint.

Required native screenshots:

- `artifacts/terrain-redesign/northeast/final/overview-1x.png`
- `artifacts/terrain-redesign/northeast/final/club-front-1x.png`
- `artifacts/terrain-redesign/northeast/final/market-front-1x.png`

Score the exact screenshots beside the full RimWorld reference and the Northwest final screenshot. Do not score from memory or from an enlarged crop.
