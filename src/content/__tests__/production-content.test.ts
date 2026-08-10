import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RecordedInferencePort } from '../../application/effects/InferencePort';
import { ConversationService } from '../../ai/conversation/service';
import { createBrowserConversationPort } from '../../ai/conversation/browser-port';
import { buildPromptProjection, estimatePromptTokens, MAX_PROMPT_ESTIMATED_TOKENS } from '../../ai/projection/prompt-projection';
import { FileCharacterWritingStore } from '../../ai/registry/file-writing-store';
import { buildSceneRegistry } from '../../ai/registry/scene-registry';
import { BROWSER_NAMED_WRITING } from '../../ai/registry/generated-browser-writing';
import {
  PRODUCTION_AMBIENT_RESIDENTS,
  PRODUCTION_CAST_COUNTS,
  PRODUCTION_FULL_AI_CAST,
} from '../../domain/state/production-cast';
import { createInitialState } from '../../domain/state/initial-state';
import { ATLAS_INDEX, CHARACTER_IDS } from '../../render/atlas';
import { buildWorldFrameState, type WorldActors } from '../../render/world-frame';
import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { findCardinalPath } from '../../world/pathfinding/astar';
import { tileKey } from '../../world/maps/schema';

type ProductionBill = Readonly<{
  schemaVersion: 1;
  fullAiCount: number;
  ambientCount: number;
  fullAiNpcIds: readonly string[];
  ambientNpcIds: readonly string[];
  visualIds: readonly string[];
  scheduleIds: readonly string[];
  businessLocationIds: readonly string[];
}>;

const bill = JSON.parse(readFileSync(resolve('content/production-bill.json'), 'utf8')) as ProductionBill;
const performanceFixture = JSON.parse(
  readFileSync(resolve('tests/fixtures/performance/phase-13.json'), 'utf8'),
) as { frameBuildIterations: number; maximumFrameBuildMilliseconds: number };

