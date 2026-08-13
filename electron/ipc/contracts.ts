import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

import { isTrustedAppUrl } from '../main/security';

export const IPC_CHANNELS = Object.freeze({
  getRuntimeInfo: 'si-world:get-runtime-info',
  reportRendererReady: 'si-world:report-renderer-ready',
});

export const RuntimeInfoSchema = z
  .object({
    appVersion: z.string().min(1).max(64),
    electronVersion: z.string().min(1).max(64),
    packaged: z.boolean(),
    platform: z.enum(['darwin', 'linux', 'win32']),
  })
  .strict();

export const RendererReadySchema = z
  .object({
    appUrl: z.string().max(512),
    assetsLoaded: z.literal(true),
    bridgeKeys: z.tuple([
      z.literal('abortConversation'),
      z.literal('beginConversation'),
      z.literal('completeVerbalMissionTurn'),
      z.literal('confirmVerbalMissionGoal'),
      z.literal('endConversation'),
      z.literal('getRuntimeInfo'),
      z.literal('loadPresentationPreferences'),
      z.literal('loadSave'),
      z.literal('migrateSave'),
      z.literal('readVerbalMissionTurn'),
      z.literal('reportRendererReady'),
      z.literal('requestSave'),
      z.literal('savePresentationPreferences'),
      z.literal('sendConversationTurn'),
    ]),
    canvasKitReady: z.literal(true),
    nodeAccessBlocked: z.literal(true),
  })
  .strict();

export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;
export type RendererReadyReport = z.infer<typeof RendererReadySchema>;

export class IpcRateLimiter {
  readonly #requests = new Map<number, number[]>();

  constructor(
    private readonly maximumRequests = 20,
    private readonly windowMilliseconds = 10_000,
  ) {}

  assertAllowed(senderId: number, now = Date.now()): void {
    const threshold = now - this.windowMilliseconds;
    const recent = (this.#requests.get(senderId) ?? []).filter((timestamp) => timestamp > threshold);
    if (recent.length >= this.maximumRequests) {
      throw new Error('IPC request rate exceeded.');
    }
    recent.push(now);
    this.#requests.set(senderId, recent);
  }
}

export function assertTrustedEvent(event: IpcMainInvokeEvent, limiter: IpcRateLimiter): void {
  const senderUrl = event.senderFrame?.url;
  if (!senderUrl || !isTrustedAppUrl(senderUrl) || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('IPC sender is not the trusted main frame.');
  }
  limiter.assertAllowed(event.sender.id);
}

export function registerRuntimeIpc(
  ipcMain: IpcMain,
  runtimeInfo: RuntimeInfo,
  onRendererReady: (report: RendererReadyReport) => void,
): void {
  const safeRuntimeInfo = RuntimeInfoSchema.parse(runtimeInfo);
  const limiter = new IpcRateLimiter();

  ipcMain.handle(IPC_CHANNELS.getRuntimeInfo, (event, ...args: unknown[]) => {
    assertTrustedEvent(event, limiter);
    if (args.length !== 0) {
      throw new Error('Unexpected IPC payload.');
    }
    return safeRuntimeInfo;
  });

  ipcMain.handle(IPC_CHANNELS.reportRendererReady, (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    if (extra.length !== 0) {
      throw new Error('Unexpected IPC payload.');
    }
    const report = RendererReadySchema.parse(payload);
    if (!isTrustedAppUrl(report.appUrl)) {
      throw new Error('Renderer report URL is not trusted.');
    }
    onRendererReady(report);
    return { accepted: true as const };
  });
}
