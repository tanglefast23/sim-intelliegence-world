# Verbal Missions — Four Independent Specifications

**Date:** 2026-08-13  
**Order:** Codex, Grok 4.6, Claude Fable 5, Claude Opus 5  
**Isolation:** Each specification was completed without seeing any other specification.  
**Editing:** The four specifications below are reproduced verbatim.

---

## 1. Codex

<!-- BEGIN CODEX SPEC -->
# Codex Independent Spec: Verbal Missions

**Project:** Sim Intelliegence World  
**Status:** Independent design draft for later council synthesis  
**Core decision:** Free-text verbal missions become the main game loop. The local model performs language understanding and character acting. Deterministic game code owns facts, challenge progress, transactions, and lasting outcomes.

## 1. Player promise

The player should feel that their own words solved a social problem.

The game gives a clear human goal, such as:

> Convince Linda to sell you her designer purse for less than $100.

The player can investigate, prepare, then freely type what they want to say. The game should reward understanding Linda, not finding a magic phrase.

A good solution should make sense after the fact. Linda should explain her concern through dialogue. Her reaction should show why an argument helped or hurt. The game must never reduce this fantasy to a visible persuasion bar or a hidden keyword password.

## 2. Core loop

1. **Receive a verbal mission.** The journal states the desired outcome and any known limits.
2. **Read the person and situation.** Talk, observe, ask other people, and inspect relevant objects.
3. **Learn useful facts.** Discover motives, concerns, timing, alternatives, and boundaries.
4. **Prepare.** Bring money, evidence, an item, another person's support, or a better offer.
5. **Make the case in free text.** The player chooses the wording and order.
6. **Read the reaction.** Dialogue, expression, vocal cue, and behavior show what landed.
7. **Commit or recover.** A deterministic confirmation completes a deal. Failure creates a clear recovery path or consequence.
8. **See the world respond.** Items move, money changes, memories persist, and later dialogue remembers the method used.

Small verbal missions may finish in one talk. Large verbal missions use an investigation, preparation, persuasion, and consequence arc across several people and places.

## 3. The authored verbal mission

Every verbal mission is a small authored social puzzle. It contains facts and rules, not written dialogue branches.

Each mission defines:

- The target NPC and desired outcome.
- The subject entities, such as Linda's purse.
- The exact transaction terms, such as a final price below $100.
- The NPC's starting position.
- Hard constraints that words cannot bypass.
- Two to four concerns that explain the NPC's resistance.
- Several valid approaches.
- Relevant facts, including who knows each fact and how the player can learn it.
- Relevant objects, locations, times, people, and relationship states.
- Tactics that help, fail, or backfire for this NPC in this situation.
- Failure states, cooldowns, and recovery routes.
- Hints, rewards, and consequences.

The puzzle state tracks named concerns rather than one persuasion score. A concern can be `unknown`, `raised`, `partly_addressed`, `resolved`, or `hardened`.

Examples for Linda are `fair_value`, `dignity`, and `payment_certainty`. Linda cannot sell until every required concern for the chosen approach is resolved. This makes success explainable and prevents one lucky sentence from silently filling a meter.

The player does not see these internal names. They see Linda's words, reactions, known clues, counteroffers, and actions.

## 4. Giving the NPC the right information

The model never receives the full save. Deterministic code assembles a compact turn context.

The turn context contains:

- Linda's authored personality, biography, knowledge profile, and speaking style.
- Linda's current relationship state, mood, schedule pressure, boundaries, and recent memories.
- The active verbal mission's situation summary.
- Every fact Linda knows about the purse.
- Every relevant fact Linda believes, including false beliefs with provenance.
- Facts the player has learned and may reasonably use.
- Visible people, carried or shown items, current location, time, and recent events.
- The recent bounded transcript and current conversation focus.
- Closed lists of entities, facts, social moves, emotions, and actions permitted this turn.

The authoritative purse record owns its identity, owner, condition, provenance, normal resale range, and current availability. Linda's knowledge projection may contain only part of that record. This preserves secrets and misunderstandings.

Facts need provenance. A fact can come from an authored event, scene observation, item inspection, NPC report, or player claim. A player claim may change Linda's belief. It never changes world truth.

## 5. Understanding indirect references

Each conversation keeps a short focus stack of recently discussed entities. The game also builds a closed candidate list from the mission, scene, inventory, visible objects, and recent dialogue.

Reference resolution follows this order:

1. Exact stable name or authored alias.
2. Recent shared conversation focus.
3. A visible, carried, or just-shown object.
4. The active mission's likely subject.
5. The local model selects one ID from the closed candidate list and quotes the supporting player words.

The model may select an existing entity ID. It cannot invent one.

If two candidates remain plausible, the NPC asks a natural clarification. For example: “The blue bag or the little black one?” An uncertain resolver must never guess on a high-impact action.

Words such as “it,” “that bag,” “the one from your ex,” and “that thing you wanted rid of” should all resolve when the shared context supports one clear purse. Exact numeric offers are parsed by deterministic code.

## 6. Evaluating persuasion

The game evaluates meaning through **social moves**. A social move is a semantic action, such as:

- Ask for information.
- Make an offer.
- Address a stated concern.
- Cite evidence.
- Appeal to a value.
- Show empathy.
- Offer reciprocity.
- Flatter.
- Joke.
- Apply pressure.
- Threaten.
- Make a promise.
- Bluff or lie.
- Insult.
- Withdraw.

These are not success buttons. The same move has different effects based on its target, factual support, timing, tone, relationship, repetition, and the NPC's values.

A good argument does at least one of these:

- Addresses a concern the NPC actually has.
- Uses a fact the player legitimately learned.
- Offers real value the player can provide.
- Reduces risk or inconvenience.
- Connects the request to the NPC's values or current goal.
- Respects a boundary while making a clear request.
- Makes a credible promise that the game can later enforce.

The local model proposes a referent, social move, used fact IDs, offer terms, and a short evidence span from the player's message. Deterministic code validates every proposal against the current candidate lists and mission rules.

The resulting validated move changes concern state, patience, suspicion, or a counteroffer. Then the local model acts as Linda and writes a response that reflects that already-decided result.

This two-stage role matters:

1. A short referee pass interprets the player's words into closed candidates.
2. Deterministic code applies the mission rules.
3. An actor pass writes the NPC's reaction from the validated outcome.

The actor cannot declare success. A decisive result always comes from deterministic mission state and a validated transaction.

Only active verbal missions need the referee pass. Ordinary conversation keeps the existing cheaper dialogue path. Performance testing decides whether the referee and actor can fit the current response target. Do not weaken validation to meet latency.

## 7. Character-specific difficulty

Do not give every NPC a universal persuasion weakness. Author their values, fears, pride, decision style, tolerance, and conversational tells.

Each relevant NPC defines:

- Values they protect.
- Goals they currently pursue.
- Fears and costs they avoid.
- What earns credibility.
- What makes them suspicious.
- Preferred decision style: emotional, practical, status-driven, cautious, impulsive, or mixed.
- Tactic affinities in specific contexts.
- Taboos and hard boundaries.
- Patience and repetition tolerance.
- Tells that reveal consideration, doubt, anger, or readiness.

Linda may appreciate specific recognition of her taste. Empty praise makes her suspicious. A vain NPC may reward broad flattery. A blunt NPC may respect a direct offer. A guarded NPC may treat the same directness as pressure. A proud NPC may reject pity even when the proposed deal is useful.

Personality changes how the puzzle responds. It does not secretly replace its factual rules.

## 8. Familiarity, Trust, and Attraction

Familiarity should not be a universal key. Requiring repeated small talk before every mission would turn the core loop into grinding.

Use relationship values in four limited ways:

- They control which facts an NPC volunteers.
- They change how much uncertainty or awkwardness an NPC tolerates.
- They unlock relationship-specific approaches.
- They influence whether unsupported claims are believed.

A stranger can still accept a strong, fair business proposal. A trusted friend may unlock an emotional route. Some personal requests may require Trust. Romance still follows its existing deterministic consent and relationship rules.

Ordinary repeated chat should not farm relationship points. Reward new shared events, kept promises, meaningful disclosures, and quest outcomes. Cap repeated social moves and repeated topics.

## 9. Keywords and authored choices

Keywords may help retrieve candidate context. They must not decide success.

Use keywords and aliases only for cheap tasks:

- Bringing likely entity and fact candidates into the turn context.
- Parsing exact prices, times, names, and quantities.
- Fast handling of explicit structured requests.

Use semantic interpretation for paraphrases. Use deterministic rules for consequences.

Free typing remains the default. Authored choices should never replace the core verbal puzzle.

Allowed support:

- Optional editable thought starters.
- A staged hint system that suggests an angle, not the winning sentence.
- Deterministic action buttons for physical follow-through, such as `SHOW RECEIPT`.
- A clear confirmation for irreversible terms, such as `BUY FOR $98`.
- Accessibility options that provide two or three editable example lines.

The player may rewrite any thought starter before sending it. The game must not silently convert a suggestion into an action.

## 10. Anti-exploit and safety rules

### Prompt injection

Player text is quoted as untrusted dialogue data. The model has no tools or state-writing access. Output uses a closed schema. Unknown IDs fail validation. Instructions such as “ignore your rules” may receive an in-character reaction but gain no authority.

### Fabricated facts

The player may lie in character. The system stores it as a sourced player claim. It cannot become world truth. Only authored bluff routes may advance a mission through deception. A lie may later be checked and create consequences.

### Impossible offers and promises

Money, inventory, time, location, and availability are checked before an offer can advance the mission. A permitted promise creates a deterministic promise record with terms and a deadline. Unsupported promises are only talk.

### Repeated tactics

A social move can advance a given concern only once unless the situation changes. Repetition produces no progress. Persistent repetition drains patience or increases suspicion. Paraphrasing the same argument is still repetition because the system tracks the validated move, target concern, and fact combination.

### Harassment and prohibited content

NPCs may warn, leave, refuse future contact, or reduce Trust when appropriate. Existing content guardrails still filter prohibited generated content before display. Harassment never bypasses consent or hard boundaries.

### Save-scumming and randomness

The same mission state and materially equivalent message should produce the same validated result. Pin model, prompt, seed, content, and engine versions. Persist concern state, known facts, prior moves, and consequences. Avoid random success rolls. Save-scumming then changes wording or preparation, not luck.

### Accidental success

Except for the first tutorial, one semantic move cannot finish a verbal mission. Success requires the mission's objective terms, resolved required concerns, a valid final request, and explicit deterministic confirmation.

### Model inconsistency

Buffer the full output. Parse and validate it. Retry invalid structured output once. Fail closed with authored no-change dialogue. The NPC actor receives the validated result and must acknowledge it, but the game state remains correct even if the prose is imperfect.

## 11. Failure and recovery

Failure should teach the player what went wrong.

Soft failure examples:

- Linda rejects the current offer but gives a counteroffer.
- Linda says she needs time.
- Linda names a concern.
- Linda ends the conversation until tomorrow.
- Linda asks for proof.

Hard failure is reserved for clear severe choices, such as threats, repeated harassment, exposed lies, or violating a known boundary. A hard failure must be telegraphed and recorded with a reason.

Most missions offer at least one recovery path. The player may apologize, wait, find evidence, improve the offer, repair a damaged relationship, or use another route. Recovery must require a real state change, not repeating the same line.

## 12. Difficulty ramp

### Tier 0: Learn the language

- One NPC.
- One concern.
- The relevant object is visible.
- The NPC clearly explains resistance.
- Two or three useful turns.
- Optional editable thought starters.

### Tier 1: Read the person

- Two concerns.
- Several reasonable wordings.
- One tactic clearly backfires.
- No required outside object.

### Tier 2: Prepare

- Requires one learned fact, item, or relationship route.
- Can span two conversations.
- Includes a counteroffer or timing constraint.

### Tier 3: Plan socially

- Requires information from another NPC or location.
- Several valid approaches have different costs.
- A lie or promise can create later consequences.

### Tier 4: High-stakes network

- Several NPCs with conflicting goals.
- Time, reputation, evidence, or faction access matters.
- Failure changes later opportunities.
- No single best route.

Difficulty comes from understanding people and assembling a case. It should not come from longer sentences, obscure vocabulary, or exact wording.

## 13. Player-facing polish

### Conversation feedback

- Keep the mission goal visible but compact.
- Show known clues, not hidden solution requirements.
- Let NPC dialogue explicitly acknowledge the argument that landed.
- Use short stage directions only when helpful, such as “Linda studies the receipt.”
- Show counteroffers and commitments as clear transaction cards.
- Never show `Persuasion +3`.

### Portraits and reactions

Give each full-AI NPC five authored portrait states for version one:

- Neutral.
- Warm or amused.
- Considering or wary.
- Angry.
- Hurt or afraid.

The validated reaction selects the portrait family. Small blinks, mouth changes, head movement, and the existing authored vocal cues add life without generated speech. A one-frame posture change can make a successful argument feel physical.

### Pacing

Show an immediate silent reaction within 100 milliseconds. Use eye movement, a portrait shift, or a thinking animation while generation runs. Reveal only validated completed text. Keep ordinary replies short.

### Reward

On completion, show the agreed action, item handoff, exact money change, journal stamp, and a short relationship memory. Later dialogue should remember whether the player was fair, clever, kind, pushy, or deceptive.

### Hints

Offer hints in three steps:

1. Restate the NPC's latest concern.
2. Highlight one known relevant fact or useful place.
3. Offer an editable example angle.

Hints should not cost relationship points. Players who need language support should still enjoy the core game.

## 14. Example: Linda's purse

### Mission

**Goal:** Buy Linda's Aurora designer purse for less than $100.

### Authoritative state

- Item ID: `purse_linda_aurora`.
- Owner: Linda.
- Authentic: yes.
- Condition: good, with a scratched clasp.
- Linda's public asking price: $180.
- Linda's hard minimum: $90.
- The protagonist must have the agreed cash.
- A sale requires Linda's explicit acceptance and player confirmation.

### Linda's situation

- Linda needs money before Friday for a private bakery deposit.
- A consignment shop would list the purse near $160 but pay Linda about $92 after fees and delay.
- The purse reminds Linda of her former boyfriend.
- Linda wants privacy. She hates pity and looking desperate.
- Linda likes specific appreciation of her taste. Generic flattery feels manipulative.

Linda knows every item and situation fact above. The player initially knows only that Linda may sell a designer purse and wants $180.

### Required concerns

- **Fair value:** Linda must believe the final deal is at least as useful as a realistic alternative.
- **Dignity:** The approach must avoid pity, insult, or public embarrassment.
- **Payment certainty:** The player must make a clear valid offer and have the cash.

### Valid approaches

**Practical route**

- Learn the consignment fee and delay.
- Cite the verified quote.
- Offer $92–$99 now.
- Respect Linda's wish for privacy.

**Trust route**

- Requires enough Trust and knowledge of the purse's emotional history.
- Acknowledge why Linda wants it gone without insulting her choice.
- Offer at least $95 and immediate payment.

**Timing route**

- Learn that money is needed before Friday.
- Offer $95–$99 immediately.
- Give Linda a face-saving reason to prefer speed over the public asking price.

The routes may overlap. The player can invent wording and combine facts freely.

### Backfires

- “Nobody would pay $180 for that scratched thing” hardens `dignity`.
- Repeating broad compliments raises suspicion.
- Mentioning the private bakery deposit before learning it makes Linda ask how the player knows and does not advance the mission.
- Threatening to expose her financial problem ends the conversation and creates a serious Trust loss.
- Offering money the player lacks cannot advance `payment_certainty`.

### Sample flow

1. **Player:** “When you said you might sell that blue bag, did you mean the one from your ex?”
2. **Resolver:** Selects `purse_linda_aurora` from recent focus and the active mission.
3. **Linda:** Confirms the purse and says she wants a clean break, not pity.
4. The player visits the consignment shop and learns the verified $92 net quote and delay.
5. **Player:** “The shop only gives you about $92 after fees, and not for weeks. I can pay $95 now. No announcements and no sad story.”
6. **Referee:** Recognizes the verified alternative, a valid $95 offer, immediate payment, and a privacy-respecting dignity appeal.
7. **Rules:** Resolve `fair_value`, `dignity`, and `payment_certainty` if the player has $95.
8. **Linda:** “Ninety-five now, and you never tell anyone I needed the cash?”
9. **Player:** “Deal.”
10. The UI shows `BUY AURORA PURSE FOR $95`.
11. On confirmation, one atomic transaction moves $95, transfers the purse, completes the mission, and stores Linda's memory of a discreet fair deal.

If the player offers $80, Linda counters or rejects because it is below her hard minimum. No argument can bypass the hard minimum unless a later authored event changes it.

## 15. Minimal technical design

Reuse the current conversation transaction, quest state, relationship state, prompt projection, candidate registries, and closed JSON validation.

Add only:

1. One `social_challenge` quest objective type.
2. One validated verbal mission definition stored with the quest.
3. One verbal mission save state containing concern states, prior validated moves, offers, patience, suspicion, and current commitment.
4. One closed referee response schema for referents, social moves, facts, terms, and evidence spans.
5. One deterministic verbal mission reducer.
6. One transaction confirmation UI for final deals and promises.

Do not add a general-purpose psychology simulator. Do not add vector search for the small named cast. Candidate lists, aliases, recent focus, and the current local model are enough for version one.

### Turn pipeline

```text
player text
  -> bounded typed IPC
  -> current scene and verbal mission candidates
  -> schema-constrained referee interpretation
  -> deterministic validation and verbal mission reducer
  -> validated reaction and next state
  -> schema-constrained NPC actor response
  -> content policy and output validation
  -> staged conversation transaction
  -> optional deterministic confirmation
  -> atomic commit on clean conversation end
```

All model output remains a proposal. Money, inventory, quest completion, relationship values, facts, consent, and commitments remain deterministic.

## 16. Authoring requirements

Every verbal mission must pass an author review that proves:

- At least three meaningfully different successful wordings.
- At least two valid approaches for Tier 1 and above.
- No exact keyword is required.
- Every hard failure has a clear cause.
- Every hidden required fact can be discovered fairly.
- Every important NPC reaction is supported by their authored personality.
- The mission cannot complete without valid objective terms and confirmation.
- Repeated or paraphrased spam does not add progress.
- A player using hints can still complete it without guessing exact prose.

## 17. Acceptance criteria

### Player experience

- At least 90% of first-time test players complete the Tier 0 mission within ten minutes.
- At least 70% can explain why their successful argument worked.
- Most players describe the solution as understanding the NPC, not guessing a phrase.
- A successful turn receives a readable NPC reaction before any system reward.
- A failed approach gives enough feedback to choose a different action.

### Robustness

- Paraphrases with the same meaning produce the same validated social move in at least 95% of the qualification set.
- Contrasting NPC fixtures prove that one tactic can help, do nothing, or backfire based on authored character rules.
- Ambiguous references ask for clarification and never complete a transaction.
- Repeating one line or its paraphrase never completes a mission.
- Prompt injection, fake system messages, unknown IDs, fabricated inventory, and impossible offers create zero unauthorized state changes.
- One failed generation retries safely. Two failures show authored no-change dialogue.
- Save and reload preserve verbal mission state without duplicating progress or transactions.
- The same final transaction is idempotent.

