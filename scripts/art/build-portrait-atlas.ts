import {
  addOutwardContour,
  composePortrait,
  tokenFrameToBitmap,
  type CharacterSource,
} from './character-source';
import { parseHexColor, type Bitmap } from './png';

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
    bitmap: addOutwardContour(
      tokenFrameToBitmap(composePortrait(source), source.palette),
      parseHexColor(source.palette.K as string),
    ),
  }));
}
