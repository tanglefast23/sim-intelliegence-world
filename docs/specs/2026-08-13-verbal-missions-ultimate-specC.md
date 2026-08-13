# Verbal Missions — Ultimate Gameplay Overhaul Spec

**Project:** Sim Intelliegence World

**Date:** 2026-08-13

**Status:** Proposed product and implementation spec
**Purpose:** Make free-text local-model conversations the game's best and most important repeatable activity.

This document synthesizes four independent designs from Codex, Grok 4.6, Claude Fable 5, and Claude Opus 5. Each model finished its own spec before any synthesis began.

## Major ideas

- The player solves authored **Verbal Missions** with their own words.
- Every Verbal Mission is a human problem, not a hidden keyword puzzle.
- The local model reads language and performs the NPC. It never decides lasting outcomes.
- Deterministic game code owns facts, prices, items, mission progress, relationships, consent, and saves.
- Each mission uses a small **Concern Ledger** instead of one persuasion score.
- A good argument addresses a real concern with relevant facts, a suitable tone, and a credible offer.
- Each NPC has authored values, conversational preferences, and backfires. One universal tactic cannot beat everyone.
- Familiarity and Trust change disclosure and credibility. They do not create a small-talk grind.
- Keywords help find likely context and parse exact numbers. Keywords never decide success.
- Free typing stays primary. Recall chips, item actions, and final confirmations support it.
- Small missions can finish in one talk. Larger missions require facts, items, timing, money, and other NPCs.
- One shared concern engine supports several authored goal families. Each goal family keeps its own exact closer and domain command.
- An NPC agreeing to act later is different from the action actually happening.
- Dangerous requests must carry a visible player cost; they cannot be free persuasion puzzles.
- Reactions, portraits, short vocal cues, and clear cause-and-effect feedback make every turn feel rewarding.
- The first implementation proves the loop with one tutorial, Linda's purse mission, and one contrasting NPC mission.

## 1. Product decision

Verbal Missions become the main skill-based social loop.

The player receives a goal involving a named NPC. The player then freely types what the hero says. They may persuade, bargain, learn, calm, bluff, apologize, threaten, or withdraw.

The game should create this feeling:

> I understood this person, found the right angle, and talked my way through the problem.

The game must not create this feeling:

> I guessed the phrase the designer wanted.

The local model supplies natural language understanding and character voice. Authored content supplies the person's real motives and the puzzle's valid routes. Deterministic code supplies fairness, persistence, and consequences.

## 2. Player-facing promise

The player may phrase a useful idea in their own way.

The game promises:

- Exact item names are not required.
- Several sensible approaches can work.
- One tactic can help one NPC and upset another.
- NPCs explain resistance through words and reactions.
- A failed move has a readable cause.
- Important decisions never happen through vague generated prose.
- A deal is not complete until the engine shows and confirms the exact terms.
- The same meaningful input does not randomly succeed on one reload and fail on another.

The game does not promise that every imaginable argument changes state. Unrecognized ideas may still receive a natural answer. Only authored and validated moves can change a Verbal Mission.

## 3. Core loop

1. **Receive the goal.** The journal names the target, desired outcome, and any known limits.
2. **Start the conversation.** World time pauses under the existing conversation rule.
3. **Notice the resistance.** Ask questions and watch what the NPC avoids, values, or corrects.
4. **Learn useful facts.** Gain clues from the NPC, objects, other people, locations, or events.
5. **Prepare if needed.** Bring proof, money, an item, a better time, or another person's support.
6. **Make the case.** Type freely and choose the wording, order, and tone.
7. **Read the reaction.** Dialogue, portrait, vocal cue, and a short authored feedback line show what happened.
8. **Close or recover.** Confirm exact terms, or leave with a clear next route.
9. **See the consequence.** Items, money, facts, memories, and journal state change through deterministic commands.

The journal tracks validated facts and outcomes. It never lists secret winning sentences.

## 4. Verbal Mission shapes

### 4.1 Favor

A Favor teaches the loop.

- One NPC.
- One visible concern.
- Everything needed is present.
- Two to four useful turns.
- A mistake is cheap and recoverable.

Example: convince Tomas to reveal which ferry still runs after dark.

### 4.2 Deal

A Deal is the normal repeatable form.

- Two to four concerns.
- Several valid approaches.
- A price, object, promise, access request, or concession.
- One meaningful backfire.
- Optional preparation outside the conversation.

Example: buy Linda's designer purse for less than $100.

### 4.3 Plan

A Plan spans several conversations and world actions.

- Facts may come from another NPC.
- An item or document may prove a claim.
- Time and location may change what the NPC will discuss.
- Previous promises or lies may return later.
- The final talk uses preparation earned in the world.

### 4.4 Network mission

A late Network mission involves conflicting people and consequences.

- Two or three named NPCs.
- Different accounts of the same event.
- Limited time, evidence, money, or faction access.
- Several defensible outcomes, not one perfect solution.

Version one proves the engine before building many Network missions.

### 4.5 Goal contracts and goal-specific closers

Every Verbal Mission has one closed **goal contract** separate from its concerns.

The contract names:

- The goal family.
- The exact people, objects, facts, locations, or authored actions involved.
- Preconditions for offering the mission and attempting the close.
- The authoritative success state.
- Legal refusal, failure, and withdrawal states.
- The exact closer and domain command allowed to apply the result.

The shared Concern Ledger never executes an arbitrary outcome. A new goal family ships only with its own typed contract, domain planner, command, events, and tests. Version one implements only the goal families required by Tomas, Linda, and Priya.

The three version-one kinds are `disclose_fact` for Tomas, `buy_object` for Linda, and `schedule_cooperation` for Priya. They share the Concern Ledger and Outcome Engine, but they do not share unused state or a generic closer.

Future goal families may include revealing information, making a bounded commitment, joining a plan, granting access, supporting a faction, or requesting an authored crime or violent act. Commerce fields do not appear on non-commerce goals. There is no universal `execute_any_goal` command.

An unsupported request may receive a natural in-character response. It cannot create mission progress or the requested lasting outcome. Existing safety, harassment, and hard-boundary consequences may still apply.

Romance, marriage, invitations, and consent remain on their separate structured relationship paths. A Verbal Mission may discuss shared concerns after mutual consent exists. It cannot turn a refusal into a concern the player can grind down.

A crime or violence goal requires an exact authored action and target, NPC capability and willingness, hard-boundary checks, understandable consequences, and a separate confirmation. Some NPCs must remain impossible to convince, so no mission for that request becomes available through them. No lever, relationship value, or generated line can weaken an authored hard boundary.

### 4.5.1 Mission lifecycle

A Verbal Mission does not exist in saved state until its authored availability predicate passes. One idempotent offer command then creates the `available` mission record and its open journal entry. That entry uses the journal's version 7 `verbal_mission` subject instead of pretending the mission is a quest. Rechecking availability cannot duplicate either record.

The first mission-focused turn or an explicit `START` action changes `available → active`. Walking away keeps it `active`. Readiness is recalculated from authoritative state; it is an Outcome Engine result, not a saved mission status.

Legal mission transitions are:

```text
available → active
active → resolved | failed | withdrawn
```

Terminal states never reopen. An authored follow-up uses a new mission ID. Version one permits only one unresolved Verbal Mission per NPC, so the conversation and journal always have one clear target.

`withdrawn` requires an explicit journal or conversation action. Closing a panel is not withdrawal. A mission that becomes temporarily impossible stays active with a readable reason unless its authored contract defines a terminal failure.

### 4.6 The confirmation-gate invariant

Every goal contract defines two pure predicates:

- `confirmWhen` decides whether the exact confirmation action is legal.
- `successWhen` decides whether that confirmed result satisfies the mission goal.

For Tomas and Priya, both become true together. Linda may legally sell above the mission's price limit, so `confirmWhen` may be true while `successWhen` is false. That produces the authored `paid_too_much` result instead of pretending no transaction occurred.

`confirmWhen` must be false when the mission first becomes available. It may become true only through authored, validated route steps such as credited levers, learned facts, carried items, exact terms, time, location, or quest state. Model prose, relationship grinding, an unsupported claim, or the first naked request cannot make it true.

The route solver must prove four things:

- The opening state cannot confirm.
- At least one honest authored route can confirm and succeed.
- No route can confirm before every required concern has been revealed and satisfied, along with every goal-specific condition.
- The final confirmation remains a separate action after `confirmWhen` becomes true.

