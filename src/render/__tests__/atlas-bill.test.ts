import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  ATLAS_INDEX,
  ATLAS_PROOF_BILL,
  CHARACTER_IDS,
  WALK_FRAME_MILLISECONDS,
  assertZoomLevel,
  buildAtlasProofScene,
  movementPresentation,
} from '../atlas';

describe('runtime atlas bill and movement contract', () => {
  test('makes every generated atlas cell reachable', () => {
    expect(new Set(ATLAS_PROOF_BILL)).toEqual(new Set(Object.keys(ATLAS_INDEX.sprites)));
    const renderedNames = buildAtlasProofScene(0).sprites.map(({ sprite }) => sprite);
    expect(new Set(renderedNames)).toEqual(new Set(Object.keys(ATLAS_INDEX.sprites)));
    expect(ATLAS_INDEX.tiles).toHaveLength(10);
    for (const characterId of CHARACTER_IDS) {
      expect(Object.keys(ATLAS_INDEX.characters[characterId].frames)).toHaveLength(8);
      expect(ATLAS_INDEX.characters[characterId].portrait).toBe(`portrait.${characterId}`);
    }
  });

  test('selects rear, front, left, and right pairs with no side-profile body', () => {
    expect(movementPresentation('protagonist', 'up', 0).sprite).toContain('.rear-1');
    expect(movementPresentation('protagonist', 'down', 1).sprite).toContain('.front-2');
    expect(movementPresentation('protagonist', 'left', 0)).toMatchObject({
      sprite: 'character.protagonist.left-1', leanX: -1,
    });
    expect(movementPresentation('protagonist', 'right', 1)).toMatchObject({
      sprite: 'character.protagonist.right-2', leanX: 1, bounceY: -1, shadowX: 1,
    });
    expect(WALK_FRAME_MILLISECONDS).toBeGreaterThanOrEqual(130);
    expect(WALK_FRAME_MILLISECONDS).toBeLessThanOrEqual(160);
  });

  test('accepts only the three integer prototype zoom levels', () => {
    expect([1, 2, 3].map(assertZoomLevel)).toEqual([1, 2, 3]);
    expect(() => assertZoomLevel(0.5)).toThrow('exactly');
    expect(() => assertZoomLevel(4)).toThrow('exactly');
  });

  test('uses one nearest-neighbor Skia Atlas and no runtime layer composition', () => {
    const proof = readFileSync(resolve(process.cwd(), 'src/render/AtlasProof.tsx'), 'utf8');
    const runtime = readFileSync(resolve(process.cwd(), 'src/render/atlas.ts'), 'utf8');
    expect(proof.match(/<Atlas\b/gu)).toHaveLength(1);
    expect(proof).toContain('FilterMode.Nearest');
    expect(proof).toContain('MipmapMode.None');
    expect(`${proof}\n${runtime}`).not.toMatch(/assets\/source|scripts\/art|composeFrontFrame|drawTokenCommands/u);
  });
});
