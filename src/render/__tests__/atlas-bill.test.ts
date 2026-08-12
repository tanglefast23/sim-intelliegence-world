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
import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';

describe('runtime atlas bill and movement contract', () => {
  test('makes every generated atlas cell reachable', () => {
    expect(new Set(ATLAS_PROOF_BILL)).toEqual(new Set(Object.keys(ATLAS_INDEX.sprites)));
    const renderedNames = buildAtlasProofScene(0).sprites.map(({ sprite }) => sprite);
    expect(new Set(renderedNames)).toEqual(new Set(Object.keys(ATLAS_INDEX.sprites)));
    expect(ATLAS_INDEX.version).toBe(3);
    expect(ATLAS_INDEX.artRevision).toBe(13);
    expect(ATLAS_INDEX.publicSpriteIds).toEqual(Object.keys(ATLAS_INDEX.sprites));
    expect(ATLAS_INDEX.internalReviewSpriteIds).toEqual([]);
    expect(ATLAS_INDEX.tiles).toHaveLength(276);
    expect(ATLAS_INDEX.groundCells).toHaveLength(81);
    expect(ATLAS_INDEX.transparentPartCells).toHaveLength(135);
    expect(ATLAS_INDEX.presentationCells).toHaveLength(60);
    expect(new Set([
      ...ATLAS_INDEX.groundCells,
      ...ATLAS_INDEX.transparentPartCells,
      ...ATLAS_INDEX.presentationCells,
    ]))
      .toEqual(new Set(ATLAS_INDEX.tiles));
    for (const name of ATLAS_INDEX.groundCells) {
      expect(ATLAS_INDEX.sprites[name]).toMatchObject({ cellClass: 'ground', wallAdjacencyMask: null });
    }
    for (const names of Object.values(ATLAS_INDEX.walls)) {
      expect(names).toHaveLength(16);
      names.forEach((name, wallAdjacencyMask) => {
        expect(ATLAS_INDEX.sprites[name]).toMatchObject({ cellClass: 'transparent-part', wallAdjacencyMask });
      });
    }
    for (const characterId of CHARACTER_IDS) {
      expect(Object.keys(ATLAS_INDEX.characters[characterId].frames)).toHaveLength(8);
      expect(ATLAS_INDEX.characters[characterId].portrait).toBe(`portrait.${characterId}`);
      expect(ATLAS_INDEX.characters[characterId].portraits.rest).toBe(`portrait.${characterId}`);
    }
    expect(ATLAS_INDEX.characters.protagonist.portraits).toEqual({
      rest: 'portrait.protagonist',
      joy: 'portrait.protagonist.joy',
      upset: 'portrait.protagonist.upset',
    });
    expect(ATLAS_INDEX.characters['generic-resident'].portraits).toEqual({ rest: 'portrait.generic-resident' });
  });

  test('selects rear, front, left, and right pairs with authored profile bodies', () => {
    expect(movementPresentation('protagonist', 'up', 0).sprite).toContain('.rear-1');
    expect(movementPresentation('protagonist', 'down', 1).sprite).toContain('.front-2');
    expect(movementPresentation('protagonist', 'left', 0)).toMatchObject({
      sprite: 'character.protagonist.left-1', leanX: 0, bounceY: 0, shadowX: 0,
    });
    expect(movementPresentation('protagonist', 'right', 1)).toMatchObject({
      sprite: 'character.protagonist.right-2', leanX: 0, bounceY: 0, shadowX: 0,
    });
    expect(movementPresentation('linda', 'right', 1)).toMatchObject({
      sprite: 'character.linda.right-2', leanX: 0, bounceY: 0, shadowX: 0,
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
    const portrait = readFileSync(resolve(process.cwd(), 'src/ui/CharacterPortrait.tsx'), 'utf8');
    const runtime = readFileSync(resolve(process.cwd(), 'src/render/atlas.ts'), 'utf8');
    expect(proof.match(/<Atlas\b/gu)).toHaveLength(1);
    expect(portrait.match(/<Atlas\b/gu)).toHaveLength(1);
    expect(proof).toContain('FilterMode.Nearest');
    expect(proof).toContain('MipmapMode.None');
    expect(portrait).toContain('FilterMode.Nearest');
    expect(portrait).toContain('MipmapMode.None');
    expect(`${proof}\n${portrait}\n${runtime}`).not.toMatch(/assets\/source|scripts\/art|composeFrontFrame|drawTokenCommands/u);
  });

  test('uses one immutable presentation index and a bounded static ground-detail batch', () => {
    const scene = readFileSync(resolve(process.cwd(), 'src/render/WorldScene.tsx'), 'utf8');
    const map = WORLD_MAP_CATALOG.northwest_residential;
    expect(Object.isFrozen(map.presentation)).toBe(true);
    expect(Object.isFrozen(map.presentation.ground)).toBe(true);
    expect(map.presentation.ground).toBe(WORLD_MAP_CATALOG.northwest_residential.presentation.ground);
    expect(scene.match(/<Atlas\b/gu)?.length).toBeLessThanOrEqual(7);
    expect(scene).toContain('map.presentation.transitions');
    expect(scene).toContain('map.presentation.decals');
    expect(scene).toContain('map.presentation.roofs');
    expect(scene).not.toContain("sprite: 'tile.boardwalk'");
    expect(scene).not.toContain('color="#4b211f55"');
    const publicIds = new Set(ATLAS_INDEX.publicSpriteIds);
    expect(map.presentation.ground.every(({ sprite }) => publicIds.has(sprite))).toBe(true);
    expect(map.presentation.roofs.every(({ sprite }) => publicIds.has(sprite))).toBe(true);
  });
});