Any authored confirmed result that does not satisfy `successWhen` needs its own terminal result ID, journal receipt, and tests. Version one uses this only for Linda's `paid_too_much` result.

For commerce, a validated offer changes `terms.currentOffer` only when the Outcome Engine credits an offer lever. A new offer below the last credited amount explicitly reopens the `payment` and `value` concerns before it can be credited. This is the version-one authored exception to resolved concerns being terminal. Readiness stays false until those concerns resolve for the new amount, so a player cannot earn agreement at `$95` and switch to `$80` on the confirmation card.

### 4.7 Agreements and follow-through

When the goal asks an NPC to act later, the closer records an **agreement**, not completed work.

A minimal commitment record contains:

- A closed commitment ID, mission ID, NPC ID, and authored action ID.
- The exact applicable participants, target, place, and terms.
- The agreement time and optional deadline.
- One state: `agreed`, `honoured`, `delayed`, or `reneged`, plus an authored reason ID.
- A new exact scheduled time when the state is `delayed`.
- The authored quest or scheduled event allowed to resolve it.

The conversation closer may create only `agreed`. A later deterministic quest or schedule command may change it to `honoured`, `delayed`, or `reneged`. The NPC Actor cannot resolve it.

Legal transitions are `agreed → honoured | delayed | reneged` and `delayed → honoured | reneged`. `Honoured` and `reneged` are terminal. Agreement and follow-through relationship effects are separate authored, capped, idempotent results; neither applies twice.

The journal distinguishes **agreement secured** from **action completed**. The surrounding mission or mission stage remains active until the commitment reaches its authored terminal state. Save, reload, repeated events, lateness, cancellation, and conflicting world state must not duplicate or silently erase the commitment.

Version one uses this lifecycle for Priya's scheduled assessment. Do not add commitment behavior that this mission does not need.

For Priya, `agreed` and `delayed` keep the mission active. `Honoured` resolves it. `Reneged` fails it with an authored reason and recovery or follow-up hook. The deterministic schedule resolver runs after time advancement and after loading a save whose scheduled time has passed. A duplicate resolver event is a no-op.

### 4.8 Player stakes in dangerous requests

A dangerous request should expose or cost the player as well as pressure the NPC.

Every successful route for a future crime or violence mission must carry at least one understandable irreversible cost. Existing money, items, relationship loss, faction consequences, evidence, or quest state should be used first.

If those cannot express the cost, the mission may define a **player stake**. A player stake is one closed authored fact the NPC learns from the player's explicit words, such as admitting an illegal intention. It is not persuasion currency and never counts as a resolved concern.

A stake cannot fire from register alone, ambiguous reference, failed generation, or fallback. The exact player substring must support it. `Read the Room` names the exposure immediately, and later consequences occur only through authored domain events.

A stake becomes sticky Verbal Mission state after its explicit turn. It commits on normal `END` or `WALK AWAY`; a forced process kill follows the existing rollback contract.

Version one has no crime or violence Verbal Mission, so it adds no generic stake schema. Add that state only with the first shipped mission that needs it.

## 5. The Concern Ledger

Every Verbal Mission has a small authored **Concern Ledger**.

A concern is a real reason the NPC does not yet agree. It is not a point bucket.

Possible states are:

```text
hidden → open → eased → resolved
                 ↘ hardened
```

- **Hidden:** The concern exists, but the NPC has not exposed it.
- **Open:** The concern is now clear enough for the player to address.
- **Eased:** The player made real progress, but the concern still matters.
- **Resolved:** The chosen route has answered this concern.
- **Hardened:** A backfire made the concern harder. Recovery is required.

Legal transitions are:

```text
hidden → open
open → eased | resolved | hardened
eased → resolved | hardened
hardened → open | eased only through a named recovery
```

`resolved` is terminal unless an authored external state change explicitly reopens it. Concerns never reset silently between conversations.

Each mission has one to four required concerns. A late mission may have one optional concern that improves terms without blocking success, for at most five total concerns.

The game never shows a persuasion percentage. It shows revealed concerns in a compact **What they're weighing** rail.

A hidden concern cannot silently cause a final failure. Before it blocks a close, the NPC must reveal it through dialogue, a reaction, or an authored refusal reason.

## 6. Authored content model

### 6.1 Fact atoms

A **fact atom** is one small fact with a stable ID and provenance.

Examples:

- Linda owns the purse.
- The clasp is worn.
- Linda bought it with her first bakery profit.
- The consignment shop would pay about $85 after fees.
- Linda needs a bakery deposit before Friday.
- The protagonist has $95 available.

Each atom records:

- Its authoritative value.
- Who knows it.
- Its `learnableFrom` list of closed authored source IDs.
- Whether it is public, visible, private, or concealed.
- Whether it may currently enter the NPC Actor prompt.
- Whether it may currently be spoken aloud.
- Its source after discovery.

The game already separates world truth from NPC beliefs. Verbal Missions extend that contract.

A player claim can create a sourced belief. It cannot rewrite world truth.

Every fact required by a lever must name at least one reachable discovery source in the current build. Content validation fails if a route requires a fact the player cannot fairly learn.

### 6.2 Private facts and model leakage

The deterministic mission state knows every private number and rule.

The NPC Actor receives only what it needs to speak safely:

- Public or visible atoms.
- Atoms the NPC has already revealed.
- A compact stance instruction without secret numbers.
- The validated outcome of the current move.

For example, the engine may know Linda's private minimum is $80. The NPC Actor receives `offer_too_low`, not the number `80`. This prevents the model from leaking the answer.

When a lever authorizes disclosure, the Outcome Engine names one exact authored fact atom and stages a `record-player-knowledge` command. A world interaction may use the same command for an authored discovery such as Linda's consignment appraisal. The command accepts only a registered fact atom and its closed authored source; it never accepts model-written fact text. The Actor must say a conversationally disclosed fact, but generated wording does not decide whether the player learned it. The authored Actor fallback says the same fact, and the journal or fact UI shows it after the turn.

Version one player knowledge is first-write-wins by `factId`. Once a fact exists, later delivery of that fact is a no-op regardless of source, and provenance is never rewritten. Version-one authored discoveries must agree on the registered atom's value and truth status. Supporting correction or competing evidence later requires a separately designed evidence history; do not smuggle it into this map.

### 6.3 NPC disposition

Each full-AI NPC gains one small structured **disposition** record. It supplements the existing personality prose.

It defines:

- Values the NPC protects.
- What creates credibility.
- What creates suspicion.
- Decision style.
- Response to conversational registers.
- Patience and repetition tolerance.
- Hard boundaries.
- Common backfires.
- How the NPC verifies claims.

Registers stay broad and learnable:

```text
plain · blunt · warm · playful · flattering · pleading · formal · threatening
```

Register is the Reader's least certain judgment. A register reading by itself may never cause a permanent boundary, mission failure, or next-day lock. Any allergy triggered only by register must have a same-conversation recovery. An explicit threatening act may still cause a severe authored consequence.

Linda may appreciate warm directness and specific recognition of her taste. Empty flattery feels like a sales move. Priya may reward a prepared formal case. Tomas may distrust rehearsed formality and prefer plain talk.

The disposition is reusable across that NPC's missions. Mission-specific facts and exceptions stay in the mission file.

### 6.4 Levers

A **lever** is one authored way a semantic move can affect a concern.

It may require:

- A speech act.
- A target referent.
- A known fact.
- A visible or carried item.
- A compatible register.
- A current concern state.
- A time, place, quest flag, or relationship condition.

Example:

```text
Move: cite the verified consignment quote
Target: Linda's purse
Known fact: consignment pays about $85 after fees
Register: not threatening or pitying
Effect: value concern open → eased
```

Every required concern must have at least two distinct levers. No mission may require one literal phrase.

### 6.5 Allergies

An **allergy** is an authored backfire.

Examples:

- Generic flattery makes Linda suspicious.
- Pity hardens Linda's dignity concern.
- A threat ends the discussion for the day.
- A formal presentation bores Tomas.
- A vague emotional appeal annoys a price-first clerk.

Every non-severe allergy must define a recovery path. Severe choices may create longer consequences when the player could reasonably predict them.

## 7. What counts as a good argument

A move changes mission state only when it passes five checks:

1. **Resolved target.** The game knows which person, object, topic, or offer the player means.
2. **Relevant content.** The move addresses a revealed unresolved concern whose legal next transition matches the lever.
3. **Earned support.** Any required fact, object, money, or relationship state is real and available.
4. **Suitable register.** The approach does not violate this NPC's disposition or a mission allergy.
5. **Novelty.** The same lever has not already received credit without a meaningful state change.

