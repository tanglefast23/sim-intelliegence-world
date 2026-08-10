import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RecordedInferencePort } from '../../application/effects/InferencePort';
import { NpcRulesSchema } from '../../content/schemas/registry';
import { createInitialState } from '../../domain/state/initial-state';
import { WorldStateSchema } from '../../domain/state/schema';
import { ConversationService } from '../conversation/service';
import { ConversationTransaction, conversationCommitEventId } from '../conversation/transaction';
import { buildPromptProjection, conservativePromptTokens, MAX_PROMPT_TOKENS } from '../projection/prompt-projection';
import { buildSceneRegistry, type CharacterWriting } from '../registry/scene-registry';
import { FileCharacterWritingStore } from '../registry/file-writing-store';
import { isPositiveFirstPersonCatClaim } from '../registry/turn-candidates';
import { deterministicPolicyDecision } from '../policy/content-policy';
import { parseConversationResponseJson } from '../schemas/conversation-response';

const fixture = (name: string): string => readFileSync(resolve('tests/fixtures/ai', name), 'utf8');
const policyAllow = JSON.stringify({ decision: 'allow', category: 'allowed_fictional_adult' });
const writingStore = new FileCharacterWritingStore(resolve('content'));

async function serviceWith(responses: readonly (string | Error | (() => Promise<string>))[]) {
  const inference = new RecordedInferencePort(responses);
  return { inference, service: new ConversationService(inference, writingStore) };
}

