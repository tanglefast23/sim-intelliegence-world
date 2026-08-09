export type ResourceState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; assetsLoaded: true }>
  | Readonly<{ status: 'failed'; detail: string }>;

export async function settleResourceGate(load: () => Promise<void>): Promise<ResourceState> {
  try {
    await load();
    return { status: 'ready', assetsLoaded: true };
  } catch (error: unknown) {
    return { status: 'failed', detail: String(error) };
  }
}