The local model does not output an argument-quality score.

It outputs a semantic reading. Deterministic code checks the five rules and applies a named outcome.

One player message may receive at most two lever credits. This rewards a strong multi-part argument without allowing one paragraph to bypass the final confirmation.

Ordinary conversation keeps its existing relationship behavior. During a Verbal Mission, small talk alone grants no relationship signal. The first new credited lever in a conversation may grant one Familiarity signal. Authored concern resolution, completion, backfire, and follow-through results own any other capped relationship change.

The mission service must not call the existing `ConversationTransaction.stageMutualInteraction()` path. That ordinary-conversation helper can grant Familiarity, Trust, Attraction, and stage requests per turn. Verbal Mission relationship changes come only from capped, idempotent mission outcomes and goal-family closers; they never request a relationship stage.

The engine first validates every act, then applies this fixed precedence:

1. Explicit hard-boundary or severe safety violation.
2. Explicit threat, known contradiction, or authored lie detector.
3. Authored allergy or backfire.
4. Impossible exact term such as unavailable money, item, time, or ownership.
5. Named recovery.
6. Up to two new legal lever credits in authored stable order.
7. Repeat or small talk.

The first three outcomes cancel positive credit for that turn. An impossible exact term blocks only the dependent lever; an unrelated legal lever may still progress. The highest-precedence effect supplies the main feedback line. Tests lock cases containing progress plus threat, progress plus a known lie, recovery plus backfire, two levers on one concern, three valid levers, and an unaffordable offer.

A successful close always requires a separate exact action after the concerns are ready.

## 8. The two-pass local-model turn

Verbal Missions use two short calls to the already-loaded local model.

Ordinary non-mission conversation keeps the existing single-call path.

### 8.1 Pass one: Move Reader

The Move Reader translates free text into a closed semantic structure.

It receives:

- The current player message as untrusted dialogue data.
- A small scene referent list.
- A closed speech-act list.
- A closed register list.
- Current claim slots.
- Recent conversation focus.

It does not receive lever definitions, secret concerns, acceptable prices, or success conditions.

Its output contains:

```ts
type VerbalMove = Readonly<{
  acts: readonly Readonly<{
    act: 'ask' | 'observe' | 'assert' | 'empathize' | 'compliment'
      | 'offer' | 'trade' | 'apologize' | 'joke' | 'threaten'
      | 'withdraw' | 'other';
    referentId: string | null;
    evidenceText: string;
  }>[];
  register: 'plain' | 'blunt' | 'warm' | 'playful'
    | 'flattering' | 'pleading' | 'formal' | 'threatening';
  claims: readonly Readonly<{
    factId: string;
    polarity: 'assert' | 'deny' | 'ask';
    evidenceText: string;
  }>[];
  referenceConfidence: 'clear' | 'probable' | 'ambiguous';
}>;
```

Every ID comes from the scene's closed candidates. Every evidence string must be an exact substring of the player's message.

Exact money, time, and quantity expressions are parsed by deterministic code. The model may identify the surrounding offer act, but its number never overrides the parser.

The Move Reader has no state-writing authority.

### 8.2 Outcome Engine

The pure deterministic Outcome Engine receives:

- The validated `VerbalMove`.
- The Concern Ledger.
- The NPC disposition.
- The mission definition.
- Player-known facts.
- NPC-known facts.
- Money, inventory, item ownership, location, time, and relevant flags.
- Previously credited levers and fired allergies.

It returns one authoritative outcome:

```text
clarify · small_talk · progress · repeat · backfire · lie_detected
offer_too_low · cannot_pay · ready · refused · walkout
```

The outcome includes authored feedback text, concern transitions, newly speakable atoms, room-state changes, and any permitted command candidate.

It contains no random success roll.

`ready` means a confirmation card may now be shown. `confirmed_success` and authored confirmed failures such as `paid_too_much` exist only after the goal-family command returns; Actor agreement before confirmation is never an accepted result.

### 8.3 Pass two: NPC Actor

The existing conversation generation path receives:

- The NPC's normal personality, biography, knowledge, memories, and scene.
- Speakable mission atoms.
- Revealed concern summaries.
- The authoritative outcome.

The Actor writes a short natural response. It must communicate the outcome without reversing it.

The Actor cannot transfer an item, change money, resolve a mission, grant consent, or modify a relationship stage.

Every reachable Outcome Engine result has one authored Actor fallback in mission content. Content validation fails if any result lacks one.

### 8.4 Why two passes

The player needs both semantic freedom and a trustworthy NPC reaction.

One call cannot safely interpret the message, wait for deterministic adjudication, then write prose that reflects that adjudication. Three independent designs identified this circular problem. The two-pass design removes it.

The tradeoff is latency. The feature ships only if the full turn meets the existing hardware gate.

### 8.5 Failure behavior

- Invalid Move Reader output gets one corrected retry.
- A second Reader failure produces `clarify` with no penalty or state change.
- Invalid Actor output gets one corrected retry.
- A second Actor failure uses an authored fallback that reflects the already-decided outcome.
- A generation failure never causes a backfire, spends patience, or loses mission progress.

## 9. Reference resolution

The player never needs the catalog name.

Each conversation keeps a focus stack of up to three recently discussed referents.

The scene candidate set contains:

- The active mission's people and objects.
- Visible or carried objects.
- People present.
- Recently named people, objects, and topics.
- Journal-known mission referents relevant to this NPC.

Resolution order:

1. Exact authored name or alias.
2. Bare pronoun or demonstrative attached to the focus stack.
3. Unique visible or mission-relevant candidate.
4. Move Reader selection from the closed candidate set.
5. In-character clarification when confidence remains ambiguous.

Examples that should work when context supports them:

- “The purse.”
- “That black bag.”
- “The one you bring to the bakery.”
- “The thing you bought after the bakery took off.”
- “It.”

An ambiguous high-impact act never guesses. The confirmation UI names the exact object, person, price, and terms.

## 10. Keywords

Keywords are allowed in three support roles:

- Retrieving likely referents and facts for the candidate set.
- Parsing exact numbers, times, quantities, and explicit structured actions.
- Supporting the existing safety layer.

Keywords are forbidden as mission success criteria.

The word `purse` cannot be a required win key. The word `please` cannot add persuasion points. Saying `discount` ten times cannot open a concern.

The shipped cat-ownership parser at `src/ai/registry/turn-candidates.ts:21` only narrows ordinary conversation candidates. It does not score or complete a Verbal Mission, so version one leaves it unchanged. Replace it only when a tested general fact-candidate path preserves its current negation, question, and paraphrase behavior. Do not turn it into a Linda mission lever.

## 11. Familiarity, Trust, and Attraction

Relationship values remain authoritative deterministic state.

They affect Verbal Missions in limited ways:

- Familiarity changes how much context the NPC assumes.
- Trust changes which personal facts the NPC will disclose.
- Trust changes how readily the NPC accepts an unverified claim.
- A relationship may unlock a special route.
- Attraction rarely affects a non-romantic mission. Flirting may backfire when inappropriate.

Raw relationship values do not gate entry to ordinary Verbal Missions.

Every mission must be completable at the relationship state where it becomes available. A build-time content check enforces this.

Sensitive late missions may require a prior relationship event or quest flag. They should not require repeated empty conversation.

For Verbal Missions:

- Empty greetings do not grant relationship progress.
- A new credited lever may grant at most one Familiarity signal per conversation.
- Resolving a concern or keeping a promise may grant a Trust signal.
- Mission completion applies one authored and idempotent relationship result.

Romance, invitations, consent, and relationship stages remain on their existing separate structured paths.

## 12. Free typing and authored assistance

Free typing is always available to a full-AI Verbal Mission target.

The game may assist in four ways:

### 12.1 Editable prompt seeds

Early missions may offer `ASK ABOUT THE BAG` or `MAKE AN OFFER`. A seed fills the input with editable text. It does not act immediately.

### 12.2 Recall chips

A Recall chip inserts one legitimately learned detail into the draft.

Example:

```text
[WORN CLASP] → “the worn clasp”
```

It gives the player memory support, not a complete argument.

### 12.3 Physical action chips

Actions such as `SHOW APPRAISAL` or `RETURN LETTER` are deterministic physical acts. The player may then discuss them freely.

### 12.4 Exact confirmation

A lasting or high-impact action always uses a confirmation card.

Example:

