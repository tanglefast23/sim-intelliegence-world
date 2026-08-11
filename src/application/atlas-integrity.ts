function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyAtlasDigest(source: ArrayBuffer, expectedSha256: string): Promise<void> {
  if (!/^[0-9a-f]{64}$/u.test(expectedSha256)) {
    throw new Error('Generated world atlas index has an invalid SHA-256 digest.');
  }
  if (source.byteLength === 0) {
    throw new Error('Generated world atlas was empty.');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('This runtime cannot verify the generated world atlas.');
  }
  const digest = bytesToHex(await globalThis.crypto.subtle.digest('SHA-256', source));
  if (digest !== expectedSha256) {
    throw new Error('Generated world atlas does not match its revisioned index.');
  }
}
