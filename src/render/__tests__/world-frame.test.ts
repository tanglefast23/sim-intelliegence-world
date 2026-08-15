import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { createInitialState } from '../../domain/state/initial-state';
import { WorldStateSchema } from '../../domain/state/schema';
import frameCases from '../../../tests/fixtures/rendering/world-frame-v1.json';
import { tileKey } from '../../world/maps/schema';
import { stableTupleHash } from '../../world/presentation/material-selection';
import {
  advanceMovement,
  createMovementState,
  DOOR_CLOSE_DELAY_MS,
  DOOR_CLOSING_MS,
  DOOR_OPENING_MS,
  doorMotionPhase,
  requestMovement,
  type MovementDirection,
} from '../../world/pathfinding/movement';
import { advanceWorldMovement } from '../../application/runtime/world-runtime';
import { compareGroundedDepth, WORLD_DEPTH } from '../depth';
import { atlasRectangle } from '../atlas';
import {
  buildWorldFrameState,
  DESTINATION_PULSE_MS,
  destinationPulseFrame,
  doorSpriteForFrame,
  WORLD_LAYER_ORDER,
  WORLD_COMPOSITE_ORDER,
  type WorldActors,
  type WorldFrameState,
  type WorldFrameView,
} from '../world-frame';

const MAP = WORLD_MAP_CATALOG.northwest_residential;
const ACTORS = {
  linda: { tile: MAP.source.spawns.linda!, visualId: 'linda' },
  generic_resident: { tile: MAP.source.spawns.generic_resident!, visualId: 'generic-resident' },
} as const;

function stateVariant(variant: string) {
  const initial = createInitialState();
  if (variant === 'outside') {
    return WorldStateSchema.parse({
      ...initial,
      protagonist: {
        ...initial.protagonist,
        worldPosition: { mapId: 'northwest_residential', tileX: 17, tileY: 25 },
      },
    });
  }
  if (variant === 'exact-journal') {
    return WorldStateSchema.parse({
      ...initial,
      clock: { ...initial.clock, absoluteMinute: 1_260 },
      journal: {
        journal_linda_boyfriend: {
          id: 'journal_linda_boyfriend',
          subject: { kind: 'quest', questId: 'linda_boyfriend_check' },
          summary: 'Exact villa location confirmed.',
          locationPrecision: 'exact',
          locationId: 'linda_villa',
          markerVisible: true,
          source: { type: 'scene_observation', sourceId: 'linda_villa_arrival' },
          resolutionState: 'open',
          outcomeReceipts: [],
        },
      },
    });
  }
  throw new Error(`Unknown frame state variant ${variant}.`);
}

function frameSummary(frame: WorldFrameState) {
  return {
    frameHash: stableTupleHash([JSON.stringify(frame)]).toString(16).padStart(8, '0'),
    mapHash: frame.mapHash,
    presentationHash: frame.presentationHash,
    atlasHash: frame.atlasHash,
    drawCounts: frame.drawCounts,
    counts: {
      floors: frame.floors.length,
      groundDetails: frame.groundDetails.length,
      props: frame.props.length,
      doors: frame.doors.length,
      characters: frame.characters.length,
      effects: frame.effects.length,
      fallbackEffects: frame.fallbackEffects.length,
      walls: frame.walls.length,
      roofs: frame.roofs.length,
      propShadows: frame.propShadows.length,
      characterShadows: frame.characterShadows.length,
      thresholds: frame.thresholds.length,
      journalMarkers: frame.journalMarkers.length,
      shelterCells: frame.shelterCells.length,
    },
    firstIds: {
      floor: frame.floors[0]?.id,
      detail: frame.groundDetails[0]?.id,
      prop: frame.props[0]?.id,
      door: frame.doors[0]?.id,
      character: frame.characters[0]?.id,
      effect: frame.effects[0]?.emitterId,
      fallbackEffect: frame.fallbackEffects[0]?.id,
      wall: frame.walls[0]?.id,
      roof: frame.roofs[0]?.id,
      journal: frame.journalMarkers[0]?.journalEntryId,
    },
    hiddenRoofGroupId: frame.hiddenRoofGroupId,
    visibleRoofGroupIds: frame.visibleRoofGroupIds.length > 0 ? frame.visibleRoofGroupIds : undefined,
    fallbackEmitterIds: frame.fallbackEmitterIds,
  };
}