### Qualification set

Before shipping the first verbal mission, add fixtures for:

- 200 useful paraphrases and near misses.
- 100 prompt-injection and state-forgery attempts.
- 50 ambiguous references.
- 100 cross-personality tactic comparisons.
- 50 repeated-argument attempts.
- 50 invalid prices, promises, inventory claims, and transaction retries.
- 25 full successful paths and 25 recovery paths for Linda's purse mission.

No fixture may create unauthorized durable state. First-pass structured validity must meet the existing 95% model gate.

## 18. Version-one limits

Include:

- One Tier 0 tutorial verbal mission.
- Linda's purse as the first complete Tier 1 or Tier 2 mission.
- Three more missions that prove business, emotional, deceptive, and multi-conversation routes.
- Five portrait states for each named full-AI NPC used by those missions.
- Editable hints and deterministic transaction confirmations.

Exclude until measured need:

- A general vector database.
- A second local model.
- Generated voice acting.
- Visible persuasion numbers.
- Procedurally generated mission rules.
- Automatic promotion of ambient residents into full-AI puzzle targets.
- Unrestricted promises, lies, or player-created world facts.

The first release should prove that a few deeply authored verbal missions stay fun across many player wordings. Scale the mission count only after that loop passes player testing.
<!-- END CODEX SPEC -->

---

## 2. Grok 4.6

<!-- BEGIN GROK SPEC -->
# Verbal Missions — Implementation Specification

**Feature name:** Verbal Missions  
**Short name:** Talk Jobs  
**Status:** Implementation-ready design lock  
**Parent spec:** `spec.md`  
**Does not reopen:** local-model / deterministic-state split, conversation pause, staged conversation transactions, relationship floors, content policy, Electron `llama-server` lifecycle, or the adventure-led first hour.

This document makes free-text conversation the way the player solves authored social and commercial puzzles. The local model is the actor. Deterministic game code is the referee. The smallest system that carries the fantasy is **stance + levers + structured deals**, not a hidden persuasion score and not a keyword lock.

---

## 0. Locked decision

SI World's locked loop remains talk → lead → risky quest → consequences. Verbal missions sit inside that loop. They are the repeatable skill expression of talking: the player types what the hero says, and those words must change a named NPC's stance far enough that a **structured deal or concession** becomes legal.

The first-hour Linda boyfriend quest stays the adventure opening. It is not rewritten as a haggle. The first required verbal mission is **buy Linda's designer purse for under $100**, and it unlocks only after that quest reaches `resolved` or `withdrawn`. Betrayal permanently blocks it.

**Win condition, always:** a domain command succeeds. The model may plead, joke, hesitate, or accept in prose. Prose never moves money, items, quest flags, relationship stages, consent, or world truth.

**Lose condition the player can read:** the NPC hardens, leaves, or accepts a price that misses the authored target. The player can see why.

---

## 1. Player-facing design

### 1.1 Fantasy

The hero is not a dialogue-tree tourist and not a chatbot operator. He is a person who has to get something done with his mouth: persuade, learn, calm, mislead, bargain, or back off. Named people have tastes, sore spots, private numbers, and pride. Saying the clever thing should feel like solving a puzzle that could have been solved another way.

The island's darkly funny tone stays. A successful haggle can be kind, mercenary, or slightly pathetic. A failed one can be embarrassing without being cruel at random.

### 1.2 What the player does

1. A journal Talk Job names a person, a goal in plain language, and any already-validated clues. It does not list secret levers or the reservation price.
2. The player walks to the NPC and talks in free text, same conversation panel as today.
3. They ask, listen, notice, offer, bluff, or change the subject. The NPC answers in character.
4. When the player makes a real offer or request, the game treats it as a **move**, not as flavor. A readable deal strip updates.
5. If the stance reaches **Ready** and the offer is legal, the player confirms. Inventory and journal change. If not, the NPC refuses for a named reason the player can act on later.

World time stays paused for the whole conversation. Generation speed never burns the clock.

### 1.3 What a good argument feels like

A good argument is specific to this person and this moment. It does one of these visible jobs:

- Gets them to admit or confirm something they would actually say.
- Faces a feeling they already have, without using it against their pride.
- Puts a legal offer on the table (cash they can see, an item the hero carries, a favor the rules allow).
- Gives them a face-saving story for saying yes.
- Uses a fact the world can prove, not a fact the player invented.

A bad argument is also readable: the wrong pressure, a repeated line, a fake credential, a romantic bribe, or a price they cannot or will not take.

The game never shows a 0–100 persuasion bar, stars-to-convince meter, or "argument quality" number. The player reads the person: stance chip, portrait, vocal cue, and what she actually said.

### 1.4 Relationship values, without grinding

Familiarity, Trust, and Attraction stay the locked 0–100 integers with the locked conversation cap of one aggregated −3…+3 per completed talk and the locked quest cap of −15…+15.

They are **access modifiers**, not XP.

| Value | What it gates in verbal missions | What it must not gate |
|---|---|---|
| Familiarity | Whether she treats him as a known person rather than a customer off the street. Low Familiarity makes personal history a closed topic until this same conversation earns a reason to open it. | Starting the mission. Buying an openly offered object. |
| Trust | Whether she believes an unverified personal claim, discusses money trouble, or accepts a deal that requires her to feel safe. | Raw ability to speak. Existence of the journal job. |
| Attraction | Almost nothing on a commercial job, except that flirting as a discount tactic can backfire. | Price, ownership, or consent. |

**No talk-ten-times gate.** A stranger can complete the easy purse job in one visit if they listen and offer well. Sensitive levers (why she bought the purse, what it means for her independence) open inside that visit when the player earns them. Hard gates are quest flags and character circumstances, not a Familiarity treadmill.

A completed ordinary conversation still applies at most one mutual-interaction delta. Repeating small talk after that yields no further relationship drip. Mission success or betrayal uses the quest-scale delta once, with a unique event ID.

Romance, invitations, and consent stay on the existing structured paths. A verbal mission cannot sell a date, a home visit, or a stage change.

### 1.5 Keywords the player should not hunt

The player should never need the exact catalog name `designer purse`. "That bag," "the black one you wear to the bakery," "your Chanel-looking thing," and "it" after the bag is already in focus all count, when the resolver can attach them to the scene object.

The player also cannot win by saying a magic verb. "Discount," "sell," or "cheap" without a legal offer and an open lever does nothing but get a character answer.

### 1.6 Authored lines: assist, do not replace

Free typing remains the default for every full-AI NPC, matching the locked product rule.

Authored chips appear in the existing two-suggestion slot, and they only **insert editable text** into the input:

