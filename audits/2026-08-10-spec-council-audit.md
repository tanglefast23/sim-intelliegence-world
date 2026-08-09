# SI World Specification Council Audit

**Target:** `spec.md` at commit `ae4d243`
**Scope:** Complete pre-implementation specification coherence and plan readiness
**Council status:** Complete

## Reviewers

- Claude Fable 5 (`claude-fable-5`), `xhigh`: completed without fallback
- Claude Opus 5 (`claude-opus-5`), `xhigh`: completed
- Grok 4.5 (`grok-4.5`), `high`: completed

All reviewers received the same read-only prompt and repository evidence. Codex treated every result as a hypothesis and checked it against the target commit before editing.

## Synthesized verdict

### 1. Conflicting save authority — high — 2/3

**Reviewers:** Fable and Grok
**Original evidence:** `spec.md:467`, `spec.md:499`, and `spec.md:819` at `ae4d243` said both that JSON was authoritative and that generated Markdown frontmatter was authoritative.
**Impact:** Two persistent read paths would break save integrity, migration, and the rule that the model cannot write game state.
**Resolution:** Versioned `state.json` is now the only authority. Markdown is a disposable prompt projection and is never read back into game logic.

### 2. AI validation and display pipeline was incomplete — high — 2/3

**Reviewers:** Fable and Opus
**Original evidence:** `spec.md:561–605`, `spec.md:843`, and `spec.md:856–876` required closed registries and safe fallback but provided only prose sources for hard rules, rejected false beliefs as contradictions, allowed an undefined scheduled model path, and displayed streamed text before full validation.
**Impact:** Deterministic boundaries could not be built from prose, false beliefs could not exist safely, and rejected content could reach the player before validation.
**Resolution:** Each named NPC now has Zod-validated `rules.json`; global registries own persistent IDs; belief state is separate from world truth; source types are explicit; version one invokes the model only during conversations; the complete JSON response is buffered, filtered, and validated before a type-on reveal.

### 3. Prototype gates depended on undefined rules — high — 3/3

**Reviewers:** Fable, Opus, and Grok
**Original evidence:** `spec.md:920–944` required a faction change, the full path through Married, a defined defeat cost, named hardware, and both a `32×32`-tile environment and `64×48` maps while related rules remained open in `spec.md:993–1004`.
**Impact:** No implementation phase could have an objective done condition without inventing product rules during coding.
**Resolution:** Section 17 now has staged ART, WORLD, AI, QUEST, and SHIP gates. The map wording is corrected, the vertical slice proves one relationship transition instead of marriage, a defeat fixture is fixed, and minimum faction and relationship contracts are locked.

### 4. Model selection gate had no reproducible subject — high — 2/3

**Reviewers:** Opus and Grok
**Original evidence:** `spec.md:881–884` and `spec.md:944` required measurements on unnamed hardware with an unnamed fallback and no prompt-size rule.
**Impact:** The primary versus fallback model decision could not be repeated or accepted.
**Resolution:** The spec names macOS and Windows baseline machines, a `4,096`-token prompt limit, a `256`-token response limit, sample rules, a capability suite, Qwen3.5-4B as fallback, and separate raw first-token and validated visible-reply latency gates.

### 5. Cross-neighborhood NPC travel was undefined — medium — 1/3

**Reviewer:** Opus
**Original evidence:** `spec.md:242`, `spec.md:725–735`, and `spec.md:846` required normal invitation travel but defined boundary arrival only for the protagonist.
**Impact:** Cross-district schedules and invitations could not be simulated or tested.
**Resolution:** NPC transfer records now contain edge, departure, arrival, and entrance data. Active departures and arrivals use pathfinding; inactive transfers use deterministic milestones; reload reconstructs the route from authoritative time.

## Other verified corrections included in the same fixes

- The faction system now has two stable prototype IDs, bounded standing, tiers, idempotent deltas, and structured access gates.
- Familiarity, Trust, and Attraction now use a locked range, bounded event deltas, minimum stage floors, and structured rejection records.
- Exact quoted text is now treated as source provenance rather than proof of meaning; high-impact effects require a structured action, observation, or authored event.
- The first quest now has three minimum terminal approaches for vertical-slice planning.
- The selected model cannot pass through speed alone; it must pass schema, state-safety, boundary, and content fixtures.

## Rejected or uncertain claims

- No council claim was rejected after local checking.
- The exact Qwen GGUF artifacts remain intentionally unselected. The implementation model spike must pin source revisions, conversion, runtime revision, licences, and hashes using real benchmark evidence.
- The current development Mac is much faster and has much more memory than the locked baseline, so results from it alone cannot prove baseline performance.

## Verification

- Inspected all cited sections in `spec.md` at `ae4d243`.
- Confirmed all three requested reviewers and reasoning levels from the schema-validated council result.
- Confirmed both official Qwen3.5-9B and Qwen3.5-4B model pages and Apache 2.0 licence pages.
- Ran `git diff --check` after fixes.
- Confirmed obsolete conflict phrases are absent.
- Confirmed all Markdown code fences are balanced.

No source code or runtime existed during this audit, so build and gameplay checks were not applicable.