function walkTo(target: { x: number; y: number }, initialState = createInitialState()) {
  let worldState = initialState;
  let movement = requestMovement(
    MAP,
    createMovementState({
      x: worldState.protagonist.worldPosition.tileX,
      y: worldState.protagonist.worldPosition.tileY,
    }),
    target,
  );
  while (movement.status === 'moving') {
    ({ movement, worldState } = advanceWorldMovement(MAP, movement, worldState));
  }
  return { movement, worldState };
}

describe('authoritative world frame', () => {
  test('runs exactly two destination pulses and then disappears', () => {
    expect(destinationPulseFrame(0)).toMatchObject({ complete: false, opacity: 0.72, radius: 3 });
    expect(destinationPulseFrame(DESTINATION_PULSE_MS / 2)).toMatchObject({ complete: false, opacity: 0.72, radius: 3 });
    expect(destinationPulseFrame(DESTINATION_PULSE_MS)).toMatchObject({ complete: true, opacity: 0, radius: 16 });
  });

  test('opens one tile ahead, holds after crossing, then closes', () => {
    const door = MAP.doorById.get('bedroom-door')!;
    let movement = requestMovement(MAP, createMovementState({ x: 16, y: 12 }), { x: 16, y: 15 });
    expect(MAP.blockedKeys.has(tileKey(door.tile))).toBe(false);
    expect(doorSpriteForFrame(door, [movement])).toBe(door.sprite);

    movement = advanceMovement(MAP, movement, 50).movement;
    expect(movement.player).toEqual({ x: 16, y: 12 });
    expect(movement.segment?.to).toEqual({ x: 16, y: 13 });
    expect(doorSpriteForFrame(door, [movement])).toBe(door.sprite.replace('closed-door', 'opening-door'));
    let remainingOpeningMs = DOOR_OPENING_MS;
    remainingOpeningMs -= 50;
    while (remainingOpeningMs > 0) {
      const elapsedMs = Math.min(50, remainingOpeningMs);
      movement = advanceMovement(MAP, movement, elapsedMs).movement;
      remainingOpeningMs -= elapsedMs;
    }
    expect(movement.player).toEqual({ x: 16, y: 12 });
    expect(movement.segment).toBeDefined();
    expect(doorSpriteForFrame(door, [movement])).toBe(door.sprite.replace('closed-door', 'open-door'));

    for (let frame = 0; frame < 20 && movement.status === 'moving'; frame += 1) {
      movement = advanceMovement(MAP, movement, 50).movement;
    }
    expect(movement.player).toEqual({ x: 16, y: 15 });
    expect(movement.status).toBe('idle');
    expect(doorMotionPhase(movement, door.id)).toBe('open');

    for (let elapsed = 0; elapsed < DOOR_CLOSE_DELAY_MS; elapsed += 50) {
      movement = advanceMovement(MAP, movement, Math.min(50, DOOR_CLOSE_DELAY_MS - elapsed)).movement;
    }
    expect(doorMotionPhase(movement, door.id)).toBe('closing');
    expect(doorSpriteForFrame(door, [movement])).toBe(door.sprite.replace('closed-door', 'opening-door'));

    for (let elapsed = 0; elapsed < DOOR_CLOSING_MS; elapsed += 50) {
      movement = advanceMovement(MAP, movement, Math.min(50, DOOR_CLOSING_MS - elapsed)).movement;
    }
    expect(doorSpriteForFrame(door, [movement])).toBe(door.sprite);
  });

  test('sorts props and characters by their ground contact point', () => {
    const order = [
      { groundY: 64, id: 'front-prop', kind: 'prop' as const },
      { groundY: 32, id: 'back-prop', kind: 'prop' as const },
      { groundY: 64, id: 'actor', kind: 'character' as const },
    ].sort(compareGroundedDepth);
    expect(order.map(({ id }) => id)).toEqual(['back-prop', 'actor', 'front-prop']);
  });

  test('uses the explicit floor-to-roof depth contract', () => {
    expect(WORLD_LAYER_ORDER.map((name) => WORLD_DEPTH[name])).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(buildWorldFrameState(MAP, createInitialState(), ACTORS, 'down', 0).layerOrder).toEqual(WORLD_LAYER_ORDER);
  });

  test('locks the core layers and full composite order separately', () => {
    expect(WORLD_LAYER_ORDER).toEqual(['floor', 'prop', 'shadow', 'character', 'effect', 'wall', 'roof']);
    expect(WORLD_COMPOSITE_ORDER).toEqual([
      'floor-and-ground-detail',
      'doors-and-door-wear',
      'contact-shadows-and-thresholds',
      'selection-ring',
      'grounded-props-and-characters',
      'effects',
      'walls',
      'roofs',
      'shelter-shade',
      'district-lighting',
      'atmosphere',
      'destination-pulse',
      'journal-markers',
      'failure-marker',
      'selection-marker-and-ui',
    ]);
  });

  test.each(frameCases.cases)('matches locked frame case $id', (fixture) => {
    const state = stateVariant(fixture.stateVariant);
    const actors = (fixture.actors === 'baseline' ? ACTORS : {}) as WorldActors;
    const movement = createMovementState({ x: 18, y: 18 });
    const frame = buildWorldFrameState(
      MAP,
      state,
      actors,
      fixture.direction as MovementDirection,
      fixture.walkFrame as 0 | 1,
      fixture.playerPresentation as Parameters<typeof buildWorldFrameState>[5],
      { ...fixture.view, movements: [movement] } as WorldFrameView,
    );
    expect(frameSummary(frame)).toEqual(fixture.expected);
    expect(JSON.parse(JSON.stringify(frame))).toEqual(frame);
  });

  test('deep-freezes every renderer list and samples time exactly once', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), ACTORS, 'down', 0, undefined, {
      camera: { x: 400, y: 480, zoom: 1.25 },
      viewport: { width: 900, height: 640 },
      devicePixelRatio: 2,
      artMode: 'enhanced',
      movements: [],
      selectedFoot: { x: 592, y: 606 },
      destinationPulseElapsedMs: 0,
      reducedMotion: false,
      animationTimestampMilliseconds: 1_002,
      vfxAgeStep: 3,
      vfxMode: 'procedural',
    });
    expect(frame.animationTimestampMilliseconds).toBe(1_002);
    expect(frame.vfxAgeStep).toBe(3);
    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.floors)).toBe(true);
    expect(Object.isFrozen(frame.floors[0]?.source)).toBe(true);
    expect(Object.isFrozen(frame.effects[0]?.rects)).toBe(true);
    expect(() => (frame.floors as unknown[]).push({})).toThrow();
  });

  test('records atlas rectangles, pivots, masks, colors, and stable grounded order', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), ACTORS, 'right', 1, {
      visualFoot: { x: 592, y: 606 },
      walkFrame: 1,
      moving: true,
      reducedMotion: false,
      horizontalRunDistance: 16,
    });
    expect(frame.floors[0]).toEqual(expect.objectContaining({
      color: '#ffffffff', opacity: 1, pivot: { x: 0, y: 0 }, mask: null,
    }));
    expect(frame.groundDetails.some(({ mask }) => mask !== null)).toBe(true);
    expect(frame.walls.every(({ adjacencyMask }) => Number.isInteger(adjacencyMask))).toBe(true);
    expect(frame.characters[0]?.pivot).toEqual({ x: 12, y: 29 });
    expect(frame.floors.every(({ source, sprite }) => JSON.stringify(source) === JSON.stringify(atlasRectangle(sprite)))).toBe(true);
    expect(frame.groundedOrder).toEqual([...frame.groundedOrder].sort(compareGroundedDepth));
  });

  test('sorts same-layer characters by tile row and stable ID before drawing', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda' },
      generic_resident: { tile: { x: 29, y: 5 }, visualId: 'generic-resident' },
    }, 'down', 0);
    expect(frame.characters.map(({ id }) => id)).toEqual([
      'generic_resident', 'protagonist', 'linda',
    ]);
  });

  test('uses independent continuous anchors, directions, and foot frames per actor', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {
      linda: {
        tile: { x: 23, y: 30 },
        visualId: 'linda',
        direction: 'left',
        visualFoot: { x: 748.5, y: 988 },
        walkFrame: 1,
        moving: true,
      },
    }, 'up', 0, {
      visualFoot: { x: 592, y: 606.5 },
      walkFrame: 0,
      moving: true,
      reducedMotion: false,
      horizontalRunDistance: 16,
    });
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    const linda = frame.characters.find(({ id }) => id === 'linda')!;
    expect(player.sprite).toContain('.rear-1');
    expect(linda.sprite).toContain('.left-2');
    expect(player.worldY).not.toBe(Math.round(player.worldY));
    expect(linda.worldX).not.toBe(Math.round(linda.worldX));
    expect(player.angleDegrees).toBe(0);
    expect(linda.angleDegrees).toBe(0);
  });

  test('rotates every rounded character during a pure horizontal run', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {
      linda: {
        tile: { x: 23, y: 30 },
        visualId: 'linda',
        direction: 'right',
        visualFoot: { x: 752, y: 989 },
        walkFrame: 1,
        moving: true,
        horizontalRunDistance: 16,
      },
    }, 'right', 1, {
      visualFoot: { x: 592, y: 606 },
      walkFrame: 1,
      moving: true,
      reducedMotion: false,
      horizontalRunDistance: 16,
    });
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    const linda = frame.characters.find(({ id }) => id === 'linda')!;
    expect(player.angleDegrees).toBeCloseTo(10.416666, 5);
    expect(player.worldX).toBe(581);
    expect(player.worldY).toBe(578);
    expect(player.shadowWorldX).toBe(586);
    expect(linda.angleDegrees).toBeCloseTo(10.416666, 5);
    expect(linda.worldX).toBe(741);
    expect(linda.worldY).toBe(961);
    expect(linda.shadowWorldX).toBe(746);
  });

  test('reduced motion keeps horizontal travel upright without moving the shadow', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {}, 'left', 0, {
      visualFoot: { x: 584, y: 606 },
      walkFrame: 0,
      moving: true,
      reducedMotion: true,
      horizontalRunDistance: 16,
    });
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    expect(player.angleDegrees).toBe(0);
    expect(player.worldX).toBe(572);
    expect(player.worldY).toBe(579);
    expect(player.shadowWorldX).toBe(577);
  });

  test('uses restrained talk and reaction poses before adding more walk frames', () => {
    const reaction = buildWorldFrameState(MAP, createInitialState(), {
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda', pose: 'reaction', poseFrame: 1 },
    }, 'down', 0).characters.find(({ id }) => id === 'linda')!;
    const talk = buildWorldFrameState(MAP, createInitialState(), {
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda', pose: 'talk', poseFrame: 1 },
    }, 'down', 0).characters.find(({ id }) => id === 'linda')!;
    const reduced = buildWorldFrameState(MAP, createInitialState(), {
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda', pose: 'reaction', poseFrame: 1, reducedMotion: true },
    }, 'down', 0).characters.find(({ id }) => id === 'linda')!;
    expect(reaction).toMatchObject({ angleDegrees: -4, worldY: 959 });
    expect(talk).toMatchObject({ angleDegrees: 2, worldY: 960 });
    expect(reduced).toMatchObject({ angleDegrees: 0, worldY: 962 });
  });

  test('save and reload inside reconstruct the byte-identical first frame', () => {
    const inside = walkTo({ x: 16, y: 23 });
    const savedBytes = JSON.stringify(inside.worldState);
    const loaded = WorldStateSchema.parse(JSON.parse(savedBytes) as unknown);
    const before = buildWorldFrameState(MAP, inside.worldState, ACTORS, inside.movement.direction, 0);
    const after = buildWorldFrameState(MAP, loaded, ACTORS, inside.movement.direction, 0);
    expect(after).toEqual(before);
    expect(after.hiddenRoofGroupId).toBe('protagonist-villa-roof');
    expect(loaded.protagonist.worldPosition).toEqual({ mapId: 'northwest_residential', tileX: 16, tileY: 23 });
  });

  test('leaving through the pathfindable door restores the roof only outside', () => {
    const doorway = walkTo({ x: 17, y: 24 });
    expect(buildWorldFrameState(MAP, doorway.worldState, ACTORS, doorway.movement.direction, 0).hiddenRoofGroupId)
      .toBe('protagonist-villa-roof');
    const outside = walkTo({ x: 17, y: 25 }, doorway.worldState);
    const outsideFrame = buildWorldFrameState(MAP, outside.worldState, ACTORS, outside.movement.direction, 0);
    expect(outsideFrame.hiddenRoofGroupId).toBeUndefined();
    expect(outsideFrame.visibleRoofGroupIds).toEqual(['protagonist-villa-roof']);
  });

  test('every committed movement event is one adjacent tile and state-owned', () => {
    const result = walkTo({ x: 19, y: 20 });
    expect(result.worldState.protagonist.worldPosition).toEqual({
      mapId: 'northwest_residential', tileX: 19, tileY: 20,
    });
    expect(result.worldState.eventLedger).toHaveLength(2);
    for (const event of result.worldState.eventLedger) {
      expect(event.type).toBe('protagonist-moved');
      if (event.type === 'protagonist-moved') {
        expect(Math.max(
          Math.abs(event.toTileX - event.fromTileX),
          Math.abs(event.toTileY - event.fromTileY),
        )).toBe(1);
      }
    }
  });
});
