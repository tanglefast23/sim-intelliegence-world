import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { resolve } from 'node:path';

import { ConversationService } from '../../src/ai/conversation/service';
import { FileCharacterWritingStore } from '../../src/ai/registry/file-writing-store';
import { RecordedInferencePort } from '../../src/application/effects/InferencePort';
import { createInitialState } from '../../src/domain/state/initial-state';
import { parseWorldState } from '../../src/domain/state/schema';
import { createOpeningMission } from '../../src/domain/verbal-missions/outcome-engine';
import type { VerbalMissionContentStore } from '../../src/ai/conversation/verbal-mission-session';
import {
  TEST_DEAL_DEFINITION,
  TEST_DEAL_DISPOSITION,
} from '../fixtures/verbal-missions/test-deal';
import { CONVERSATION_IPC_CHANNELS, registerConversationIpc } from '../../electron/conversation/ipc';

const policyAllow = JSON.stringify({ decision: 'allow', category: 'allowed_fictional_adult' });
const response = JSON.stringify({
  dialogue: 'That is worth remembering.', emotion: 'warm', intent: 'continue_conversation', actionId: 'ask_follow_up',
  knowledgeCandidates: [], interestCandidateIds: [], memoryCandidates: [], unlockCandidateIds: [], highImpactCandidates: [],
});