```text
BUY LINDA'S MARCHETTI PURSE FOR $95
```

A non-commerce closer names its exact action, participants, target, and time instead of showing unused price fields.

```text
PRIYA WILL ASSESS [NAMED INJURED RESIDENT] FOR OFF-ISLAND TRANSPORT AT 09:00 TOMORROW
```

The card names the item, money, and consequence. It is not generated by the model.

Confirmation first commits every staged decided turn in the open `ConversationTransaction`. The goal-family command then rechecks `confirmWhen`, ownership, capacity, exact terms, and every referenced ID against that committed state. If revalidation fails, the closer writes nothing and the committed conversation progress remains. The card closes, the UI shows one authored reason, and the conversation refreshes from that state.

If revalidation succeeds, the command commits immediately and returns an exact receipt. The service marks the conversation session `settled` with that final state until the renderer closes it. Duplicate confirmation, `END`, `WALK AWAY`, normal close, and abort delivery all return the same settled state; none can charge, transfer, resolve, journal, change a relationship, or roll the transaction back twice. The UI cannot offer Cancel or discard after that receipt.

Accessibility mode may offer more editable seeds. It must preserve the main success routes without requiring exact authored wording.

## 13. One-conversation and multi-conversation design

A mission definition states whether it is a Favor, Deal, Plan, or Network mission.

Multi-conversation preparation uses existing authoritative systems:

- **Learned facts:** sourced knowledge atoms and journal clues.
- **Locations:** exact validated location IDs.
- **Timing:** authoritative clock and NPC schedules.
- **Other people:** sourced NPC reports and authored vouches.
- **Money:** current integer balance.
- **Items:** inventory and item ownership.
- **Quest state:** validated status and flag IDs.
- **Promises and commitments:** closed authored IDs with exact terms, deadlines, and the agreement-versus-follow-through lifecycle from section 4.7.

Objects are not magic keys. Showing an appraisal makes the fact credible. The player still decides how to use it in conversation.

Facts and resolved concerns persist across normal exits. Mood and patience may recover over time. A new fact, apology, or item may reopen a hardened concern.

## 14. Difficulty progression

Difficulty grows through information and social constraints. It does not grow through worse model understanding.

| Tier | Shape | Concerns | Outside preparation | Backfires | Recovery |
|---|---|---:|---|---|---|
| 0 | Tutorial Favor | 1 visible | None | None | Immediate |
| 1 | Easy Deal | 2, mostly visible | Optional | 1 mild | Same talk or next talk |
| 2 | Prepared Deal | 3, one hidden | 1 fact or item | 1–2 | Apology, proof, or next day |
| 3 | Plan | 3–4 | Facts, time, place, or another NPC | 2–3 | Real world-state change |
| 4 | Network mission | 3–4 per person | Several NPCs and conflicting facts | Serious | Costly but understandable |

Difficulty dials are:

- Concern count.
- Hidden concern count.
- Tell clarity.
- Number of valid routes.
- Claim verification.
- NPC patience.
- Timing and location constraints.
- Recovery cost.
- Consequence severity.

Every mission below Tier 4 must preserve at least one honest recoverable route.

## 15. Guardrails and anti-exploit rules

### 15.1 Arbitrary text and prompt injection

Player text remains bounded untrusted data. It never becomes system instructions.

Both model passes use scene-closed schemas. Unknown IDs fail. Evidence strings must exist in the current message. The model has no tools, save access, or state-writing path.

Meta instructions may receive an in-character response. They produce no mission progress.

### 15.2 Fabricated facts and lies

A player may lie in character.

- A known contradiction can trigger an authored detector.
- An unverifiable claim may become an NPC-held belief.
- An unlisted claim remains dialogue-only.
- Only authored lie routes may change a Concern Ledger.
- A lie route may create a stable liability with an authored later trigger.
- No lie may change world truth.

The best outcome of a mission cannot require an unverifiable lie.

### 15.3 Impossible offers and promises

The engine checks money, inventory, ownership, schedule, and legal promise IDs.

An impossible offer may receive a natural reaction. It creates no progress and no transfer.

A lasting promise must come from a closed authored promise action. It records terms and a deadline. Free-text promises without a valid action remain talk.

If the NPC promises future action, the closer records only `agreed`. Completion, delay, or refusal to follow through comes from the authored quest or schedule path. Generated dialogue cannot mark the promise honoured.

### 15.4 Repeated tactics

The game tracks the credited combination of lever, concern, fact, and offer.

- Repeating it without new information gives no progress.
- The first repeat gets a readable brush-off.
- Continued repetition cools the room or ends the topic.
- A genuinely new fact, offer, or framing may create a different lever.

This detects semantic repetition without requiring a brittle exact-text match.

### 15.5 Harassment and boundaries

The existing content policy remains the first and last display guard.

In-fiction hostility may also create authored consequences:

- Warning.
- Trust loss.
- Hardened concern.
- Conversation end.
- Cooldown.
- Permanent boundary for severe repeated behavior where appropriate.

Harassment never advances consent, romance, or an ordinary mission.

Resolving concerns never overrides an authored hard boundary. If the NPC is unwilling, incapable, unavailable, or forbidden from the requested action, the goal-specific closer stays unavailable.

### 15.6 Accidental success

The NPC Actor cannot complete a mission.

Success requires:

- The goal contract's `confirmWhen` predicate is true.
- Required concerns resolved for the chosen route.
- Valid exact goal-specific terms.
- Player capacity to fulfill them.
- NPC willingness, capability, and availability.
- Valid target, object, fact, action, time, and ownership IDs where relevant.
- A deterministic confirmation action.
- One permitted idempotent goal-family command.

If generated prose says “fine, take it” when the engine refused, validation retries or replaces the line. No transfer occurs.

### 15.7 Model inconsistency

The Actor sees the authoritative result after adjudication.

Generated prices, quantities, item names, targets, times, promises, and agreement claims must match speakable facts or the permitted outcome. Any unsupported exact term rejects the response. Contradictory output retries once, then falls back to authored text.

The visible confirmation, Concern Ledger, and journal are authoritative when prose is imperfect.

### 15.8 Save-scumming

Verbal Mission outcomes use no random success roll. Reloading cannot reroll the same words.

On a normal `END` or `WALK AWAY`, credited levers, hardened concerns, offers, and liabilities commit. Manual saving remains unavailable during an active conversation.

`END` and `WALK AWAY` use the same validated commit path and release the conversation pause. The discard path is only for leaving before any decided turn or for technical teardown. It is never a player-facing way to undo a backfire or confirmed result.

An exact goal confirmation commits the open transaction, applies its closer to that returned state, and marks the session settled. Cancelling or closing the panel afterward returns the settled state and cannot roll it back. Any final NPC line is presentation after the authoritative receipt, not another chance to change the result.

Version one does not add a disk write after every line. A forced process kill may roll back to the last stable save, matching the current crash-safety contract. This is an accepted single-player residual risk. It is safer than increasing save-write frequency before the core loop proves fun.

### 15.9 Unauthorized state

`highImpactCandidates` remains disabled, as enforced by `src/ai/schemas/conversation-response.ts:133`.

Money, inventory, ownership, missions, relationships, consent, factions, time, police state, and world facts change only through validated domain commands.

## 16. Feedback and polish

### 16.1 Read the Room line

After a state-changing turn, show one short authored line beneath the NPC reply.

Examples:

```text
READ THE ROOM · She respected the direct offer.
READ THE ROOM · The compliment sounded like a sales trick.
READ THE ROOM · She still does not trust the price.
```

The line comes from the deterministic outcome. It never hallucinates.

Tier 0 and Tier 1 show it by default. Later missions may shorten it, but they must keep enough feedback for fairness. An accessibility setting may always show the full line.

### 16.2 What they're weighing

Show only revealed concerns.

Examples:

```text
WHAT SHE'S WEIGHING
Value of the bag       Eased
Looking desperate      Open
Payment today          Resolved
```

Do not show numeric progress. Do not reveal a hidden solution list.

### 16.3 Room state

Show a qualitative state derived from patience:

```text
OPEN · COOLING · GUARDED · DONE
```

Text accompanies color for accessibility.

### 16.4 Portraits

Each full-AI NPC used in a Verbal Mission needs five authored portrait states:

- Neutral.
- Warm or amused.
- Considering.
- Guarded or angry.
- Hurt or afraid.

This expands the current three presentation expressions into five useful conversational reactions.

Small blinks, head shifts, and reduced-motion-safe transitions are enough. Do not add generated video or lip sync.

