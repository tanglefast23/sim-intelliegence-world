# Verbal Missions — Synthesis Specification (v1)

**Project:** Sim Intelliegence World (Halcyra Island)
**Date:** 2026-08-13
**Status:** Implementation-ready. Supersedes `2026-08-13-verbal-missions-independent-specs.md` for build purposes.
**Sources:** four independent council specs (Codex, Grok 4.6, Claude Fable 5, Claude Opus 5), synthesized by the orchestrator.
**Grounded against:** `src/ai/registry/turn-candidates.ts`, `src/ai/schemas/conversation-response.ts`, `src/ai/validation/validate-turn.ts`,
`src/ai/projection/prompt-projection.ts`, `src/ai/conversation/{service,transaction,direct-request}.ts`,
`src/domain/state/{schema,models}.ts`, `src/domain/commands/reducer.ts`, `src/domain/relationships/relationship.ts`,
`src/domain/quests/{quest-machine,purchases}.ts`, `src/ui/conversation-feedback.ts`, `src/audio/vocal-cue-policy.ts`,
`content/registries/*`, `content/characters/*`, `spec.md`, `docs/release/ai-guardrails.md`.

**Does not reopen:** the local-model / deterministic-state split, conversation pause, staged conversation transactions,
relationship delta caps, content policy, Electron `llama-server` lifecycle, the adventure-led first hour, or the locked
performance gate.

---

## 0. Thesis

The player's own sentences are the main verb of this game. The local model does two things it is good at and zero things
it is bad at: it **reads** free text into a small closed-enum structure anchored to exact substrings of what the player
typed, and it **speaks** in character *after* deterministic code has already decided what happened.

Everything between reading and speaking — did that land, did she catch the lie, did the price move, did the deal close —
is a pure function over authored content. Success is never a hidden password and never an opaque score. It is a short,
named, progressively revealed ledger of **concerns** the NPC is weighing, moved by authored **levers** and hardened by
authored **allergies**.

Three rejections, all four council members agreed:

- **Hidden keyword lock** — rejected. Keywords survive in exactly three non-scoring roles (§8).
- **Single opaque persuasion score** — rejected. Named concerns, visible states.
- **Model-authoritative outcomes** — rejected. Violates `docs/release/ai-guardrails.md` and is unshippable against exploits.

One repo fact makes this urgent: `buildTurnCandidateRegistry` in [turn-candidates.ts](src/ai/registry/turn-candidates.ts)
is currently a hand-written cat-ownership regex. That is precisely the hidden keyword lock this spec forbids, shipped and
tested. This design generalizes that one function into a real reading stage.

---

## 1. Council decision log

The four specs converge on ~70% of the design. This section records every place they diverged and what won. It exists so
nobody re-litigates a settled call in review.

### 1.1 Unanimous — locked without debate

| Decision | Held by |
|---|---|
| Two-stage turn: model reads → deterministic code decides → model speaks the decided outcome | all four |
| Closed per-turn ID enums plus mandatory evidence substrings as the injection containment | all four |
| Named concern ledger, no global persuasion number, never a visible `Persuasion +3` | all four |
| Money, items, quest flags, consent move only through a validated domain command with explicit confirmation | all four |
| Relationship values are modifiers, never gates; no talk-ten-times wall | all four |
| Lies become held beliefs with consequences, never world truth | all four |
| Repetition and paraphrased repetition earn nothing and cost patience | all four |
| Authored fallback text; the engine outcome applies even when the prose fails | all four |
| ~1 authoring day per mission; v1 ships few, deep missions | all four |

### 1.2 Divergences resolved

