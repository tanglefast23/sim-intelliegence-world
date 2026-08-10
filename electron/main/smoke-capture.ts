export const SMOKE_CAPTURE_ATTEMPTS = 5;
export const SMOKE_CAPTURE_RETRY_MILLISECONDS = 80;

export type SmokeCaptureRetryPolicy = Readonly<{
  deadlineMilliseconds?: number;
  maximumAttempts?: number;
  now?: () => number;
}>;

export async function retrySmokeCapture<T>(
  capture: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void>,
  policy: SmokeCaptureRetryPolicy = {},
): Promise<T> {
  const maximumAttempts = policy.maximumAttempts ?? SMOKE_CAPTURE_ATTEMPTS;
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new Error('Smoke capture attempts must be a positive integer.');
  }
  const now = policy.now ?? Date.now;
  const deadline = policy.deadlineMilliseconds;
  if (deadline !== undefined && (!Number.isFinite(deadline) || deadline < 0)) {
    throw new Error('Smoke capture deadline must be a non-negative finite timestamp.');
  }
  let lastError: unknown;
  let attempts = 0;
  while (attempts < maximumAttempts) {
    if (deadline !== undefined && now() >= deadline) break;
    attempts += 1;
    try {
      return await capture();
    } catch (error: unknown) {
      lastError = error;
      if (attempts >= maximumAttempts) break;
      const remaining = deadline === undefined ? SMOKE_CAPTURE_RETRY_MILLISECONDS : deadline - now();
      if (remaining <= 0) break;
      await wait(Math.min(SMOKE_CAPTURE_RETRY_MILLISECONDS, remaining));
    }
  }
  const attemptLabel = attempts === 1 ? 'attempt' : 'attempts';
  throw new Error(
    `Smoke screenshot capture failed after ${attempts} ${attemptLabel}: ${String(lastError)}`,
  );
}

type EmptyCheckableFrame = Readonly<{ isEmpty: () => boolean }>;

function assertNonEmpty<T extends EmptyCheckableFrame>(captured: T): T {
  if (captured.isEmpty()) throw new Error('Electron returned an empty screenshot.');
  return captured;
}

export async function captureNonEmptySmokeFrame<T extends EmptyCheckableFrame>(
  capture: () => Promise<T>,
  wait: (milliseconds: number) => Promise<void>,
  policy: SmokeCaptureRetryPolicy = {},
): Promise<T> {
  return retrySmokeCapture(async () => assertNonEmpty(await capture()), wait, policy);
}

export async function captureLoadingSmokeFrame<T extends EmptyCheckableFrame>(
  capture: () => Promise<T>,
  loadingVisible: () => Promise<boolean>,
  wait: (milliseconds: number) => Promise<void>,
  policy: SmokeCaptureRetryPolicy = {},
): Promise<T> {
  return retrySmokeCapture(async () => {
    if (!await loadingVisible()) throw new Error('Loading shell is no longer visible.');
    const captured = assertNonEmpty(await capture());
    if (!await loadingVisible()) throw new Error('Loading shell changed during screenshot capture.');
    return captured;
  }, wait, policy);
}