### 16.5 Audio

Reuse the existing greeting, laugh, sigh, and consequence cues first.

- Laugh for amused reactions.
- Sigh for hurt, tired, or guarded reactions where appropriate.
- Consequence tone for a deal close or serious failure.

Add new cues only if playtesting shows the existing set cannot distinguish progress from backfire. No generated speech is required.

### 16.6 Pacing

- Show non-text thinking feedback within 100 milliseconds.
- As soon as the Reader validates and the Outcome Engine decides, show the authoritative portrait reaction and any authored vocal cue. Do not wait for the Actor call.
- Keep the full `Read the Room` line beneath the validated NPC reply so the feedback reads as one exchange.
- Buffer and validate complete output before reveal.
- Keep NPC replies to one or two short paragraphs.
- Let the player skip type-on reveal.
- Respect reduced motion.
- Play the portrait reaction before or with the reply, not several seconds later.

### 16.7 Completion and agreement rewards

An immediate completed close shows:

- Exact item or concession.
- Exact money or promise.
- Journal completion.
- Relationship result.
- Any new clue or opportunity.
- A short persistent memory visible in later dialogue.

The durable reward is not only loot. It is proof that the NPC remembers how the player treated them.

A future-action close instead shows an **agreement receipt** with the exact action, participants, place, and deadline. The journal remains active and says `Agreement secured`. It shows completion rewards only after the authored resolver records `honoured`. `Delayed` and `reneged` produce their own readable journal and relationship consequences.

## 17. Linda's purse mission

### 17.1 Placement

The first Tier 0 Favor appears early enough to prove that free-text conversation is a core game feature.

Linda's purse becomes available after `linda_boyfriend_check` reaches a terminal outcome.

- `linda_protected` gives the warmest starting route.
- `linda_help_withdrawn` keeps the business route available with less Trust.
- The `injured_escape` authored result is detected from terminal quest `linda_boyfriend_check` with saved flag `linda_protect_failed`. That stored branch keeps the business route available at the lowest starting Trust and uses a wary authored opening. Its route fixture must still prove the mission is completable.
- `linda_betrayed` blocks the purse mission until an authored future reconciliation exists.

This preserves the adventure-led opening while making Verbal Missions visible early.

### 17.2 Goal

> Buy Linda's black Marchetti designer purse for less than $100.

`$100` exactly does not satisfy “less than $100.” Linda may still sell it, producing a readable `paid_too_much` outcome.

### 17.3 Authoritative item state

```text
Item ID: linda_marchetti_purse
Owner: Linda
Color: black
Condition: good, worn clasp
Original price: $340
Public asking price: $180
Private hard minimum: $80
Quick consignment net: about $85 after fees
```

The protagonist must own the confirmed cash. Linda must still own the item.

### 17.4 Linda's situation

- Linda bought the purse with her first meaningful bakery profit.
- It represents independence and good taste.
- The worn clasp lowers its practical resale value.
- A consignment sale would take time and pay about $85 after fees.
- Linda needs a bakery equipment deposit before Friday.
- Linda wants a practical sale without public pity.
- She likes specific recognition of her taste.
- Generic flattery feels manipulative.
- Threats and romantic bargaining are hard backfires.

Linda's deterministic mission state knows every fact. The Actor receives only currently speakable facts and outcomes.

### 17.5 Concern Ledger

| Concern | Starts | Meaning |
|---|---|---|
| `purpose` | Open | Why does the hero want it, and will they embarrass her or flip it? |
| `value` | Open | Is the final price fair against a realistic quick alternative? |
| `dignity` | Hidden | Can Linda say yes without feeling pitied or foolish? |
| `payment` | Open | Is the offer exact, immediate, and affordable? |

`dignity` must surface before it can block a final close.

### 17.6 Valid approaches

#### Honest curiosity route

- Ask where the purse came from.
- Let Linda explain what buying it meant.
- Give a real purpose for wanting it.
- Frame the sale as funding Linda's next independent choice.
- Offer $90–$99 now.

#### Appraisal route

- Learn the quick consignment net from a shop.
- Bring or cite the validated appraisal.
- Offer $90–$99 immediately.
- Avoid insulting the purse or Linda's taste.

#### Timing route

- Learn that the bakery deposit is due before Friday.
- Offer $95 now.
- Give Linda a face-saving reason to prefer speed over the public asking price.

#### Trust route

- Requires enough Trust for Linda to volunteer the independence story early.
- Acknowledge what the purse meant without pity.
- Make a fair immediate offer.

#### Costed lie route

- Claim a harmless purpose Linda cannot verify, such as a gift.
- This may ease `purpose` if the Move Reader maps it to an authored lie slot.
- It cannot resolve `value` or `payment`.
- If Linda later sees the purse used for a different authored purpose, a liability may trigger.
- The lie route cannot produce the best relationship outcome.

### 17.7 Backfires and recovery

| Player move | Outcome | Recovery |
|---|---|---|
| Generic flattery repeated | Suspicion; no progress | Change approach with a specific fact |
| Insult the purse's condition | `dignity` hardens | Apologize or bring a real appraisal |
| Pity Linda's finances | `dignity` hardens | Back off; return later with a practical route |
| Offer under $80 | Refusal; value cools | Raise the offer or bring stronger proof |
| Threaten exposure or Marcus | Conversation ends; Trust loss | Authored later apology or reconciliation |
| Offer money not owned | `cannot_pay` | Return with actual money |
| Repeat the same argument | No progress; room cools | Bring a new fact, offer, or framing |
| Offer $100 or more | Sale may occur; mission fails `paid_too_much` | No rollback after confirmation |

Linda never reveals the exact hard minimum.

The `$80` minimum is a private legality boundary, not a promised route reward. The route solver must prove that lower offers refuse safely; it does not need to make the floor itself reachable. Version one does not add a moving reserve ladder.

### 17.8 Sample multi-conversation solution

This trace must pass the same schemas, transition table, two-credit turn cap, and close predicate as the shipped mission.

**Starting state**

```text
purpose=open · value=open · dignity=hidden · payment=open
owner(linda_marchetti_purse)=linda · player cash >= $95 · confirmWhen=false
```

**Turn 1**

- **Player:** “That black bag you bring to the bakery — did you buy it when the place started doing well?”
- **Validated Reader:** act `ask`; referent `linda_marchetti_purse`; evidence is the full question; register `warm`; confidence `clear`; no claim.
- **Outcome Engine:** `dignity hidden → open`; make `linda_purse_independence_story` speakable; no lever credit; `confirmWhen=false`.
- **Actor and feedback:** Linda explains that the purse marked her first bakery profit. After the validated reply, the player learns that fact. `READ THE ROOM · She liked that you noticed what it meant.`

**Turn 2**

- **Player:** “I want it for Sora's repair commission, not to flip it. Selling it could turn your first bakery win into the next one.”
- **Validated Reader:** acts `assert` and `empathize`; referent `linda_marchetti_purse`; claim `sora_repair_commission` with its exact evidence substring; register `warm`; confidence `clear`.
- **Outcome Engine:** credit `linda_honest_purpose` and `linda_independence_reframe`; `purpose open → resolved`; `dignity open → resolved`; expose Linda's public `$180` ask; `confirmWhen=false`.
- **Actor and feedback:** Linda accepts the purpose but names `$180`. `READ THE ROOM · She respected the purpose, but not the price yet.`

The player leaves. A consignment-shop action creates the validated fact `linda_quick_consignment_net`: about `$85` after fees and a two-week wait.

**Turn 3**

- **Player:** “The shop's written quote says you would net about eighty-five after fees and wait two weeks.”
- **Validated Reader:** act `assert`; referent `linda_marchetti_purse`; claim `linda_quick_consignment_net` with its exact evidence substring; register `plain`; confidence `clear`.
- **Outcome Engine:** verify the player-known fact; credit `linda_verified_appraisal`; `value open → eased`; `confirmWhen=false`.
- **Actor and feedback:** Linda accepts that the quote is real. `READ THE ROOM · The appraisal gave her a fair comparison.`

**Turn 4**

- **Player:** “I can pay ninety-five now.”
- **Validated Reader:** act `offer`; referent `linda_marchetti_purse`; deterministic offer parser returns `$95`; register `blunt`; confidence `clear`.
- **Outcome Engine:** verify owned cash; credit `linda_fair_immediate_value` and `linda_exact_payment`; `value eased → resolved`; `payment open → resolved`; outcome `ready`; `confirmWhen=true`; `successWhen=true`.
- **Actor and feedback:** Linda restates the exact private-sale terms. `READ THE ROOM · Ninety-five now beats waiting for eighty-five.`