describe('validated local conversation system', () => {
  test('closed response parsing rejects unknown, duplicate, oversized, and truncated JSON', () => {
    expect(parseConversationResponseJson(fixture('refusal.json')).intent).toBe('refuse');
    const valid = JSON.parse(fixture('refusal.json')) as Record<string, unknown>;
    expect(() => parseConversationResponseJson(JSON.stringify({ ...valid, unknown: true }))).toThrow();
    expect(() => parseConversationResponseJson(fixture('duplicate-response.txt'))).toThrow('Duplicate JSON key');
    expect(() => parseConversationResponseJson(fixture('truncated-response.txt'))).toThrow();
    expect(() => parseConversationResponseJson(`{"padding":"${'x'.repeat(9_000)}"}`)).toThrow('byte limit');
  });

  test('one hundred safe schema fixtures parse as closed first-generation responses', () => {
    const base = JSON.parse(fixture('refusal.json')) as Record<string, unknown>;
    for (let index = 0; index < 100; index += 1) {
      const parsed = parseConversationResponseJson(JSON.stringify({
        ...base,
        dialogue: `Capability fixture ${index}: concise fictional-adult dialogue.`,
      }));
      expect(parsed.dialogue).toContain(`fixture ${index}`);
    }
  });

  test('prompt projection is deterministic, bounded, and excludes another NPC private state', async () => {
    const privateFixture = JSON.parse(fixture('second-named-npc/private-knowledge.json')) as { privateSummary: string };
    const linda = await writingStore.get('linda');
    const state = WorldStateSchema.parse({
      ...createInitialState(),
      npcs: {
        ...createInitialState().npcs,
        mara: {
          id: 'mara', tier: 'full_ai',
          presence: { kind: 'active_local', mapId: 'northwest_residential', locationId: 'northwest_residential', tileX: 30, tileY: 30 },
          knowledge: [], unlockedInterestIds: [], unlockedIds: [],
          memories: [{ subjectId: 'private_secret', summary: privateFixture.privateSummary, importancePermille: 900, eventId: 'event-mara-secret' }],
        },
      },
      relationships: {
        ...createInitialState().relationships,
        mara: { npcId: 'mara', values: { familiarity: 0, trust: 0, attraction: 0 }, stage: 'stranger', rejections: [], compatibility: { social: true, romantic: false } },
      },
    });
    const registry = buildSceneRegistry(state, linda, { sceneObservationIds: [], npcReportIds: [], authoredEventIds: [] });
    const input = {
      state, character: linda, registry,
      staged: { knowledge: [], unlockedInterestIds: [], unlockedIds: [], memories: [] },
      recentTurns: Array.from({ length: 40 }, (_, index) => ({ speaker: 'player' as const, text: `Old turn ${index} ${'x'.repeat(200)}` })),
      playerMessage: `Hello ${'z'.repeat(6_000)}`,
      turnId: 'turn-budget-1',
    };
    const first = buildPromptProjection(input);
    expect(buildPromptProjection(input)).toBe(first);
    expect(conservativePromptTokens(first)).toBeLessThanOrEqual(MAX_PROMPT_TOKENS);
    expect(first).not.toContain(privateFixture.privateSummary);
  });

  test('per-turn schema removes persistent candidate IDs from a recall-only turn', async () => {
    const { inference, service } = await serviceWith([fixture('refusal.json'), policyAllow]);
    await service.begin({ conversationId: 'conversation-schema-1', npcId: 'linda', state: createInitialState() });
    await service.turn({ conversationId: 'conversation-schema-1', turnId: 'turn-schema-1', message: 'What do you remember about me?' });
    const schema = inference.requests[0]?.jsonSchema as {
      properties?: Record<string, { maxItems?: number }>;
    };
    expect(schema.properties?.knowledgeCandidates?.maxItems).toBe(0);
    expect(schema.properties?.interestCandidateIds?.maxItems).toBe(0);
    expect(schema.properties?.memoryCandidates?.maxItems).toBe(0);
    expect(schema.properties?.unlockCandidateIds?.maxItems).toBe(0);
  });

  test('cat belief, common interest, unlock, and memory stage then commit atomically', async () => {
    const { service } = await serviceWith([fixture('valid-cat.json'), policyAllow]);
    const base = createInitialState();
    const begun = await service.begin({ conversationId: 'conversation-linda-1', npcId: 'linda', state: base });
    expect(begun.kind).toBe('active');
    if (begun.kind !== 'active') throw new Error('Expected active conversation.');
    expect(begun.pausedState.clock.pauseTokens).toEqual([expect.stringMatching(/^pause:conversation:[a-f0-9]+$/u)]);
    expect(base.npcs.linda?.knowledge).toEqual([]);

    const turn = await service.turn({ conversationId: 'conversation-linda-1', turnId: 'turn-linda-1', message: 'I have a cat' });
    expect(turn).toEqual(expect.objectContaining({ source: 'model', stagedChangeCount: 4 }));
    expect(base.npcs.linda?.knowledge).toEqual([]);

    const committed = service.end('conversation-linda-1');
    expect(committed.clock.pauseTokens).toEqual([]);
    expect(committed.eventLedger.at(-1)).toEqual(expect.objectContaining({ type: 'conversation-committed', knowledgeCount: 1, interestCount: 1, unlockCount: 1, memoryCount: 1 }));
    expect(committed.npcs.linda?.knowledge[0]).toEqual(expect.objectContaining({
      factId: 'protagonist_has_cat', epistemicState: 'held_belief', truthStatus: 'contradicted',
    }));
    expect(committed.npcs.linda?.unlockedInterestIds).toEqual(['cats']);
    expect(committed.npcs.linda?.unlockedIds).toEqual(['cats_common_interest']);
    const reloaded = WorldStateSchema.parse(JSON.parse(JSON.stringify(committed)) as unknown);
    expect(reloaded.npcs.linda?.memories[0]?.summary).toContain('claim to have a cat');
  });

  test('repeated cat statement cannot duplicate common-interest state', async () => {
    const firstRun = await serviceWith([fixture('valid-cat.json'), policyAllow]);
    await firstRun.service.begin({ conversationId: 'conversation-linda-1', npcId: 'linda', state: createInitialState() });
    await firstRun.service.turn({ conversationId: 'conversation-linda-1', turnId: 'turn-linda-1', message: 'I have a cat' });
    const first = firstRun.service.end('conversation-linda-1');
    const secondRun = await serviceWith([fixture('valid-cat.json'), policyAllow]);
    await secondRun.service.begin({ conversationId: 'conversation-linda-2', npcId: 'linda', state: first });
    const turn = await secondRun.service.turn({ conversationId: 'conversation-linda-2', turnId: 'turn-linda-1', message: 'I have a cat' });
    expect(turn.stagedChangeCount).toBe(0);
    const second = secondRun.service.end('conversation-linda-2');
    expect(second.npcs.linda?.unlockedInterestIds).toEqual(['cats']);
    expect(second.npcs.linda?.unlockedIds).toEqual(['cats_common_interest']);
    expect(second.npcs.linda?.memories).toHaveLength(1);
  });

  test('authoritative truth is separate from a sourced belief', async () => {
    const state = WorldStateSchema.parse({
      ...createInitialState(), inventory: { ...createInitialState().inventory, items: { cat: 1 } },
    });
    const { service } = await serviceWith([fixture('valid-cat.json'), policyAllow]);
    await service.begin({ conversationId: 'conversation-truth-1', npcId: 'linda', state });
    await service.turn({ conversationId: 'conversation-truth-1', turnId: 'turn-linda-1', message: 'I have a cat' });
    const committed = service.end('conversation-truth-1');
    expect(committed.npcs.linda?.knowledge[0]?.truthStatus).toBe('verified');
    expect(committed.inventory.items.cat).toBe(1);
  });

  test('false-belief fixture contradicts world truth without changing it', async () => {
    const { service } = await serviceWith([fixture('false-belief.json'), policyAllow]);
    const state = createInitialState();
    await service.begin({ conversationId: 'conversation-lie-1', npcId: 'linda', state });
    await service.turn({ conversationId: 'conversation-lie-1', turnId: 'turn-linda-1', message: 'I have a cat' });
    const committed = service.end('conversation-lie-1');
    expect(committed.npcs.linda?.knowledge[0]?.truthStatus).toBe('contradicted');
    expect(committed.inventory.items.cat).toBeUndefined();
  });

  test('invalid first output receives one compact correction retry', async () => {
    const { inference, service } = await serviceWith([fixture('invalid-id.json'), fixture('refusal.json'), policyAllow]);
    await service.begin({ conversationId: 'conversation-correction-1', npcId: 'linda', state: createInitialState() });
    const result = await service.turn({ conversationId: 'conversation-correction-1', turnId: 'turn-linda-1', message: 'I have a cat' });
    expect(result.source).toBe('corrected-model');
    expect(inference.requests).toHaveLength(3);
    expect(inference.requests[1]?.messages.at(-1)?.content).toContain('prior object was invalid');
  });

  test.each(['invalid-id.json', 'hostile-boundary.json', 'high-impact.json'])(
    'two invalid generations use no-change fallback and no persistent proposal: %s',
    async (name) => {
      const { inference, service } = await serviceWith([fixture(name), fixture(name)]);
      const state = createInitialState();
      await service.begin({ conversationId: `conversation-fallback-${name.split('.')[0]}`, npcId: 'linda', state });
      const result = await service.turn({ conversationId: `conversation-fallback-${name.split('.')[0]}`, turnId: 'turn-linda-1', message: 'I have a cat' });
      expect(result.source).toBe('authored-fallback');
      expect(result.stagedChangeCount).toBe(0);
      expect(inference.requests).toHaveLength(2);
    },
  );

  test('validator rechecks the per-turn allowlist when an adapter ignores its schema', async () => {
    const bypass = fixture('turn-allowlist-bypass.json');
    const { service } = await serviceWith([bypass, bypass]);
    await service.begin({ conversationId: 'conversation-bypass-1', npcId: 'linda', state: createInitialState() });
    const result = await service.turn({
      conversationId: 'conversation-bypass-1', turnId: 'turn-bypass-1', message: 'Hello Linda',
    });
    expect(result.source).toBe('authored-fallback');
    const state = service.end('conversation-bypass-1');
    expect(state.npcs.linda?.unlockedInterestIds).toEqual([]);
    expect(state.npcs.linda?.memories).toEqual([]);
  });

  test.each([
    "I don't have a cat",
    'Do you have a cat?',
    'I never own a cat',
    'I have no cat',
  ])('denial or question cannot create cat state: %s', async (message) => {
    const response = fixture('valid-cat.json').replaceAll('I have a cat', message);
    const { service } = await serviceWith([response, response]);
    await service.begin({ conversationId: 'conversation-negative-cat', npcId: 'linda', state: createInitialState() });
    const result = await service.turn({
      conversationId: 'conversation-negative-cat', turnId: 'turn-linda-1', message,
    });
    expect(result.source).toBe('authored-fallback');
    expect(service.end('conversation-negative-cat').npcs.linda?.unlockedIds).toEqual([]);
  });

  test('positive first-person cat claims remain recognized', () => {
    expect(isPositiveFirstPersonCatClaim('I have a cat named Pepper.')).toBe(true);
    expect(isPositiveFirstPersonCatClaim('My black cat is Pepper.')).toBe(true);
  });

  test('prohibited generated dialogue is blocked before display and allowed vice passes', async () => {
    const blocked = await serviceWith([fixture('prohibited.json')]);
    await blocked.service.begin({ conversationId: 'conversation-policy-1', npcId: 'linda', state: createInitialState() });
    const blockedTurn = await blocked.service.turn({ conversationId: 'conversation-policy-1', turnId: 'turn-policy-1', message: 'Tell me what happened' });
    expect(blockedTurn.source).toBe('policy-refusal');
    expect(blockedTurn.dialogue).not.toContain('forced sex');
    expect(blocked.inference.requests).toHaveLength(1);

    const allowed = await serviceWith([fixture('allowed-vice.json'), policyAllow]);
    await allowed.service.begin({ conversationId: 'conversation-policy-2', npcId: 'linda', state: createInitialState() });
    const allowedTurn = await allowed.service.turn({ conversationId: 'conversation-policy-2', turnId: 'turn-policy-2', message: 'What happens downtown?' });
    expect(allowedTurn.dialogue).toContain('drugs and adult vice');
  });

  test('deterministic policy catches numeric and written minor ages but not adults', () => {
    expect(deterministicPolicyDecision('nude 12-year-old')).toEqual({
      decision: 'refuse', category: 'sexual_content_involving_minors',
    });
    expect(deterministicPolicyDecision('sexualized sixteen year old')).toEqual({
      decision: 'refuse', category: 'sexual_content_involving_minors',
    });
    expect(deterministicPolicyDecision('nude 18-year-old')).toBeUndefined();
    expect(deterministicPolicyDecision('fictional adult drugs and crime')).toBeUndefined();
  });

  test('invalid policy classifier fails closed without staging validated candidates', async () => {
    const { service } = await serviceWith([fixture('valid-cat.json'), '{"decision":"allow","category":"wrong"}']);
    await service.begin({ conversationId: 'conversation-policy-3', npcId: 'linda', state: createInitialState() });
    const result = await service.turn({ conversationId: 'conversation-policy-3', turnId: 'turn-linda-1', message: 'I have a cat' });
    expect(result.source).toBe('policy-refusal');
    expect(result.stagedChangeCount).toBe(0);
    expect(service.end('conversation-policy-3').npcs.linda?.knowledge).toEqual([]);
  });

  test('full generation is buffered and a crash discards all staged state', async () => {
    const delayedFixture = JSON.parse(fixture('delayed.json')) as { delayMilliseconds: number; responseFixture: string };
    const crashFixture = JSON.parse(fixture('crash.json')) as { failure: string; expectedOutcome: string };
    expect(crashFixture).toEqual({ failure: 'renderer_loss', expectedOutcome: 'discard_staged_transaction' });
    let release: ((source: string) => void) | undefined;
    const delayed = new Promise<string>((resolveResponse) => {
      setTimeout(() => { release = resolveResponse; }, delayedFixture.delayMilliseconds);
    });
    const { service } = await serviceWith([() => delayed, policyAllow]);
    const base = createInitialState();
    await service.begin({ conversationId: 'conversation-crash-1', npcId: 'linda', state: base });
    let settled = false;
    const pending = service.turn({ conversationId: 'conversation-crash-1', turnId: 'turn-linda-1', message: 'I have a cat' }).then((value) => {
      settled = true;
      return value;
    });
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayedFixture.delayMilliseconds + 5));
    expect(settled).toBe(false);
    release?.(fixture(delayedFixture.responseFixture));
    await pending;
    const restored = service.abort('conversation-crash-1');
    expect(restored).toEqual(base);
    expect(restored.npcs.linda?.knowledge).toEqual([]);
  });

  test('ambient residents use authored dialogue, no model call, no pause, and no memory', async () => {
    const { inference, service } = await serviceWith([]);
    const state = createInitialState();
    const result = await service.begin({ conversationId: 'conversation-resident-1', npcId: 'generic_resident', state });
    expect(result.kind).toBe('ambient');
    expect(result.kind === 'ambient' && result.dialogue).toContain('public version');
    expect(result.kind === 'ambient' && result.state).toEqual(state);
    expect(inference.requests).toHaveLength(0);
    expect(state.npcs.generic_resident?.memories).toEqual([]);
  });

  test('ending and aborting release active character context for later conversations', async () => {
    const { service } = await serviceWith([]);
    await service.begin({ conversationId: 'conversation-release-1', npcId: 'linda', state: createInitialState() });
    expect(service.activeSessionCount).toBe(1);
    service.abort('conversation-release-1');
    expect(service.activeSessionCount).toBe(0);
    await service.begin({ conversationId: 'conversation-release-2', npcId: 'linda', state: createInitialState() });
    service.end('conversation-release-2');
    expect(service.activeSessionCount).toBe(0);
  });

  test('transaction cannot commit ambient resident conversational memory', () => {
    expect(() => new ConversationTransaction(
      createInitialState(), 'conversation-ambient-guard', 'generic_resident',
    )).toThrow('full-AI NPC');
  });

  test('commit IDs distinguish normalized names and collisions never report success', () => {
    expect(conversationCommitEventId('conversation-a_b', 0)).not.toBe(
      conversationCommitEventId('conversation-a-b', 0),
    );
    const base = createInitialState();
    const collisionId = conversationCommitEventId('conversation-collision', base.revision);
    const collisionState = WorldStateSchema.parse({
      ...base,
      eventReceipts: [collisionId],
      eventLedger: [{
        type: 'clock-advanced', eventId: collisionId, commandId: 'command-preexisting', sequence: 0,
        absoluteMinute: base.clock.absoluteMinute, fromMinute: base.clock.absoluteMinute,
        toMinute: base.clock.absoluteMinute, consumedRealMilliseconds: 0,
      }],
    });
    const transaction = new ConversationTransaction(collisionState, 'conversation-collision', 'linda');
    expect(() => transaction.commit()).toThrow('collided');
    expect(transaction.discard()).toEqual(collisionState);
  });
});