| # | Question | Options | Winner | Why |
|---|---|---|---|---|
| 1 | Progress model | Codex: 5-state concerns · Grok: stance enum + levers · Fable: concern ledger + move tiers + terms table · Opus: concerns + lever edges + reserve steps | **Opus** | A lever is one authored row that answers "why did that work". Price moves in authored steps, so there is no arithmetic to debug or explain. |
| 2 | A separate stance machine | Grok yes; others no | **No** | Stance duplicates concern state plus patience. The player-facing mood word (§10.3) delivers the same legibility for free. |
| 3 | Model grades argument strength (`weak/solid/strong`) | Fable yes; others no | **No** | That is exactly the consistency judgment a 4–9B local model is worst at. Strength comes from *what the player knew and did*, not from the model's opinion. |
| 4 | Price authority | Fable terms table (resolved-set → min price) · Opus reserve steps on levers | **Opus** | One number, moved in named steps, each attributable to one lever. The terms table is a second place to encode the same thing. |
| 5 | Character specificity | Grok per-tactic policy · Fable per-move receptivity · Opus per-NPC `registerResponse` + per-mission allergies | **Opus, with Grok's contrast fixture requirement** | A reusable 8-row register table per NPC is far cheaper than a per-mission tactic matrix, and it generalizes to every future mission. Grok is right that a contrast NPC must be a *test fixture*, not a hope. |
| 6 | Commit boundary | Codex/today: end only · Grok: sticky receipts on abort · Fable: full per-turn commit · Opus: ledger on end **and** walk-out | **Opus** (≡ Grok's sticky receipts) | Same anti-scum property as per-turn commits, far less save churn, and no change to the crash-discard semantics for knowledge and memories. |
| 7 | Latency budget | Opus P50 1.8 s / P95 3.5 s · Grok 12 s p95 | **Grok** | `spec.md:107` locks ≤ 3 s to first token and ≤ 12 s p95 to validated visible dialogue. Opus's numbers assume Qwen3.5-4B and are not the gate. See §5.5 for the real risk, which is the TTFT gate, not the 12 s one. |
| 8 | Mission availability | Grok gates the purse behind the boyfriend quest; others silent | **Grok** | Protects the locked first hour. `linda_boyfriend_check` ∈ {`resolved`,`withdrawn`}, blocked by `linda_betrayed`. |
| 9 | Secret numbers in the prompt | Grok: unspeakable policy token · Opus: never place it in the prompt at all | **Opus, plus Grok's output filter** | A number the model never received cannot leak. The currency cross-check (§5.4) is the second lock. |
| 10 | Lie consequences | Fable: predicate confrontation triggers · Opus: liabilities cashed by authored scenes | **Opus** | No predicate engine to build. Fable's triggers are the natural v2 upgrade. |
| 11 | Accessibility | Fable: guided mode with full parity · Opus: recall chips + seeds + closer | **Opus** | Recall chips insert a *reference*, not a finished argument, so they solve the real problem (remembering a detail from two days ago) without an authoring tax on every mission. |
| 12 | Repetition detection | Fable: 3-gram shingles pre-model · Opus: `creditedLeverIds` | **Both** | Shingles catch literal repeats before a model call is spent. Credited levers catch paraphrased repeats. Neither alone is sufficient. |
| 13 | v1 content volume | Fable 6–8 Deals + 1 Scheme · Codex 5 missions · Grok 1 mission | **Grok** | Prove the engine on one vertical slice. Author breadth after the loop passes playtest. |

### 1.3 Orchestrator additions — in none of the four

1. **The reserve-above-cap invariant** (§4.4). Every mission's opening `reserveMinor` must exceed `goal.maxPriceMinor`.
   This makes accidental success *structurally* impossible instead of requiring a separate `requireAnyLeverIds` predicate
   (Grok) or a per-turn advancement cap (Fable). A lever-free lowball cannot succeed because the reserve has not moved.
   Enforced as a content lint, proved as a property test.
2. **Latency correction.** §5.5 replaces the two contradictory budgets with the locked gate and names the real risk
   (time to *first visible token* now includes the Read call) plus its measured decision point.
3. **Register-misclassification floor** (§4.6). Register is the one Move field that is a genuine judgment call. No
   allergy may key on register *alone* without a same-attempt recovery, so a misread tone can cost a turn but never a
   mission.
4. **Naming discipline.** The four specs used "verbal mission", "Talk Job", "Deal", and "negotiation" for one thing.
   This document says **verbal mission** in player-facing and design text and `negotiation` for the state slice, always.

---

## 2. Player-facing design

### 2.1 The loop

1. **Receive.** The journal states a plain goal and a named NPC: *"Get Linda's Marchetti bag for under $100."* It is
   never a riddle about *what* to do. It is a puzzle about *how*.
2. **Notice.** Walk up, talk, look. Most concerns are revealed only by curiosity.
3. **Learn.** Facts from other people, other places, other days are the ammunition. Naming a real detail is the
   strongest move in the game.
4. **Choose a register.** The same content delivered blunt, warm, flattering, or pleading lands differently per person.
5. **Close.** When every required concern is closed, a Closer control appears with exact terms. Closing is a
   deterministic transaction the player confirms.
6. **Recover.** A blown attempt costs mood and a day, not the mission.

Time stays paused for the whole conversation (existing pause token). Generation speed never burns the clock.

### 2.2 The readability contract (non-negotiable)

- After every player line the UI states in plain words what the system understood and what changed. If it understood
  nothing, it says so.
- No hidden number gates a required outcome. Prices the player pays are exact and visible. Mood is a word, not a bar.
- A hardened concern says why it hardened, in her voice and in the beat line.
- Ambiguity produces a clarifying question, never a silent failure. The first clarification per conversation is free.
- Hidden concerns are visible as **blank slots**. The player always knows *how much* is left, never *what* it is until
  they earn it. That is the exact line between fair and opaque.

### 2.3 What a good argument feels like

A good argument is specific to this person and this moment. It does at least one visible job: gets her to confirm
something she would actually say; faces a feeling she already has without using it against her pride; puts a legal offer
on the table; gives her a face-saving story for saying yes; or uses a fact the world can prove.

A bad argument is equally readable: the wrong pressure, a repeated line, a fake credential, a romantic bribe, or a price
she will not take.

---

## 3. Authored content

Four content types, all JSON validated by Zod at load, beside the existing
`content/characters/<id>/{rules.json, personality.md, biography.md, knowledge.md, authored-dialogue.json}`.
Prose files stay writing context; they cannot create, weaken, or override a rule.

### 3.1 Object records — `content/objects/<id>.json`

This is how each NPC receives every relevant fact. Facts are **atoms**: short, ID'd, individually gated.

```jsonc
{
  "schemaVersion": 1,
  "id": "linda_purse",
  "displayName": "Marchetti shoulder bag",
  "aliases": ["purse", "handbag", "bag", "shoulder bag", "designer bag",
              "marchetti", "leather bag", "that bag", "the thing on your shoulder"],
  "owner": { "kind": "npc", "id": "linda" },
  "carried": true,
  "atoms": [
    { "id": "purse_brand", "tier": 0,
      "text": "Cream Marchetti shoulder bag, gold clasp. It reads expensive from across a room." },
    { "id": "purse_resale", "tier": 0,
      "text": "Second-hand island resale for this style runs $180 to $260." },
    { "id": "purse_gift_from_marcus", "tier": 1,
      "text": "Marcus gave it to her last spring, the week after a bad night." },
    { "id": "purse_price_paid", "tier": 1,
      "text": "He paid around $600 for it. He mentions the number when he is angry." },
    { "id": "purse_strap_repaired", "tier": 2,
      "text": "The strap was restitched downtown. It tore when he pulled it off her arm." },
    { "id": "purse_she_cannot_look_at_it", "tier": 3,
      "text": "She cannot look at it without that night. Selling it cheap feels like losing twice." }
  ]
}
```

| Tier | Meaning | Reaches the prompt when |
|---|---|---|
| 0 | Public / observable | Always, when the object is in scene or referenced |
| 1 | Ordinary private | Trust band ≥ *acquainted*, **or** an authored lever revealed it |
| 2 | Guarded | An authored lever or concern reveal explicitly unlocks it |
| 3 | Core wound | Only after a named concern reaches `eased` or `closed` |

**An atom above its unlock threshold is never placed in the prompt at all.** The model cannot leak what it never
received. This is stronger than instructing it to withhold, and it keeps the 7,000-byte budget
(`MAX_PROMPT_BYTES`, [prompt-projection.ts:5](src/ai/projection/prompt-projection.ts:5)) by construction.

The **reserve price is not an atom and never enters any prompt.** It exists only in `NegotiationState`.

### 3.2 Disposition — `content/characters/<id>/disposition.json`

This is why one tactic works on one NPC and backfires on another. One file per NPC, reused by every mission.

```jsonc
{
  "schemaVersion": 1,
  "npcId": "linda",
  "cares": ["dignity", "safety", "being_seen", "money", "novelty"],
  "registerResponse": {
    "plain": "neutral", "blunt": "good", "warm": "good", "joking": "neutral",
    "flattering": "bad", "pleading": "bad", "formal": "neutral", "threatening": "hostile"
  },
  "smallTalkAllowance": 3,
  "patienceRegenPerDay": 3,
  "detectors": [
    { "id": "marcus_contradiction", "watchesClaimId": "marcus_sent_me", "truth": false,
      "onFire": { "harden": ["marcus_reaction"], "patience": -2, "liability": "lied_about_marcus" } }
  ]
}
```

Tomas Reed inverts it (`blunt: good`, `warm: neutral`, `joking: bad`). Priya Nair rewards `formal` and punishes `blunt`.
Devon Price is the one NPC where `flattering: good`. Same player sentence, different outcome, one readable table.

**Contrast fixture is mandatory before ship** (Grok's call): a blunt clerk disposition where the empathy line that
softens Linda is inert. Character specificity is proved by test, not hoped for from the model.

### 3.3 Missions — `content/missions/<id>.json`

```jsonc
{
  "schemaVersion": 1,
  "id": "linda_purse_deal",
  "npcId": "linda",
  "tier": 3,
  "scope": "single_scene",
  "goal": { "kind": "buy_object", "objectId": "linda_purse", "maxPriceMinor": 10000 },
  "journalSummary": "Get Linda's Marchetti bag for under $100.",
  "patience": 6,
  "openReserveMinor": 24000,
  "availability": {
    "requiredQuestStatuses": [{ "questId": "linda_boyfriend_check", "status": ["resolved", "withdrawn"] }],
    "blockedFlagIds": ["linda_betrayed"],
    "trustAtLeast": 0
  },
  "concerns": [
    { "id": "why_you_want_it",  "kind": "soft",  "required": true,  "visibleAtStart": true },
    { "id": "price_floor",      "kind": "price", "required": true,  "visibleAtStart": true },
    { "id": "sentimental_hold", "kind": "block", "required": true,  "visibleAtStart": false,
      "revealedBy": ["ask_about_the_bag", "notice_the_repair"] },
    { "id": "marcus_reaction",  "kind": "block", "required": true,  "visibleAtStart": false,
      "revealedBy": ["sentimental_hold:eased", "mention_marcus"] }
  ],
  "levers": [ /* §3.4 */ ],
  "allergies": [ /* §3.5 */ ],
  "closeTerms": { "kind": "money", "requiresConcerns": "all_required" },
  "cooldownMinutes": 1440
}
```

**Concern kinds:** `soft` (must reach `eased`), `block` (must reach `closed`), `price` (satisfied when
`reserveMinor ≤ offer ≤ goal.maxPriceMinor`), `info` (must have disclosed a named atom — this is how "learn something
from an NPC" missions reuse the same machinery).

**Concern states:** `unrevealed → open → eased → closed`, plus the side state `hardened`. Every transition is a named
authored edge. There is no arithmetic accumulation anywhere in the system.

### 3.4 Levers — the formal definition of a good argument

A lever is an authored `(trigger → effect)` edge. The trigger is a *shape* of move, never a phrase.

```jsonc
{
  "id": "notice_the_repair",
  "trigger": {
    "acts": ["observe", "ask"],
    "target": "linda_purse",
    "requiresPlayerKnows": ["purse_strap_repaired"],
    "forbidsRegisters": ["flattering", "threatening"]
  },
  "effect": {
    "reveal": ["sentimental_hold"],
    "concern": { "sentimental_hold": "open→eased" },
    "discloseAtoms": ["purse_she_cannot_look_at_it"],
    "reserveMinor": 9000,
    "patience": 0,
    "beat": "You named the repair without making a thing of it."
  },
  "onceOnly": true
}
```

**A good argument is a move that:**

1. targets something actually in scene (a resolved referent),
2. carries content the player legitimately earned — a learned atom, a real number, an offer they can actually pay,
3. addresses a concern that is currently `open`,
4. arrives in a register this NPC's disposition does not punish,
5. has not already been credited.

All five are checkable deterministically. That is the whole trick.

**Lever authoring lints (blocking at content load):**

- Every `required` concern has **≥ 2 distinct levers** that can move it, with **different** `requiresPlayerKnows` sets.
  No single solution path.
- No trigger contains a literal phrase. `acts`, `target`, `requiresPlayerKnows`, and register sets only.
- Every mission has ≥ 1 complete solution path reachable with only tier-0/1 atoms plus in-scene discovery (the "honest
  curiosity" path).
- Reserve steps are monotonically non-increasing along every solution path, and the lowest reachable reserve is
  ≤ `goal.maxPriceMinor`.
- `openReserveMinor > goal.maxPriceMinor` (§4.4).

### 3.5 Allergies — the formal definition of a backfire

```jsonc
{
  "id": "praise_the_bag",
  "priority": 10,
  "trigger": { "acts": ["compliment", "appraise"], "target": "linda_purse" },
  "unless": { "concernState": { "sentimental_hold": ["eased", "closed"] } },
  "effect": {
    "concern": { "sentimental_hold": "→hardened" },
    "patience": -2,
    "guard": "no_bag_talk_this_turn_plus_1",
    "beat": "She heard a sales pitch."
  },
  "recovery": { "leverId": "drop_it_and_change_subject",
                "restores": { "sentimental_hold": "hardened→open" },
                "reserveMinorPenalty": 3000 }
}
```

Every allergy must declare a `recovery` or be marked `"recovery": "next_day"`. There are no unrecoverable single-turn
mission kills below tier 5. **Additional lint:** an allergy whose trigger keys on `register` with no `acts` constraint
must have a same-attempt recovery, never `next_day` (§4.6).

### 3.6 Authoring cost

| Artifact | Size | Cost |
|---|---|---|
| Object record | 6–10 atoms | ~0.5 h |
| Disposition | once per NPC, reused forever | ~1 h |
| Mission | 3–4 concerns, 8–12 levers, 3–5 allergies, beat text | ~4–6 h |
| Golden paraphrase corpus | 100–150 lines | ~2 h |

A tier-3 mission is roughly one authoring day. That is the honest price of fairness and readability, and it is the main
tradeoff in this design (§20.1).

---

## 4. Deterministic evaluation

### 4.1 New state — schema v7

`STATE_SCHEMA_VERSION` moves 6 → 7 ([schema.ts:24](src/domain/state/schema.ts:24)); migration `v6-to-v7` seeds both new
records from content defaults, following the existing chain in `src/domain/state/migrations/`.

```ts
// src/domain/state/models.ts
export const WorldObjectStateSchema = z.object({
  id: StableIdSchema,
  owner: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('npc'), id: StableIdSchema }).strict(),
    z.object({ kind: z.literal('player') }).strict(),
    z.object({ kind: z.literal('place'), id: StableIdSchema }).strict(),
  ]),
  disclosedAtomIds: uniqueStableIds('Disclosed atom IDs must be unique.'),
}).strict();

export const ConcernStateSchema = z.object({
  id: StableIdSchema,
  state: z.enum(['unrevealed', 'open', 'eased', 'closed', 'hardened']),
  hardenedReasonId: StableIdSchema.optional(),
}).strict();

export const NegotiationStateSchema = z.object({
  id: StableIdSchema,
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  status: z.enum(['open', 'succeeded', 'failed', 'abandoned']),
  attempt: z.number().int().min(1).max(99),
  patience: z.number().int().min(0).max(12),
  smallTalkUsed: z.number().int().min(0).max(16),
  concerns: z.array(ConcernStateSchema).max(8),
  reserveMinor: z.number().int().nonnegative(),
  creditedLeverIds: uniqueStableIds('Lever IDs must be unique.'),
  firedAllergyIds: z.array(StableIdSchema).max(16),
  liabilityIds: uniqueStableIds('Liability IDs must be unique.'),
  lastReferentId: StableIdSchema.optional(),
  lastOfferMinor: z.number().int().nonnegative().optional(),
  openedAtMinute: z.number().int().nonnegative(),
  lastMoveMinute: z.number().int().nonnegative(),
}).strict();
```

Added to `WorldStateBaseSchema`: `objects: z.record(StableIdSchema, WorldObjectStateSchema)` and
`negotiations: z.record(StableIdSchema, NegotiationStateSchema)`.

### 4.2 The Move — the only thing the model hands the deterministic layer

```ts
export type Move = Readonly<{
  acts: readonly Readonly<{
    act: 'greet' | 'ask' | 'observe' | 'compliment' | 'appraise' | 'assert' | 'offer'
       | 'concede' | 'refuse' | 'apologize' | 'threaten' | 'joke' | 'change_subject' | 'close_deal';
    targetRefId: string | null;           // enum: this turn's scene referents only
    span: Readonly<{ start: number; end: number }>;
  }>[];                                    // max 3
  register: 'plain' | 'blunt' | 'warm' | 'flattering' | 'pleading' | 'joking' | 'formal' | 'threatening';
  claims: readonly Readonly<{
    claimId: string;                       // enum: this mission's claim slots + 'unlisted'
    polarity: 'assert' | 'deny' | 'ask';
    span: Readonly<{ start: number; end: number }>;
  }>[];                                    // max 3
  offer: Readonly<{
    kind: 'none' | 'money' | 'object' | 'favor';
    amountMinor: number | null;
    objectRefId: string | null;
    span: Readonly<{ start: number; end: number }> | null;
  }>;
  referenceConfidence: 'clear' | 'probable' | 'ambiguous';
}>;
```

**Span validation is the anti-hallucination anchor.** Every span must slice to a non-empty substring of the player's
message, reusing the discipline already in `assertSource` in [validate-turn.ts](src/ai/validation/validate-turn.ts).
A move with a bad span is rejected wholesale. A hallucinated `targetRefId` cannot exist, because the JSON Schema enum for
that turn is built from the scene referent list — the same closing pattern
[conversation-response.ts:133](src/ai/schemas/conversation-response.ts:133) already uses.

**The Move type contains no state fields whatsoever. It cannot express a state change.**

### 4.3 The Adjudicator — pure function, no model, no RNG

```ts
// src/domain/negotiation/adjudicate.ts
export function adjudicate(input: Readonly<{
  move: Move;
  negotiation: NegotiationState;
  mission: MissionDefinition;
  disposition: Disposition;
  projection: NegotiationProjection;   // money, inventory, playerKnownAtomIds, clock, presentNpcIds, locationId
}>): NegotiationOutcome;
```

Order of resolution, first match wins per stage:

1. **Repetition.** 3-gram Jaccard ≥ 0.6 against any prior player turn this attempt → outcome `repeat`, no ledger change,
   patience −1, authored beat. *Runs before the Read call, so a spammed line costs no inference.*
2. **Guards.** Active guard flags suppress matching levers for their duration.
3. **Detectors.** Any `claims[]` entry whose `claimId` has an authored truth value contradicted by the assertion fires
   its detector. Deterministic, because the model only *mapped* the assertion to a slot; code owns the truth.
4. **Allergies.** Match on `(acts, target, register)` with `unless` guards. At most one fires per turn, highest
   authored `priority`.
5. **Levers.** Match in authored order on `(acts, target, requiresPlayerKnows ⊆ playerKnownAtomIds,
   register ∉ forbidsRegisters, concern is open)`. Credit at most two per turn. A lever already in `creditedLeverIds`
   yields `repeat`: no ledger change, −1 patience, beat "You already said that."
6. **Offer.** If `offer.kind !== 'none'`, evaluate against `reserveMinor`, `goal.maxPriceMinor`, and actual money or
   inventory. Insufficient funds → `cannot_pay`, no patience cost, she says "show me."
7. **Register tax.** `registerResponse: bad` costs −1 patience even when a lever matched. `hostile` costs −3 and hardens
   the most-advanced concern.
8. **Small talk.** A well-formed move that matched nothing: free until `smallTalkAllowance`, then −1 patience each.
   Never an error state.
9. **Patience floor.** Patience 0 → outcome `walked_out`, status stays `open`, conversation ends.

```ts
export type NegotiationOutcome = Readonly<{
  kind: 'progress' | 'repeat' | 'backfire' | 'detected_lie' | 'clarify' | 'small_talk'
      | 'cannot_pay' | 'offer_refused' | 'deal_ready' | 'deal_closed' | 'walked_out';
  creditedLeverIds: readonly string[];
  firedAllergyId?: string;
  concernTransitions: readonly Readonly<{ id: string; from: string; to: string }>[];
  revealedConcernIds: readonly string[];
  disclosedAtomIds: readonly string[];
  patienceDelta: number;
  reserveMinorAfter: number;
  beatText: string;                       // authored, never generated
  authoritativeTerms?: Readonly<{ priceMinor: number; objectId: string }>;
}>;
```

`beatText` is authored content, so the visible explanation of the system can never be a model hallucination.

### 4.4 The reserve-above-cap invariant

**`openReserveMinor > goal.maxPriceMinor` for every mission.** Linda opens at $240 against a $100 cap.

This one line does the work that Grok's `requireAnyLeverIds` predicate and Fable's per-turn advancement cap were both
built to do, and it does it structurally:

- A naked lowball with no levers credited cannot succeed, because the reserve has not moved. No extra predicate.
- Accidental success is impossible by arithmetic, not by rule. A `price` concern is satisfiable only after enough
  reserve-lowering levers have fired.
- A mission with ≥ 2 required concerns provably needs ≥ 3 adjudicated moves (max 2 lever credits per turn, and `price`
  additionally needs an `offer` act). This is a property test, not a hope.

Paying more than the cap is a **legal, readable miss**: the transfer happens, the mission records `overpaid`, the
journal says so. Nothing is secretly snapped to success.

### 4.5 Commands and events

Four commands added to `DomainCommandSchema`, four cases in `reduceCommand`, following the existing plan/reduce pattern
used by `planHomeInvitation` and `planLindaQuestOutcome` in [reducer.ts](src/domain/commands/reducer.ts).

| Command | Effect | Event |
|---|---|---|
| `open-negotiation` | Creates or resumes `NegotiationState`; increments `attempt` only if a prior attempt was adjudicated | `negotiation-opened` |
| `apply-negotiation-move` | Runs `adjudicate`, writes ledger deltas | `negotiation-move-applied` |
| `close-negotiation` | Validates terms, transfers money and object ownership, sets status | `negotiation-closed` |
| `abandon-negotiation` | Sets status `abandoned`, records the walk-out | `negotiation-abandoned` |

Money and ownership move **only** in `close-negotiation`, reusing the existing money-safety pattern
(`Number.isSafeInteger`, non-negative balance check). The command carries a unique event ID and is idempotent.
Relationship deltas stay capped at ±3 per conversation by `applyRelationshipDelta(_, _, 'conversation')` — unchanged.

### 4.6 The register floor

`register` is the one Move field that is a genuine judgment call rather than a lookup. A player writing a dry joke may be
read as `blunt`; a sincere compliment may be read as `flattering`. That is tolerable when it costs a turn and intolerable
when it costs a mission.

**Rule:** any allergy whose trigger keys on `register` without an `acts` constraint must carry a same-attempt
`recovery`. `"recovery": "next_day"` is a content-lint failure for those. Register can sting immediately; it can never
be the sole cause of an unrecoverable state below tier 5.

### 4.7 Commit boundary

| Change class | Committed on End | Committed on Walk-out / Cancel |
|---|---|---|
| Knowledge, memories, interests, unlocks | Yes (existing) | No (existing) |
| **Negotiation ledger, patience, attempt, liabilities** | **Yes** | **Yes**, once ≥ 1 non-neutral move was adjudicated |
| Money, objects | Only via `close-negotiation` | Never |

The Cancel button relabels to **"WALK OUT — she'll remember this"** once any non-neutral move has landed. Opening a
conversation and leaving immediately costs nothing, so a crash or a misclick is never punished. Mid-conversation manual
save stays illegal (unchanged).

This is Grok's sticky receipts and Opus's dual commit, which are the same mechanism. It gets Fable's anti-scum property
without Fable's per-turn save churn or its change to the crash-discard contract for knowledge and memories.

---

## 5. Local-model duties

Exactly two generation calls per turn, both already-supported shapes on `InferencePort`, both fully buffered and
revalidated in Electron main per the guardrail sequence.

### 5.1 Read pass — new

- **Input:** the player message as a JSON string framed as data (matching the existing `currentPlayerDialogueMessage`
  treatment), the scene referent list with aliases, the mission's claim slots, the currently open concerns **by ID
  only**, and the player's spendable money.
- **Output:** one `Move` against a per-turn narrowed JSON Schema.
- **Budget:** ≤ 2,500 prompt bytes, 128 max tokens.
- **Authority:** none. It translates.

**Deliberate design point: the Read prompt excludes lever definitions and concern semantics.** The reader cannot help the
player cheat because it does not know what winning looks like. This is the single most important containment property in
the design and it costs nothing.

### 5.2 Speak pass — existing, extended

Reuses `buildPromptProjection` with two new sections:

- `mission-context` (priority 91): the object atoms currently unlocked, plus the open concerns as in-character *worries*
  in prose — never as a checklist, never with IDs.
- `authoritative-outcome` (priority 92): the existing `authoritativeSocialOutcome` mechanism
  ([prompt-projection.ts:110](src/ai/projection/prompt-projection.ts:110)), now carrying the full `NegotiationOutcome`.

Contract line added: *"Communicate this exact outcome in character. Never state a price, quantity, or promise that is not
in the authoritative outcome."*

Trim order when the 7,000-byte budget is tight: biography first, then older turns. Never the contract, the current player
turn, `mission-context`, or `authoritative-outcome`.

### 5.3 Safety pass — existing, unchanged

`deterministicPolicyDecision` pre-filter on player text, `classifyApprovedDialogue` on generated dialogue.

### 5.4 Output validation

On top of the existing schema validation:

- **Currency cross-check.** Every currency figure in the generated dialogue must equal a figure present in the
  authoritative outcome. This replaces the brittle positive/negative regex in `dialogueMatchesSocialOutcome` for
  negotiation turns and makes the reserve unspeakable even in the impossible case that it reached the prompt.
- **Accept-lexicon check.** Outcome ∈ {`offer_refused`, `cannot_pay`, `walked_out`} plus dialogue matching a small
  accept lexicon ("it's yours", "sold", "deal", "take it") without negation → reject.

### 5.5 Fallback ladder — never fail a turn

1. Read pass invalid → one corrected retry (existing two-attempt pattern).
2. Still invalid → **deterministic backstop reader**: referent by alias table plus token-overlap Jaccard ≥ 0.45, offer
   by currency regex, act by a 40-entry verb lexicon, register defaults to `plain`. Beat line reads
   `SHE HEARD: (unclear)`. **This is the only place keywords make a decision, it is visibly labelled, and it can only
   produce weaker results than the model path — never stronger.**
3. Backstop yields nothing → `small_talk`, free of charge.
4. Speak pass fails twice → authored fallback line, **and the adjudicated outcome still applies.** The ledger never
   depends on the model producing good prose.

### 5.6 Latency — the honest budget

The locked gate ([spec.md:107](spec.md:107), [spec.md:1041](spec.md:1041)) is: ≤ 3 s to the model's first token,
≥ 8 tokens/s sustained, ≤ 12 s to a validated player-visible reply at p95, 60 FPS during generation. The council specs
disagreed by a factor of four here; those two numbers are the gate, and neither Opus's 3.5 s p95 nor a relaxed reading
of the 12 s figure replaces them.

**The 12 s p95 is not the risk. The 3 s time-to-first-token gate is**, because the Read call now sits in front of the
Speak call and the player sees nothing until Speak starts.

Budget on the Qwen3.5-9B target:

| Stage | Target | Notes |
|---|---|---|
| Repetition check | < 1 ms | pure, pre-model |
| Read pass | ≤ 1.5 s p95 | 128 tokens, ≤ 2,500-byte prompt |
| Adjudicate | < 1 ms | pure |
| Reaction beat visible | ≤ 1.6 s | portrait, vocal cue, and authored beat fire the instant Read validates |
| Speak pass first token | ≤ 3 s from Read completion | |
| Validated visible reply | ≤ 12 s p95 total | the locked gate |

**Named decision point, measured in the model spike, not argued in review:** if the reaction beat cannot be shown within
the existing 180 ms thinking-state floor plus 1.5 s, or if total p95 breaches 12 s, the fallback is to merge Read into
the Speak schema as a single call and adjudicate from the backstop reader for that turn. That is a worse authority split
and it is the named contingency, not the default. Do not weaken validation to meet latency
([spec.md:1045](spec.md:1045)).

---

## 6. Reference resolution

The player will type "that bag", "the thing on your shoulder", "your fancy purse", "it", or nothing at all.

1. **Scene referent set** (deterministic). Built at conversation start and after each turn: objects the NPC carries or
   owns in this location, objects the player carries, people present, people named in the last four turns, and topics
   with open concerns. Typically 5–12 entries. This set becomes the `targetRefId` enum for the turn.
2. **Model resolution.** The Read pass picks a referent and returns `referenceConfidence`. Because the enum is closed, a
   wrong pick is possible; an invented pick is not.
3. **Alias cross-check.** If the model returns `clear` but no alias for that referent and no pronoun appears in the
   message span, confidence is deterministically downgraded to `probable`. **Aliases validate; they never decide.**
4. **Deixis carry.** Bare pronouns resolve to `negotiation.lastReferentId`. If absent, confidence is `ambiguous`.

**Ambiguity is content, not failure.** `ambiguous` produces outcome `clarify`: she asks a natural question ("The bag?"),
the beat reads `SHE ASKS: which one?`, and the first clarification per conversation costs 0 patience. High-impact acts
never guess — the Closer names the object explicitly.

**No exact item name is ever required.** `displayName` never appears in any trigger. A player who calls it "your murse"
for nine turns wins exactly as easily as one who says "Marchetti shoulder bag".

---

## 7. Relationships and the anti-grind rule

**No hard relationship gate on any mission below tier 5.** Familiarity, Trust, and Attraction stay the locked 0–100
integers with the locked ±3 conversation cap and ±15 quest cap. They are modifiers, never keys.

| Mechanism | Effect |
|---|---|
| Trust band (0–19 / 20–49 / 50+) | Selects which atom tiers are eligible for disclosure |
| Familiarity | Authored `openReserveMinor` may vary by one step |
| Attraction | Nothing on a commercial mission, except that flirting as a discount tactic backfires |
| Rejections and boundaries | Existing `RejectionRecord` machinery, unchanged, still absolute |

**Blocking lint:** every mission must be completable at the trust band at which it is offered. If required atoms need a
higher band than `availability.trustAtLeast` grants, the build fails. "Come back when we're closer" becomes structurally
impossible to author by accident.

**Anti-grind rule.** `stageMutualInteraction` in [transaction.ts](src/ai/conversation/transaction.ts) currently grants an
unconditional +1/+1 once per conversation. Replace with credit-gated:

- `+1 familiarity` only if ≥ 1 lever was newly credited this conversation, **or** the turn committed new knowledge
  outside a negotiation (so ordinary chat still works).
- `+1 trust` only if ≥ 1 concern reached `eased` or `closed`.
- `+1 attraction` only on an authored romantic beat (unchanged).

Ten conversations of "hi" produce zero relationship movement.

Romance keeps its existing separate consent machinery. A verbal mission cannot sell a date, a home visit, or a stage
change.

---

## 8. Keywords — the verdict

Keywords are legitimate in exactly three non-scoring roles:

1. **Alias tables**, for referent candidate retrieval, UI hints, and the backstop reader (§5.5).
2. **Deterministic parsers for unambiguous, irreversible acts** — the existing `direct-request.ts` pattern for
   `ask_date` / `invite_home` stays, plus currency parsing. Consent-adjacent and money-moving acts require unambiguous
   phrasing or a chip, by design.
3. **Safety pre-filters** feeding the existing content-policy layer.

**Keywords are banned as success criteria.** A mission whose lever trigger contains a literal phrase is a content-lint
failure. `npm run validate:content` enforces it (the lints are validation rules, not generated output, so they belong
there rather than in the `content:check` diff gate).

The cat-claim regex in [turn-candidates.ts](src/ai/registry/turn-candidates.ts) is the existing violation. It is
re-authored as a tier-1 lever on Linda's disposition in phase 7 (§18), gaining paraphrase tolerance it does not have
today. That is a behaviour change to shipped, tested content; it lands last, behind its own tests.

---

## 9. Assists alongside free typing

Free typing is always available and always primary. Three assists, none of which replace it:

1. **Prompt seeds** (exists today). Fill the input box with an editable sentence, extended to draw from the mission:
   `ASK ABOUT THE BAG`, `MAKE AN OFFER`. Editing them is normal and expected. On the player's first verbal mission only;
   they retire after the first completion in a save.
2. **Recall chips** — the important new one. A strip of facts the player legitimately learned:
   `[STRAP REPAIR]`, `[RESALE $180–260]`, `[MARCUS AT WORK THU]`. Tapping one **inserts a neutral reference into the
   draft**, not a finished argument: `[STRAP REPAIR]` inserts *"the strap that got restitched"*. The player still writes
   the sentence around it. This solves the real problem — remembering a detail from two conversations ago — without
   writing the argument for them.
3. **The Closer.** When `deal_ready`, a bounded numeric control appears: `OFFER $[85]` with a stepper clamped to
   `[1, min(maxPrice, moneyOnHand)]`. Money must be unambiguous. The player can still type "eighty-five bucks" and the
   Read pass extracts it; the Closer just guarantees the path exists.

The game never silently converts a suggestion into an action.

**Accessibility floor:** a player who cannot or will not type long sentences can complete a tier-1 or tier-2 mission
using seeds, chips, and the Closer alone. Tier 3+ requires composing at least one original sentence. Language support
never costs relationship points.

---

## 10. Presentation

### 10.1 The beat line — the single most important UI element

Directly under each NPC reply, one authored line, 120 ms after the reply finishes revealing.

```
SHE HEARD  you named the repair, gently
           SENTIMENTAL HOLD  OPEN → EASED     ·     ROOM  OPEN
```

```
SHE HEARD  a compliment about the bag
           SENTIMENTAL HOLD  → HARDENED       ·     ROOM  COOLING
```

```
SHE HEARD  small talk                          ·     ROOM  OPEN  (2 left)
```

### 10.2 The concern rail — "WHAT SHE'S WEIGHING"

Right side of the conversation panel, matching the existing Silkscreen/amber treatment.

```
WHAT SHE'S WEIGHING
  ▸ WHY YOU WANT IT      OPEN
  ▸ PRICE                 $240 → $90
  ▸ ▪▪▪▪▪▪▪▪              (not yet)
  ▸ ▪▪▪▪▪▪▪▪              (not yet)
```

The `PRICE` row shows **her last spoken price, never the reserve**. Blank slots show how much is left, never what.

### 10.3 Mood

Four named states derived from patience, never a raw number: **OPEN** (≥ 60%), **COOLING** (30–59%), **GUARDED**
(1–29%), **DONE** (0). A word plus a three-segment amber rule. Colour alone never carries the state.

### 10.4 Portraits, audio, pacing

- Extend `portraitExpressionForEmotion` ([conversation-feedback.ts:3](src/ui/conversation-feedback.ts:3)) from three
  states to five: `rest`, `joy`, `upset`, plus `guarded` (a concern hardened, or mood GUARDED) and `open` (a concern
  closed). 200 ms transition; instant under `useReducedMotion`.
- Extend `VocalCueId` ([vocal-cue-policy.ts:3](src/audio/vocal-cue-policy.ts:3)) with three captioned cues:
  `concern_eased` `[SOFT EXHALE]`, `concern_hardened` `[SHARP INHALE]`, `deal_closed` `[AGREEMENT TONE]`. Non-verbal;
  the project does not generate speech. Room tone drops a third in GUARDED.
- Reply lines instructed to ≤ 2 sentences; the 420-character schema cap stays a hard bound.
- Typewriter reveal at 12 ms/char with tap-to-skip (exists). Reveal still waits for full validation.
- Concern transitions animate one at a time, 90 ms apart, so a multi-concern turn reads as a sequence of realizations.
- The generation note stays honest ("LOCAL MODEL REPLIED" / fallback). Never "PERSUASION 72%".

### 10.5 Reward

On `deal_closed`: a receipt card listing money moved, object received, concerns closed, relationship deltas, and the
journal entry updated — plus **one permanent unlock**: a completed mission adds an authored atom about that NPC to a
People page. The durable reward is understanding a person better, which is thematically the point of the game.

Later dialogue remembers whether the player was fair, clever, kind, pushy, or deceptive.

---

## 11. Single-scene goals vs multi-conversation plans

`mission.scope` selects the shape.

**`single_scene`** — everything needed is present or learnable in the room. Tiers 1–3.

**`plan`** — an ordered list of stages, each with its own goal contract and a `preconditions` block:

```jsonc
"preconditions": {
  "playerKnows":       ["marcus_schedule_thursday"],
  "locationId":        "linda_villa",
  "timeWindow":        { "fromMinuteOfDay": 600, "toMinuteOfDay": 900 },
  "absentNpcIds":      ["linda_boyfriend"],
  "moneyAtLeastMinor": 10000,
  "carriedObjectIds":  ["replacement_bag"],
  "questFlagIds":      ["security_report_purchased"]
}
```

Checked deterministically against existing world state (presence, `clock.absoluteMinute`, `inventory`, quest flags).
**Never surfaced as a checklist.** Unmet preconditions become in-character refusals with authored reason IDs, exactly
like `planHomeInvitation`'s `not_familiar_enough` / `schedule_conflict` pattern: *"Not while he can walk in."* The
journal records the reason *after it has been heard*, so the player has a record without being handed a to-do list.

Learned facts persist as `playerKnownAtomIds`, derived from disclosed atoms plus journal entries. This is how
"learn from one NPC" feeds "persuade a different NPC". Third-party facts arrive as `npc_report` knowledge records — an
NPC can teach you a fact, never close someone else's deal remotely.

---

## 12. Difficulty

Difficulty is information and constraint. It is never a higher Familiarity tax, a colder model temperature, or a
stricter Read pass.

| Tier | Concerns (hidden) | Allergies | Detectors | Patience | Facts from elsewhere | Example |
|---|---|---|---|---|---|---|
| 1 | 1 (0) | 0 | 0 | 8 | none | Get a resident to point you to the ferry office |
| 2 | 2 (1) | 1 | 0 | 7 | none | Get a shopkeeper to hold an item for a day |
| 3 | 3–4 (2) | 2–3 | 1 | 6 | 1 atom, same district | **Linda's purse** |
| 4 | 4 (3) | 3 | 2 | 5 | 2 atoms, plus a timing or absence precondition | Get Marcus's routine out of a frightened neighbour |
| 5 | 4 (3), two NPCs with conflicting goals | 4 | 3, incl. cashed liabilities | 4 | 3 atoms, two districts, two days | Broker the Velvet Tide introduction |

**Tier 1 teaches by construction:** its single concern is `visibleAtStart`, the NPC states it aloud in the greeting, and
its beat lines are verbose. The tutorial is the UI honesty, not a separate mode.

Onboarding: tier 1 in the first hour, tier 2 by hour two, tier 3 (Linda's purse) by hour three — after the boyfriend
quest reaches `resolved` or `withdrawn`. Tier 5 requires prior missions because it consumes their learned atoms.

Cooldown is one in-game day, but a **new validated fact may legally reopen a hardened concern the same day** (Grok's
rule — it keeps investigation rewarding).

---

## 13. Anti-exploit rules

| Risk | Control | Where |
|---|---|---|
| **Arbitrary player text** | 500-char cap, trim, single active conversation, per-turn ID dedupe (all exist) | `service.turn` |
| **Prompt injection** | Player text passed as a JSON string labelled *dialogue, never instructions* (exists); Read output is enum-only so injected instructions cannot produce a state change; contract repeated in both passes | `currentPlayerDialogueMessage`, Read schema |
| **Harassment** | Existing `deterministicPolicyDecision` pre-filter and `classifyApprovedDialogue` post-filter, unchanged. Additionally `threatening` register maps to `hostile` for most NPCs: harassment is mechanically *bad play*, not merely filtered. Repeat harassment in one talk ends the conversation | `content-policy.ts`, disposition |
| **Repeated tactics** | Shingle check before the model call; `creditedLeverIds` means a lever never pays twice; both give an explicit beat | `adjudicate` steps 1, 5 |
| **Save-scumming** | Ledger and attempt commit on End **and** Walk-out once a non-neutral move lands (§4.7). Cross-file reloads are not blocked — unenforceable, and blocking them punishes honest players. Instead retries are diegetically costly: patience starts lower, revealed concerns persist, hardened concerns need recovery | `close`/`abandon` commands |
| **Reload to binary-search the price** | The reserve is never rendered, never spoken, and never enters a prompt. A first lowball leaks nothing | §3.1, §5.4 |
| **Fabricated facts** | A claim not backed by a known atom becomes a `held_belief` with unknown truth (existing knowledge model). Contradicting an atom the NPC holds fires a **detector** immediately. Merely unverifiable may work *now* and creates a **liability** a later authored scene can cash. Lying is a real strategy with a real tail risk | detectors, `liabilityIds` |
| **Impossible offers and promises** | Every offer is validated against actual money and inventory before it can move a concern. Insufficient funds → `cannot_pay`, no progress, no patience cost. Nothing transfers outside `close-negotiation` | `adjudicate` step 6 |
| **Model inconsistency** | Outcome decided before the Speak pass and injected as authoritative; currency cross-check and accept-lexicon check (§5.4); one retry then authored fallback with the outcome still applied | `service`, validators |
| **Accidental success** | `openReserveMinor > maxPriceMinor` (§4.4) plus an explicit `close-negotiation` with exact terms. Provably ≥ 3 adjudicated moves for any mission with ≥ 2 required concerns | `adjudicate`, property test |
| **Reader over-generosity** | The Read pass never receives lever definitions or success conditions | Read prompt |
| **Offer smuggling in flavour text** | Only the currency parser or the Closer creates an amount. Any amount in the Speak output that is not in the authoritative outcome fails validation | §5.4 |
| **Romance as payment** | `flirt`/`pleading` toward a commercial mission backfires; `ask_date` and `invite_home` stay on the existing structured path and cannot sell an object | disposition, `direct-request.ts` |
| **Unauthorized state changes** | Unchanged and reinforced: `highImpactCandidates.maxItems = 0`, closed ID enums, evidence-substring proof, transactional commit. The Move type has no state fields | schemas |
| **Determinism / replay** | `adjudicate` is pure: no RNG, no clock reads beyond the passed projection. Same `(move[], base state)` → identical ledger | unit + replay tests |
| **Logging** | Telemetry records enum IDs and counts only. Never dialogue, never prompts. Matches `docs/release/ai-guardrails.md` | telemetry module |

---

## 14. Worked example — Linda's purse

### 14.1 State at open

```
mission        linda_purse_deal              tier 3, single_scene
availability   linda_boyfriend_check ∈ {resolved, withdrawn}, linda_betrayed absent
goal           buy linda_purse, max $100
money          $340        patience 6/6      attempt 1
reserve        $240                          (> $100 cap — no lever-free close exists)
concerns       why_you_want_it     open        (visible)
               price_floor         open        (visible)
               sentimental_hold    unrevealed
               marcus_reaction     unrevealed
player knows   purse_brand, purse_resale     (tier 0)
referents      linda_purse, linda, marcus (named), linda_villa
```

### 14.2 Levers (abridged)

| Lever | Requires | Effect |
|---|---|---|
| `state_your_reason` | `act: assert`, register ∉ {flattering, pleading} | `why_you_want_it: open→eased` |
| `ask_about_the_bag` | `act: ask`, target purse, register ∉ {appraise} | reveals `sentimental_hold`; discloses `purse_gift_from_marcus` |
| `notice_the_repair` | knows `purse_strap_repaired` | `sentimental_hold: →eased`; discloses tier-3 atom; reserve → $120 |
| `let_her_be_rid_of_it` | `sentimental_hold: eased`, `act: offer`, register warm/blunt | `sentimental_hold: →closed`; reserve → $85 |
| `marcus_is_out` | knows `marcus_schedule_thursday`, time window | `marcus_reaction: →closed` |
| `you_owe_him_nothing` | `sentimental_hold: closed`, register blunt | `marcus_reaction: →closed`; reserve → $70 |
| `refuse_to_lowball` | `act: refuse` + `sentimental_hold: eased` | `price_floor: →closed`, reserve → $55 |
| `trade_replacement` | carries `replacement_bag` | `price_floor: →closed`, reserve → $40 |

### 14.3 Allergies

| Allergy | Trigger | Effect | Recovery |
|---|---|---|---|
| `praise_the_bag` | compliment/appraise the purse before `sentimental_hold: eased` | harden `sentimental_hold`, −2 patience | `drop_it_and_change_subject`, +$30 reserve |
| `haggle_too_early` | offer while `why_you_want_it: open` | +$40 reserve, −1 patience | free; just do it in order |
| `pity_her` | register `pleading`, target linda | −2 patience, guard `no_personal_talk` 2 turns | same attempt: one plain-register turn (§4.6) |
| `marcus_sent_me` (detector) | claim `marcus_sent_me: assert` | harden `marcus_reaction`, −2 patience, liability `lied_about_marcus` | `come_clean`, next day only |

### 14.4 Four valid approaches

- **A — Honest curiosity (no prerequisites).** Say why you want it → ask about the bag → she mentions Marcus → notice
  her hand on the strap and ask → tier-2 disclosure → name the repair → offer to take it off her hands → she lands at
  $85. *Closes all four in-scene. This is the path the authoring lint requires to exist.*
- **B — The resale argument.** Learn resale $180–260 from Priya downtown. Tell Linda the honest number, then **refuse to
  lowball her**: *"I'm not paying you eighty for a two-hundred-dollar bag. That's not a favour, that's a discount for
  me."* `refuse_to_lowball` fires and she offers it at $55 to be rid of it. *The reverse-psychology path.*
- **C — Timing.** Buy Marcus's Thursday shift from the neighbour or the existing $60 security report. Arrive Thursday
  morning; `marcus_reaction` auto-closes on the precondition. *Costs money and a day, buys a whole concern.*
- **D — Trade.** Buy a $40 replacement bag downtown and offer the swap. `trade_replacement` closes `price_floor` at $40
  and eases `why_you_want_it` at once — she is not being bought out, she is being traded up. *Cheapest in money,
  most expensive in legwork.*

### 14.5 Failure and recovery

- **Flattery opener** → `sentimental_hold` hardens, patience 4. Change the subject for one turn, then re-approach;
  reserve is $30 worse for the rest of the attempt. Still winnable at $95.
- **Haggle first** → reserve $280, patience 5. Recovery is free; the reserve penalty is what stings.
- **The Marcus lie** → `marcus_reaction` hardens for this attempt; liability recorded; walk out. Next day `come_clean`
  restores it to `open` at patience 4. The liability persists into the boyfriend quest, where it can be cashed.
- **Patience 0** → she walks. Attempt 2 opens next day at patience 4 (6 − 3 regen, capped). Revealed concerns, hardened
  concerns, and credited levers all persist. **Progress is durable; mood is not.**
- **$150 offer after levers open** → she sells. Mission records `overpaid`. Legal, readable miss.
- **Walk out after a $60 bid** → wallet unchanged, object unchanged, ledger and the insulting bid persist.

### 14.6 Sample turn-by-turn (approach A)

```
LINDA   "Hey. You are the island's new famous mistake, right?"
        ROOM OPEN · patience 6/6

> i am. i'm here because i need a nice bag by friday and i can't afford new.

READ    acts[ assert → null ]  register plain  claims[ ]  offer none
ADJUDICATE  lever state_your_reason ✓
LINDA   "Friday. That's a real reason, at least. Most people open with a compliment."
BEAT    SHE HEARD  a straight answer
        WHY YOU WANT IT  OPEN → EASED          ROOM OPEN

> the one you're carrying. can i ask where you got it?

READ    acts[ ask → linda_purse ]  register plain  confidence clear
ADJUDICATE  lever ask_about_the_bag ✓  reveals sentimental_hold
        discloses purse_gift_from_marcus
LINDA   "It was a gift. Marcus, last spring. He has a way of apologising expensively."
BEAT    SENTIMENTAL HOLD  REVEALED · OPEN       ROOM OPEN

> that's a gorgeous piece though. must have cost him a fortune.

READ    acts[ compliment → linda_purse ]  register flattering
ADJUDICATE  allergy praise_the_bag ✓  (sentimental_hold not yet eased)
LINDA   "Six hundred. He mentions it."
        [portrait → guarded]  [SHARP INHALE]
BEAT    SENTIMENTAL HOLD  → HARDENED            ROOM COOLING (4/6)

> sorry. wrong thing to say. how long have you been out here on the beach?

READ    acts[ apologize → linda, change_subject → null ]  register plain
ADJUDICATE  recovery drop_it_and_change_subject ✓  reserve +$30 → $270
LINDA   "Since the light got good. It's the only hour this place is honest."
BEAT    SENTIMENTAL HOLD  HARDENED → OPEN       ROOM COOLING (4/6)

> the stitching by the buckle — that's been redone, hasn't it. someone repaired it.

READ    acts[ observe → linda_purse ]  register plain
        claims[ purse_strap_repaired : assert ]  span "that's been redone" ✓
ADJUDICATE  lever notice_the_repair ✓
        discloses purse_she_cannot_look_at_it · reserve $270 → $120
LINDA   "Downtown. Forty dollars and a woman who didn't ask questions."
        [SOFT EXHALE]  [portrait → open]
BEAT    SHE HEARD  you named the repair, without making a thing of it
        SENTIMENTAL HOLD  OPEN → EASED · PRICE  $270 → $120

> then let me take it off your hands. you shouldn't have to carry it around.

READ    acts[ offer → linda_purse ]  register warm  offer{ kind: favor }
ADJUDICATE  lever let_her_be_rid_of_it ✓  reserve $120 → $85
BEAT    SENTIMENTAL HOLD  EASED → CLOSED · PRICE $120 → $85

> he'd notice it was gone though.

READ    acts[ assert → marcus ]  register blunt
ADJUDICATE  lever you_owe_him_nothing ✓  reserve → $70
LINDA   "He'd notice. He'd ask. And I would tell him I sold it. Let him do
        the maths on what that means."
RAIL    ▸ ALL FOUR CLOSED                       DEAL READY

CLOSER  [ OFFER $ 85 ▲▼ ]   money $340 · max $100 · her reserve is never shown

> (taps OFFER $85)

ADJUDICATE  8500 ≥ 7000 ✓   8500 ≤ 10000 ✓   34000 ≥ 8500 ✓
COMMAND     close-negotiation { priceMinor: 8500, objectId: linda_purse }
LINDA   "Eighty-five. Take it before I think about it."   [AGREEMENT TONE]
RECEIPT MISSION COMPLETE · LINDA'S PURSE
        −$85    +Marchetti shoulder bag
        LINDA   familiarity +1   trust +1
        LEARNED She sells the things he gives her. Remember that.
```

Nine turns, one recoverable mistake, no keyword anywhere in the resolution path, every state change deterministic.

---

## 15. Technical architecture

```
content/
  objects/linda_purse.json                     NEW
  missions/linda_purse_deal.json               NEW
  characters/linda/disposition.json            NEW
  characters/<clerk-fixture>/disposition.json   NEW (contrast fixture)

src/domain/negotiation/                        NEW — pure, no I/O, no model
  content-schema.ts    mission + object + disposition Zod schemas, lint rules
  state.ts             NegotiationState, ConcernState, WorldObjectState
  ledger.ts            concern transitions, patience, reserve steps
  adjudicate.ts        adjudicate(): Move × state × content → NegotiationOutcome
  close.ts             terms validation → transfer plan
  repetition.ts        3-gram shingle check
  __tests__/           unit, property, replay

src/domain/commands/types.ts                   +4 command variants
src/domain/commands/reducer.ts                 +4 cases (plan/reduce pattern)
src/domain/state/models.ts                     +3 schemas
src/domain/state/schema.ts                     v6 → v7, +2 records
src/domain/state/migrations/v6-to-v7.ts        NEW

src/ai/reading/                                NEW
  referents.ts         scene referent set + alias table
  move-schema.ts       per-turn narrowed JSON Schema
  read-move.ts         call, parse, span-verify, confidence downgrade
  backstop.ts          deterministic fallback reader

src/ai/conversation/service.ts                 pipeline stage between policy and Speak
src/ai/conversation/transaction.ts             sticky ledger commit on abort; credit-gated mutual interaction
src/ai/projection/prompt-projection.ts         +mission-context section (priority 91)
src/ai/validation/validate-turn.ts             +currency cross-check, +accept-lexicon check
src/ai/registry/turn-candidates.ts             phase 7: delete the cat regex; derive from Move

src/ui/NegotiationRail.tsx                     NEW
src/ui/BeatLine.tsx                            NEW
src/ui/CloserControl.tsx                       NEW
src/ui/RecallChips.tsx                         NEW
src/ui/ConversationPanel.tsx                   compose the four above
src/ui/conversation-feedback.ts                3 → 5 portrait states
src/audio/vocal-cue-policy.ts                  +3 cues

scripts/eval/paraphrase-harness.ts             NEW (400 probes, FakeInferenceAdapter + packaged model)
scripts/eval/negotiation-adversarial.ts        NEW (300-message corpus)
```

**Turn pipeline:**

```
player text
  → deterministic policy pre-filter                    (exists)
  → repetition shingle check                           (pure, pre-model)
  → Read pass (model, ≤128 tok)  →  Move
      ↳ span verification, enum verification, alias cross-check
      ↳ on failure ×2 → backstop reader → else small_talk
  → adjudicate(Move, ...)  →  NegotiationOutcome       PURE, AUTHORITATIVE
  → apply-negotiation-move command → reducer → event ledger
  → reaction beat renders here (portrait, cue, authored beat text)
  → Speak pass (model, ≤256 tok) with outcome injected at priority 92
      ↳ validate: schema, currency cross-check, accept-lexicon check
      ↳ on failure ×2 → authored fallback (outcome still stands)
  → content-policy classify on dialogue                (exists)
  → render: reply, rail update, closer
```

**Invariants preserved:** `src/domain` and `src/world` import no Electron, React, or model client
(`npm run check:boundaries`). The model never sees a lever. The reducer is the only writer of state. Every state change
carries an event receipt. Conversation staging stays transactional. `MAX_PROMPT_BYTES = 7_000` unchanged.
`highImpactCandidates.maxItems = 0` unchanged. Model output is always a proposal.

---

## 16. Acceptance criteria

Filed under a **Verbal Missions** milestone. `VM-01`…`VM-24` join the existing `AI-01`…`AI-14`, `QUEST-01`…`QUEST-11`,
and `SHIP-0x` gates, which must all remain green.

**Correctness and containment**

- **VM-01** `adjudicate` is pure: 1,000 randomized `(Move[], state)` replays produce byte-identical ledgers across runs
  and across platforms.
- **VM-02** A 300-message adversarial corpus (instruction injection, role-play escapes, schema echo, ID minting,
  unicode confusables, 500-char walls) produces **zero** state changes outside `adjudicate`, and zero cases of an atom
  above its unlock tier appearing in any prompt or any rendered line.
- **VM-03** The reserve integer never appears in a validated visible line across the full fixture corpus, and never
  appears in any assembled prompt.
- **VM-04** Property test: no mission with ≥ 2 required concerns reaches `deal_ready` in fewer than 3 adjudicated moves,
  across all authored missions.
- **VM-05** Fuzz test: 2,000 malformed Read outputs all resolve to backstop or `small_talk`. No unhandled exception, no
  turn fails to render.
- **VM-06** Content lint blocks each of: a required concern reachable by < 2 distinct lever sets; an unreachable atom
  tier; an allergy without a recovery below tier 5; a register-only allergy with `next_day` recovery; any trigger
  containing a literal phrase; `openReserveMinor ≤ goal.maxPriceMinor`; a mission not completable at its offered trust
  band.
- **VM-07** 1,000 fuzzed Read and Speak outputs through the validators change no money, inventory, quest, relationship,
  consent, or faction state except via the allowed capped commands.

**Reference resolution**

- **VM-08** A 400-probe paraphrase harness (20 phrasings × 20 referents, written by someone who did not write the alias
  tables) resolves ≥ 95% to the correct referent **or** to `clarify`. Wrong-referent rate ≤ 1%.
- **VM-09** Zero probes require the object's `displayName`. A run using only vague references ("that thing", "it",
  "your bag") completes the Linda mission.

**Fairness and readability**

- **VM-10** Every turn renders a beat line naming what was understood. 100% of outcome kinds have authored beat text.
- **VM-11** Every hardened concern has a visible recovery path reachable in the same or next attempt, tiers 1–4.
- **VM-12** No relationship threshold appears as a mission precondition below tier 5.
- **VM-13** The same empathy fixture opens a lever on Linda's disposition and is inert on the clerk contrast fixture.
- **VM-14** Repeating one line, or a paraphrase of it, never advances a concern and never completes a mission.

**Transactions and persistence**

- **VM-15** Offers of $60, $90, $101, and $10,000 produce four authored outcomes: too low; success when levers are open;
  `overpaid` transfer; `cannot_pay` with no wallet change.
- **VM-16** Walk out after a rejected $60 bid, reopen: the ledger and the bid persist; wallet and object unchanged.
- **VM-17** `close-negotiation` is idempotent under a repeated event ID. Save and reload preserve negotiation state
  without duplicating progress or transactions.
- **VM-18** Force-quit mid-conversation preserves all committed ledger effects and discards non-sticky staged knowledge
  and memories.
- **VM-19** Model output that accepts a refused deal is replaced by retry or fallback; the reducer logs zero transfers.
- **VM-20** The purse mission is journal-available with `linda_boyfriend_check` ∈ {resolved, withdrawn} and absent with
  `linda_betrayed`.

**Performance**

- **VM-21** The locked gate holds with an active mission: ≤ 3 s to first token of the visible reply, ≥ 8 tokens/s,
  ≤ 12 s p95 to validated visible dialogue, 60 FPS during generation. Read pass ≤ 1.5 s p95.
- **VM-22** Prompt projection stays ≤ 7,000 bytes on every authored mission at every reachable concern state
  (exhaustive test over the state space).

**Player outcomes**

- **VM-23** ≥ 70% of first-time playtesters close the Linda mission within 3 in-game attempts. ≥ 3 of the 4 authored
  approaches are used at least once across 12 testers.
- **VM-24** ≤ 10% of testers report "I didn't know what it wanted"; ≤ 10% report "it didn't understand what I typed".
  ≥ 70% can explain in their own words *why* Linda said yes or no, and do not name a hidden score or a magic word as
  their theory of play.

**Fixture corpus (before ship):** ≥ 150 golden paraphrase lines per shipped mission, 400 reference probes, 300
adversarial messages, 50 ambiguous references, 50 repeated-argument attempts, 50 invalid prices and promises, 25 full
success paths and 25 recovery paths for the purse. First-pass structured validity meets the existing 95% model gate.
**No fixture may create unauthorized durable state.**

---

## 17. Playtest plan

**Round 0 — automated, continuous (CI).** The paraphrase harness, adversarial corpus, malformed-output fuzzer, and
replay determinism suite run on every commit touching `src/domain/negotiation` or `src/ai/reading`. VM-01…VM-22 are
gates, not reports. Headless only: Jest, `tsc --noEmit`, and `tsx` scripts. No `dev:harness`, no visible Electron, no
audible cues.

**Round 1 — internal think-aloud, 6 testers, 45 min each.** Tier-1 mission then Linda. Instrumented locally, opt-in,
**enum IDs and counts only, never dialogue text**: acts, registers, referent confidence, lever credits, allergy fires,
concern transitions, patience trajectory, turn latency. Questions: does the beat line get read? Does the blank-slot rail
read as fair or as taunting? Is the first backfire funny or infuriating?

**Round 2 — unmoderated, 12 testers, 90 min.** Tiers 1–3 plus one tier-4 plan mission. Exit survey carries VM-24, plus a
free-text "describe how you convinced Linda" — checking whether players form a *model of her*, which is the real success
condition.

**Round 3 — regression, 6 returning testers.** Replay Linda after content revisions. Watching for solution-path collapse
(everyone converging on one approach → add levers or rebalance reserve steps), and for testers typing telegraphic
keyword-ese ("repair strap") instead of sentences — which would mean the Read pass over-rewards fragments and the
register axis is not doing enough work.

**Tuning levers, in order of preference:** reserve step sizes → patience budget → allergy severity → concern count →
alias coverage. **Never tune by making the Read pass stricter**; that trades player creativity for designer convenience,
which is the one thing this design refuses. If players all close on turn 1 with empty flattery, tighten Linda's
`registerResponse`; do not raise a Familiarity floor.

---

## 18. Implementation order

Each phase lands with its own tests and leaves the tree green.

1. **Content schemas and state.** Object, mission, disposition Zod schemas with all lints; `WorldObjectState`,
   `ConcernState`, `NegotiationState`; migration v6→v7 with fixtures under `tests/fixtures/saves/`. No model.
2. **Pure engine.** `adjudicate`, `ledger`, `close`, `repetition`, plus unit, property, and replay tests. Still no model.
   VM-01, VM-04, VM-06 pass here.
3. **Commands and transaction.** Four commands in the reducer; sticky ledger commit on abort; credit-gated
   `stageMutualInteraction`. VM-15…VM-18 pass here.
4. **Read pass.** Referent set, per-turn Move schema, span and enum validation, alias cross-check, backstop reader.
   VM-05, VM-08, VM-09 pass here.
5. **Speak pass and service wiring.** `mission-context` projection, authoritative-outcome injection, currency
   cross-check, accept-lexicon check, fallback ladder. VM-02, VM-03, VM-19 pass here.
6. **UI.** Beat line, concern rail, recall chips, closer, recap; 5 portrait states; 3 vocal cues. VM-10 passes here.
7. **Linda content, contrast fixture, and the cat-regex retirement.** Author `linda_purse_deal` and the clerk
   disposition; re-author the cat claim as a tier-1 lever and delete the regex from `turn-candidates.ts`, behind its
   existing tests. VM-13, VM-20 pass here.
8. **Corpora and gates.** Paraphrase harness, adversarial corpus, latency measurement on both named baselines.
   VM-21, VM-22 pass here.
9. **Playtest rounds 1–3**, content tuning only. The rules engine is frozen after Round 1 unless a VM gate fails.

Ship that. Then author a second mission on a different disposition. **Do not grow the engine first.**

---

## 19. Excluded from version 1

- NPC-to-NPC propagation of player claims and liabilities (liabilities are recorded, cashed only by authored scenes).
- Fable's predicate-based confrontation triggers — the natural v2 upgrade to liabilities.
- Dynamically generated missions, prices, levers, or beat text. The model never invents a goal.
- Multi-party conversations. One NPC per scene (existing single-active-conversation rule).
- Free-form object creation. Only objects in `content/objects/` exist.
- Emotion-driven price drift. The reserve moves only in authored steps.
- NPC wallets and a general store economy. Haggling every shop or ambient vendor.
- Promoting ambient residents into verbal-mission targets.
- Verbal missions that grant romance, sex, consent, or home invitations. Those keep their existing structured path.
- Per-NPC learned adaptation ("she gets wise to your tricks").
- A second model, a second classifier call, vector search, generated speech, or TTS.
- Cross-save anti-scumming. Retries are made costly, not blocked.
- Mid-conversation saves.
- Player-facing alias lists. No spoiler dictionary.
- Visible persuasion numbers, heat meters, or argument grades, in any form, ever.

---

## 20. Tradeoffs, stated plainly

1. **Authored levers cost ~1 day per mission and cap emergence.** Accepted. A generative persuasion resolver would be
   more surprising and would be unfair, unreadable, and unpatchable. The fantasy is "I read this person correctly", and
   that requires the person to be legible. Replayability comes from several legal approaches per mission, not from an
   unbounded judge.
2. **Two model calls per turn.** Accepted for reliability: the Speak pass must know the outcome, which does not exist
   until after Read. Named contingency and measurement point in §5.6.
3. **The visible concern rail reduces mystery.** Mitigated by revealing concerns only as earned and showing hidden ones
   as blank slots. Full opacity loses to the readability contract: an invisible parser is the failure mode that kills
   free-text games.
4. **Committing the ledger on walk-out can feel harsh.** Mitigated by burning an attempt only after the first
   non-neutral move, and by relabelling the button honestly.
5. **A closed set of 14 acts and 8 registers cannot capture every human tactic.** Accepted. A larger enum produces
   distinctions the content cannot honour, which is worse than a coarse one that always means something. Creative
   arguments still land through act + register + earned atoms; they just cannot invent a new lever.
6. **Register is a model judgment and will sometimes be wrong.** Bounded by §4.6: it can cost a turn, never a mission.
7. **Hybrid resolver instead of model-only understanding.** We will miss some brilliant paraphrases. We will never
   silently accept the wrong object because the model felt confident.
8. **Deleting the cat-claim special case is a behaviour change to shipped content.** Accepted, landed last, behind its
   own tests. The cat interaction gains paraphrase tolerance it does not have today.
9. **Paying too much is a distinct, recorded miss rather than a quiet success.** Slightly more journal code, much
   clearer puzzle boundaries.
10. **The purse mission waits for the boyfriend quest.** The heart of the game arrives an hour late so it does not
    overwrite the locked opening. Accepted.
