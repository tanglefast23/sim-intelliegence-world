# Live-generated dialogue guardrails

## Player-visible behavior

Named adult NPCs answer free-text messages with one bundled local model. The game buffers the complete response. It does not show raw model tokens. The renderer shows an immediate non-text thinking state while generation runs.

## Guardrail sequence

1. The renderer sends a bounded message through one typed bridge operation.
2. Electron main validates the sender frame, payload shape, stable IDs, size, and request rate.
3. The prompt contains only the NPC projection, authored island facts, validated memories, and recent bounded turns.
4. llama.cpp grammar constrains output to a scene-specific JSON Schema.
5. Zod parses the complete object again in Electron main.
6. Deterministic code rejects unknown facts, unsupported evidence, invalid stable IDs, direct state writes, and contradictions with authored consent or boundaries.
7. A separate content-policy step checks the approved dialogue. Deterministic rules refuse sexual violence, sexual content involving minors, and sexual content involving real people. Explicit sexual detail between fictional consenting adults fades to black.
8. Invalid output gets one corrected attempt. A second failure returns authored no-change dialogue.
9. Only validated proposals enter the conversation transaction. The save changes only after an explicit deterministic commit.

## State authority

The model can propose dialogue, low-authority beliefs, memories, interests, and closed-enum action IDs. It cannot edit money, inventory, quests, factions, consent, relationships, police state, location, time, or save files. Deterministic systems own those values.

## Runtime containment

The main process starts one loopback-only `llama-server` with a private per-run key file, offline mode, no UI, no tools, no MCP, no media paths, no metrics, and no model routing. The renderer never receives the server address or key. Requests have byte, token, time, and queue bounds. Restart attempts end at a circuit breaker and safe fallback.

## Logging and privacy

Core dialogue works offline. The game does not send dialogue to a remote AI service. Logs can contain stage names and safe error classes. They do not contain prompts, model output, dialogue, private paths, keys, or save content.

## Steam disclosure draft

SI World uses live-generated text from a bundled local Qwen model to create dialogue for named fictional adult NPCs. Generation runs on the player's computer and does not require an external AI service. Output is constrained to a closed JSON schema, fully buffered, parsed, and validated before display. Deterministic game code blocks unauthorized state changes and enforces authored identity, knowledge, boundaries, compatibility, and consent. A second policy layer refuses sexual violence, sexual content involving minors, and sexual content involving real people; explicit fictional consenting-adult sexual detail fades to black. Invalid or blocked output is replaced by authored safe text. The game does not generate full speech.

This is a draft only. Recheck the current Steam Content Survey before submission. Disclose mature content separately and accurately. The current design does not permit live-generated Adult Only sexual content.
