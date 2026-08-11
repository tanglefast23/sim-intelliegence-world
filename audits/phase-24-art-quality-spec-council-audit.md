# Phase 24 art-quality specification council audit

**Target:** `docs/specs/2026-08-11-art-quality.md` at draft commit `d1757e4`

**Scope:** Internal coherence, deterministic art, atlas and runtime budgets, transitions, character-quality feasibility, player-visible gates, and scope control

**Council status:** Complete

## Reviewers

- Claude Fable 5 (`claude-fable-5`), `xhigh`: completed without fallback.
- Claude Opus 5 (`claude-opus-5`), `xhigh`: completed.
- Grok 4.5 (`grok-4.5`), `high`: completed.

All reviewers received the same committed specification diff in a clean temporary worktree. They were read-only and had no web, shell, edit, MCP, subagent, or memory tools. Codex checked every accepted claim against the draft and current repository before editing.

Two earlier complete-run attempts were discarded because both Claude processes exited before structured validation. Direct subscription qualification proved both requested model names. The successful third run bounded the target to the committed specification diff and returned schema-validated results from all three requested models. No partial output from a failed run was used.

## Synthesized verdict

### 1. Variant selection could not satisfy its own repetition gate — high — 2/3

**Reviewers:** Fable and Opus.

**Draft evidence:** Section 7.2 specified an independent per-tile hash, while sections 7.3 and 14.2 prohibited an all-identical `2×2` block. Four uniform variants produce about `1.9` all-identical overlapping blocks on an average `12×12` board. The `+` notation also did not define unambiguous tuple mixing.

**Resolution:** The final contract uses a length-prefixed non-commutative tuple and a hash-derived candidate order. It resolves tiles in row-major order and repairs an all-identical `2×2` against the already resolved left, upper-left, and upper tiles. The board has per-variant count bands and separate automated and native-`1×` visual gates. Each family has a versioned `selectionSalt`; a failed canonical board reports its counts and blocks the build until the author changes that source input, the variant set, or an approved coordinate-phase recipe.

### 2. Orthogonal transitions did not define corners or multi-material junctions — high — 2/3

**Reviewers:** Opus and Grok.

**Draft evidence:** The first pass required sixteen N/E/S/W masks but deferred corner support. Pairwise boards did not require inner corners, outer corners, diagonal saddles, islands, strips, priority ties, or three-material junctions.

**Resolution:** The final contract requires a sixteen-case corner-aware marching-squares or equivalent quarter-Wang set. Stable transition priority and material-ID tie-breaking resolve shared vertices. Transition boards now cover all named topology and multi-material cases.

### 3. The one-atlas hard cap had no content budget — high — 3/3

**Reviewers:** Fable, Opus, and Grok.

**Draft evidence:** The spec required variants, sixteen transition cells per family, roofs, walls, props, eighty world-character cells, and portraits, but it supplied only a `1024×1024` hard failure.

**Resolution:** Section 11.3 now allocates every category. The raw rectangle ceiling is `714,744 px`, about `68.2%` of the atlas, but the specification labels that value as a lower bound. The prototype must run dimension-correct placeholders through the real stable packer. Broad work requires raw area at or below `70%`, projected packed bounding area at or below `80%`, and both projected dimensions at or below `1024`. A fixed reduction order protects public IDs, character cells, portraits, gutters, and collision readability.

### 4. Placeholder-district scope contradicted all-map quality gates — high — 3/3

**Reviewers:** Fable, Opus, and Grok.

**Draft evidence:** Section 3 prohibited full authoring outside Sunward, while sections 6, 14, 15, and 17 implied new district-specific props, room cues, and equal scene-content gates across all four maps.

**Resolution:** Section 3.1 now defines Tier A Sunward quality work and Tier B shared upgrades. Tier B re-authors existing cells and placements only. It cannot add objects, parts, rooms, walls, interactions, solids, density, or story content. Tier A receives the full hierarchy gate; Tier B receives all-map regression evidence and a reduced readability gate.

### 5. Character and hierarchy contingencies were incomplete — medium — normalized from 1/3 claims

**Reviewers:** Fable identified a locked lateral-view contradiction and missing selection case. Opus identified undefined contour direction. Grok identified direction-dependent identity loss and the lack of a hard prototype gate.

These were separate claims, not a council vote on one root cause. Codex verified each as a contract gap.

**Resolution:** The default lateral method remains locked, but the already approved mirrored three-quarter head and hair fallback is explicit. Identity features declare direction support, and each named character has one feature that survives all directions. The contour is outward into transparent pixels, has source-margin rules, cannot replace fill, and stays inside `24×30`. Selection and active interaction are in the review matrix. The Sunward prototype is now a hard gate before full-cast or Tier B expansion.

## Rejected or narrowed claims

- Fable described `mapId + tileX + tileY` as arithmetic. The draft intended concatenated identity inputs, but the notation was ambiguous. The final tuple encoding removes the ambiguity without accepting the arithmetic claim as a code defect.
- Opus proposed that no contour pixel touch the cell boundary. This is unnecessarily strict. A generated contour can safely occupy the boundary because the atlas has extruded gutters. The accepted rule requires a pre-contour source margin and forbids clipping or source-pixel replacement.
- Grok grouped the locked rear/lateral method and identity quality as one direct contradiction. The method can remain if the source declares direction-visible features and the proof controls the three-quarter fallback. The final specification keeps that smaller design.

## Local verification

- Confirmed the current atlas is `512×426` RGBA with one-pixel gutters.
- Confirmed ten ground cells, four wall palettes, eighty current world-character cells, and ten portraits.
- Confirmed current world-character alpha bounds leave horizontal contour space; one current hair source reaches the top row, so the new generator margin must be enforced during character re-authoring.
- Confirmed the renderer uses batched Skia atlas layers and the presentation compiler can own deterministic visual data without changing collision.
- Confirmed the current roof path uses boardwalk art as the visual fallback.
- Confirmed the raw atlas rectangle-area arithmetic and category total. The final specification does not treat that sum as measured packer occupancy.
- Ran `git diff --check` after synthesis.

No runtime source changed in Phase 24, so package, movement, save, and performance checks are not applicable until the implementation phases.