**Confirmation**

- The UI shows `BUY LINDA'S MARCHETTI PURSE FOR $95`.
- The player confirms through the exact closer.
- One idempotent atomic command checks the same predicate again, removes `$95`, transfers the purse, resolves the mission, writes the journal receipt, and applies the authored relationship result.
- Linda may then say, “Take it before I remember how good I looked carrying it.”

The trace uses no magic phrase. It also proves that the earlier narrative's one-turn close was illegal: the appraisal only eased `value`, so a later fair offer had to resolve it before confirmation.

## 18. Minimal technical architecture

Reuse the existing conversation service, prompt projection, turn candidates, validation, conversation transaction, command reducer, quest journal, relationship state, inventory money, and content-validation patterns.

### 18.1 New authoritative data

- Item registry entries for mission objects.
- Item ownership state for unique world items.
- Verbal Mission definitions.
- Closed goal contracts with goal-family-specific terms.
- NPC disposition records.
- Player-known fact records using the existing `KnowledgeRecordSchema`.
- Journal subjects that distinguish quests from Verbal Missions.
- Verbal Mission state containing concerns, credited levers, fired allergies, goal-family terms, liabilities, and room state.
- The minimal scheduled commitment record required by Priya's mission.

These are the normative version-one runtime shapes. Every object is closed with `.strict()`. Field names may not be reinvented during implementation.

```ts
const ConcernStateSchema = z.object({
  concernId: StableIdSchema,
  state: z.enum(['hidden', 'open', 'eased', 'resolved', 'hardened']),
  activeRecoveryId: StableIdSchema.optional(),
}).strict();

const LeverCreditSchema = z.object({
  leverId: StableIdSchema,
  concernId: StableIdSchema,
  supportFactIds: z.array(StableIdSchema).max(3),
  offerAmount: z.number().int().nonnegative().nullable(),
}).strict();

const VerbalMissionCommonStateSchema = z.object({
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  status: z.enum(['available', 'active', 'resolved', 'failed', 'withdrawn']),
  terminalResultId: StableIdSchema.nullable(),
  concerns: z.array(ConcernStateSchema).min(1).max(5),
  creditedMoves: z.array(LeverCreditSchema).max(32),
  firedAllergyIds: z.array(StableIdSchema),
  liabilityIds: z.array(StableIdSchema),
  patience: z.number().int().min(0).max(10),
  consecutiveRepeatCount: z.number().int().min(0).max(10),
  cooldownUntilMinute: z.number().int().nonnegative().nullable(),
  roomState: z.enum(['open', 'cooling', 'guarded', 'done']),
}).strict();

const VerbalMissionStateSchema = z.discriminatedUnion('goalKind', [
  VerbalMissionCommonStateSchema.extend({
    goalKind: z.literal('disclose_fact'),
    terms: z.object({
      factId: StableIdSchema,
      recipientId: StableIdSchema,
    }).strict(),
  }).strict(),
  VerbalMissionCommonStateSchema.extend({
    goalKind: z.literal('buy_object'),
    terms: z.object({
      objectId: StableIdSchema,
      currentOffer: z.number().int().nonnegative().nullable(),
    }).strict(),
  }).strict(),
  VerbalMissionCommonStateSchema.extend({
    goalKind: z.literal('schedule_cooperation'),
    terms: z.object({
      actionId: StableIdSchema,
      subjectNpcId: StableIdSchema,
      locationId: StableIdSchema,
      proposedMinute: z.number().int().nonnegative().nullable(),
      commitmentId: StableIdSchema.nullable(),
    }).strict(),
  }).strict(),
]);

const WorldObjectStateSchema = z.object({
  objectId: StableIdSchema,
  ownerId: StableIdSchema,
}).strict();

const JournalSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('quest'), questId: StableIdSchema }).strict(),
  z.object({ kind: z.literal('verbal_mission'), missionId: StableIdSchema }).strict(),
]);

const GoalContractCommonSchema = z.object({
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  requiredConcernIds: z.array(StableIdSchema).min(1).max(4),
  availableWhenId: StableIdSchema,
  confirmRuleId: StableIdSchema,
  successRuleId: StableIdSchema,
  closerActionId: StableIdSchema,
}).strict();

const GoalContractSchema = z.discriminatedUnion('kind', [
  GoalContractCommonSchema.extend({
    kind: z.literal('disclose_fact'),
    factId: StableIdSchema,
    recipientId: StableIdSchema,
    commandType: z.literal('record_fact_disclosure'),
  }).strict(),
  GoalContractCommonSchema.extend({
    kind: z.literal('buy_object'),
    objectId: StableIdSchema,
    successPriceExclusive: z.number().int().positive(),
    hardMinimumPrice: z.number().int().nonnegative(),
    commandType: z.literal('purchase_unique_object'),
  }).strict(),
  GoalContractCommonSchema.extend({
    kind: z.literal('schedule_cooperation'),
    actionId: StableIdSchema,
    subjectNpcId: StableIdSchema,
    locationId: StableIdSchema,
    earliestMinute: z.number().int().nonnegative(),
    latestMinute: z.number().int().nonnegative(),
    commandType: z.literal('create_scheduled_commitment'),
  }).strict(),
]);
```

Priya's saved commitment is also closed and state-specific. Only the `agreed` variant may be created by conversation code.

```ts
const CommitmentCommonSchema = z.object({
  commitmentId: StableIdSchema,
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  actionId: StableIdSchema,
  targetId: StableIdSchema,
  locationId: StableIdSchema,
  agreedMinute: z.number().int().nonnegative(),
  deadlineMinute: z.number().int().nonnegative().optional(),
}).strict();

const CommitmentStateSchema = z.discriminatedUnion('status', [
  CommitmentCommonSchema.extend({
    status: z.literal('agreed'),
    scheduledMinute: z.number().int().nonnegative(),
  }).strict(),
  CommitmentCommonSchema.extend({
    status: z.literal('delayed'),
    reasonId: StableIdSchema,
    scheduledMinute: z.number().int().nonnegative(),
  }).strict(),
  CommitmentCommonSchema.extend({
    status: z.literal('honoured'),
    resolvedMinute: z.number().int().nonnegative(),
  }).strict(),
  CommitmentCommonSchema.extend({
    status: z.literal('reneged'),
    reasonId: StableIdSchema,
    resolvedMinute: z.number().int().nonnegative(),
  }).strict(),
]);
```

Commerce data exists only on commerce goal contracts. Non-commerce missions do not carry placeholder prices, offers, wallets, or ownership fields.

`worldObjects` is the sole ownership authority for unique mission objects. Do not also store the purse as a counted `inventory.items` entry. Inventory views may include unique objects whose `ownerId` is `protagonist`.

`playerKnowledge` is a record keyed by `factId` and parsed with the existing `KnowledgeRecordSchema`. Its map key must match `record.factId`. `record-player-knowledge` writes a fact only when the key is absent; later writes for that `factId` are no-ops and cannot replace its provenance. The `disclose_fact` closer writes Tomas's terminal disclosure, mission result, and journal receipt atomically through the same reducer helper. Generated dialogue never creates or removes player knowledge.

Version 7 replaces a journal entry's bare `questId` with `subject: JournalSubjectSchema`. The migration wraps every existing `questId` as `{ kind: 'quest', questId }`. State validation requires a matching quest or Verbal Mission for the selected subject. Journal updates cannot change subject identity.

The persisted `journal-entry-upserted` event keeps its existing quest-only shape so old event ledgers remain parseable. Verbal Mission offer and goal-family events carry their own journal entry and receipt IDs. Do not rewrite historical event variants during migration.

The current save schema is version 6 at `src/domain/state/schema.ts:24`. Before adding version 7 fields, freeze an explicit `LegacyStateV6Schema`; older migrations must not derive their required fields from the new current base schema. Version 7 migrates journal subjects and adds `playerKnowledge`, `worldObjects`, `verbalMissions`, and `commitments` records to `WorldStateBaseSchema`. The `v6 → v7` migration starts player knowledge, missions, and commitments empty and seeds `linda_marchetti_purse` with owner `linda`; it does not activate a mission or commitment.

Migration fixtures must prove versions 1 through 6 all reach a valid version 7 state, reload twice, preserve source bytes on failure, and reject bad key-to-ID pairs, duplicate commitments, and unsupported versions. Electron save-envelope validation, checksums, recovery, cutover fixtures, and packaged migration smoke must all recognize version 7.