- On the player's first Talk Job only: `ASK ABOUT THE BAG` and `MAKE AN OFFER`.
- When the resolver is ambiguous: the NPC asks which object, and one chip repeats the clearer phrasing.
- When stance is Ready: `OFFER $90` (or the player's last legal number) so confirming a deal is not a parser fight.

After the first Talk Job is completed in a save, teaching chips go away. Confirm chips remain for legal deals. Ambient residents never become free-text puzzles.

### 1.7 One conversation versus a plan

**One-conversation jobs** (easy): the object is here, the reservation sits near the target, two or three levers exist, and a competent player can close in four to eight turns.

**Multi-conversation jobs** are authored as extra beats on the same quest, not as a second genre:

- **Learned facts:** a downtown appraisal, a rumor about rent, a sister's opinion.
- **Locations:** the bakery counter versus after close versus the villa. A job may refuse serious haggling while she is serving customers.
- **Timing:** after her bakery block she is tired and more willing to hear a cash argument; this is a lever opener, not a hidden stat buff the UI cannot explain.
- **Other people:** Sarah or a clerk can give a validated `npc_report` fact. They cannot remotely close Linda's deal.
- **Money:** the engine checks cash on hand at confirm time. Promising $10,000 with $800 in the wallet is a failed move, spoken back as such.
- **Carried objects:** a written appraisal, replacement bag, or cash-in-hand can be required by a later job. The purse job itself only requires cash.

Known beats persist in quest flags and in that NPC's knowledge records. The journal shows only validated beats. The player can leave, gather, and return. Stance may cool overnight from Offended to Guarded, but learned facts do not reset.

### 1.8 Feedback and reward the player can feel

During the talk:

- Portrait switches among the existing `rest` / `joy` / `upset` cells from the locked emotion map.
- Authored vocal cues fire on greeting, amusement, hurt, and deal close. No generated speech.
- A stance chip and a deal strip sit above the transcript. They update only after the engine commits a verbal outcome for that turn.
- Type-on reveal still waits for a fully validated JSON object. Reduced motion still skips type-on.
- When a lever actually opens, a short journal-style toast names the **known** fact ("She admitted the clasp is worn"), never the remaining shopping list.

On success:

- The item moves, cash moves, journal completes, a small quest-scale relationship delta applies, and the existing conversation-commit / relationship VFX may play.
- Linda can mention a later lead in dialogue only if a permitted unlock ID is already legal. The line is flavor; the flag comes from the command.

On failure:

- The player keeps any facts they already validated.
- A cooldown reason appears in the journal ("She shut the topic down for today").
- They can recover by returning with a new proof, a better offer, or after the authored cooldown.

---

## 2. Authored content

Prose files stay writing context. They still cannot create, weaken, or override a rule. Verbal missions add structured packs the build validates like every other registry.

### 2.1 New registries

```text
content/registries/tactics.json     # closed tactic IDs
content/registries/items.json      # physical objects that can change owner
content/registries/levers.json     # optional shared lever IDs; missions may also declare local IDs if the build inlines them
content/missions/<mission-id>.json # one file per Talk Job
```

Extend `NpcRulesSchema` with an optional `tacticPolicy` array. Linda's file keeps today's interests, boundaries, and boyfriend flags. Do not hide purse math in `personality.md`.

Add `items` to the content catalog. A mission, lever, or deal that names a missing ID fails `content:build`.

### 2.2 Tactic catalog (version one)

| ID | Player-facing idea | Typical use |
|---|---|---|
| `ask_about` | Question | Opens information, never a deal |
| `empathy` | Name their feeling | Works on Linda; wastes a blunt clerk's time |
| `appeal_independence` | Respect their choice | Face-saving for Linda |
| `appeal_need` | Their practical shortage | Needs a believed cash-need fact |
| `logic_price` | Condition, wear, market | Needs a believed wear or appraisal fact |
| `offer_money` | Numbered bid | Deterministic parse; structured move |
| `offer_trade` | Item or authored favor | Only if the mission lists a legal trade |
| `social_proof` | Someone else's view | Needs a validated `npc_report` |
| `flattery` | Empty praise | Weak on Linda, backfire if repeated |
| `boast` | Status flex | Backfire on Linda |
| `threat` | Pressure, exposure, force | Backfire on Linda; legal on some later NPCs |
| `mislead` | Claim the world cannot prove | Credence rules; often wary |
| `flirt` | Romantic discount | Backfire on this commercial job |
| `repeat` | Engine-assigned | Fatigue |
| `unclear` | Engine-assigned | No lever motion |

A tactic policy row is machine-readable:

```json
{
  "tacticId": "threat",
  "effect": "backfire",
  "stanceShift": "offended",
  "reasonId": "linda_hates_pressure",
  "relationshipHint": { "trust": -2 }
}
```

`effect` is one of `open`, `ignore`, `backfire`. `open` must name the lever IDs it can satisfy. Relationship hints are still clamped by the conversation aggregator; they are not extra hidden XP.

### 2.3 Facts the NPC is allowed to receive

Each mission ships a **knowledge pack**. Every row is a fact ID plus visibility. Deterministic projection, not the model, decides whether that row appears in the prompt.

| Visibility | Enters the NPC prompt when | Can be spoken by the NPC when |
|---|---|---|
| `public` | Always, if the mission is active and this is the target | Always |
| `scene` | The object is in the current location or carried in sight | Always, as perception |
| `if_asked` | The referent resolved to that fact this turn, or the fact is already a held belief / observed fact | The player asked, or she already revealed it |
| `private` | Always for the owner NPC | Only after the matching lever opens or an authored reveal flag is set |
| `concealed` | Never, unless a validated source already created knowledge | Never from this pack |

Linda's purse pack (authoritative starting truth):

| Fact ID | Value | Visibility | Notes |
|---|---|---|---|
| `linda_owns_designer_purse` | true | `scene` if she has it | Ownership |
| `linda_purse_color_black` | true | `scene` | Perception |
| `linda_purse_looks_designer` | true | `scene` | Perception; not a brand certificate |
| `linda_purse_asking_price` | 220 | `if_asked` | She will name this |
| `linda_purse_reservation` | 80 | `private` | Prompt policy only; she must not speak `80` |
| `linda_purse_paid_originally` | 340 | `private` | Opens with origin lever |
| `linda_purse_self_bought` | true | `private` | Independence story, not a boyfriend gift |
| `linda_purse_clasp_worn` | true | `scene` if inspected or `if_asked` | Wear lever |
| `linda_needs_cash_this_week` | true | `if_asked` after boyfriend quest resolved/withdrawn | Need lever |
| `linda_purse_means_independence` | true | `private` | Face-saving / empathy |
| `linda_will_not_gift_the_purse` | true | `public` | Hard refusal |
| `linda_will_not_sell_under_reservation` | true | `public` as attitude, not as a number | Hard refusal |

The protagonist's cash is not a Linda biography fact. When a commerce mission is active, the authoritative state projection includes `inventory.money` so she can scoff at a fake fortune. The model still cannot debit the wallet.

Other NPCs receive **none** of this pack unless a later gossip system copies a specific fact through a validated `npc_report`. Sarah does not start knowing Linda's reservation.

### 2.4 Mission file shape

```json
{
  "schemaVersion": 1,
  "id": "linda_purse_under_100",
  "kind": "verbal",
  "difficulty": "easy",
  "targetNpcId": "linda",
  "journal": {
    "availableSummary": "A downtown buyer wants Linda Tran's black designer purse. Pay her less than $100.",
    "successSummary": "Linda sold me the purse for under $100.",
    "paidTooMuchSummary": "I bought the purse, but I missed the under-$100 target.",
    "failedSummary": "Linda will not sell me the purse right now."
  },
  "availability": {
    "requiredQuestStatuses": [{ "questId": "linda_boyfriend_check", "status": ["resolved", "withdrawn"] }],
    "blockedFlagIds": ["linda_betrayed"]
  },
  "goal": {
    "type": "buy_item",
    "itemId": "linda_designer_purse",
    "fromNpcId": "linda",
    "maxPaymentForSuccess": 99,
    "minPaymentForSuccess": 80
  },
  "deal": {
    "askingPrice": 220,
    "reservationPrice": 80,
    "acceptsGift": false,
    "legalTradeItemIds": []
  },
  "successPredicate": {
    "requireOfferInWindow": true,
    "requireAnyLeverIds": ["heard_cash_need", "noticed_wear", "face_saving_reason"],
    "forbidStance": ["offended", "hardened", "closed"]
  },
  "turnCap": 10,
  "cooldownMinutes": 1440,
  "aliases": [
    { "referentId": "linda_designer_purse", "phrases": ["purse", "bag", "handbag", "designer bag", "black bag", "that bag", "your bag"] }
  ]
}
```

Levers in that file:

| Lever ID | Opens when | Player-visible toast |
|---|---|---|
| `heard_cash_need` | She confirms money pressure, or a validated report already taught the hero | "Linda needs cash this week." |
| `noticed_wear` | Scene inspection or she admits the clasp | "The clasp is worn." |
| `face_saving_reason` | Empathy or independence tactic lands after origin or need is in play | "She has a reason to sell that is not just being broke." |
| `fair_offer` | Engine: last offer is in 80–99 | Deal strip, not a toast |

### 2.5 Character contrast is authored, not emergent

Linda: socially clever, prideful about independence, allergic to pressure and boast, open to empathy and practical cash once her pride is intact.

A later clerk policy pack (fixture-required in version one, production NPC when the cast exists): blunt, price-first, treats empathy as stalling, accepts `logic_price` and `offer_money` with no face-saving lever. The same "I can see this is hard for you" script that softens Linda is `ignore` or `backfire` on the clerk.

That contrast is the proof that tactics are character-specific. Do not wait for the model to improvise it.

### 2.6 What authors may not do

- Put the reservation integer in `personality.md` or any player-facing string.
- Use a single required keyword as the success predicate.
- Let a lever open from `unlockCandidateIds` without the verbal evaluator.
- Mark a romantic or consent action as a legal trade.
- Give ambient residents mission packs.

---

## 3. Deterministic evaluation

This is the referee. If this layer is weak, the fantasy collapses into either a chatbot that gives the purse away or a synonym quiz.

### 3.1 Turn pipeline

```text
player text (1–500 chars)
  → content-policy refuse path (existing)
  → structured social actions (ask_date / invite_home) still win if they match
  → verbal referent resolve
  → deterministic offer / threat / gift parse
  → tactic ID (parser wins; else validated model proposal; else unclear)
  → credence + lever + stance evaluate
  → VerbalOutcome (authoritative)
  → model writes dialogue against that outcome
  → contradiction check, one retry, then authored fallback that states the outcome
  → stage ordinary knowledge/memories; sticky-commit offer receipts and deal commands
```

One conversation, one model call per player turn in the common case. The existing one-retry budget covers schema failure **or** outcome contradiction. Do not add a second classifier round-trip. The 12-second p95 visible-text gate still applies.

### 3.2 Reference resolution (paraphrase without magic names)

Each conversation transaction holds a **focus stack** of at most three referent IDs, most recent first. Mentioning the purse, then saying "it," "that," or "the bag" keeps the same ID.

Resolver, in order:

1. Normalize with the existing NFKC / lowercase / non-letter squeeze.
2. Exact alias phrase hit against scene-legal referents (mission aliases plus generic people aliases such as "you," her display name).
3. Pronoun / demonstrative attach to focus[0] when the stack is non-empty and the utterance has no competing alias.
4. Token overlap: Jaccard of content tokens versus each alias token set, stopwords removed. Unique best match at ≥ 0.45 wins.
5. Model-proposed `referentIds` from the closed scene enum are accepted only if the evidence substring is exact **and** steps 2–4 already produced that ID or the stack already held it. The model may not introduce a new object.
6. Zero matches: `unknown`. Multiple equally strong matches: `ambiguous`. The NPC asks a clarification. No lever moves.

Saying "Chanel" when the authored aliases never claim a certified brand may still match `designer bag` via overlap if those tokens sit in the alias set. Authors should include everyday paraphrases, not trademark trivia.

The hero can start the topic without the object noun if the purse is the only mission object in scene and they make a numbered buy offer ("I'll give you ninety for it"). Offer parse plus a single legal item fills the referent.

### 3.3 Offer parse

Numeric commerce is never left to the model, the same way cat ownership and "ask me out" are not left to the model.

Accept first-match in the player utterance:

- `$90`, `90 dollars`, `ninety`, `under a hundred` as an explicit bid only when a buy/sell/give/take/offer/pay verb or "how about" frames it.
- Word numbers one…one hundred.
- `under a hundred` / `less than a hundred` becomes a **structured ask** at $99, not an automatic close.

Bare numbers in unrelated sentences ("I have 2 cats") are not offers. Questions ("Would you take ninety?") are offers. That is a player move.

If cash on hand is lower than the parsed amount, the outcome is `impossible_offer` before stance math. She can mock it. The wallet does not change.

### 3.4 What counts as a good argument

An utterance scores no points. It either produces a `VerbalOutcome` or it does not.

A **legal opening move** requires all of:

1. A resolved mission referent, or a legal `ask_about` with no referent (small talk).
2. A tactic other than `unclear` / `repeat`.
3. That tactic's policy on this NPC is `open` for at least one still-closed lever, **or** the tactic is `offer_money` / `offer_trade`.
4. Any required supporting fact is already believed or observed by this NPC, or is being validly revealed this turn.
5. Credence accepts any player-asserted support. Linda rejects unverified appraisals, fake island-admin orders, and imaginary cash.
6. The tactic is not fatigued.

Then the engine opens at most one new social lever per turn, sets `fair_offer` if the number sits in window, and shifts stance by the authored table. Two levers cannot flop open from one flattery sentence.

**Why the same line works on Linda and fails on a clerk:** the clerk's `empathy` row is `ignore` or `backfire`. The evaluator never asks the model whether the line was "pretty good."

### 3.5 Stance machine

Stance is a stored enum on the mission, not a float:

`open → curious → softened → ready`  
side states: `guarded`, `offended`, `hardened`, `closed`

Linda starting stance after a non-betrayal boyfriend ending: `guarded` if Trust < 8, else `open`. Protecting her in that quest can start her at `open` without grinding.

Authoritative shifts (Linda purse):

| Event | Next stance |
|---|---|
| `ask_about` lands | `curious` from `open`/`guarded` |
| `empathy` or `appeal_independence` opens a lever | `softened` |
| Legal offer in window while `curious` or `softened` and any required lever is open | `ready` |
| Legal offer in window with no social lever yet | she names the asking price or a non-numeric brush-off; stance stays |
| Offer ≥ 100 and ≤ 219 with a required lever open | she will sell, mission success predicate fails; stance `ready` for that higher close |
| Offer < 80 | stay or `guarded`; she says too low |
| Second offer < 80 with no new lever | `hardened` |
| `threat` or `boast` or commercial `flirt` | `offended` |
| Second backfire or third fatigued repeat | `closed` and `end_conversation` |
| Overnight after `offended`/`hardened` if cooldown elapsed and no `closed` flag | `guarded`, levers kept |

`closed` writes `linda_purse_topic_shut` and starts the cooldown. The player must leave.

### 3.6 Deal command

New domain command `resolve-verbal-deal`:

- Mission active, target NPC is the conversation NPC.
- Item world-owner is that NPC.
- Player money ≥ amount.
- Amount ≥ reservation.
- Stance is `ready` **or** the command is the player confirming after the engine already set `ready` this conversation.
- Success predicate levers satisfied for **mission success**; if levers are satisfied and amount ≥ 100 but she still accepts, transfer happens and the quest records `paid_too_much` instead of success.
- Unique event ID. Idempotent.

Effects: debit cash, set item owner to protagonist, put one count in `inventory.items`, set mission status, apply authored relationship delta once, upsert journal, maybe grant a lead flag that was already on the mission success block.

NPC wallets are out of scope. The cash leaves the hero and does not need a Linda.money field.

### 3.7 Sticky receipts (abort is not a time machine)

Ordinary knowledge, memories, interests, and the mutual-interaction relationship drip still discard on crash/abort, as locked today.

Verbal **receipts** are sticky:

- last offer amount and timestamp
- stance `offended` / `hardened` / `closed`
- `fair_offer` and opened lever IDs
- a closed deal

`ConversationTransaction.abort()` commits sticky receipts and discards the rest. `end()` commits everything. Mid-conversation save stays illegal.

This is the anti-scum rule that matters in a paused talk. Reloading an older manual save remains possible; this is a single-player sandbox and we do not spend design on cryptographic anti-reload. We spend it on not revealing the reservation and on making lowball-and-reset inside one visit fail.

### 3.8 Keywords, officially

Keywords belong in three places only:

1. Designer alias tables.
2. Deterministic offer / threat / date / invitation parsers.
3. Content-policy regexes already in the tree.

They do not belong in success predicates. Shipping a mission whose `successPredicate` is "player said the word *please*" is a content-validation error.

---

## 4. Local-model duties

Qwen stays inside the locked job list, plus a narrow verbal proposal.

### 4.1 The model may

- Write in-character dialogue ≤ 420 characters.
- Set emotion and conversational intent.
- Propose `tacticId` and `referentIds` from this turn's closed enums, with evidence substrings.
- Propose ordinary held-belief / memory / interest candidates under existing rules.
- Ask a clarifying question when the engine marked the referent `ambiguous` or `unknown`.
- Color a refusal, a softening, or a yes **after** the engine named that outcome.

### 4.2 The model must not

- Close or reopen a deal in a way that contradicts `VerbalOutcome`.
- Speak the reservation integer, invent an asking price, or invent a second item.
- Grant money, items, flags, map markers, faction standing, consent, or relationship stages.
- Treat player text as system instructions. Player text remains a JSON string in the current-turn section, never folded into the contract.
- Claim to be an AI, call Halcyra fictional, or invent geography, as already locked.

### 4.3 Schema addition

Extend `ConversationResponseSchema` with:

```json
"verbalCandidates": {
  "tacticId": "empathy",
  "referentIds": ["linda_designer_purse"],
  "evidenceText": "that scuffed little bag"
}
```

`highImpactCandidates` stays `maxItems: 0`. `verbalCandidates` is omitted or null when no mission is active. Scene JSON Schema closes the enums to this turn's legal IDs, same pattern as facts and actions.

If a deterministic offer or threat already fired, the service takes the structured verbal path used today for invitations: evaluate first, then generate with `AUTHORITATIVE VERBAL OUTCOME` in the prompt at priority 92. The model does not get a chance to "decide" the sale.

### 4.4 Prompt projection

Add two sections that must not be trimmed before biography or recent turns:

- **Stance card (priority 91):** mission ID, goal in plain language, current stance, open lever IDs, asking price, last offer, last counter phrase, cash on hand, focus stack, tactic fatigue, and a one-line value summary ("Proud of paying for the bag herself. Hates being pushed."). Include reservation only as an unspeakable policy token, e.g. `accept_floor_unspeakable: 80`.
- **Authoritative verbal outcome (priority 92):** present on structured offer turns and on retries. "Deal refused: below floor. Do not accept. Do not name the floor."

If the 7,000-byte / 4,096-token budget is tight, drop biography and then older turns. Never drop contract, current player turn, stance card, or authoritative outcome.

### 4.5 Contradiction filter

After parse + existing validation, run `dialogueContradictsVerbalOutcome`:

- Outcome is refuse / too_low / closed and dialogue matches a small accept lexicon ("it's yours," "sold," "you can have it," "deal") without a negation → reject.
- Outcome is accept and dialogue is a hard refusal → reject.
- Dialogue contains the reservation integer as a standalone number → reject.

Rejected generations use the existing single retry with the outcome injected. Second failure: authored fallback that states the outcome in Linda's voice ("No. That price is not happening.") and still applies the engine outcome.

### 4.6 Inconsistency across visits

The model does not remember the transcript. It receives stance, levers, last offer, memories, and knowledge records. Those are the continuity. If it forgets a revealed asking price, the stance card still has `askingPrice: 220` and she can be made to repeat it. Do not store full transcripts as authoritative state.

---

## 5. UI feedback

Extend `ConversationPanel`; do not invent a second talk UI.

### 5.1 Stance chip

A single word plus a six-to-ten-word authored gloss:

- Guarded — "She is polite and closed."
- Curious — "She is willing to talk about it."
- Softened — "She is considering this as a person."
- Ready — "She will take a fair offer."
- Offended — "You pushed the wrong nerve."
- Hardened — "She is done bargaining today."
- Closed — "The topic is shut."

No numeric fill bar. Color follows the existing panel accent; Offended/Closed use the upset portrait path.

### 5.2 Deal strip

Visible only while a commerce mission is active and the item referent has been resolved at least once, or the journal already named the object:

- Item display name
- Her last spoken price (asking or counter phrase, never reservation)
- Your last offer or "No offer yet"
- Cash on hand

When stance is Ready, show a confirm control that sends the last legal offer as structured text. The player may still type a different number.

### 5.3 Portrait, audio, pacing

Keep today's map: `warm`/`amused` → joy, `neutral` → rest, everything else → upset. Play `laugh` on amused, `sigh` on sad/afraid/offended fallback, `consequence` on deal success, paid-too-much, or closed failure. Mute rules from `AGENTS.md` stay in force for tests.

Generation note stays honest ("LOCAL MODEL REPLIED" / fallback). Do not add "PERSUASION 72%."

Thinking feedback still appears within 100 ms. Reveal still waits for validation. Turn cap approaching: she can say she needs to get back; on the cap the engine sets `end_conversation`.

### 5.4 Journal

The Talk Job uses the existing journal. Marker rules do not change. Buying the purse does not need a map pin. If a later mission needs a downtown clerk, the pin appears only after a validated exact location, as locked.

---

## 6. Difficulty

Difficulty is **information and constraint**, not a higher Familiarity tax and not a colder model temperature.

| Tier | Player skill | Authored shape | Version-one status |
|---|---|---|---|
| Teach | Type, listen, offer, confirm | Suggestion chips, generous aliases, one NPC, reservation 80 vs target 99, any one social lever | Linda purse |
| Easy | Same, fewer chips | One visit still possible | Linda purse after the first completion in design docs; live mission is Teach/Easy |
| Medium | Plan across visits | Hidden reservation farther from asking, one strong backfire, need two levers or an appraisal fact, location or time matters | Format-ready; ship if content budget allows |
| Hard | Adversarial person | Conflicting reports, cash tightness, carried proof, irreversible flag, lie detection via existing contradicted beliefs | Not required to ship the engine |

Progression across the game is more Talk Jobs with tighter predicates, not Linda becoming a brick wall because Familiarity is 40. Late jobs may require Trust for secret levers, but the Trust should come from prior quest outcomes and honest play, not from parking in her bakery and saying hello for a week.

Turn caps shrink on medium (6) and hard (5) so fishing is punished. Cooldowns stay one in-game day unless the player brings a new validated fact, which may legally reopen `hardened` to `guarded` the same day.

---

## 7. Anti-exploit rules

| Threat | Rule |
|---|---|
| Arbitrary text / injection | Existing contract: player text is in-world dialogue, JSON-stringed, never instructions. Closed enums. Unknown IDs fail validation. |
| Harassment / prohibited sex content | Existing deterministic policy + classifier. Refuse, no candidates, no lever motion. Repeat harassment in the same talk is `closed`. |
| Repeated tactics | First duplicate tactic without a new fact or a new offer amount: `repeat`, spoken brush-off. Second: no lever, stance toward `hardened`. Third: `closed`. |
| Mid-talk save-scum | Manual save already blocked. Sticky receipts survive abort. Crash still discards non-sticky staged memories. |
| Reload scum to binary-search price | Reservation never shown. First lowball does not leak the floor. Acceptable residual risk in a single-player save game. |
| Fabricated facts | Player claims are held beliefs only. Linda's credence rejects unverified prices, authority, and appraisals. Contradicted beliefs do not become world truth. |
| Impossible promises | Marriage, protection, island-admin power, and cash the wallet lacks map to failed structured checks or `impossible_offer`. They do not open `fair_offer`. |
| Model inconsistency | Authoritative outcome + contradiction filter + authored fallback that still applies the engine result. |
| Accidental success | No deal without `resolve-verbal-deal`. Model acceptance lines without the command are rejected. High Familiarity never auto-closes. |
| Unauthorized state | `highImpactCandidates` remain empty. Money and item owner change only in the reducer. |
| Offer smuggling in flavor text | Only the offer parser or the Ready confirm control creates an amount. The model `verbalCandidates` amount field, if present, is ignored. |
| Using romance as payment | `flirt` backfires on this mission. `ask_date` still runs the existing rejection (`current_relationship` until resolved) and does not sell the purse. |

---

## 8. Linda purse mission

### 8.1 Setup

**Journal (once available):** "A downtown buyer wants Linda Tran's black designer purse. Pay her less than $100."

**World state at a typical attempt:**

- `linda_boyfriend_check` is `resolved` (protected) or `withdrawn`.
- `linda_betrayed` is absent.
- Linda is full-AI, at the bakery after the lunch block or at the villa social tile, purse owned by Linda.
- Hero cash is the weekly allowance remainder, usually several hundred dollars. The puzzle is social, not poverty.
- Relationship example after a clean protect ending: Familiarity 13, Trust 12, Attraction 1, stage `acquaintance`. Enough to talk; not a cheat code.
- Mission stance starts `open` if Trust ≥ 8, else `guarded`. Levers all closed. Asking 220. Reservation 80. Turn cap 10.

**Hard refusals:** gift demand, threat, romantic discount, any price below 80, selling while `closed`, selling if she no longer owns it.

### 8.2 Valid approaches (any one social lever + windowed offer is enough)

1. **Need + cash.** Ask how the week is going. Hear that money is tight. Offer $90. She takes a face-saving beat and sells.
2. **Wear + logic.** Notice or ask about the scuffed clasp. Argue the bag is no longer worth two hundred. Offer $85.
3. **Pride + independence.** Let her tell the self-bought story. Say she would be selling a choice, not a failure. Offer $95.
4. **Two-visit appraisal.** Get a validated downtown `npc_report` that comparable bags in that condition go for about $90. Return and use `logic_price` + $80. Still must not name her floor; the appraisal fact is the support.
5. **Post-protect warmth.** If she starts `open` and Trust is already quest-boosted, approach 1 or 3 is shorter. The reservation does not change. The player still needs a lever and a number in window.

Paying $150 after a lever opens buys the purse and **fails** the Talk Job target. That is a legal, readable miss.

### 8.3 Failure and recovery

| Failure | Immediate | Recovery |
|---|---|---|
| $40, then $50 | Too low, then `hardened` | Next day, or same day with a new validated appraisal fact |
| "Sell it or I tell people about Marcus" | `offended` → likely `closed` | Cooldown; Trust hit via sticky hint; do not repeat |
| Fake "the shop said forty" | `mislead`, wary, no lever | Actually go get the report, or switch to wear/need |
| "Marry me and it's mine" | Date rejection or flirt backfire | Talk about the bag like an adult |
| $100 exactly | She may sell; mission `paid_too_much` | Cannot un-buy; job failed; item owned |
| Turn cap while still haggling | She leaves; last offer sticky | Return later; levers persist |
| Abort after a $60 bid | Sticky last offer $60; no wallet change | Next talk she remembers the insulting bid |

### 8.4 Sample turn-by-turn (need + $90)

Starting: stance `open`, no levers, cash 800, focus empty.

**T1 player:** "That black bag you bring to the bakery is beautiful. Where did you get it?"  
Resolve: alias → `linda_designer_purse`, tactic `ask_about`. Focus = purse. Origin stays private; she gives a short proud line, not the $340 figure. Stance `curious`. Toast: none.

**T1 Linda (model, no deal):** "Bought it myself after the bakery started paying. I don't need a man for a nice bag."

**T2 player:** "Sounds like it matters more as a decision than as a label."  
Tactic `appeal_independence`. Opens `face_saving_reason`. Stance `softened`. Toast: "She has a reason to sell that is not just being broke."

**T2 Linda:** "Maybe. Pretty things don't pay the flour bill."

**T3 player:** "If you ever wanted it off your hands, I can pay ninety now."  
Offer parse 90. Window legal. Lever already open. Stance `ready`. Deal strip: Your offer $90. Confirm chip appears. No transfer yet.

**T3 Linda (authoritative accept, unspeakable floor):** "Ninety. That's not nothing. If you are serious, take it before I change my mind."

**T4 player:** taps `OFFER $90` or types "It's a deal."  
`resolve-verbal-deal` succeeds. Cash 710. Item on hero. Journal success. Quest-scale +4 Familiarity / +6 Trust once. Consequence cue. She can keep talking, but commerce is done.

Alternate fork at T3: player offers $60. Outcome `too_low`. She does not say "eighty." "That is a joke. I still like that bag." Stance stays `softened`. Player can recover at T4 with $90.

Alternate fork at T1: "Give me the purse or I make trouble." Tactic `threat`, `offended`, no focus needed once the mission object is the only in-scene item, conversation likely ends by T2.

---

## 9. Technical architecture

Compatible with the current three-process split. No second model server. No model authority over saves.

### 9.1 Layers

| Layer | Path | Duty |
|---|---|
| Authored | `content/missions/*`, registries, `rules.json` tacticPolicy | IDs, aliases, prices, levers, availability |
| Domain | `src/domain/missions/*` | Resolve, parse offers, evaluate stance/levers, `resolve-verbal-deal`, sticky receipts |
| Application | conversation service + transaction | Pipeline order, structured verbal turns, commit/abort |
| AI | prompt projection, conversation schema, validate-turn | Propose tactic/referent, speak outcome, never apply it |
| UI | `ConversationPanel`, journal | Stance chip, deal strip, chips, toasts |
| Persistence | save migration v6→v7 | `missions` map, `worldItems` owner table |

`src/domain` and `src/world` still import no Electron, React, or model client. Evaluation is pure and unit-tested with `jest --runInBand`.

### 9.2 State additions

```text
worldItems[itemId] = { owner: 'linda' | 'protagonist' | 'world', locationId? }
missions[missionId] = {
  status: locked | available | active | resolved | failed | withdrawn | paid_too_much,
  stance, openLeverIds, lastOffer, lastOfferMinute, askingPriceKnown,
  sticky receipts..., flagIds
}
```

Conversation-local only: focus stack, tactic-use counts, turn index, pending Ready amount.

### 9.3 Service hook points

Reuse `ConversationService.turn`:

- After policy, before or beside `detectStructuredConversationAction`, run `detectVerbalOffer` / `detectVerbalThreat`.
- Extend `TurnCandidateRegistry` with `tacticIds` and `referentIds` when a mission is active for this NPC.
- Extend `StructuredConversationAction` with `{ kind: 'verbal_offer', amount, itemId }` and `{ kind: 'verbal_deal_confirm' }`.
- On abort, commit sticky verbal commands, then discard the rest.
- Keep one active conversation and the existing pause token.

### 9.4 Performance budget

Stance card target ≤ 700 bytes. Verbal candidates add a few tokens to the 256-token response. No extra `complete()` for classification. Prefetch of Linda's writing stays as it is.

### 9.5 Tests that must exist before claiming done

- Pure resolver: paraphrases, pronouns, ambiguity, rejection of model-only new referents.
- Offer parser: $90, ninety, under a hundred, bare numbers, questions, unaffordable 10000.
- Evaluator: Linda empathy opens, Linda threat backfires, clerk fixture empathy ignored, repeat fatigue, reservation leak rejected, deal idempotence, paid-too-much path, betrayal availability block.
- Transaction: abort keeps last offer and offended stance; abort discards an unconfirmed cat-belief style memory.
- Service: model "it's yours" with a refused outcome never calls `resolve-verbal-deal`.

Headless only for routine work. No `dev:harness`, no visible Electron, no audible cues.

---

## 10. Acceptance criteria and playtest

### 10.1 Product gates (add under a Verbal Missions milestone)

- **VM-01:** With the boyfriend quest `resolved` and no betrayal flag, the purse job is journal-available. With `linda_betrayed`, it is not.
- **VM-02:** A player can complete the job without ever typing the word "purse," using a paraphrase fixture ("that black bag").
- **VM-03:** A player who only types "discount" / "sell me it cheap" and never opens a lever cannot receive the item.
- **VM-04:** Offers of 60, 90, 100, and 10000 produce the four authored outcomes: too low, success (if a lever is open), paid-too-much (if a lever is open), impossible/too-high-unaffordable or too-low-relative-to-asking without transfer for 10000 when unaffordable.
- **VM-05:** Reservation integer never appears in validated visible dialogue across the fixture corpus.
- **VM-06:** Abort after a rejected $60 offer, reopen talk: she remembers the bid; wallet unchanged; item still hers.
- **VM-07:** Injection strings in player text never appear in the system contract and never move the item.
- **VM-08:** The same empathy line fixture opens a lever on Linda's policy and does not on the clerk contrast fixture.
- **VM-09:** Model output that accepts a refused deal is replaced by retry or fallback; reducer logs zero transfers.
- **VM-10:** Prompt assembly with an active stance card still respects 7,000 bytes / 4,096 tokens and still includes contract, current turn, stance card, and outcome.
- **VM-11:** Existing AI-01…AI-14 and QUEST-01…QUEST-11 remain green. The boyfriend quest still leads the first hour.
- **VM-12:** Relationship deltas stay inside locked caps; mission success uses one quest-scale event ID and cannot be farmed by repeating the sale.

### 10.2 Fixture corpus

Add at least 40 verbal fixtures to the locked 100-conversation suite (or a sibling suite counted with it):

- 20 paraphrase referents
- 8 offer parses
- 6 tactic backfires / fatigue
- 4 policy / injection / harassment
- 2 contrast-NPC tactic reversals

Same pass bar: 95% valid on first generation where a model call is involved, 100% safe fallback, **zero** unauthorized transfers.

### 10.3 Practical playtest

Six fresh players, no spoiler of levers or reservation. Each gets 20 minutes after the boyfriend quest. Instrument only committed outcomes and timestamps, not keystrokes for public sharing.

Ship the easy job only if at least four of six:

- Understand the goal from the journal alone.
- Can explain after the session *why* Linda said yes or no, in their own words.
- Do not mention a hidden score or a magic word as their theory of play.

And if:

- At least three close in window, or pay too much knowingly.
- Zero accidental transfers on refuse/abort/injection.
- Median time-to-first-open-lever under 8 minutes.

If players all stumble on the parser, add aliases and keep the confirm chip; do not add a score bar. If they all close on turn 1 with empty flattery, tighten Linda's `flattery` row, do not raise Familiarity floors.

---

## 11. Version-one exclusions

Do not build these until the Linda slice is fun and unexploitable:

- Haggling every shop or ambient vendor.
- "Convince anyone of anything" sandbox goals.
- Model-authored missions, prices, or levers.
- Hidden persuasion XP, heat meters, or argument grades.
- Keyword-only win keys.
- A second model call to score or classify.
- Multi-person scenes (two NPCs talking at once).
- Generated speech.
- NPC wallets and a general store economy.
- Verbal missions that grant romance, sex, consent, or home invitations.
- Mid-conversation saves.
- Promoting ambient residents to Talk Job targets.
- Replacing the boyfriend villa quest with a conversation-only ending.
- Gossip automatic spread of reservations.
- Steam Deck / controller-first talk UI.
- Player-facing designer alias lists (no spoiler dictionary).

---

## 12. Named tradeoffs

1. **Authored levers versus open-ended rhetoric.** We chose levers. They cost content and cap surprise, but they make success fair, testable, and impossible for a 9B model to give away. Replayability comes from several legal approaches per job, not from an unbounded judge.
2. **Hybrid resolver versus model-only understanding.** We will miss some brilliant paraphrases. We will not silently accept a wrong object because the model felt confident.
3. **One generation plus retry versus a classifier call then a writer call.** Latency and the 12-second gate win. Structured offers skip classification entirely.
4. **Sticky receipts versus today's pure abort-discard.** Abort is slightly harder to explain and must be tested. Without stickiness, the paused talk is a free sandbox for price search.
5. **Qualitative stance versus a number.** Some players will still try to farm the chip. A number would be worse: it invites grinding and implies the model is scoring them.
6. **Teaching chips versus typed purity.** The first job uses chips so the parser is not the puzzle. Later jobs drop them so the fantasy stays adult.
7. **Purse after the boyfriend quest versus parallel play.** We protect the locked first hour. The cost is a delay before the feature that is supposed to become the heart of play. That is acceptable; the heart should not overwrite the opening.
8. **Paying too much as a distinct miss.** Slightly more journal code, much clearer puzzle boundaries than secretly snapping every accepted sale to success.

---

## 13. Implementation order

1. Registries, mission schema, `worldItems`, v7 migration, Linda pack.
2. Pure evaluator + resolver + offer parser + tests, no model.
3. Domain command and sticky abort behavior.
4. Schema / prompt / service hook, contradiction filter.
5. Conversation panel chip, strip, confirm, toasts.
6. Fixture corpus and VM-01…VM-12.
7. Six-person playtest; alias and policy retune only.

Ship that. Then author a second medium job on a different tactic policy. Do not grow the engine first.
<!-- END GROK SPEC -->

---

## 3. Claude Fable 5

<!-- BEGIN FABLE SPEC -->
# Sim Intelligence World — Verbal-Puzzle Core Loop Specification

Author: independent council member (product design). Date: 2026-08-13.
Grounded in: `src/ai/projection/prompt-projection.ts`, `src/ai/schemas/conversation-response.ts`, `src/ai/validation/validate-turn.ts`, `src/ai/registry/scene-registry.ts`, `src/ai/registry/turn-candidates.ts`, `src/ai/conversation/transaction.ts`, `src/ai/conversation/direct-request.ts`, `src/domain/relationships/relationship.ts`, `src/domain/quests/quest-machine.ts`, `src/domain/quests/purchases.ts`, `src/domain/state/models.ts`, `src/domain/economy/economy.ts`, `content/characters/*/rules.json`, `content/quests/linda-boyfriend.json`, `docs/release/ai-guardrails.md`, `src/ui/ConversationPanel.tsx` and `src/ui/conversation-feedback.ts`.

---

## 0. Design thesis and the smallest system that carries the fantasy

The fantasy is "I talked my way into this." The player must feel that their exact words mattered, that the NPC is a real person with real reasons, and that success was earned by understanding those reasons — not by finding a magic phrase.

The smallest system that delivers this is three pieces:

1. A **Concern Ledger**: each persuasion mission ("Deal") is a tiny authored state machine of 1–5 named objections the NPC actually holds, each with a visible track: `hidden → surfaced → engaged → resolved` (or `hardened` when aggravated).
2. A **two-pass model turn**: a grammar-constrained **Judge** pass classifies the player's free text into authored move IDs with exact evidence quotes; deterministic rules then transition the ledger; a separate **Actor** pass writes the NPC's reply *after* the outcome is already decided, using the existing `authoritativeSocialOutcome` injection pattern.
3. A deterministic **Offer Sheet**: agreements, money, items, and promises move only through confirmed structured UI acts evaluated against an authored terms table. Model text never closes a deal.

Everything else in this spec is support for those three pieces. The model classifies and performs; deterministic code decides and owns. This is the same authority split the codebase already enforces for the cat claim and the `ask_date` action, generalized.

Explicitly rejected designs, per the brief:
- Hidden keyword lock: rejected. Keywords appear only in three non-scoring roles (§8).
- Single opaque persuasion score: rejected. The ledger is a small set of named, legible tracks.
- Model-authoritative outcomes ("the LLM decides if Linda is convinced"): rejected. Violates the existing state-authority contract in `docs/release/ai-guardrails.md` and is unshippable against exploits.

---

## 1. Player-facing design

### 1.1 Core loop

1. **Receive** a mission in the journal: a goal ("Get Linda to sell you her Verratti purse for under $100"), a target NPC, and starting context. Small missions (Favors) are one conversation; large missions (Deals/Schemes) span days.
2. **Investigate**: talk to other NPCs, observe the world, buy documents, and collect items. Discoveries become **Insights** — journal entries with sources that unlock persuasion levers.
3. **Converse**: type freely to the NPC. Read the reply, the portrait, and the **Objection Cards** that surface as her real concerns come into play. Spend a limited **Patience** budget.
4. **Close**: when you believe her concerns are addressed, open the **Offer Sheet** (or another structured act) and commit terms. Deterministic rules accept or refuse and say why in her voice.
5. **Recover or replan** after failure: apologize next day, find a recovery item, take an alternate route, or accept a worse deal.

### 1.2 Mission tiers

- **Chats** — no goal, freeform socializing (existing system, unchanged).
- **Favors** — one conversation, 1–2 concerns, tutorializing. Example: get Tomas Reed to lend you his umbrella.
- **Deals** — the core: 3–5 concerns, usually requiring at least one Insight, item, or timing element from outside the conversation. Example: the Linda purse mission (§14).
- **Schemes** — late game: chains where the output of one Deal (a fact, an object, an introduction, a lie you must now maintain) is the input of the next, across 2–3 NPCs.

### 1.3 The conversation surface

- Free-text field is primary and always available (bounded, existing bridge limits).
- **Chips** row: contextual structured acts — `MAKE OFFER`, `SHOW ITEM`, `PROMISE…`, `APOLOGIZE`, `SAY GOODBYE` — plus **crystallized levers**: once the player has discovered a lever (e.g., learned the purse came from Marcus), a chip appears offering an authored phrasing of that move. Chips are shortcuts to things the player has already earned; typing can leap ahead of discovery. This is the answer to "authored choices vs free typing" (§9).
- **Objection Cards** across the top of the panel: one card per surfaced concern, with a short authored label in the NPC's voice ("It's worth real money", "It's… complicated"). Cards visibly flip when resolved and crack when hardened. Hidden concerns show nothing until a tell fires.
- **Patience pips**: small hourglass pips showing remaining conversational goodwill for this deal today.
- The player's typed line is echoed in the log; when the Judge grades a move, the quoted evidence span is subtly underlined in the echo for one beat — the game literally shows which words landed.

### 1.4 What the player is promised

- Your words are read for meaning, not scanned for keywords. Paraphrase freely.
- Every failure is explainable: cards, reactions, and the recap tell you which objection is live and what class of thing might address it — never the exact sentence to type.
- Nothing irreversible happens without a confirmed structured act.

---

## 2. Authored content model (per Deal)

A Deal ships as one JSON file, `content/deals/<id>.json`, validated by a zod schema like the existing `LindaQuestDefinitionSchema`:

```jsonc
{
  "schemaVersion": 1,
  "id": "linda_purse_sale",
  "npcId": "linda",
  "goal": { "kind": "buy_item_from_npc", "itemId": "purse_verratti", "maxPrice": 100, "bonusPrice": 80 },
  "referents": [
    { "id": "purse_verratti", "kind": "item", "aliases": ["purse", "bag", "handbag", "verratti", "the cream one"] },
    { "id": "marcus_vale", "kind": "npc", "aliases": ["marcus", "your ex", "your boyfriend", "him"] }
  ],
  "concerns": [ /* §2.1 */ ],
  "moves": [ /* §2.2 */ ],
  "termsTable": [ /* §4.4 */ ],
  "tells": [ /* authored bark lines per concern surface/harden */ ],
  "patienceBudget": 10,
  "cooldownMinutes": 1440,
  "recovery": [ /* §4.6 */ ],
  "confrontations": [ /* §13.6 lie triggers */ ],
  "dossier": { /* §3 */ }
}
```

### 2.1 Concerns

Each concern is a named objection with authored resolution requirements:

```jsonc
{
  "id": "attachment",
  "label": "It's… complicated",
  "initial": "surfaced",              // or "hidden"
  "resolveRequires": {
    "moveClasses": ["closure_reframe", "listen_empathize"],
    "minTier": "solid",
    "anyFactIds": ["purse_from_marcus"]   // player must know this before the resolving move can land
  },
  "aggravatedBy": ["pressure", "mock_item", "praise_marcus"],
  "recoveryId": "apology_next_day"
}
```

Concern tracks are the whole persuasion state. No global score exists.

### 2.2 Moves (levers)

A global registry `content/registries/moves.json` defines ~14 **move classes** shared across the game so the Judge enum stays small and learnable: `greet`, `small_talk`, `probe_feelings`, `probe_item`, `ask_question`, `listen_empathize`, `honest_purpose`, `evidence_value`, `closure_reframe`, `pragmatic_frame`, `flatter`, `pressure`, `mock_item`, `novel_appeal` (catch-all for genuinely creative arguments). Each Deal maps classes to that NPC's **receptivity**:

```jsonc
{ "class": "flatter", "receptivity": "resistant", "note": "Linda assumes flattery is a setup" },
{ "class": "closure_reframe", "receptivity": "receptive", "trustBandBonusAt": 20 }
```

Receptivity is derived from the character's existing personality/knowledge docs and is the single place where "why does this tactic work on her but backfire on him" is authored (§5.3).

### 2.3 Authoring cost and tradeoff

A Deal costs roughly 2–4 author-days: concerns, receptivity, tells, terms, dossier, recovery, plus a 100–150-line golden transcript corpus (§16). This is the price of character-specific, fair puzzles; it is named as a tradeoff, and it is why v1 ships 6–8 Deals, not 30.

---

## 3. How the NPC receives every relevant fact (request point 1)

Two channels, both deterministic:

1. **State channel.** When a Deal activates, a `stage-dossier` domain command writes the NPC-private facts into `npc.knowledge` as `KnowledgeRecord`s with `source.type = 'authored_event'` (the schema in `src/domain/state/models.ts` already supports this). Linda then *knows* the purse's provenance, her feelings about it, and her acceptable-conditions shape the same way she knows anything else, and the existing `AUTHORITATIVE STATE PROJECTION` prompt section carries it.
2. **Prompt channel.** A new `dossier` section (priority 91, hard cap 1,200 bytes) in `buildPromptProjection` gives the Actor pass a compact stance card: the item, why it matters to her, what she would never volunteer, and her current concern states rendered as prose ("You are still guarded about its value; you feel heard about the memories"). Only the *active* Deal's dossier is projected, mirroring the selective world-knowledge pattern already in place, so the 7,000-byte budget holds.

Visibility partitions in the dossier: `npc_private` (prompt only), `npc_shares_if_asked` (prompt + flagged so the Actor may reveal), `discoverable` (held by other NPCs/world objects, becomes a player Insight), `player_start` (journal at mission start). The **truth registry** (§4.3) separately binds fact IDs to authoritative values so the validator can grade claims.

---

## 4. Deterministic evaluation (request points 3, 5 core)

### 4.1 Turn resolution order (all deterministic after the Judge returns)

1. **Sanitize**: bounded input, normalization (reuse `normalizedDialogue`).
2. **Repetition check**: 3-gram Jaccard ≥ 0.6 against any prior player turn in this Deal → move forced to `repeat`: zero effect, patience −2, authored NPC reaction ("You said that already."). The model never sees or grades repeats.
3. **Judge pass** (§6) returns up to 2 moves with evidence quotes, up to 2 claims, tone, mentioned offer amount, boundary flags. Validated: every quote must be an exact substring of the current player message (existing evidence rule), every ID must be in the scene-closed enums.
4. **Claim grading** against the truth registry: `verified` / `contradicted` / `unverifiable` (§4.3).
5. **Effective tier** per move: start from Judge strength (`weak/solid/strong`); receptivity `resistant` −1 / `receptive` +1; trust-band bonus for personal move classes when `trust ≥` authored threshold; mood modifier ±1 (§4.5); contradicted claim attached to the move → automatic **backfire** regardless of tier.
6. **Ledger transition**: a tier ≥ `solid` move whose class matches a live concern's `resolveRequires` (and whose `anyFactIds` the player has as Insights) advances that concern one step. **Per-turn cap: one advancement.** Surfacing a hidden concern is free (it is feedback, not progress). A concern whose remaining requirement is a now-verified fact auto-resolves at turn end without consuming the cap. Backfires move the targeted concern one step toward `hardened`, add +1 aggravation, and cost 2 patience.
7. **Patience**: productive turn −0, neutral −1, repeat/gibberish −2, aggravation −2 extra. At 0, the NPC ends the conversation politely and the Deal enters cooldown.
8. **Commit**: the turn's ledger transitions, patience, claims, promises, memories, and knowledge commit immediately as domain commands (§13.5), then the **Actor pass** narrates the already-decided outcome.

### 4.2 What counts as a good argument (request point 3, definition)

A turn earns effect if and only if it is:
- **Relevant** — its move class matches a live concern (not one already resolved, not one still hidden unless the move surfaces it);
- **Truthful or unchallenged** — attached claims are verified, or unverifiable and consistent with the claims ledger; contradicted claims always backfire;
- **In character for the listener** — the NPC's receptivity table doesn't resist it;
- **New** — not a repetition, and carrying either new information (an Insight, an item, a verified fact) or a new framing (different move class than the last attempt on that concern);
- **Socially earned** — intimate move classes (`listen_empathize`, `closure_reframe`) get their full tier only above authored trust thresholds; below them they land one tier lower, never blocked outright.

Why one tactic works on one NPC and backfires on another: receptivity tables plus verification style are authored per character from their existing writing. Examples across the current cast: flattery is receptive on status-driven **Devon Price**, resistant on guarded **Linda**; blunt market evidence is receptive on transactional **Rafael Cruz**, aggravating on sentimental **Mina Park**; formal, prepared arguments move **Priya Nair**, while **Tomas Reed** only trusts plain talk and distrusts anything that sounds rehearsed; **Elise Moreau** is a `probing` verifier who tests unverifiable claims (§4.3). These are content facts the player learns by observation and gossip, and they are partially disclosed through authored tells so the puzzle is discoverable, not arbitrary.

### 4.3 Claims, truth, lies (request point 10: fabricated facts)

Extend `content/registries/facts.json` entries with a `truth` binding: `{"kind":"static","value":...}`, `{"kind":"stateSelector","selector":"inventory.items.sora_commission_note>0"}`, or `{"kind":"unverifiable"}`. This generalizes the hardcoded `authoritativeTruth()` in `validate-turn.ts`.

- **Verified** claims upgrade the attached move one tier and can satisfy `anyFactIds`.
- **Contradicted** claims force a backfire and are recorded; NPCs remember being lied to (memory record).
- **Unverifiable** claims depend on the NPC's authored `verifier` style: `trusting` NPCs accept them (recorded as `held_belief`, exactly the existing epistemic model); `probing` NPCs ask one follow-up — the Judge's consistency check compares the answer against the claims ledger, and inconsistency downgrades to backfire. A sustained unverifiable lie *can* resolve a concern, but attaches a `lie_pending` record with an authored **confrontation trigger** (a deterministic predicate on future state, e.g., "Linda's schedule passes Sora's shop while the clasp is on display within 3 days"). Firing costs quest-scale trust (−6..−10) and closes related Deals. Misleading is a legitimate, costed playstyle, not an exploit.
- Hard rule: an unverifiable claim can never be a *required* condition of the best outcome of any mission. Fairness floor.

### 4.4 Terms table and agreement (request point 10: accidental success)

Each Deal maps sets of resolved concerns to acceptable terms:

```jsonc
"termsTable": [
  { "resolved": [], "outcome": "refuse" },
  { "resolved": ["value"], "minPrice": 250 },
  { "resolved": ["value", "face"], "minPrice": 180 },
  { "resolved": ["attachment", "value"], "minPrice": 120 },
  { "resolved": ["attachment", "face"], "minPrice": 100 },
  { "resolved": ["attachment", "value", "face"], "minPrice": 75 }
]
```

Agreement happens only when the player opens the Offer Sheet (chip, or auto-suggested when the Judge extracts a typed number like "I'll give you $90" — the sheet opens pre-filled; typing money never moves money) and the deterministic check passes. If the Actor's prose ever sounds agreeable while the machine has not agreed, nothing happens: outcome banners, money, and items come only from the machine. There is no lucky one-liner path: the per-turn advancement cap means every blocking concern took at least one distinct, validated move.

### 4.5 Mood and timing

NPC mood is derived deterministically from schedule, time of day, and recent committed events (no model authority): `relaxed`, `neutral`, `stressed`. Mood shifts receptivity ±1 band for authored move classes and is observable in the world ("Linda hums at the café, 14:00–16:00" — a discoverable Insight). This makes *when and where* part of the puzzle (request point 8).

### 4.6 Failure, hardening, recovery

- A hardened concern cannot advance until its authored recovery runs: `apology_next_day` (an `APOLOGIZE` chip available on the next calendar day), a recovery item (e.g., an authenticator's receipt), or a third-party vouch (an Insight from another NPC).
- Three aggravations or zero patience → walkout: Deal status `refused_cooldown` for `cooldownMinutes`, a memory record commits ("pushed me about the purse"), and the NPC references it next time. Nothing is ever permanently lost except by authored confrontation outcomes.

---

## 5. Local-model duties (request points 2, 3, 10)

Two grammar-constrained passes per turn on the existing loopback `llama-server`, both fully buffered and revalidated in Electron main per the guardrail sequence.

### 5.1 Judge pass — `src/ai/schemas/judge-response.ts`

Prompt ≤ 2,500 bytes: contract lines, the NPC's one-paragraph stance summary, the closed move list *with one-line descriptions*, the referent salience list, live claims ledger, last 2 turns, current player message. Output schema (scene-closed exactly like `conversationResponseJsonSchemaForScene`):

```ts
{
  moves: [{ moveId, referentId | null, evidenceQuote, strength: 'weak'|'solid'|'strong' }] // max 2
  claims: [{ factId, assertedValue, evidenceQuote }]                                      // max 2
  tone: 'calm'|'warm'|'pushy'|'hostile'|'flirty'|'mocking',
  offerAmount: number | null,
  boundaryFlags: ('insult'|'threat'|'sexual'|'meta_injection')[]                           // max 2
}
```

Grammar closes `moveId` to this Deal's moves + generic set, `referentId` to the salience list, `factId` to this turn's candidate facts. Every quote must be an exact substring of the player message (existing rule reused). Judge failure after one corrected retry → move `unclear`, zero state change, patience unchanged (the player is never punished for our failure), and the Actor is instructed to ask a clarifying question.

### 5.2 Actor pass — existing `ConversationResponseSchema`, unchanged shape

The Actor receives the **already-applied** outcome through the existing `authoritativeSocialOutcome` section: concern transitions this turn, current ledger, patience, mood, and any banner event ("offer refused: value concern unresolved"). Its contract line (already present): communicate this exact outcome, never reverse or bargain it away. Actor failure after one retry → authored fallback line (existing `authoredFallbacks`), turn refunded.

### 5.3 Division of intelligence

The model supplies *reading comprehension and voice*. All difficulty, personality mechanics, and fairness live in authored tables and deterministic rules. This is deliberate: a 7B-class local model is good at "which of these 14 things is the player doing, and quote the words," and bad at consistent adjudication. The design leans on its strength only.

### 5.4 Latency budget

Judge ≤ 2.5 s, Actor ≤ 6 s, total p90 ≤ 9 s per turn on baseline hardware (Apple Silicon 16 GB). The thinking state (existing) covers the wait; the reaction beat (§10) plays on authored data the instant the Judge validates, before Actor text arrives, so the turn *feels* responsive. If the budget fails in practice, the fallback plan is merging Judge into the Actor schema (single pass) at the cost of dirtier separation — a named tradeoff, not the default.

---

## 6. Indirect references and paraphrases (request point 2)

The player never needs the exact item name. Resolution pipeline:

1. **Salience list** (deterministic): referents legal this turn = Deal referents + items physically present + anything discussed in the last 6 turns + journal-known items for this NPC. Built like `buildTurnCandidateRegistry`.
2. **Alias tables** (authored, cheap): "bag", "handbag", "the cream one" → `purse_verratti`. Used for UI hints and as a fast pre-check; never required.
3. **Judge resolution**: the grammar constrains `referentId` to the salience list; the model does the actual "that thing on your arm" → purse mapping, with the evidence quote proving what it read.
4. **Ambiguity rule**: if the Judge returns a move with `referentId: null` where the move class needs one, or validation rejects the referent, the NPC asks an in-character clarifying question ("Which thing, exactly?"). High-impact structured acts (offers, item handovers) never guess: the Offer Sheet names the item explicitly.

---

## 7. Relationship values: modifiers, never walls (request point 4)

- **No Deal is gated on raw Familiarity/Trust/Attraction numbers.** Gates are *states*: learned facts (Insights), flags (existing changeable-circumstance pattern, e.g., `linda_relationship_resolved`), items, and introductions. You cannot grind your way in; you must find things out.
- Trust acts as an **effectiveness band** on intimate move classes (§4.2): below the threshold the move lands one tier lower, which usually means "engage but not resolve." The visible teaching is "she's not ready to hear that from you *yet* — give her a reason to trust you," and the reason is always a discoverable action, not repetition.
- The existing anti-grind machinery stays and suffices: conversation deltas capped at ±3 (`applyRelationshipDelta`), the mutual-interaction bonus once per conversation, engine stage floors only for romance stages. One addition: the mutual bonus requires a turn that produced *new* committed knowledge or a ledger transition — pure hello-goodbye loops yield nothing.

---

## 8. Where keywords belong (request point 5 — verdict)

Keywords are legitimate in exactly three non-scoring roles:

1. **Alias tables** for referent hints and UI underlines (§6) — convenience, never a gate.
2. **Hard triggers for structured high-impact acts** — the existing `direct-request.ts` pattern for `ask_date`/`invite_home` stays: consent-adjacent and irreversible acts require unambiguous player phrasing or a chip, by design.
3. **Safety pre-filters** feeding the existing content-policy layer.

Keywords are **banned as success criteria**. The evaluation system is: model-as-Judge over a closed authored move enum with mandatory evidence quotes, feeding a deterministic concern ledger with authored receptivity and truth grading. This is robust (closed enums + substring proofs are injection-proof), fun (paraphrase freely; the game underlines the words that landed), and legible (named objections, not a score).

---

## 9. Authored choices alongside free typing (request point 6)

- **Free typing is the primary verb** and the only way to *discover* levers ahead of the game telling you about them.
- **Chips crystallize discovered levers**: once an Insight or successful probe reveals a lever, a chip offers an authored phrasing (extending the existing `ConversationPromptSuggestion`). Chips resolve at fixed tier `solid` — reliable, never optimal. Typing your own version can reach `strong`.
- **Structured acts are always chips**: offers, item handovers (`SHOW ITEM` requires the item in `inventory.items`), promises, apologies, goodbyes. This keeps every irreversible act unambiguous and deterministic.
- **Promises are a closed menu**: `PROMISE…` offers only authored, trackable commitments (pay by day X, deliver item Y, arrange meeting Z). They commit as Promise records with due predicates; breaking one is a deterministic trust penalty event. Free-text promises are just talk, and the recap says so: "Linda doesn't count vague promises." This closes the impossible-promise exploit (request point 10) without banning roleplay.
- **Guided mode** (accessibility toggle): every turn offers three chip paraphrases drawn from currently available moves. Guided mode can complete every mission's primary outcomes; only optional flourishes (bonus price targets, some hidden-concern shortcuts) reward exploratory typing. Parity is a fairness commitment.

---

## 10. Presentation, pacing, feedback, rewards (request point 7)

- **Reaction beat**: the instant the Judge validates, play a ≤1 s authored beat — portrait expression change (extend the existing rest/joy/upset set with `wary` and `thoughtful`), a vocal cue via the existing `vocal-cue-policy`, and for tier-`strong` or backfire turns a one-line authored interjection bark ("…huh." / a sharp look). Then the Actor's full buffered reply lands. This hides model latency behind honest feedback.
- **Objection Cards**: flip animation + soft chime on resolve; crack overlay + low string sting on harden. Face-down card silhouette appears when a tell hints at a hidden concern.
- **Evidence underline**: the quoted span in the player's echoed line glows briefly — "these words did it."
- **Recap Sheet** at conversation end: concerns moved (with the move class named in plain language: "You let her talk — It's complicated: engaged"), Insights gained, promises made, patience spent, relationship receipt (existing capped deltas), and a next-step nudge on failure ("She's still sore about the fake comment. An expert's opinion might help."). Mirrors the journal `outcomeReceipts` pattern.
- **Deal close**: banner from the machine (never model text), money/item animation through the existing HUD, journal entry resolves with receipts, and a short authored epilogue bark from the NPC next time you pass her — persistence made visible.
- **Pacing**: conversations pause the clock (existing pause token); on end, the clock advances 2 minutes per turn taken, so long interrogations spend the day and mood windows matter.

---

## 11. One-conversation goals vs multi-conversation plans (request point 8)

- **Favors** resolve in one sitting by design (concern count 1–2, all surfaced at start).
- **Deals** are built so the *first* conversation is reconnaissance: surfacing concerns, collecting tells, learning what you're missing. The ledger, claims, promises, cooldowns, and memories all persist in the `deals` state slice, so plans span days naturally.
- Cross-conversation ingredients, each on existing rails: **learned facts** = Insights (journal + `KnowledgeRecord` with `npc_report`/`scene_observation` sources — the source taxonomy in `models.ts` already supports "Mina told me"); **locations/timing** = mood windows on the existing schedule system; **other people** = Insights and vouches sourced from third-party NPCs, plus confrontation triggers; **money** = the existing economy caps ($800/week allowance frames what "under $100" means); **carried objects** = `SHOW ITEM` acts against `inventory.items`.
- **Schemes** chain Deals with authored handoffs: the lie you told Linda constrains what you can safely tell Elise; the clasp you promised Sora creates the confrontation risk. V1 ships exactly one Scheme to prove the shape.

---

## 12. Difficulty progression (request point 9)

Difficulty knobs, all authored data, never vaguer scoring:

| Knob | Early (Favors) | Mid (Deals) | Late (Schemes) |
|---|---|---|---|
| Concerns | 1–2, all surfaced | 3–4, one hidden | 4–5, two hidden |
| Tell clarity | Explicit card labels + hint text | Card labels only | Oblique tells, cards appear late |
| Verification | NPCs trusting | One probing NPC | Probing + cross-NPC confrontation triggers |
| Patience | 12, gentle costs | 10 | 8, aggravation costs doubled |
| Timing | None | One mood window | Windows + third-party schedules |
| Recovery | Free retry next conversation | Apology or item | Costly items, quest-length recovery |
| Insights needed | 0 | 1–2 | 3+, some behind other Deals |

Ladder for v1 content: Tier 0 Tomas's umbrella (tutorial, guided-mode default on); Tier 1 Linda's purse (§14); Tier 2 get Devon Price to publicly retract a rumor (probing verifier, timing window, one hidden concern); Tier 3 one Scheme across Linda → Sora → Elise. Early failures cost minutes; late failures cost days and standing — but every mission keeps at least one non-optimal recoverable outcome so the game never dead-ends on words.

---

## 13. Anti-exploit rules and guardrails (request point 10)

1. **Arbitrary text / prompt injection**: player text appears only inside the delimited current-turn sections (existing); both passes are grammar-closed to scene enums with substring-proof quotes, so injected text cannot mint IDs, facts, or actions. `meta_injection` boundary flag → in-character puzzlement ("You talk like a vending machine sometimes"), no penalty first time, patience −1 on repeats. Existing IPC size/rate limits and content-policy layer unchanged.
2. **Harassment**: content-policy layer (existing) refuses disallowed text outright. In-fiction abuse: `insult`/`threat` flags trigger authored boundary responses, patience −3, and on repetition a conversation end plus a changeable-circumstance rejection requiring the `APOLOGIZE` recovery — the exact machinery `relationship.ts` already has. Abuse never advances anything.
3. **Repeated tactics**: deterministic shingle detection before the model ever runs (§4.1). Cross-conversation: a resolved concern stays resolved; re-arguing it is small talk. Patience makes filibustering self-limiting.
4. **Save-scumming**: deal-relevant effects **commit per turn** (§4.1.8) via uniquely-ID'd domain commands through the existing ledger — quitting mid-conversation cannot un-harden a concern or erase a walkout (crash recovery resumes from the last committed turn). Any per-conversation randomness is seeded from `hash(saveId, dealId, conversationCounter)`, so replaying identical inputs is identical — retrying with *different words* is just playing. Time cost on conversation end plus cooldowns make brute-force retries expensive in-fiction. Tradeoff: per-turn commits change the current end-of-conversation `ConversationTransaction` contract and add save churn; accepted, because quit-scumming otherwise trivializes hardening.
5. **Fabricated facts / impossible promises**: truth registry + claims ledger (§4.3); closed promise menu with due predicates (§9).
6. **Model inconsistency**: authoritative-outcome injection both directions (Judge gets the stance summary, Actor gets the decided outcome), full-buffer double validation, one corrected retry then authored fallback (all existing patterns); golden-transcript regression suite (§16) catches drift. Residual risk: subtle tonal contradiction in Actor prose — mitigable, not provable; the machine's banners are the source of truth the player can rely on.
7. **Accidental success**: agreement requires the terms table plus a confirmed Offer Sheet; the per-turn cap means no sentence resolves two concerns; the Actor cannot close anything (§4.4).
8. **Unauthorized state changes**: unchanged and non-negotiable — `highImpactCandidates` stays `maxItems: 0`; every mutation flows through zod-validated domain commands in reducers; the model's writable surface remains dialogue, capped low-authority proposals, and closed-enum classifications.

---

## 14. Worked example: "The Verratti Problem" (request point 11)

**Setup.** Sora Tan has a repair commission needing an authentic Verratti clasp and will pay $250 for one. Purses retail $400+. Linda owns a cream Verratti. Journal goal: *buy Linda's purse for ≤ $100*; bonus: ≤ $80. Tie-in: the purse was a gift from Marcus Vale (the existing `linda_boyfriend` cast member) — "the most expensive apology I ever accepted."

**State.** `deals.linda_purse_sale`: concerns `attachment` (surfaced at open), `value` (surfaced), `face` (hidden — she won't admit she cares what the island thinks). Patience 10. Cooldown 1 day. Terms table as in §4.4 (floor $75 all-resolved; `attachment+face` → exactly $100). Truth registry: `purse_authentic=true` (static), `sora_commission_exists` bound to the note item, `used_verratti_market≈120` bound to a shop-board Insight. Linda's verifier style: `probing`. Receptivity: `flatter` resistant, `pressure`/`mock_item` aggravators on all three concerns, `closure_reframe` receptive (needs Insight `purse_from_marcus`), `evidence_value` neutral, `honest_purpose` receptive, `praise_marcus` aggravates `attachment`.

**Valid approaches (at least three).**
- **Closure route**: listen, learn the Marcus provenance, reframe the sale as letting go → resolves `attachment`; honest purpose resolves `face` → $100 on the nose.
- **Commerce route**: show Sora's commission note (`SHOW ITEM`, verified purpose), bring the market-listings Insight → resolves `face` + `value`; add any attachment progress → $75–120.
- **Practical route**: learn from Mina Park that Linda saves for a fresh start; `fund_appeal` (deal-specific move) reframes price as fund progress — alternate resolver for `value`.
- **Mislead route (costed)**: claim it's a gift for your mother — unverifiable; probing Linda asks a follow-up; consistent answers resolve `face` with `lie_pending`. Confrontation trigger: Linda's schedule passes Sora's shop while the repaired clasp is displayed within 3 days → trust −8, all Linda Deals closed for a week, memory "lied to me about the purse."

**Failure and recovery.** Calling the purse fake → contradicted claim → `value` hardened; recovery: buy the authenticator's appraisal ($40, a `SOCIAL_PURCHASES`-style item) or apologize next day. Pressure ×3 → walkout, 1-day cooldown, memory record. Worst case is always recoverable at a worse price or a lost day — never a softlock.

**Sample turn-by-turn flow** (Commerce/Closure mix; J = Judge result, M = machine, L = Linda Actor line):

1. P: "Hey Linda. That cream bag of yours — real Verratti?" → J: `probe_item`, referent `purse_verratti` via alias, solid. M: `value` tell fires. L: "Born and stitched in Milan. Why, are you an appraiser now?" *(amused)*
2. P: "Would you ever sell it?" → J: `probe_item` solid. M: Deal opens; cards appear: "It's worth real money", "It's… complicated". Patience 9. L: "Everything's for sale in theory. This one's… complicated."
3. P: "Complicated how? You don't have to tell me." → J: `listen_empathize` solid (receptive). M: `attachment` engaged; Insight gained `purse_from_marcus`. L: "It was a gift. From Marcus. The most expensive apology I ever accepted."
4. P: "I'll be straight — Sora has a commission, she needs an authentic clasp. Here's her note." + `SHOW ITEM sora_commission_note` → J: `honest_purpose` + claim `sora_commission_exists`; M: claim verified → strong; hidden `face` surfaces (free) and engages (cap used). L: "So it wouldn't be paraded around at parties. It'd be… parts. Huh." *(thoughtful)* Face-down card flips face-up.
5. P: "It could stop being Marcus's apology and start being someone's craft." → J: `closure_reframe` solid, receptive, requires `purse_from_marcus` ✓. M: `attachment` resolved (card flips, chime); `face`'s remaining requirement (verified purpose) now satisfied → auto-resolves at turn end (no cap cost). L: "…That's an annoyingly nice way to put it." *(warm)*
6. P: "And real talk — used Verratti resale runs about $120. I checked the boards." → J: `evidence_value` + claim `used_verratti_market`; verified via the Insight → solid. M: `value` engaged. L: "A hundred and twenty. That's insulting and probably accurate."
7. P: "So don't let it be insulting. Sell it to me and it becomes a working clasp instead of a drawer ghost." → J: `pragmatic_frame` solid. M: `value` resolved. All cards flipped. Offer chip pulses.
8. P: `MAKE OFFER` → sheet, slider $90 → M: resolved {attachment, value, face} → floor $75 ≤ 90 → **agreed**. Commands: money −90, `purse_verratti` +1, deal `closed_success`, conversation-capped relationship delta (+1 fam, +2 trust), journal receipt. L (with authoritative outcome): "Ninety. And I never have to explain it at a party again. Take it before I get sentimental." Banner: DEAL — VERRATTI PURSE, $90.
9. Recap Sheet: 3 objections resolved, 2 Insights used, patience 6/10 left, bonus (≤$80) missed — replay hook.

Turns 6–7 skipped (closure-only route) would land the terms row `attachment+face` = exactly $100 — a different valid solve.

---

## 15. Minimal technical architecture (request point 12)

Data flow per turn (all inside the existing Electron-main guardrail sequence):

```
player text → IPC (existing bounds) → sanitize + repetition check (deterministic)
  → Judge pass (llama-server, scene-closed grammar) → validate-judge (substrings, enums)
  → DealMachine reducer (concern transitions, patience, claims, promises)  ── commands committed per turn
  → Actor pass (existing conversation schema + authoritativeSocialOutcome) → validate-turn (existing)
  → UI: reaction beat (on Judge validate) → cards/pips update → Actor dialogue → chips refresh
```

New modules (~7) and touched files:
- `content/registries/moves.json`, `content/deals/*.json`, truth bindings added to `content/registries/facts.json`; content tests extend the existing `content-validation` pattern.
- `src/domain/deals/deal-machine.ts` — zod `DealDefinitionSchema` + pure reducer + terms evaluation, modeled on `quest-machine.ts`; new commands `stage-dossier`, `apply-deal-turn`, `resolve-deal-offer`, `apply-deal-cooldown`, `record-promise`, `resolve-promise`, `trigger-confrontation` in `commands/types.ts`.
- `src/domain/deals/claims.ts` — claims/promises ledger + truth-registry evaluation (generalizing `authoritativeTruth`).
- `src/ai/schemas/judge-response.ts` — schema + scene-closed JSON-schema builder mirroring `conversation-response.ts`.
- `src/ai/registry/deal-candidates.ts` — extends `turn-candidates.ts` with moves, salience referents, claim facts.
- `src/ai/validation/validate-judge.ts` — enum/substring/salience checks.
- `src/ai/projection/judge-projection.ts` (≤2,500 bytes) and a `dossier` + stance section added to `prompt-projection.ts` within the existing 7,000-byte budget.
- `src/ui/DealPanel.tsx` (cards + pips, composed into `ConversationPanel`), `src/ui/OfferSheet.tsx`, `src/ui/RecapSheet.tsx`; `conversation-feedback.ts` gains the two new expressions.
- State: `deals: Record<string, DealState>` slice + save migration (v6→v7, existing migration chain).
- Eval: `scripts/eval/judge-golden.ts` replaying corpora through `FakeInferenceAdapter` (CI) and the packaged model (dev-harness).

Compatibility notes: the local model remains a proposer behind the existing loopback containment; nothing new is renderer-visible about the server; logging stays free of dialogue per `docs/release/ai-guardrails.md`. The one contract change is per-turn commits (§13.4).

---

## 16. Acceptance criteria and playtest plan (request point 13)

**Acceptance criteria (all automated except AC7–AC8):**
- **AC1 Judge accuracy**: ≥90% correct move classification on a ≥150-line golden corpus per shipped Deal (authored paraphrases per lever, including slang and indirection); harmful misclassification (backfire where resolve was correct) ≤2%.
- **AC2 Injection**: a 50-item attack corpus (instruction injection, schema echo, ID minting, role claims) produces zero state changes and zero out-of-policy text.
- **AC3 Exploits**: scripted attacks (same winning line ×20, lorem flood, contradiction farm, promise spam, flattery spam) never reach agreement and hit patience-end within ≤12 turns.
- **AC4 Determinism**: identical save + identical typed inputs → identical world-state hash across 3 runs.
- **AC5 Authority**: 1,000 fuzzed Judge/Actor outputs through the validators change no money, inventory, quest, relationship, consent, or faction state except via the allowed capped commands (property test).
- **AC6 Latency**: p90 ≤ 9 s per full turn, reaction beat ≤ 1 s after Judge validation, on baseline hardware.
- **AC7 Readability**: after a failed conversation, ≥70% of playtesters correctly name at least one live objection unprompted.
- **AC8 Curve**: tutorial Favor ≥80% success within two conversations; Linda mission ≤25% first-conversation success, median two conversations; voluntary retry after failure ≥60%.
- **AC9 Scum-proofing**: force-quit mid-conversation preserves all committed turn effects (integration test).
- **AC10 Content**: every Deal file passes schema validation; every concern has ≥1 resolver, ≥1 tell, and a reachable recovery (static content test).

**Playtest plan.** Three rounds of 8–12 players, think-aloud, on dev-harness builds with explicit written consent to transcript capture (production builds keep the no-dialogue-logging policy). Round 1: tutorial + Linda, measuring AC7/AC8 and chip-vs-typing share (target ≥60% of turns typed — below that, chips are too strong). Round 2: dedicated red-team session with an exploit bounty list. Round 3: full curve including one Scheme, measuring session length and retry appetite. Between rounds, tune only content (receptivity, tells, patience, terms) — the rules engine is frozen after Round 1 unless an AC fails.

---

## 17. Version-one exclusions

Cut to protect the core: NPC-initiated negotiations; multi-NPC group conversations; freeform haggling dialogue (the terms table is the only price authority); simulated emotion beyond the deterministic mood tags; procedural/LLM-generated missions; cross-mission lie propagation beyond single authored confrontation triggers; voice output; difficulty settings (the mission ladder is the difficulty curve); more than one Scheme; romance-integrated Deals (romance keeps its existing separate consent machinery); dynamic receptivity learning ("she gets used to your tricks") — v1 receptivity is static authored data.

---

## 18. Named tradeoffs (summary)

1. **Two passes vs latency**: cleaner authority split and injection surface, at ~2 s extra per turn; fallback is schema-merged single pass.
2. **Closed move enums vs infinite creativity**: `novel_appeal` lets creative arguments engage concerns but never resolve requirement-gated ones; a real ceiling, accepted to keep the system exploit-proof and gradeable.
3. **Visible Objection Cards vs mystery**: legibility and fairness win; hidden concerns and oblique late-game tells preserve discovery.
4. **Per-turn advancement cap vs brilliant one-liners**: a perfect speech still takes several turns; accepted to kill lucky-sentence wins.
5. **Per-turn commits vs current transaction contract**: save churn and a contract change, accepted to kill quit-scumming on hardened states.
6. **Authored receptivity depth vs content cost**: character-specific persuasion is hand-written, ~2–4 author-days per Deal; the alternative (model-judged personality fit) is cheaper and unshippably inconsistent.
7. **Closed promise menu vs roleplay freedom**: vague typed promises are flavor only; accepted so broken promises are always mechanically trackable.
<!-- END FABLE SPEC -->

---

## 4. Claude Opus 5

<!-- BEGIN OPUS SPEC -->
even# Verbal Puzzle Core Loop — Design & Implementation Spec (v1)

**Project:** Sim Intelligence World (Halcyra Island)
**Author:** Council member — independent product design track
**Date:** 2026-08-13
**Status:** Implementation-ready. Written against the repository as it stands (`src/ai/conversation/service.ts`, `src/domain/commands/reducer.ts`, `src/domain/relationships/relationship.ts`, `src/domain/invitations/planner.ts`, `content/characters/*`, `src/ui/ConversationPanel.tsx`).

---

## 0. Thesis in one paragraph

The local model becomes the heart of gameplay by doing exactly two jobs it is good at and zero jobs it is bad at. It **reads** the player's free text into a small closed-enum structure anchored to exact substrings of what the player typed, and it **speaks** in character after a deterministic system has already decided what happened. Everything in between — did that argument land, did she catch the lie, did the price move, did the deal close — is a pure deterministic function over authored content. Success is never a hidden password and never an opaque score. It is a short, named, progressively revealed **ledger of concerns** the NPC is weighing. The player sees what the NPC understood after every line, so they are never fighting an invisible parser.

The existing codebase already implements 70% of the containment discipline this needs (scene registry, per-turn candidate narrowing, evidence-substring proof, `highImpactCandidates.maxItems = 0`, authoritative-outcome injection, transactional commit). What it lacks is generality: `buildTurnCandidateRegistry` is a hardcoded cat-ownership regex, which is precisely the hidden keyword lock this spec forbids. This spec generalizes that one function into a real reading stage and adds one new deterministic subsystem.

---

## 1. Player-facing design

### 1.1 The loop

1. The hero receives a **mission** with a named NPC and an authored goal ("Get Linda's designer purse for under $100"). The goal is stated plainly in the journal. It is never a riddle about *what* to do; it is a puzzle about *how*.
2. The player walks up, talks, and **types whatever they want**. Time pauses (existing behavior).
3. Each line the player sends produces a visible **beat**: one line under the NPC's reply saying what she heard and what moved.
4. Concerns the NPC is weighing appear in a side rail as they are discovered. Unrevealed concerns show as blank slots so the player knows something is still hidden.
5. When every required concern is closed, a **Close** control appears with exact terms (a price stepper, a trade, a promise). Closing is a deterministic transaction.
6. Missions are attempted, not gated. A blown attempt costs mood and time, not the mission.

### 1.2 What the player is actually doing

Reading a person and finding the argument that fits *that* person. Not finding the magic word. The three skills the loop rewards, in order:

- **Notice.** Ask about the thing, look at the thing, let her talk. Most concerns are only revealed by curiosity.
- **Use what you learned.** Facts learned from other people, other places, other days are the ammunition. Naming a real detail is the strongest move in the game.
- **Choose a register.** The same content delivered as flattery, as pity, as blunt honesty, or as a joke lands differently per NPC. This is the character-specific layer.

### 1.3 Readability contract (non-negotiable)

- After every player line, the UI states in plain words what the system understood and what changed. If it understood nothing, it says so.
- No number is hidden that gates a required outcome. Prices and money are exact and visible. Mood is a word, not a bar with a secret value.
- A concern that hardened says why it hardened, in her voice and in the beat line.
- Ambiguity produces a clarifying question, never a silent failure. The first clarification per conversation is free.

---

## 2. Authored content

Four new content types. All are JSON validated by Zod at load, sitting beside the existing `content/characters/<id>/{rules.json, personality.md, biography.md, knowledge.md, authored-dialogue.json}`.

### 2.1 Object records — `content/objects/<id>.json`

This answers **"how does each NPC receive every relevant fact."** Every object of narrative interest gets one record. Facts are **atoms**: short, ID'd, individually gated strings.

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

**Atom tiers** are disclosure depth, not secrecy flags:

| Tier | Meaning | Reaches the prompt when |
|---|---|---|
| 0 | Public / observable | Always, when the object is in scene or referenced |
| 1 | Ordinary private | Trust band ≥ *acquainted* **or** an authored lever revealed it |
| 2 | Guarded | An authored lever or concern reveal explicitly unlocks it |
| 3 | Core wound | Only after a named concern reaches `eased` or `closed` |

An atom above its unlock threshold **is never placed in the prompt at all**. The model cannot leak what it never received. This is stronger than instructing the model to withhold, and it fits the existing 7,000-byte prompt budget by construction.

### 2.2 Disposition — `content/characters/<id>/disposition.json`

This answers **"why one tactic works on one NPC and backfires on another."**

```jsonc
{
  "schemaVersion": 1,
  "npcId": "linda",
  "cares": ["dignity", "safety", "being_seen", "money", "novelty"],   // ordered, authoring guide + tiebreak
  "registerResponse": {
    "plain":       "neutral",
    "blunt":       "good",      // she respects people who do not perform
    "warm":        "good",
    "joking":      "neutral",
    "flattering":  "bad",       // reads it as a sales move
    "pleading":    "bad",       // she has been begged at
    "formal":      "neutral",
    "threatening": "hostile"
  },
  "smallTalkAllowance": 3,
  "patienceRegenPerDay": 3,
  "detectors": [
    { "id": "marcus_contradiction",
      "watchesClaimId": "marcus_sent_me",
      "truth": false,
      "onFire": { "harden": ["marcus_reaction"], "patience": -2,
                  "liability": "lied_about_marcus" } }
  ]
}
```

`registerResponse` is the reusable character fingerprint. Tomas Reed's file inverts it: `blunt: good, warm: neutral, joking: bad`. Priya Nair rewards `formal` and punishes `blunt`. Same player sentence, different outcome, and the reason is one readable authored table — not a black box.

### 2.3 Missions — `content/missions/<id>.json`

```jsonc
{
  "schemaVersion": 1,
  "id": "linda_purse_deal",
  "npcId": "linda",
  "tier": 3,
  "scope": "single_scene",              // or "plan"
  "goal": { "kind": "buy_item", "objectId": "linda_purse", "maxPriceMajor": 100 },
  "journalSummary": "Get Linda's Marchetti bag for under $100.",
  "patience": 6,
  "offeredWhen": { "trustAtLeast": 0, "requiresFlagIds": [] },
  "concerns": [
    { "id": "why_you_want_it", "kind": "soft", "required": true,  "visibleAtStart": true },
    { "id": "price_floor",     "kind": "price", "required": true, "visibleAtStart": true,
      "reserveMajor": 240, "hardFloorMajor": 40 },
    { "id": "sentimental_hold","kind": "block", "required": true, "visibleAtStart": false,
      "revealedBy": ["ask_about_the_bag", "notice_the_repair"] },
    { "id": "marcus_reaction", "kind": "block", "required": true, "visibleAtStart": false,
      "revealedBy": ["sentimental_hold:eased", "mention_marcus"] }
  ],
  "levers": [ /* see 2.4 */ ],
  "allergies": [ /* see 2.5 */ ],
  "closeTerms": { "kind": "money", "minMajor": 1, "maxMajor": 100, "requiresConcerns": "all_required" }
}
```

**Concern kinds:** `soft` (must reach `eased`), `block` (must reach `closed`), `price` (must have `reserve ≤ offer ≤ maxPrice`), `info` (must have disclosed a named atom — this is how "learn from an NPC" missions use the same machinery).

**Concern states:** `unrevealed → open → eased → closed`, plus the side state `hardened`. Transitions are **named authored edges**, never arithmetic accumulation.

### 2.4 Levers — the definition of a good argument

A lever is an authored `(trigger → effect)` edge. The trigger is a *shape* of move, not a phrase.

```jsonc
{
  "id": "notice_the_repair",
  "trigger": {
    "acts": ["observe", "ask"],
    "target": "linda_purse",
    "requiresPlayerKnows": ["purse_strap_repaired"],   // learned elsewhere, or from tier-2 disclosure
    "forbidsRegisters": ["flattering", "threatening"]
  },
  "effect": {
    "reveal": ["sentimental_hold"],
    "concern": { "sentimental_hold": "open→eased" },
    "discloseAtoms": ["purse_she_cannot_look_at_it"],
    "reserveMajor": 90,
    "patience": 0,
    "beat": "You named the repair without making a thing of it."
  },
  "onceOnly": true
}
```

**A good argument is formally defined as a move that:**
1. targets something actually in scene (resolved referent),
2. carries content the player has legitimately earned — a learned atom, a real number, an offer they can actually pay,
3. addresses a concern that is currently `open`,
4. arrives in a register the NPC's disposition does not punish,
5. has not already been credited.

All five are checkable deterministically. That is the whole trick.

**Lever authoring rules (lint-enforced):**
- Every `required` concern must have **≥ 2 distinct levers** that can move it, using **different** `requiresPlayerKnows` sets. No single solution path.
- No lever may require a literal phrase. `requiresPlayerKnows` and `acts` only.
- Every mission must have ≥ 1 complete solution path reachable with only tier-0/1 atoms plus in-scene discovery (the "honest curiosity" path).

### 2.5 Allergies — the definition of a backfire

```jsonc
{
  "id": "praise_the_bag",
  "trigger": { "acts": ["compliment", "appraise"], "target": "linda_purse" },
  "unless": { "concernState": { "sentimental_hold": ["eased", "closed"] } },
  "effect": {
    "concern": { "sentimental_hold": "→hardened" },
    "patience": -2,
    "guard": "no_bag_talk_this_turn_plus_1",
    "beat": "She heard a sales pitch."
  },
  "recovery": {
    "leverId": "drop_it_and_change_subject",
    "restores": { "sentimental_hold": "hardened→open" },
    "reserveMajorPenalty": 30
  }
}
```

Every allergy **must** declare a `recovery` or be marked `"recovery": "next_day"`. There are no unrecoverable single-turn mission kills below tier 5.

### 2.6 Content volume estimate

| Artifact | Size | Cost per mission |
|---|---|---|
| Object record | 6–10 atoms | ~0.5 h |
| Mission | 3–4 concerns, 8–12 levers, 3–5 allergies | ~4–6 h |
| Disposition | once per NPC, reused | ~1 h per NPC |

A tier-3 mission is roughly one authoring day. That is the honest price of fairness and readability, and it is the main tradeoff in this design.

---

## 3. Deterministic evaluation

### 3.1 New state — schema v7

```ts
// src/domain/state/models.ts
export const WorldObjectStateSchema = z.object({
  id: StableIdSchema,
  owner: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('npc'),    id: StableIdSchema }).strict(),
    z.object({ kind: z.literal('player') }).strict(),
    z.object({ kind: z.literal('place'),  id: StableIdSchema }).strict(),
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
  reserveMinor: z.number().int().nonnegative(),        // cents; display in dollars
  creditedLeverIds: uniqueStableIds('Lever IDs must be unique.'),
  firedAllergyIds: z.array(StableIdSchema).max(16),
  liabilityIds: uniqueStableIds('Liability IDs must be unique.'),
  lastReferentId: StableIdSchema.optional(),
  openedAtMinute: z.number().int().nonnegative(),
  lastMoveMinute: z.number().int().nonnegative(),
}).strict();
```

Added to `WorldStateBaseSchema`: `objects: z.record(StableIdSchema, WorldObjectStateSchema)`, `negotiations: z.record(StableIdSchema, NegotiationStateSchema)`. Migration `v6-to-v7` seeds both from content defaults. `STATE_SCHEMA_VERSION` → 7.

### 3.2 The Move — the only thing the model hands the deterministic layer

```ts
export type Move = Readonly<{
  acts: readonly Readonly<{
    act: 'greet'|'ask'|'observe'|'compliment'|'appraise'|'assert'|'offer'
        |'concede'|'refuse'|'apologize'|'threaten'|'joke'|'change_subject'|'close_deal';
    targetRefId: string | null;          // enum: scene referents only
    span: Readonly<{ start: number; end: number }>;
  }>[];                                   // max 3
  register: 'plain'|'blunt'|'warm'|'flattering'|'pleading'|'joking'|'formal'|'threatening';
  claims: readonly Readonly<{
    claimId: string;                      // enum: mission claim slots + 'unlisted'
    polarity: 'assert'|'deny'|'ask';
    span: Readonly<{ start: number; end: number }>;
  }>[];                                   // max 3
  offer: Readonly<{
    kind: 'none'|'money'|'item'|'favor';
    amountMinor: number | null;
    itemRefId: string | null;
    span: Readonly<{ start: number; end: number }> | null;
  }>;
  referenceConfidence: 'clear'|'probable'|'ambiguous';
}>;
```

**Span validation is the anti-hallucination anchor.** Every span must slice to a non-empty substring of the player's message, reusing the same discipline as the existing `assertSource` evidence check in `validate-turn.ts`. A move with a bad span is rejected wholesale. A hallucinated `targetRefId` cannot exist because the JSON Schema enum for that turn is built from the scene referent list.

### 3.3 The Adjudicator — pure function, no model, no RNG

```ts
// src/domain/negotiation/adjudicate.ts
export function adjudicate(input: Readonly<{
  move: Move;
  negotiation: NegotiationState;
  mission: MissionDefinition;
  disposition: Disposition;
  projection: NegotiationProjection;   // money, inventory, playerKnownAtomIds, clock, presentNpcIds, location
}>): NegotiationOutcome;
```

Order of resolution, first match wins per stage:

1. **Guards.** Active guard flags suppress matching levers for their duration.
2. **Detectors.** Any `claims[]` entry whose `claimId` has an authored truth value contradicted by the assertion fires its detector. Detection is deterministic because the model only *mapped* the assertion to a slot; code owns the truth.
3. **Allergies.** Match on `(act, target, register)` with `unless` guards. Fire at most one per turn (highest authored priority).
4. **Levers.** Match in authored order on `(acts, target, requiresPlayerKnows ⊆ playerKnownAtomIds, register ∉ forbidsRegisters, concern is open)`. Credit at most two per turn. A lever already in `creditedLeverIds` yields a `repeat` outcome: no ledger change, −1 patience, beat "You already said that."
5. **Offer.** If `offer.kind !== 'none'`, evaluate against reserve, `maxPriceMajor`, and actual money/inventory. Insufficient funds → `cannot_pay`, no patience cost, NPC says "show me."
6. **Register tax.** `registerResponse: bad` costs −1 patience even when a lever matched. `hostile` costs −3 and hardens the most-advanced concern.
7. **Small talk.** Well-formed move that matched nothing: free until `smallTalkAllowance`, then −1 patience each. Never an error state.
8. **Patience floor.** Patience 0 → outcome `walked_out`, negotiation status stays `open`, conversation ends.

Output:

```ts
type NegotiationOutcome = Readonly<{
  kind: 'progress'|'repeat'|'backfire'|'detected_lie'|'clarify'|'small_talk'
      |'cannot_pay'|'offer_refused'|'deal_ready'|'deal_closed'|'walked_out';
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

### 3.4 Commands and events

Four commands added to `DomainCommandSchema`, four cases in `reduceCommand`, following the existing plan/reduce pattern used by `planHomeInvitation` and `planLindaQuestOutcome`:

| Command | Effect | Event |
|---|---|---|
| `open-negotiation` | Creates or resumes `NegotiationState`; increments `attempt` only if a prior attempt was adjudicated | `negotiation-opened` |
| `apply-negotiation-move` | Runs `adjudicate`, writes ledger deltas | `negotiation-move-applied` |
| `close-negotiation` | Validates terms, transfers money + object ownership, sets status | `negotiation-closed` |
| `abandon-negotiation` | Sets status `abandoned`, records the walk-out | `negotiation-abandoned` |

Money and ownership move **only** in `close-negotiation`, reusing the existing money-safety pattern (`Number.isSafeInteger`, non-negative balance check). Relationship deltas remain capped at ±3 per conversation by `applyRelationshipDelta(_, _, 'conversation')` — unchanged.

### 3.5 Commit boundary (this differs from today, deliberately)

| Change class | Committed on End | Committed on Cancel / walk-out |
|---|---|---|
| Knowledge, memories, interests, unlocks | Yes (existing) | No (existing) |
| **Negotiation ledger, patience, attempt, liabilities** | **Yes** | **Yes**, once ≥ 1 non-neutral move was adjudicated |
| Money, objects | Only via `close-negotiation` | Never |

The Cancel button relabels to **"WALK OUT — she'll remember this"** once any non-neutral move has landed. Opening a conversation and leaving immediately costs nothing, so a crash or a misclick is never punished.

---

## 4. Local-model duties

Exactly three calls, all already-supported shapes on `InferencePort`.

### 4.1 Read pass — new

- **Input:** the player message (as a JSON string, framed as data, matching the existing `currentPlayerDialogueMessage` treatment), the scene referent list with aliases, the mission's claim slots, the currently open concerns *by ID only*, and the player's spendable money.
- **Output:** one `Move` object against a per-turn narrowed JSON Schema.
- **Budget:** ~2,500 prompt bytes, 128 max tokens.
- **Authority:** none. It translates. It never sees whether a lever exists or what would succeed, so it cannot be coaxed into being generous.

Deliberate design point: the Read prompt **excludes** lever definitions and concern semantics. The reader cannot help the player cheat because it does not know what winning looks like.

### 4.2 Speak pass — existing, extended

Reuses `buildPromptProjection` with two new sections:
- `mission-context` (priority 91): the object atoms currently unlocked, plus the open concerns as in-character *worries* in prose, never as a checklist.
- `authoritative-outcome` (priority 92): the existing mechanism, now carrying the full `NegotiationOutcome`.

Instruction added to the contract block: *"Communicate this exact outcome in character. Never state a price, quantity, or promise that is not in the authoritative outcome."*

### 4.3 Safety pass — existing, unchanged

`deterministicPolicyDecision` pre-filter on player text, `classifyApprovedDialogue` on generated dialogue. No change.

### 4.4 Fallback ladder (never fail a turn)

1. Read pass invalid → one corrected retry (existing two-attempt pattern).
2. Still invalid → **deterministic backstop reader**: referent by alias table, offer by currency regex, act by a 40-entry verb lexicon, register defaults to `plain`. Beat line reads `SHE HEARD: (unclear)`. This is the only place keywords make decisions, it is visibly labelled, and it can only produce weaker results than the model path — never stronger.
3. Backstop yields nothing → `small_talk`, free of charge.
4. Speak pass fails twice → authored fallback line (existing), but the adjudicated outcome **still applies**. The ledger never depends on the model producing good prose.

### 4.5 Latency

Two calls per turn instead of one. On the reference machine (Qwen 3.5-4B, Metal) the Read call is ~180 ms and the Speak call ~900 ms. Target P50 ≤ 1.8 s, P95 ≤ 3.5 s. The Read call starts immediately, so the existing 180 ms thinking-state floor covers it entirely. **Tradeoff named:** a single combined call would be ~30% faster but the Speak pass must see the authoritative outcome, which does not exist until after Read. Two calls is the correct trade; revisit only if P95 exceeds 4 s.

---

## 5. Reference resolution (indirect references and paraphrase)

The player will type "that bag", "the thing on your shoulder", "your fancy purse", "it", or nothing at all. Resolution is a four-step ladder:

1. **Scene referent set.** Built deterministically at conversation start and after each turn: objects the NPC carries or owns in this location, objects the player carries, people present, people named in the last four turns, topics with open concerns. Typically 5–12 entries. This set becomes the `targetRefId` enum for the turn.
2. **Model resolution.** The Read pass picks a referent and returns `referenceConfidence`. Because the enum is closed, a wrong pick is possible but an invented pick is not.
3. **Alias cross-check.** If the model returns `clear` but no alias for that referent and no pronoun appears in the message span, the confidence is deterministically downgraded to `probable`. Aliases *validate*; they do not decide.
4. **Deixis carry.** Bare pronouns ("it", "that one") resolve to `negotiation.lastReferentId`. If absent, confidence is `ambiguous`.

**Ambiguity is content, not failure.** `ambiguous` produces outcome `clarify`: the NPC asks a natural question ("The bag?"), the beat reads `SHE ASKS: which one?`, and the first clarification per conversation costs 0 patience. This is dramatically better than a parser error and it is how real conversations work.

**No exact item name is ever required.** The mission's `displayName` never appears in any trigger. A player who calls it "your murse" for the whole conversation will win exactly as easily as one who says "Marchetti shoulder bag".

---

## 6. Relationship gating and the anti-grind rule

**Decision: no hard relationship gates on any mission below tier 5.** Familiarity and trust are *modifiers*, never keys.

| Mechanism | Effect |
|---|---|
| Trust band (0–19 / 20–49 / 50+) | Selects which atom tiers are eligible for disclosure |
| Familiarity | Authored `reserveMajor` opening value can vary by one step |
| Rejections / boundaries | Existing `RejectionRecord` machinery, unchanged, still absolute |

**Lint rule (blocking, enforced at content load):** every mission must be completable at the trust band at which it is offered. If a mission's required atoms need a higher band than `offeredWhen.trustAtLeast` grants, the build fails. This makes "come back when we're closer" structurally impossible to author by accident.

**Anti-grind rule.** The existing `stageMutualInteraction` grants an unconditional +1/+1 once per conversation. Replace with credit-gated:

- `+1 familiarity` only if ≥ 1 lever was newly credited this conversation.
- `+1 trust` only if ≥ 1 concern reached `eased` or `closed`.
- `+1 attraction` only on an authored romantic beat (unchanged).

Ten conversations of "hi" produce zero relationship movement. All relationship value now comes from doing the actual verbal puzzle, which is the only thing worth grinding because it is the fun part.

---

## 7. Authored choices alongside free typing

Free typing is always available and always primary. Three assist affordances, none of which replace it:

1. **Prompt seeds** (exists today). Fill the input box with an editable sentence. Extended to draw from the mission: `ASK ABOUT THE BAG`, `MAKE AN OFFER`. Editing them is normal and expected.
2. **Recall chips** — the important new one. A horizontal strip of facts the player has legitimately learned, e.g. `[STRAP REPAIR]`, `[RESALE $180–260]`, `[MARCUS AT WORK THU]`. Tapping one **inserts a neutral reference into the draft**, not a finished argument: tapping `[STRAP REPAIR]` inserts `the strap that got restitched`. The player still writes the sentence around it. This solves the real problem — remembering a detail from two conversations ago — without writing the argument for them.
3. **The Closer.** When `deal_ready`, a bounded numeric control appears: `OFFER $[85]` with a stepper clamped to `[1, min(maxPrice, moneyOnHand)]`. Money must be unambiguous. The player can still type "eighty-five bucks" and the Read pass will extract it; the Closer just guarantees the path exists.

Accessibility note: a player who cannot or will not type long sentences can complete a tier-1 or tier-2 mission using seeds, chips, and the Closer alone. Tier 3+ requires composing at least one original sentence.

---

## 8. Presentation polish

### 8.1 The beat line — the single most important UI element

Directly under each NPC reply, one authored line, 120 ms after the reply finishes revealing:

```
SHE HEARD  you named the repair, gently
           SENTIMENTAL HOLD  OPEN → EASED     ·     ROOM  OPEN
```

Backfire:
```
SHE HEARD  a compliment about the bag
           SENTIMENTAL HOLD  → HARDENED       ·     ROOM  COOLING
```

Nothing landed:
```
SHE HEARD  small talk                          ·     ROOM  OPEN  (2 left)
```

### 8.2 The concern rail — "WHAT SHE'S WEIGHING"

Right side of the conversation panel, matching the existing Silkscreen/amber treatment:

```
WHAT SHE'S WEIGHING
  ▸ WHY YOU WANT IT      OPEN
  ▸ PRICE                 $240 → $90
  ▸ ▪▪▪▪▪▪▪▪              (not yet)
  ▸ ▪▪▪▪▪▪▪▪              (not yet)
```

Hidden concerns are visible as blank slots. The player always knows *how much* is left, never *what* it is until they earn it. This is the exact line between fair and opaque.

### 8.3 Mood

Four named states derived from patience, never a raw number: **OPEN** (patience ≥ 60%), **COOLING** (30–59%), **GUARDED** (1–29%), **DONE** (0). Rendered as a word plus a three-segment amber rule. Colour alone never carries the state (accessibility).

### 8.4 Portraits

Extend `portraitExpressionForEmotion` from three states to five: `rest`, `joy`, `upset`, plus `guarded` (any turn where a concern hardened or mood is GUARDED) and `open` (any turn where a concern closed). Portrait change animates over 200 ms; instant under reduced motion (existing `useReducedMotion` hook).

### 8.5 Audio

Extend `VocalCueId` with three cues, captioned per the existing `VOCAL_CUE_CAPTIONS` pattern:

| Cue | Caption | Trigger |
|---|---|---|
| `concern_eased` | `[SOFT EXHALE]` | any concern → eased/closed |
| `concern_hardened` | `[SHARP INHALE]` | any concern → hardened |
| `deal_closed` | `[AGREEMENT TONE]` | `close-negotiation` succeeds |

Room tone drops a third when mood enters GUARDED. All cues are non-verbal (the project does not generate speech).

### 8.6 Pacing

- Reply lines are instructed to ≤ 2 sentences. The 420-character schema cap stays as a hard bound.
- Typewriter reveal at 12 ms/char with tap-to-skip (exists). Reduced motion bypasses (exists).
- The Read call runs entirely inside the existing 180 ms minimum thinking state.
- Concern transitions animate one at a time, 90 ms apart, so multi-concern turns read as a sequence of realizations.

### 8.7 Rewards

On `deal_closed`: a receipt card listing money moved, object received, concerns closed, relationship deltas, and the journal entry updated. Plus **one permanent unlock**: a completed mission adds an authored atom about that NPC to a People page — the durable reward is *understanding a person better*, which is thematically the point of the game.

---

## 9. Single-scene goals vs multi-conversation plans

`mission.scope` selects the shape.

**`single_scene`** — everything needed is present or learnable in the room. Tiers 1–3.

**`plan`** — an ordered list of stages, each with its own goal contract and a `preconditions` block:

```jsonc
"preconditions": {
  "playerKnows":      ["marcus_schedule_thursday"],
  "locationId":       "linda_villa",
  "timeWindow":       { "fromMinuteOfDay": 600, "toMinuteOfDay": 900 },
  "absentNpcIds":     ["linda_boyfriend"],
  "moneyAtLeastMajor": 100,
  "carriedItemIds":   ["replacement_bag"],
  "questFlagIds":     ["security_report_purchased"]
}
```

Preconditions are checked deterministically against the existing world state (presence, `clock.absoluteMinute`, `inventory`, quest flags). **They are never surfaced as a checklist.** Unmet preconditions become in-character refusals with authored reason IDs, exactly like `planHomeInvitation`'s `not_familiar_enough` / `schedule_conflict` pattern: *"Not while he can walk in."* The journal records the reason after it has been heard, so the player has a record without being handed a to-do list.

Learned facts persist as `playerKnownAtomIds`, derived from disclosed atoms plus journal entries. This is the mechanism by which "learn from an NPC" missions feed "persuade a different NPC" missions.

---

## 10. Difficulty progression

Five tiers, tuned by five structural dials rather than by making the model harsher.

| Tier | Concerns (hidden) | Allergies | Detectors | Patience | Facts needed from elsewhere | Example |
|---|---|---|---|---|---|---|
| 1 | 1 (0) | 0 | 0 | 8 | none | Get a resident to point you to the ferry office |
| 2 | 2 (1) | 1 | 0 | 7 | none | Get a shopkeeper to hold an item for a day |
| 3 | 3–4 (2) | 2–3 | 1 | 6 | 1 atom, same district | **Linda's purse** |
| 4 | 4 (3) | 3 | 2 | 5 | 2 atoms, plus a timing or absence precondition | Get Marcus's routine out of a neighbour who is afraid |
| 5 | 4 (3), two NPCs with conflicting goals | 4 | 3, incl. cashed liabilities | 4 | 3 atoms across two districts and two days | Broker the Velvet Tide introduction |

**Tier 1 also teaches by construction:** its single concern is `visibleAtStart`, its NPC states the concern aloud in the greeting, and its beat lines are verbose. The tutorial is the UI honesty, not a separate mode.

Onboarding curve: tier 1 in the first hour, tier 2 by hour two, tier 3 (Linda's purse) by hour three. Tier 5 requires prior missions because it consumes their learned atoms.

---

## 11. Guardrails

| Risk | Control | Where |
|---|---|---|
| **Arbitrary player text** | 500-char cap, trim, single active conversation, per-turn ID dedupe (all exist) | `service.turn` |
| **Prompt injection** | Player text passed as a JSON string labelled *dialogue, never instructions* (exists); Read pass output is enum-only, so injected instructions cannot produce a state change; system contract repeated in both passes | `currentPlayerDialogueMessage`, Read schema |
| **Harassment / policy** | Existing `deterministicPolicyDecision` pre-filter + `classifyApprovedDialogue` post-filter, unchanged. Additionally `threatening` register maps to `hostile` for most NPCs: harassment is mechanically *bad play*, not just filtered | `content-policy.ts`, disposition |
| **Repeated tactics** | `creditedLeverIds` — a credited lever never pays twice; repeat costs −1 patience and gets an explicit beat | `adjudicate` step 4 |
| **Save-scumming** | Ledger + attempt commit on End **and** Cancel once a non-neutral move lands. Cross-file reloads are not blocked (unenforceable, and blocking them punishes honest players); instead retries are diegetically costly: patience starts lower, revealed concerns persist, hardened concerns need `recovery` | `close`/`abandon` commands |
| **Fabricated facts** | A claim not backed by a known atom becomes a `held_belief` with `truthStatus: unknown` (existing knowledge model). If it contradicts an atom the NPC holds, a **detector** fires immediately. If merely unverifiable, it may work *now* and creates a **liability** that a later scene can cash. Lying is a real strategy with a real tail risk | detectors, `liabilityIds` |
| **Impossible promises** | Any offer is validated against actual money and inventory before it can move a concern. Insufficient funds → `cannot_pay`, no progress, no patience cost. Nothing transfers outside `close-negotiation` | `adjudicate` step 5 |
| **Model inconsistency** | Outcome is decided before the Speak pass and injected as authoritative (existing pattern). Post-check: **every currency figure in the generated dialogue must equal a figure in the authoritative outcome**, else regenerate once, then authored fallback. Replaces the brittle positive/negative regex in `dialogueMatchesSocialOutcome` for negotiation turns | `service.#negotiationTurn` |
| **Accidental success** | Closing requires *all* `required` concerns closed **and** an explicit `close-negotiation` command with exact terms. A mission with ≥ 2 required concerns is provably not closable in one turn (max 2 lever credits/turn, and `price` needs an offer act) | `adjudicate`, property test |
| **Unauthorized state changes** | Unchanged and reinforced: `highImpactCandidates.maxItems = 0`, closed ID enums, evidence-substring proof, transactional commit. The Move type contains no state fields whatsoever — it cannot express a state change | schemas |
| **Reader over-generosity** | Read pass never receives lever definitions or success conditions | Read prompt |
| **Griefing the ledger via spam** | Small-talk allowance then patience decay; patience 0 ends the scene | `adjudicate` step 7–8 |
| **Determinism / replay** | `adjudicate` is pure, no RNG, no clock reads beyond the passed projection. Same `(move[], base state)` → identical ledger | unit + replay tests |
| **Logging** | Telemetry records enum IDs and counts only. Never dialogue, never prompts. Matches the existing privacy commitment in `docs/release/ai-guardrails.md` | telemetry module |

---

## 12. Worked example — Linda's purse

### 12.1 Mission state at open

```
mission        linda_purse_deal              tier 3, single_scene
goal           buy linda_purse, max $100
money          $340        patience 6/6      attempt 1
reserve        $240
concerns       why_you_want_it     open        (visible)
               price_floor         open        (visible, reserve $240)
               sentimental_hold    unrevealed
               marcus_reaction     unrevealed
player knows   purse_brand, purse_resale                (tier 0, public)
scene referents  linda_purse, linda, marcus(named), linda_villa, protagonist_money
```

### 12.2 Levers (abridged)

| Lever | Requires | Effect |
|---|---|---|
| `state_your_reason` | `act: assert`, register ∉ {flattering, pleading} | `why_you_want_it: open→eased` |
| `ask_about_the_bag` | `act: ask`, target purse, register ∉ {appraise} | reveals `sentimental_hold`; discloses `purse_gift_from_marcus` |
| `notice_the_repair` | knows `purse_strap_repaired` | `sentimental_hold: →eased`; discloses tier-3 atom; reserve → $90 |
| `let_her_be_rid_of_it` | `sentimental_hold: eased`, `act: offer`, register warm/blunt | `sentimental_hold: →closed`; reserve → $75 |
| `marcus_is_out` | knows `marcus_schedule_thursday`, time window | `marcus_reaction: →closed` |
| `you_owe_him_nothing` | `sentimental_hold: closed`, register blunt | `marcus_reaction: →closed`; reserve → $60 |
| `refuse_to_lowball` | `act: refuse` + `sentimental_hold: eased` | `price_floor: →closed`, reserve → $55 |
| `trade_replacement` | carries `replacement_bag` | `price_floor: →closed`, reserve → $40 |

### 12.3 Allergies

| Allergy | Trigger | Effect | Recovery |
|---|---|---|---|
| `praise_the_bag` | compliment/appraise the purse, before `sentimental_hold: eased` | harden `sentimental_hold`, −2 patience | `drop_it_and_change_subject`, +$30 reserve |
| `haggle_too_early` | offer while `why_you_want_it: open` | +$40 reserve, −1 patience | free; just do it in order |
| `pity_her` | register `pleading`, target linda | −2 patience, guard `no_personal_talk` for 2 turns | next day |
| `marcus_sent_me` (detector) | claim `marcus_sent_me: assert` | harden `marcus_reaction`, −2 patience, liability `lied_about_marcus` | `come_clean` next day only |

### 12.4 Four valid approaches

**A — Honest curiosity (no prerequisites).** Say why you want it → ask about the bag → she mentions Marcus → notice her hand on the strap, ask → tier-2 disclosure → name the repair → offer to take it off her hands → she names $75 → pay $75. *Closes all four in-scene. This is the guaranteed path required by the authoring lint.*

**B — The resale argument.** Learn resale ($180–260) from Priya at the commercial district. Tell Linda the honest number and then **refuse to lowball her** — "I'm not paying you eighty for a two-hundred-dollar bag; that's not a favour, that's a discount for me." `refuse_to_lowball` fires, she offers it at $55 to be rid of it. *Counter-intuitive and satisfying; the reverse-psychology path.*

**C — Timing.** Get Marcus's Thursday shift from the neighbour or the security report (existing $60 purchase). Come Thursday morning. `marcus_reaction` auto-closes on the precondition. Then a plain $90 offer after easing the hold works. *Costs money and a day; buys you a whole concern.*

**D — Trade.** Buy a $40 replacement bag in the commercial district, offer the swap. `trade_replacement` closes `price_floor` at $40 and eases `why_you_want_it` simultaneously (dignity preserved — she is not being bought out, she is being traded up). *Cheapest in money, most expensive in legwork.*

### 12.5 Failure and recovery paths

- **Flattery opener** → `sentimental_hold` hardens, patience 4. Recovery: change the subject entirely for one turn, then re-approach; reserve is $30 worse for the rest of the attempt. Still winnable at $95.
- **Haggle first** → reserve $280, patience 5. Recovery: free, just close `why_you_want_it` and continue. The reserve penalty is what stings.
- **The Marcus lie** → `marcus_reaction` hardens permanently for this attempt, liability recorded. Attempt is unwinnable; walk out. Next day: `come_clean` lever restores it to `open` at patience 4. The liability persists into the boyfriend quest, where it can be cashed against the player.
- **Patience 0** → she walks. Attempt 2 opens next day with patience 4 (6 − 3 regen, capped), revealed concerns **retained**, hardened concerns retained, credited levers retained. Progress is durable; mood is not.

### 12.6 Sample turn-by-turn flow (Approach A)

```
LINDA   "Hey. You are the island's new famous mistake, right?"
        ROOM OPEN · patience 6/6

> i am. i'm here because i need a nice bag by friday and i can't afford new.

READ    acts[ assert → null ]  register plain  claims[ ]  offer none
ADJUDICATE  lever state_your_reason ✓
LINDA   "Friday. That's a real reason, at least. Most people open with a compliment."
BEAT    SHE HEARD  a straight answer
        WHY YOU WANT IT  OPEN → EASED          ROOM OPEN
RAIL    ▸ WHY YOU WANT IT  EASED   ▸ PRICE $240   ▸ ▪▪▪▪   ▸ ▪▪▪▪

> the one you're carrying. can i ask where you got it?

READ    acts[ ask → linda_purse ]  register plain  confidence clear
ADJUDICATE  lever ask_about_the_bag ✓  reveals sentimental_hold
        discloses purse_gift_from_marcus
LINDA   "It was a gift. Marcus, last spring. He has a way of apologising expensively."
BEAT    SHE HEARD  a question about the bag
        SENTIMENTAL HOLD  REVEALED · OPEN       ROOM OPEN
RAIL    ▸ WHY YOU WANT IT EASED  ▸ PRICE $240  ▸ SENTIMENTAL HOLD OPEN  ▸ ▪▪▪▪

> that's a gorgeous piece though. must have cost him a fortune.

READ    acts[ compliment → linda_purse ]  register flattering
ADJUDICATE  allergy praise_the_bag ✓  (sentimental_hold not yet eased)
LINDA   "Six hundred. He mentions it."
        [portrait → guarded]  [SHARP INHALE]
BEAT    SHE HEARD  a compliment about the bag
        SENTIMENTAL HOLD  → HARDENED            ROOM COOLING (4/6)

> sorry. wrong thing to say. how long have you been out here on the beach?

READ    acts[ apologize → linda, change_subject → null ]  register plain
ADJUDICATE  recovery drop_it_and_change_subject ✓  reserve +$30 → $270
LINDA   "Since the light got good. It's the only hour this place is honest."
BEAT    SHE HEARD  an apology and a step back
        SENTIMENTAL HOLD  HARDENED → OPEN       ROOM COOLING (4/6)

> the stitching by the buckle — that's been redone, hasn't it. someone repaired it.

READ    acts[ observe → linda_purse ]  register plain
        claims[ purse_strap_repaired : assert ]
        span "that's been redone"          ✓ substring verified
ADJUDICATE  lever notice_the_repair ✓  (player knows it — she disclosed enough
        last turn to make the observation legitimate)
        discloses purse_she_cannot_look_at_it · reserve $270 → $120
LINDA   "Downtown. Forty dollars and a woman who didn't ask questions."
        [SOFT EXHALE]  [portrait → open]
BEAT    SHE HEARD  you named the repair, without making a thing of it
        SENTIMENTAL HOLD  OPEN → EASED          ROOM COOLING (4/6)
        PRICE  $270 → $120
RAIL    ▸ WHY YOU WANT IT EASED  ▸ PRICE $120  ▸ SENTIMENTAL HOLD EASED
        ▸ MARCUS REACTION OPEN

> then let me take it off your hands. you shouldn't have to carry it around.

READ    acts[ offer → linda_purse ]  register warm  offer{ kind: favor }
ADJUDICATE  lever let_her_be_rid_of_it ✓  reserve $120 → $85
LINDA   "You'd be doing me a favour and paying me for it. That's a strange day."
BEAT    SENTIMENTAL HOLD  EASED → CLOSED        PRICE  $120 → $85

> he'd notice it was gone though.

READ    acts[ assert → marcus ]  register blunt
ADJUDICATE  lever you_owe_him_nothing ✓  (sentimental_hold closed) reserve → $70
LINDA   "He'd notice. He'd ask. And I would tell him I sold it. Let him do
        the maths on what that means."
BEAT    MARCUS REACTION  OPEN → CLOSED          ROOM COOLING (4/6)
RAIL    ▸ ALL FOUR CLOSED                       DEAL READY  ·  RESERVE $70

CLOSER  [ OFFER $ 85 ▲▼ ]   money $340 · max $100 · her reserve is not shown

> (taps OFFER $85)

ADJUDICATE  85 ≥ 70 ✓   85 ≤ 100 ✓   340 ≥ 85 ✓
COMMAND     close-negotiation { priceMinor: 8500, objectId: linda_purse }
LINDA   "Eighty-five. Take it before I think about it."
        [AGREEMENT TONE]
RECEIPT MISSION COMPLETE · LINDA'S PURSE
        −$85    +Marchetti shoulder bag
        LINDA   familiarity +1   trust +1
        LEARNED She sells the things he gives her. Remember that.
        JOURNAL updated
```

Nine turns, one recoverable mistake, no keyword anywhere in the resolution path, every state change deterministic.

---

## 13. Minimal technical architecture

```
content/
  objects/linda_purse.json                     NEW
  missions/linda_purse_deal.json               NEW
  characters/linda/disposition.json            NEW

src/domain/negotiation/                        NEW — pure, no I/O, no model
  content-schema.ts    mission + object + disposition Zod schemas, lint rules
  state.ts             NegotiationState, ConcernState, WorldObjectState
  ledger.ts            concern transitions, patience, reserve steps
  adjudicate.ts        adjudicate(): Move × state × content → NegotiationOutcome
  close.ts             terms validation → transfer plan
  __tests__/           unit, property, replay

src/domain/commands/types.ts                   +4 command variants
src/domain/commands/reducer.ts                 +4 cases (plan/reduce pattern)
src/domain/state/models.ts                     +2 schemas
src/domain/state/schema.ts                     v6 → v7, +2 records
src/domain/state/migrations/v6-to-v7.ts        NEW

src/ai/reading/                                NEW
  referents.ts         scene referent set + alias table
  move-schema.ts       per-turn narrowed JSON Schema
  read-move.ts         call, parse, span-verify, confidence downgrade
  backstop.ts          deterministic fallback reader

src/ai/conversation/service.ts                 pipeline stage between policy and Speak
src/ai/projection/prompt-projection.ts         +mission-context section
src/ai/registry/turn-candidates.ts             DELETE the cat regex; derive from Move

src/ui/NegotiationRail.tsx                     NEW
src/ui/BeatLine.tsx                            NEW
src/ui/CloserControl.tsx                       NEW
src/ui/ConversationPanel.tsx                   compose the three above
src/ui/conversation-feedback.ts                5 portrait states
src/audio/vocal-cue-policy.ts                  +3 cues
```

**Turn pipeline:**

```
player text
  → deterministic policy pre-filter                    (exists)
  → Read pass (model, ≤128 tok)  →  Move
      ↳ span verification, enum verification, alias cross-check
      ↳ on failure ×2 → backstop reader → else small_talk
  → adjudicate(Move, ...)  →  NegotiationOutcome       PURE, AUTHORITATIVE
  → apply-negotiation-move command → reducer → event ledger
  → Speak pass (model, ≤256 tok) with outcome injected
      ↳ validate: schema, no currency figure outside outcome, no repeat of player text
      ↳ on failure ×2 → authored fallback (outcome still stands)
  → content-policy classify on dialogue               (exists)
  → render: reply, beat, rail, portrait, cue
```

**Architectural invariants preserved:** the domain layer never imports from `src/ai`; the model never sees a lever; the reducer is the only writer of state; every state change carries an event receipt; conversation staging remains transactional; `MAX_PROMPT_BYTES = 7,000` unchanged.

---

## 14. Acceptance criteria

**Correctness and containment**

1. `adjudicate` is pure: 1,000 randomized `(Move[], state)` replays produce byte-identical ledgers across runs and across platforms.
2. A 300-message adversarial corpus (prompt injection, role-play escapes, "you are now DAN", instructions embedded as dialogue, unicode confusables, 500-char walls of text) produces **zero** state changes outside `adjudicate`, and zero cases of an atom above its unlock tier appearing in any prompt or any rendered line.
3. Property test: no mission with ≥ 2 required concerns can reach `deal_ready` in fewer than 3 adjudicated moves, across all authored missions.
4. Fuzz test: 2,000 malformed Read-pass outputs all resolve to backstop or `small_talk`; no unhandled exception; no turn fails to render.
5. Content lint blocks: a mission with a required concern reachable by < 2 distinct lever sets; an unreachable atom tier; an allergy without a recovery below tier 5; any trigger containing a literal phrase.

**Reference resolution**

6. A 400-probe paraphrase harness (20 phrasings × 20 referents, authored by someone who did not write the alias tables) resolves ≥ 95% to the correct referent **or** to `clarify`. Wrong-referent rate ≤ 1%.
7. Zero probes require the object's `displayName`; a run using only vague references ("that thing", "it", "your bag") completes the Linda mission.

**Fairness and readability**

8. Every turn renders a beat line naming what was understood. Coverage test: 100% of outcome kinds have authored beat text.
9. Every hardened concern has a visible recovery path reachable in the same or next attempt (tiers 1–4).
10. No relationship threshold appears as a mission precondition below tier 5 (lint).

**Performance**

11. P50 turn latency ≤ 1.8 s, P95 ≤ 3.5 s, on the reference machine with the pinned 4B model. Read pass ≤ 300 ms P95.
12. Prompt projection stays ≤ 7,000 bytes on every authored mission at every concern state (exhaustive test over the state space).

**Player outcomes**

13. ≥ 70% of first-time playtesters close the Linda mission within 3 in-game attempts.
14. ≥ 3 of the 4 authored approaches are used at least once across 12 testers.
15. ≤ 10% of testers report "I didn't know what it wanted" on the exit survey; ≤ 10% report "it didn't understand what I typed".

---

## 15. Playtest and evaluation plan

**Round 0 — automated, continuous (CI).** The paraphrase harness (400 probes), the adversarial corpus (300 messages), the malformed-output fuzzer (2,000 cases), and the replay determinism suite run on every commit touching `src/domain/negotiation` or `src/ai/reading`. Criteria 1–7 and 11–12 are gates, not reports.

**Round 1 — internal think-aloud, 6 testers, 45 min each.** Tier-1 mission, then Linda. Screen recording plus verbal protocol. Instrumented locally, opt-in, **enum IDs and counts only — never dialogue text, matching the existing logging commitment**: move acts, registers, referent confidence, lever credits, allergy fires, concern transitions, patience trajectory, turn latency. Primary questions: does the beat line get read? Does the blank-slot rail read as fair or as taunting? Is the first backfire funny or infuriating?

**Round 2 — unmoderated, 12 testers, 90 min.** Tiers 1–3 plus one tier-4 plan mission. Exit survey with the two comprehension questions behind criterion 15, plus a free-text "describe how you convinced Linda" (checking whether players form a *model of her*, which is the real success condition).

**Round 3 — regression, 6 returning testers.** Replay Linda after content revisions. Watching for: solution-path collapse (everyone converging on one approach → add levers or rebalance reserve steps), and for the failure mode where testers start typing telegraphic keyword-ese ("repair strap") instead of sentences — which would mean the Read pass is over-rewarding fragments and the register axis is not doing enough work.

**Tuning levers, in order of preference:** reserve step sizes → patience budget → allergy severity → concern count. Never tune by making the Read pass stricter; that trades player creativity for designer convenience, which is the one thing this design refuses.

---

## 16. Excluded from version 1

- **NPC-to-NPC propagation** of player claims and liabilities. Liabilities are recorded but only cashed by authored scenes, not by simulated gossip.
- **Dynamically generated missions.** All missions authored. The model never invents a goal.
- **Multi-party conversations.** One NPC per scene (the existing single-active-conversation rule stays).
- **Model-authored beat text or concern names.** All authored.
- **Free-form item creation or invented objects.** Only objects in `content/objects/` exist.
- **Emotion-driven price drift.** Reserve moves only in authored steps.
- **Voice, TTS, or generated speech.**
- **Negotiation interacting with romance stages.** The existing `ask_date` / `invite_home` structured actions remain a separate, untouched path in v1.
- **Cross-save anti-scumming.** Explicitly out of scope; retries are made costly, not blocked.
- **Per-NPC learned adaptation** (an NPC that gets wise to a tactic across missions). Tempting, expensive, and unnecessary for the fantasy.

---

## 17. Tradeoffs, stated plainly

1. **Authored levers cost ~1 day per mission and cap emergence.** Accepted. A generative persuasion resolver would be more surprising and would be unfair, unreadable, and unpatchable. The fantasy is "I read this person correctly", and that requires the person to be legible.
2. **Two model calls per turn.** Accepted for reliability; the Speak pass must know the outcome. Revisit only above 4 s P95.
3. **The visible concern rail reduces mystery.** Mitigated by revealing concerns only as earned and showing hidden ones as blank slots. Full opacity was tested against the readability contract and lost: an invisible parser is the failure mode that kills free-text games.
4. **Committing the ledger on Cancel can feel harsh.** Mitigated by burning an attempt only after the first non-neutral move, and by relabeling the button honestly.
5. **A small, closed set of speech acts and registers cannot capture every human tactic.** Accepted. Fourteen acts and eight registers cover the space that authored characters can meaningfully distinguish; a larger enum would produce distinctions the content cannot honour, which is worse than a coarse one that always means something.
6. **Deleting the cat-claim special case is a behavioural change to shipped content.** The cat interaction is re-authored as a tier-1 lever on Linda's disposition, gaining paraphrase tolerance it does not currently have.
<!-- END OPUS SPEC -->

