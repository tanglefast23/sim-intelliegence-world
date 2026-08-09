import { contextBridge, ipcRenderer } from 'electron';

import type { RendererReadyReport, RuntimeInfo } from '../ipc/contracts';

// A sandboxed preload is bundled by Electron's restricted loader. Keep its runtime
// surface self-contained; the security tests lock these values to the main contract.
const IPC_CHANNELS = Object.freeze({
  getRuntimeInfo: 'si-world:get-runtime-info',
  reportRendererReady: 'si-world:report-renderer-ready',
});

const desktopBridge = Object.freeze({
  getRuntimeInfo: (): Promise<RuntimeInfo> => ipcRenderer.invoke(IPC_CHANNELS.getRuntimeInfo),
  reportRendererReady: (
    report: RendererReadyReport,
  ): Promise<Readonly<{ accepted: true }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.reportRendererReady, report),
});

contextBridge.exposeInMainWorld('siWorldDesktop', desktopBridge);