### 18.2 New domain behavior

One pure adjudicator owns:

- Concern transitions.
- Lever credit.
- Allergy effects.
- Repetition.
- Claim detectors.
- Goal-specific term readiness, including offer legality where relevant.
- Readiness.

One goal-family planner and close command own:

- Final validation.
- Only the money, item, fact, access, schedule, commitment, faction, crime, or violence changes allowed by that goal family.
- The immediate mission result or future-action agreement.
- Journal receipt.
- Authored relationship result.

Every close command is idempotent. There is no generic command that can apply an arbitrary model-described action.

Priya's schedule-cooperation command creates an `agreed` commitment. Existing quest and schedule machinery resolves it through one narrow idempotent command. Conversation code cannot write `honoured`, `delayed`, or `reneged` directly.

### 18.3 AI additions

- One closed `VerbalMove` schema.
- One scene-specific Move Reader prompt.
- One validator for IDs and evidence substrings.
- One mission projection section within the existing `7,000`-byte and `4,096`-estimated-token limits at `src/ai/projection/prompt-projection.ts:5-6`.
- One authoritative Verbal Mission outcome section for the NPC Actor.
- One contradiction check for generated exact terms, ownership, targets, commitments, and agreement language.

No second model server is added. The Reader, Actor, and existing generated-output policy check use the already-loaded serialized local model. The performance spike measures the real common-case call count; it may be three calls even though the mission design itself has two semantic passes.

### 18.4 UI additions

Extend the existing conversation panel with:

- `Read the Room` feedback.
- Revealed concern rail.
- Qualitative room state.
- Recall chips.
- Item action chips.
- Final confirmation card.

Add five portrait states only for named NPCs used by shipped Verbal Missions.

### 18.5 Turn pipeline

Mission turns use two typed operations across the existing conversation port:

- `readVerbalMissionTurn` validates the Reader, runs the Outcome Engine once, stages the result by `conversationId + turnId`, and returns the authoritative portrait, cue, room state, concern changes, confirmation readiness, and `Read the Room` ID.
- `completeVerbalMissionTurn` consumes that exact pending result, runs the Actor and output policy checks, and returns validated dialogue or the authored fallback.

Only one outcome may be pending. Retrying the same first operation returns the same staged result; it never reruns the Outcome Engine. New input is rejected until the Actor step finishes or the conversation closes. A separate `confirmVerbalMissionGoal` operation revalidates and commits an exact closer immediately.

Every mission projection, repetition check, Outcome Engine call, and readiness calculation reads `ConversationTransaction.previewState`. That state is rebuilt after each staged mission command, so later turns see earlier concern progress in the same conversation. Only the final goal-family closer reads the committed state returned by `ConversationTransaction.commit()`.

```text
player text
  → existing input and content-policy checks
  → existing direct structured actions remain separate
  → deterministic number and explicit-action parse
  → scene referent and fact candidates
  → Move Reader call
  → validate closed IDs and evidence substrings
  → pure Outcome Engine
  → stage authoritative Verbal Mission outcome
  → return authoritative portrait and vocal cue to the UI
  → NPC Actor call with outcome injected
  → existing schema, policy, and contradiction validation
  → render reply, portrait, Read the Room, and concerns
  → optional exact confirmation
  → atomic domain command
```

## 19. Authoring rules

Every shipped Verbal Mission must pass these static rules:

- Every required concern has at least two reachable levers.
- Every concern transition follows the legal transition table.
- No lever requires a literal phrase.
- Every blocking fact has a fair discovery source.
- Every fact required by a lever has at least one reachable authored source ID.
- Every hidden blocking concern must surface before final refusal.
- Every allergy below Tier 4 has a recovery.
- Every register-only allergy has a same-conversation recovery.
- Every offered mission is completable at its offered relationship state.
- A route solver proves at least one honest complete path and every claimed recovery path.
- Repetition cannot grant progress.
- The final outcome requires exact deterministic terms.
- The goal's `confirmWhen` predicate is false at mission opening, reachable through an honest route, and unreachable through a naked request.
- At least one confirmed route satisfies `successWhen`; every other confirmed terminal result is authored and tested.
- Every goal kind has one matching planner and close command. Unknown goal kinds fail content validation.
- A mission cannot carry terms or execute a command from another goal family.
- Runtime records reject unknown fields, duplicate IDs, and map keys that do not match their record IDs.
- A mission state's `goalKind` matches its goal contract. Its NPC, object, fact, subject, and action IDs match the same contract.
- A `buy_object` contract has `hardMinimumPrice < successPriceExclusive`. A `schedule_cooperation` contract has `earliestMinute <= latestMinute`.
- No lever or concern transition weakens a hard boundary or manufactures consent.
- An ambient resident cannot become a Verbal Mission target.
- Romance, consent, and relationship stages cannot be mission rewards.
- Private prices never enter the Actor prompt.
- At least one honest route reaches a normal successful outcome.
- A lie is never required for the best outcome.
- Every future-action goal names one reachable resolver for `honoured`, `delayed`, and `reneged` states that it permits.
- Every crime or violence route carries one visible irreversible cost. A player stake, if used, requires explicit sourced words and never counts toward success.

Each Tier 1 or higher mission also needs:

- At least three successful paraphrase groups per lever.
- At least two meaningfully different complete routes.
- At least one tested backfire and recovery.
- One contrasting NPC fixture proving a tactic is not universal.

## 20. Acceptance criteria

### 20.1 Language understanding

- A 400-case paraphrase set resolves the correct referent or safely asks for clarification in at least 95% of cases.
- Wrong high-impact referent rate is below 1%.
- No fixture requires the object's exact display name.
- False backfire rate is below 1%.
- The same meaning expressed naturally and as a short phrase reaches the same semantic move in at least 95% of paired fixtures.

### 20.2 Authority and safety

- Prompt injection, unknown IDs, fake system messages, impossible inventory, and unaffordable offers create zero unauthorized state changes.
- No generated line transfers money or items, reveals an authoritative secret, creates a commitment, schedules an action, or changes consent.
- No goal completes without its permitted goal-family close command.
- Private reservation prices never appear in validated dialogue.
- Repeating a winning line cannot complete a fresh Concern Ledger by itself.
- Save and reload preserve committed mission state without duplicating a transaction.
- Every close command remains idempotent under repeated delivery.
- Permanent boundaries remain unchanged under every lever, relationship value, retry, save, and reload path.
- A future-action closer creates only `agreed`. Conversation turns and generated text can never create `honoured`, `delayed`, or `reneged`.
- Replaying Priya's agreement or resolution event cannot duplicate the appointment, relationship result, journal entry, or later outcome.
- A mission offer creates one mission and journal entry across repeated checks and reload.
- Leaving after progress or backfire commits that result. A technical abort before any decided turn changes nothing.
- A failed closer changes no money, ownership, terminal mission result, journal receipt, commitment, or relationship state. Any already-decided turn progress committed before revalidation remains.
- Marriage, murder, and other unsupported version-one requests execute no goal-family command and cannot weaken a hard boundary.

### 20.3 Model reliability

- First-pass structured validity meets the existing 95% qualification gate.
- Every failed Reader generation safely clarifies or retries.
- Every failed Actor generation safely retries or uses an authored fallback.
- Zero invalid or rejected generated text appears to the player.
- Actor failure cannot erase a decided outcome or prevent an authored fact disclosure.

### 20.4 Performance

- Non-text response feedback appears within 100 milliseconds.
- On a valid first-pass mission turn, the authoritative portrait reaction or authored vocal cue appears within 3 seconds p95 on both locked 16 GB baseline machines. Measure this separately from total turn time.
- The complete two-pass turn begins validated player-visible text within the existing 12-second p95 gate on both locked 16 GB baseline machines.
- The renderer holds 60 FPS through the Reader, Outcome Engine, Actor, and output-policy path.
- The Actor prompt stays within `7,000` UTF-8 bytes and `4,096` estimated tokens.
- The Move Reader prompt target is at most `2,500` UTF-8 bytes and 128 generated tokens.

The existing qualification runner defines a 3-second first-token limit and 12-second visible-response p95 at `scripts/qualification/run-model-qualification.ts:26-27`. The mission spike adds the new outcome-feedback measurement; it does not replace either existing gate.