describe('conversation IPC boundary', () => {
  test('main-frame-only handlers validate payloads and return only approved results', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = { handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler)) } as unknown as IpcMain;
    const inference = new RecordedInferencePort([response, policyAllow]);
    const service = new ConversationService(inference, new FileCharacterWritingStore(resolve('content')));
    registerConversationIpc(ipcMain, service);
    expect([...handlers.keys()].sort()).toEqual(Object.values(CONVERSATION_IPC_CHANNELS).sort());

    const mainFrame = { url: 'app://game/' };
    const trusted = { sender: { id: 90, mainFrame }, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent;
    const begun = await handlers.get(CONVERSATION_IPC_CHANNELS.beginConversation)?.(trusted, {
      conversationId: 'conversation-ipc-1', npcId: 'linda', state: createInitialState(),
    }) as { pausedState: ReturnType<typeof createInitialState> };
    expect(begun.pausedState.clock.pauseTokens).toEqual([expect.stringMatching(/^pause:conversation:[a-f0-9]+$/u)]);

    const turn = await handlers.get(CONVERSATION_IPC_CHANNELS.sendConversationTurn)?.(trusted, {
      conversationId: 'conversation-ipc-1', turnId: 'turn-ipc-1', message: 'Hello Linda',
    });
    expect(turn).toEqual(expect.objectContaining({ dialogue: 'That is worth remembering.', source: 'model' }));
    expect(JSON.stringify(turn)).not.toContain('jsonSchema');

    const closed = await handlers.get(CONVERSATION_IPC_CHANNELS.endConversation)?.(trusted, {
      conversationId: 'conversation-ipc-1',
    }) as { state: ReturnType<typeof createInitialState> };
    expect(closed.state.clock.pauseTokens).toEqual([]);

    await expect(handlers.get(CONVERSATION_IPC_CHANNELS.beginConversation)?.(trusted, {
      conversationId: '../escape', npcId: 'linda', state: createInitialState(),
    })).rejects.toThrow();
    await expect(handlers.get(CONVERSATION_IPC_CHANNELS.sendConversationTurn)?.(trusted, {
      conversationId: 'conversation-ipc-1', turnId: 'turn-ipc-2', message: 'x'.repeat(501),
    })).rejects.toThrow();

    const childFrame = { url: 'app://game/' };
    const child = { sender: { id: 91, mainFrame }, senderFrame: childFrame } as unknown as IpcMainInvokeEvent;
    await expect(handlers.get(CONVERSATION_IPC_CHANNELS.beginConversation)?.(child, {
      conversationId: 'conversation-ipc-2', npcId: 'linda', state: createInitialState(),
    })).rejects.toThrow('trusted main frame');
  });

  test('split Verbal Mission handlers return only typed reactions, dialogue, receipts, and state', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = { handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler)) } as unknown as IpcMain;
    const move = JSON.stringify({
      acts: [{ act: 'assert', referentId: 'test_purse', evidenceText: 'quote' }],
      register: 'plain',
      claims: [{ factId: 'fact_appraisal', polarity: 'assert', evidenceText: 'quote' }],
      referenceConfidence: 'clear',
    });
    const actor = JSON.stringify({
      dialogue: 'That quote gives me something concrete to consider.',
      emotion: 'neutral', reactionId: 'reaction_progress',
    });
    const inference = new RecordedInferencePort([move, actor, policyAllow]);
    const content: VerbalMissionContentStore = { get: async () => ({
      definition: TEST_DEAL_DEFINITION,
      disposition: TEST_DEAL_DISPOSITION,
      referents: [{ id: 'test_purse', label: 'test purse', aliases: ['purse'] }],
      facts: [{ id: 'fact_appraisal', description: 'written quote', aliases: ['quote'] }],
      readTheRoomLines: Object.fromEntries(TEST_DEAL_DEFINITION.reactions.map(({ readTheRoomId }) => [
        readTheRoomId, 'Linda is considering the point.',
      ])),
      speakableFactTexts: {},
    }) };
    const service = new ConversationService(
      inference,
      new FileCharacterWritingStore(resolve('content')),
      undefined,
      content,
    );
    registerConversationIpc(ipcMain, service);
    const initial = createInitialState();
    const mission = createOpeningMission(TEST_DEAL_DEFINITION, TEST_DEAL_DISPOSITION);
    const state = parseWorldState({
      ...initial,
      playerKnowledge: {
        fact_appraisal: {
          factId: 'fact_appraisal', assertedValue: true, epistemicState: 'observed_fact',
          truthStatus: 'verified', source: { type: 'scene_observation', sourceId: 'test_appraisal' },
        },
      },
      worldObjects: { ...initial.worldObjects, test_purse: { objectId: 'test_purse', ownerId: 'linda' } },
      verbalMissions: { test_purse_deal: mission },
      journal: {
        journal_test_purse_deal: {
          id: 'journal_test_purse_deal', subject: { kind: 'verbal_mission', missionId: 'test_purse_deal' },
          summary: 'Test the purse deal.', locationPrecision: 'none', markerVisible: false,
          source: { type: 'authored_event', sourceId: 'test_offer' },
          resolutionState: 'open', outcomeReceipts: [],
        },
      },
    });
    const mainFrame = { url: 'app://game/' };
    const trusted = { sender: { id: 92, mainFrame }, senderFrame: mainFrame } as unknown as IpcMainInvokeEvent;
    const begun = await handlers.get(CONVERSATION_IPC_CHANNELS.beginConversation)?.(trusted, {
      conversationId: 'conversation-ipc-mission', npcId: 'linda', state,
    });
    expect(begun).toEqual(expect.objectContaining({
      verbalMission: expect.objectContaining({ missionId: 'test_purse_deal', status: 'available' }),
    }));
    const read = await handlers.get(CONVERSATION_IPC_CHANNELS.readVerbalMissionTurn)?.(trusted, {
      conversationId: 'conversation-ipc-mission', turnId: 'mission-turn',
      message: 'The written quote values the purse fairly.',
    });
    expect(read).toEqual(expect.objectContaining({
      kind: 'decided', outcome: 'progress', reactionId: 'reaction_progress',
    }));
    expect(JSON.stringify(read)).not.toContain('hardMinimumPrice');
    const complete = await handlers.get(CONVERSATION_IPC_CHANNELS.completeVerbalMissionTurn)?.(trusted, {
      conversationId: 'conversation-ipc-mission', turnId: 'mission-turn',
    });
    expect(complete).toEqual(expect.objectContaining({ dialogue: expect.stringContaining('quote'), source: 'model' }));
    const rejected = await handlers.get(CONVERSATION_IPC_CHANNELS.confirmVerbalMissionGoal)?.(trusted, {
      conversationId: 'conversation-ipc-mission', goalKind: 'buy_object', confirmedAmount: 95,
    });
    expect(rejected).toEqual(expect.objectContaining({
      kind: 'rejected', reasonId: 'goal_confirmation_invalid',
    }));
    const closed = await handlers.get(CONVERSATION_IPC_CHANNELS.abortConversation)?.(trusted, {
      conversationId: 'conversation-ipc-mission',
    }) as { state: ReturnType<typeof createInitialState> };
    expect(closed.state.verbalMissions.test_purse_deal?.status).toBe('active');
  });
});
