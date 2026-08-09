import type {
  RendererReadyReport,
  RuntimeInfo,
} from '../../electron/ipc/contracts';

export type DesktopBridge = Readonly<{
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  reportRendererReady: (
    report: RendererReadyReport,
  ) => Promise<Readonly<{ accepted: true }>>;
}>;

declare global {
  interface Window {
    siWorldDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.siWorldDesktop;
}
