# Dialogue and knowledge council review

## Target

Design review only for unrestricted named-NPC free text, the contemporary real-world/Halcyra frame, ambiguous local destination questions, and per-NPC intelligence and knowledge limits.

## Council status

- Claude Fable 5: completed at `xhigh`
- Claude Opus 5: completed at `xhigh`
- Grok 4.5: completed at `high`
- First attempt: incomplete because Opus exited before a valid result
- Retry: all three exact models completed and passed schema/model validation

## Synthesized findings

### 1. Fixed world frame — 3/3 agreement

The prompt did not say that real countries and stable public facts coexist with Halcyra. Add an always-loaded frame that treats Halcyra as real in character, preserves ordinary real-world knowledge, and forbids invented coordinates.

### 2. Question-scope routing — 3/3 agreement

Exact keyword selection alone could not distinguish China from local island directions. Add deterministic scopes for local Halcyra, wider real world, personal NPC, and concealed or unsupported questions. Do not add a second inference call in the prototype.

### 3. Per-NPC knowledge profile — 3/3 agreement

Personality and biography did not define education, life experience, topic limits, or island-section familiarity. Add required validated `knowledge.md` content for each full-AI character. Do not reduce intelligence to one score.

### 4. Natural uncertainty — 3/3 agreement

The general prompt did not require in-character uncertainty outside the profile. Add a strict no-invention rule and an `unknown_topic` response intent.

### 5. Acceptance matrix — 3/3 agreement

The only earlier knowledge test covered clothing retrieval. Add real-world, local entertainment, local food, general local destination, explicit external destination, personal, concealed, profile-validation, and frame-validation cases.

## Local verification and disposition

- Confirmed: world selection always returned Overview and had no scope router.
- Confirmed: all full-AI writing received the same public world document and no knowledge profile.
- Confirmed: local synonyms such as `fun` and `eat` were missing.
- Confirmed: the prompt had no general uncertainty or real-world frame rule.
- Corrected council detail: `validate-content.ts` already loads every character through `FileCharacterWritingStore`, which parses the shared world document. Direct malformed-document tests were added; a duplicate validation path was not added.

## Accepted implementation

- The user selected Linda as poorly educated but socially clever. Her profile gives her strong social and practical island knowledge, weak academic and technical knowledge, and basic stable real-world knowledge.
- A deterministic router selects one of four scopes before prompt assembly.
- World frame is always available; unrelated local district facts are excluded from wider-world questions.
- Knowledge profiles contain reasoning, education, experience, real-world baseline, topic tiers, Halcyra familiarity, and uncertainty behavior.
- Dynamic discoveries remain authoritative JSON state, not installed Markdown.
