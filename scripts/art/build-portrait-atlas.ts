import {
  addOutwardContour,
  composePortrait,
  tokenFrameToBitmap,
  type CharacterSource,
} from './character-source';
import type { PortraitExpression } from './character-look-roster';
import { parseHexColor, type Bitmap } from './png';

export type PortraitEntry = Readonly<{
  name: string;
  sourceId: string;
  expression: PortraitExpression;
  kind: 'portrait';
  bitmap: Bitmap;
}>;

export function buildPortraitEntries(sources: readonly CharacterSource[]): PortraitEntry[] {
  return sources.flatMap((source) => (
    (Object.keys(source.portraitExpressions) as PortraitExpression[]).map((expression) => ({
      name: expression === 'rest' ? `portrait.${source.id}` : `portrait.${source.id}.${expression}`,
      sourceId: source.id,
      expression,
      kind: 'portrait' as const,
      bitmap: addOutwardContour(
        tokenFrameToBitmap(composePortrait(source, expression), source.palette),
        parseHexColor(source.palette.K as string),
      ),
    }))
  ));
}