describe('Phase 13 production content bill', () => {
  test('ships the locked full-AI and deterministic ambient cast', () => {
    const state = createInitialState();
    expect(PRODUCTION_CAST_COUNTS).toEqual({ fullAi: 8, ambient: 26, totalNpcs: 34 });
    expect(Object.values(state.npcs).filter(({ tier }) => tier === 'full_ai')).toHaveLength(8);
    expect(Object.values(state.npcs).filter(({ tier }) => tier === 'ambient')).toHaveLength(26);
    expect(bill.fullAiCount).toBe(8);
    expect(bill.ambientCount).toBe(26);
    expect(new Set(bill.fullAiNpcIds)).toEqual(new Set(Object.values(state.npcs).filter(({ tier }) => tier === 'full_ai').map(({ id }) => id)));
    expect(new Set(bill.ambientNpcIds)).toEqual(new Set(Object.values(state.npcs).filter(({ tier }) => tier === 'ambient').map(({ id }) => id)));
    expect(new Set(bill.scheduleIds)).toEqual(new Set(Object.keys(state.schedules)));
    for (const character of PRODUCTION_FULL_AI_CAST) {
      expect(state.npcs[character.id]?.presence).toEqual(expect.objectContaining({
        mapId: character.position.mapId,
        locationId: character.position.locationId,
        tileX: character.position.x,
        tileY: character.position.y,
      }));
    }
    for (const relationship of Object.values(state.relationships).filter(({ npcId }) => state.npcs[npcId]?.tier === 'full_ai')) {
      expect(relationship.policy.hardBoundaries).toContainEqual(expect.objectContaining({
        id: 'no_aggressive_flirting', blockedActionIds: ['aggressive_flirt'],
      }));
    }
  });

  test('loads every named character and keeps every projected prompt isolated and below 4,096 estimated tokens', async () => {
    const state = createInitialState();
    const writingStore = new FileCharacterWritingStore(resolve('content'));
    const ids = ['linda', ...PRODUCTION_FULL_AI_CAST.map(({ id }) => id)];
    const writing = await Promise.all(ids.map((id) => writingStore.get(id)));
    expect(new Set(writing.map(({ displayName }) => displayName)).size).toBe(8);
    for (const character of writing) {
      const registry = buildSceneRegistry(state, character, {
        sceneObservationIds: [], npcReportIds: [], authoredEventIds: [],
      });
      const prompt = buildPromptProjection({
        state,
        character,
        registry,
        staged: { knowledge: [], unlockedInterestIds: [], unlockedIds: [], memories: [] },
        recentTurns: [],
        playerMessage: 'Where can I have fun on Halcyra?',
        turnId: `turn-budget-${character.npcId}`,
      });
      expect(estimatePromptTokens(prompt)).toBeLessThanOrEqual(MAX_PROMPT_ESTIMATED_TOKENS);
      for (const other of writing.filter(({ npcId }) => npcId !== character.npcId)) {
        expect(prompt).not.toContain(other.biography);
      }
    }
  });

  test('ambient conversation never reads writing, starts a model session, or records memory', async () => {
    let writingCalls = 0;
    const inference = new RecordedInferencePort([]);
    const service = new ConversationService(inference, {
      get: async () => {
        writingCalls += 1;
        throw new Error('Ambient writing must not load.');
      },
    });
    const state = createInitialState();
    const result = await service.begin({
      conversationId: 'conversation-resident-01', npcId: 'resident_01', state,
    });
    expect(result).toEqual(expect.objectContaining({
      kind: 'ambient', npcId: 'resident_01', displayName: 'Resident 01', state,
    }));
    expect(writingCalls).toBe(0);
    expect(inference.requests).toHaveLength(0);
    expect(service.activeSessionCount).toBe(0);
    expect(state.npcs.resident_01?.memories).toEqual([]);
  });

  test('the browser fallback can open every named character', async () => {
    const state = createInitialState();
    const port = createBrowserConversationPort();
    for (const npcId of bill.fullAiNpcIds) {
      const result = await port.beginConversation({
        conversationId: `conversation-browser-${npcId}`,
        npcId,
        state,
      });
      expect(result).toEqual(expect.objectContaining({ kind: 'active', npcId }));
      if (result.kind === 'active') await port.abortConversation({ conversationId: result.conversationId });
    }
  });

  test('the browser fallback embeds each authored biography, knowledge profile, and boundary policy', async () => {
    const writingStore = new FileCharacterWritingStore(resolve('content'));
    for (const character of PRODUCTION_FULL_AI_CAST) {
      const fileWriting = await writingStore.get(character.id);
      const browserWriting = BROWSER_NAMED_WRITING[character.id];
      expect(browserWriting.personality).toBe(fileWriting.personality);
      expect(browserWriting.biography).toBe(fileWriting.biography);
      expect(browserWriting.knowledge).toBe(fileWriting.knowledgeProfile.source + '\n');
      expect(browserWriting.greeting).toBe(fileWriting.authoredGreeting);
      expect(browserWriting.fallbacks).toEqual(fileWriting.authoredFallbacks);
      expect(browserWriting.rules.hardBoundaries).toContainEqual(expect.objectContaining({
        id: 'no_aggressive_flirting', blockedActionIds: ['aggressive_flirt'],
      }));
    }
  });

  test('the browser fallback does not stage Linda cat facts for any other named NPC', async () => {
    const state = createInitialState();
    const port = createBrowserConversationPort();
    for (const character of PRODUCTION_FULL_AI_CAST) {
      const conversationId = `conversation-browser-${character.id}-cat`;
      const begun = await port.beginConversation({ conversationId, npcId: character.id, state });
      expect(begun.kind).toBe('active');
      const turn = await port.sendConversationTurn({
        conversationId,
        turnId: `turn-browser-${character.id}-cat`,
        message: 'I have a cat.',
      });
      expect(turn.dialogue).not.toContain('first sensible thing');
      const ended = await port.endConversation({ conversationId });
      expect(ended.state.npcs[character.id]).toEqual(expect.objectContaining({
        knowledge: [], memories: [], unlockedInterestIds: [], unlockedIds: [],
      }));
    }
  });

  test('makes every northwest spawn, schedule tile, and portal cardinally reachable', () => {
    const state = createInitialState();
    for (const map of Object.values(WORLD_MAP_CATALOG)) {
      const start = map.source.stagingTiles[0]!;
      const targets = [
        ...Object.values(map.source.spawns),
        ...Object.values(state.schedules).flatMap(({ blocks }) => blocks
          .filter(({ mapId }) => mapId === map.source.id)
          .map(({ tileX, tileY }) => ({ x: tileX, y: tileY }))),
        ...map.source.portals.map(({ tile }) => tile),
      ];
      for (const target of targets) {
        expect(map.blockedKeys.has(tileKey(target))).toBe(false);
        expect(findCardinalPath({
          width: map.source.width,
          height: map.source.height,
          start,
          target,
          blockedKeys: map.blockedKeys,
        }).status).toBe('found');
      }
    }
    expect(PRODUCTION_AMBIENT_RESIDENTS).toHaveLength(24);
  });

  test('makes every generated cast atlas cell and portrait reachable', () => {
    expect(new Set(bill.visualIds)).toEqual(new Set(CHARACTER_IDS));
    for (const visualId of CHARACTER_IDS) {
      expect(Object.keys(ATLAS_INDEX.characters[visualId].frames)).toHaveLength(8);
      expect(ATLAS_INDEX.sprites[`portrait.${visualId}`]).toBeDefined();
    }
  });

  test('builds one thousand full-cast world frames inside the renderer budget', () => {
    const state = createInitialState();
    const actors: Record<string, WorldActors[string]> = {};
    for (const [id, npc] of Object.entries(state.npcs)) {
      if (npc.presence.kind !== 'active_local' || npc.presence.mapId !== 'northwest_residential') continue;
      const candidate = id.replaceAll('_', '-');
      const visualId = npc.tier === 'ambient' || !CHARACTER_IDS.includes(candidate as typeof CHARACTER_IDS[number])
        ? 'generic-resident'
        : candidate as typeof CHARACTER_IDS[number];
      actors[id] = { tile: { x: npc.presence.tileX, y: npc.presence.tileY }, visualId };
    }
    const start = performance.now();
    for (let index = 0; index < performanceFixture.frameBuildIterations; index += 1) {
      buildWorldFrameState(WORLD_MAP_CATALOG.northwest_residential, state, actors, 'down', index % 2 as 0 | 1);
    }
    expect(performance.now() - start).toBeLessThan(performanceFixture.maximumFrameBuildMilliseconds);
  });
});