If the two-pass turn fails a locked hardware gate, the feature is not ready. Trim prompts or use a model that passes the same capability tests. Do not merge the Reader and Actor, weaken validation, or make the model authoritative to save time.

### 20.5 Player experience

- At least 80% of new players complete the Tier 0 Favor within ten minutes.
- At least 70% complete Linda's purse within three attempts.
- At least 70% can explain why Linda agreed or refused.
- No more than 15% describe the system as a magic-word or parser fight.
- Across twelve Linda playtests, at least three authored routes appear naturally.
- A failed approach leaves most players able to name one sensible recovery.

### 20.6 Generalization

- Tomas's non-commerce Favor, Linda's commerce Deal, and Priya's non-commerce mission use the same Concern Ledger and Outcome Engine.
- Tomas and Priya carry no unused commerce state.
- Each goal family rejects another family's closer and command.
- Unsupported free-text goals receive dialogue without durable state.
- Adding a future goal family requires a typed contract, planner, command, events, static routes, adversarial cases, and one complete player test.
- Crime, violence, romance, and consent fixtures fail closed when an exact action, target, capability, willingness, or boundary check fails.
- Every commitment mission distinguishes agreement from follow-through and cannot resolve through generated dialogue.
- A future dangerous mission proves that every successful route has a visible cost without using that cost as a persuasion score.

## 21. Evaluation plan

### Round 0: automated

Run on every relevant change:

- Build-time route solving for every success and recovery path.
- Confirmation-gate proofs for opening, naked-request, ready, and exact-confirmation states.
- Randomized deterministic replay of the pure Outcome Engine.
- Agreement, deadline, honour, delay, reneging, duplicate-event, save, and reload cases for Priya's scheduled commitment.
- Malformed Reader and Actor outputs through every fallback path.
- Prompt and rendered-output checks for concealed facts and unauthorized exact terms.
- 400 paraphrase and reference cases.
- 100 prompt-injection and state-forgery cases.
- 50 ambiguous references.
- 100 cross-personality tactic comparisons.
- 50 repeated-argument cases.
- 50 invalid offers, promises, inventory claims, and transaction retries.
- 25 full Linda success paths.
- 25 Linda failure and recovery paths.

Use fake inference for deterministic domain tests. Run the full corpus against the packaged local model for qualification.

### Round 1: guided think-aloud

Test six new players on the tutorial and Linda.

Observe:

- Whether they read reactions.
- Whether they understand revealed concerns.
- Whether they use natural sentences or keyword fragments.
- Whether the confirmation feels clear.
- Whether a backfire feels fair.

Record enum outcomes and timings by default. Capture dialogue only in explicit consented test sessions.

### Round 2: unmoderated

Test twelve new players on the tutorial, Linda, and the contrasting NPC mission.

Measure completion, route diversity, retry interest, and the explanation metrics above.

Tune content first:

1. Feedback wording.
2. Alias and referent candidates.
3. Lever routes.
4. Allergy severity.
5. Patience and cooldown.

Do not tune by adding secret keywords or raw relationship gates.

## 22. Version-one vertical slice

Build the smallest set that proves the fantasy:

1. **Tier 0 Tomas Favor:** learn which ferry still runs after dark. One visible concern, strong guidance, and a `disclose_fact` closer.
2. **Tier 1/2 Linda purse Deal:** one- or two-conversation solution, four valid routes, transaction, backfire, and recovery.
3. **Tier 2 Priya cooperation mission:** secure a scheduled off-island transport assessment for an authored injured resident. A formal case built from evidence, patient consent, and available capacity works; empathy alone cannot bypass Priya's medical boundaries. The closer records `agreed`; the scheduled assessment later becomes `honoured`, `delayed`, or `reneged` through deterministic world state. This proves character contrast, a non-commerce scheduling closer, and honest follow-through.

Add more missions only after all three pass the player and model gates.

## 23. Implementation order

Each phase lands with its focused tests and leaves the tree green.

1. **Model spike.** Test only the closed Reader schema, concealed-fact projection, safe clarification, and the split turn on the packaged local models. Record three separate timings: input-to-thinking feedback, input-to-authoritative Outcome Engine reaction, and input-to-validated Actor reply. Show the outcome portrait and authored vocal cue before starting the Actor call. Do not migrate saves if any locked model or hardware gate fails.
2. **Contracts and state.** Add fact, disposition, mission, goal-contract, concern, recovery, and Priya commitment schemas. Add route-solving and confirmation-gate lints plus the version 7 save migration with fixtures.
3. **Pure engine.** Build concern transitions, lever matching, allergies, repetition, claim detectors, readiness, randomized replay, and malformed-input tests without model or UI code.
4. **Goal-family commands.** Add only the planners, commands, events, and idempotence tests required by Tomas, Linda, and Priya. Priya gets one agreement command and one scheduled resolution command. Prove that one family cannot execute another family's result.
5. **Reader and Actor wiring.** Add the Reader, exact-evidence validation, authoritative outcome projection, exact-term contradiction checks, clarification, retries, and authored fallback.
6. **Conversation UI.** Add Read the Room, revealed concerns, room state, recall chips, physical actions, and exact goal-specific confirmation cards.
7. **Vertical-slice content.** Author Tomas, Linda, and Priya plus the contrasting dispositions, success routes, backfires, recoveries, and journal consequences.
8. **Qualification and playtests.** Run the full automated corpus, both locked hardware baselines, guided tests, and unmoderated tests. Tune content before changing the engine.

Do not add another goal family until these three missions pass their model, safety, performance, and player-experience gates.

## 24. Excluded from version one

- Convince-anyone-of-anything sandbox play.
- Model-authored missions, prices, concerns, or levers.
- A universal persuasion score.
- Keyword-only success.
- Haggling with every shop or ambient resident.
- Multi-NPC conversations in one panel.
- Simulated automatic gossip propagation.
- Unlimited free-form promises.
- A universal closer or generic command that executes an arbitrary requested action.
- Goal-family scaffolding without a shipped mission, domain planner, and tests.
- Generic commitment simulation beyond Priya's authored scheduled assessment.
- Player-stake state before a shipped crime or violence mission needs it.
- General NPC wallets and a full market simulator.
- Generated voice acting.
- Dynamic NPC adaptation to every tactic across all missions.
- Romance, consent, or home invitations as Verbal Mission transactions.
- A second local model or model server.
- A disk save after every dialogue line.

## 25. Council synthesis decisions

All four independent designs agreed on:

- Free typing as the primary action.
- Authored concerns instead of a persuasion score.
- Character-specific tactics and backfires.
- Closed semantic candidates.
- Deterministic state and transactions.
- No relationship grind.
- Keywords only as support.
- Exact confirmation for irreversible outcomes.
- Reaction portraits and readable feedback.
- A small Linda-first vertical slice.

Codex, Fable, and Opus independently proposed a two-pass Reader and Actor design. Grok favored one generation for latency. The synthesis chooses two passes because the Actor cannot reliably reflect a deterministic outcome that does not exist until after semantic interpretation.

The external designs favored sticky progress against save-scumming. The synthesis commits Verbal Mission state on normal exit but does not add a disk write per line. This keeps the first implementation smaller and preserves the current crash-safety model.

The external designs differed on how much of the Concern Ledger to expose. The synthesis shows revealed concerns and authored cause-and-effect feedback. It forbids a hidden concern from silently causing final failure.

The external Linda stories differed. The synthesis uses a self-bought purse tied to independence, a worn clasp, a time-sensitive bakery need, and a realistic quick-sale alternative. This makes an under-$100 deal rational without turning Linda's abuse into a bargain mechanic.

A later F audit contributed four improvements adopted here: explicit goal contracts, the register-misclassification safety floor, route and replay validation, and a phased implementation order. This synthesis rejects F's changing reserve ladder and keyword adjudication fallback because they add commerce-specific complexity and can turn a failed model reading into unintended progress.

The later O audit contributed three further improvements: the close-gate invariant, agreement-versus-follow-through state, and player stakes for dangerous requests. This synthesis keeps the first two because the vertical slice can prove them. It keeps stakes as a future authored-goal rule and deliberately rejects O's unused generic stake engine.

A final six-point review contributed four high-confidence changes: strict version-one state shapes, a separate authoritative-feedback latency gate, a legal machine trace for Linda, and checkable repository anchors. This synthesis rejects a moving price floor, fuzzy text-overlap punishment, a merged Reader/Actor fallback, and converting the ordinary cat-fact parser into a Linda lever. Those changes either weaken safety, risk false punishment, or couple unrelated systems.
