---
date: 2026-08-11
topic: full-cast-character-identity-rebuild
---

# Full-Cast Character Identity Rebuild

## What We Are Building

Superseded by the Phase 33 HFM full-cast contract. One compact look record generates each person's `24x30` world cells and `24x29` portrait. Every production person has one exaggerated, slightly goofy signature shape and one coded supporting feature that remain readable at native `1x`.

The replacement covers the protagonist, the named cast, and all ambient residents. Ambient people will no longer all use `generic-resident`.

## Why This Approach

Use bespoke compact look records for the protagonist and named cast. Use a curated compact look roster for ambient residents. Compile all records into flat atlas cells at build time.

This approach keeps the HFM strength: one identity source, consistent portraits and world art, hard-pixel generation, and cheap runtime rendering. It also permits Halcyra-specific odd clothing, accessories, body shapes, and facial choices. A runtime paper doll would add complexity and can cause identity drift, so it remains out of scope.

## Key Decisions

- Shared source: one look record owns face, hair, build, outfit, accessory, palette, and portrait expressions.
- Proportions: enlarge heads and faces inside the existing `24x30` world cell. Do not enlarge the world footprint.
- Named identity: each named person gets one authored primary oddity and one supporting feature.
- Ambient identity: each production ambient ID maps to one stable curated look. No production duplicate uses the complete same look.
- Expressions: named looks generate `rest`, `joy`, and `upset`. Ambient looks generate `rest` unless they later become conversational characters.
- Runtime: keep flat RGBA atlas cells, nearest-neighbor sampling, and the current eight walking cells.
- Review: inspect silhouette, portrait parity, eight directions, and expressions at native `1x` before `3x`.
- Existing work: preserve the concurrent Electron dev-harness changes in `WorldScene.tsx` and `SkiaProof.tsx`.

## Named-Cast Direction

| Person | Signature oddity | Supporting feature |
|---|---|---|
| Protagonist | enormous wind-swept prizewinner forelock | oversized diagonal luggage strap and large shoes |
| Linda | cloud-sized side hair mass | mismatched long earrings |
| Mina Park | stacked spa-stone bun | one huge towel sleeve and a small supply bag |
| Rafael Cruz | broad curled moustache | round cook build and tiny neckerchief |
| Sora Tan | enormous angular fashion collar | one long sleeve and one short sleeve |
| Devon Price | towering flat-top | absurdly broad bartender jacket shoulders |
| Priya Nair | high bun crossed by two long hair sticks | oversized clinic coat pockets |
| Tomas Reed | square ear defenders wider than his head | long narrow clerk body and permit pouch |
| Elise Moreau | question-mark forelock | oversized shoulder recorder |

## Open Questions

- None. Direct user approval to proceed was given.

## Next Steps

Implement the look roster, generator, stable mapping, atlas contract, review boards, and verification.
