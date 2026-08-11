import { getLoadingShellCopy } from '../LoadingShell';
import { settleResourceGate } from '../ResourceGate';

describe('desktop shell states', () => {
  test('resource success produces measured ready state', async () => {
    await expect(settleResourceGate(async () => undefined)).resolves.toEqual({
      status: 'ready',
      assetsLoaded: true,
    });
  });

  test('resource failure produces the authored safe-failure state', async () => {
    const state = await settleResourceGate(async () => {
      throw new Error('audio missing');
    });

    expect(state).toEqual({ status: 'failed', detail: 'Error: audio missing' });
    expect(getLoadingShellCopy(true, state.status === 'failed' ? state.detail : '')).toEqual({
      detail: 'Error: audio missing',
      headline: 'Unable to start safely.',
    });
  });

  test('fails closed when atlas bytes do not match the revisioned index', async () => {
    const source = new TextEncoder().encode('current atlas').buffer;
    const expected = createHash('sha256').update(new Uint8Array(source)).digest('hex');
    await expect(verifyAtlasDigest(source, expected)).resolves.toBeUndefined();
    await expect(verifyAtlasDigest(source, '0'.repeat(64))).rejects.toThrow(
      'does not match its revisioned index',
    );
  });
});
import { createHash } from 'node:crypto';

import { verifyAtlasDigest } from '../atlas-integrity';
