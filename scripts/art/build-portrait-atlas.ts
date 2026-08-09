import {
  composePortrait,
  tokenFrameToBitmap,
  type CharacterSource,
} from './character-source';
import type { Bitmap } from './png';

export type PortraitEntry = Readonly<{
  name: string;
  sourceId: string;
  kind: 'portrait';
  bitmap: Bitmap;
}>;

export function buildPortraitEntries(sources: readonly CharacterSource[]): PortraitEntry[] {
  return sources.map((source) => ({
    name: `portrait.${source.id}`,
    sourceId: source.id,
    kind: 'portrait' as const,
    bitmap: tokenFrameToBitmap(composePortrait(source), source.palette),
  }));
}
