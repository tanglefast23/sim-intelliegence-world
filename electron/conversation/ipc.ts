import type { IpcMain } from 'electron';

import type { ConversationService } from '../../src/ai/conversation/service';
import {
  BeginConversationRequestSchema,
  BeginConversationResultSchema,
  CloseConversationRequestSchema,
  CloseConversationResultSchema,
  CompleteVerbalMissionTurnRequestSchema,
  CompleteVerbalMissionTurnResultSchema,
  ConfirmVerbalMissionGoalRequestSchema,
  ConfirmVerbalMissionGoalResultSchema,
  ConversationTurnRequestSchema,
  ConversationTurnResultSchema,
  ReadVerbalMissionTurnRequestSchema,
  ReadVerbalMissionTurnResultSchema,
} from '../../src/application/effects/ConversationPort';
import { assertTrustedEvent, IpcRateLimiter } from '../ipc/contracts';

export const CONVERSATION_IPC_CHANNELS = Object.freeze({
  beginConversation: 'si-world:begin-conversation',
  sendConversationTurn: 'si-world:send-conversation-turn',
  endConversation: 'si-world:end-conversation',
  abortConversation: 'si-world:abort-conversation',
  completeVerbalMissionTurn: 'si-world:complete-verbal-mission-turn',
  confirmVerbalMissionGoal: 'si-world:confirm-verbal-mission-goal',
  readVerbalMissionTurn: 'si-world:read-verbal-mission-turn',
});

const MAX_PAYLOAD_BYTES = 2 * 1_024 * 1_024;

function assertBoundedPayload(payload: unknown, extra: readonly unknown[]): void {
  if (extra.length !== 0) throw new Error('Unexpected IPC payload.');
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (bytes > MAX_PAYLOAD_BYTES) throw new Error('Conversation IPC payload exceeds the size limit.');
}

export function registerConversationIpc(ipcMain: IpcMain, service: ConversationService): void {
  const limiter = new IpcRateLimiter(40, 10_000);
  ipcMain.handle(CONVERSATION_IPC_CHANNELS.beginConversation, async (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    assertBoundedPayload(payload, extra);
    return BeginConversationResultSchema.parse(await service.begin(BeginConversationRequestSchema.parse(payload)));
  });
  ipcMain.handle(CONVERSATION_IPC_CHANNELS.sendConversationTurn, async (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    assertBoundedPayload(payload, extra);
    return ConversationTurnResultSchema.parse(await service.turn(ConversationTurnRequestSchema.parse(payload)));
  });
  ipcMain.handle(CONVERSATION_IPC_CHANNELS.readVerbalMissionTurn, async (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    assertBoundedPayload(payload, extra);
    return ReadVerbalMissionTurnResultSchema.parse(
      await service.readVerbalMissionTurn(ReadVerbalMissionTurnRequestSchema.parse(payload)),
    );
  });
  ipcMain.handle(CONVERSATION_IPC_CHANNELS.completeVerbalMissionTurn, async (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    assertBoundedPayload(payload, extra);
    return CompleteVerbalMissionTurnResultSchema.parse(
      await service.completeVerbalMissionTurn(CompleteVerbalMissionTurnRequestSchema.parse(payload)),
    );
  });
  ipcMain.handle(CONVERSATION_IPC_CHANNELS.confirmVerbalMissionGoal, (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    assertBoundedPayload(payload, extra);
    return ConfirmVerbalMissionGoalResultSchema.parse(
      service.confirmVerbalMissionGoal(ConfirmVerbalMissionGoalRequestSchema.parse(payload)),
    );
  });
  ipcMain.handle(CONVERSATION_IPC_CHANNELS.endConversation, (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    assertBoundedPayload(payload, extra);
    const request = CloseConversationRequestSchema.parse(payload);
    return CloseConversationResultSchema.parse({ state: service.end(request.conversationId) });
  });
  ipcMain.handle(CONVERSATION_IPC_CHANNELS.abortConversation, (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    assertBoundedPayload(payload, extra);
    const request = CloseConversationRequestSchema.parse(payload);
    return CloseConversationResultSchema.parse({ state: service.abort(request.conversationId) });
  });
}
