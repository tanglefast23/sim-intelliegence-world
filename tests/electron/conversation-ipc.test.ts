import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { resolve } from 'node:path';

import { ConversationService } from '../../src/ai/conversation/service';
import { FileCharacterWritingStore } from '../../src/ai/registry/file-writing-store';
import { RecordedInferencePort } from '../../src/application/effects/InferencePort';
import { createInitialState } from '../../src/domain/state/initial-state';
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
});
