import {
  WORLD_CELL,
  drawTokenCommands,
  emptyTokenFrame,
  type CharacterSource,
  type DrawCommand,
  type TokenFrame,
} from './character-source';

function mirrorCommand(command: DrawCommand): DrawCommand {
  if (command.kind === 'rect') {
    return { ...command, x: WORLD_CELL.width - command.x - command.width };
  }
  return {
    ...command,
    points: command.points.map(([x, y]) => [WORLD_CELL.width - 1 - x, y]),
  };
}

function staticLayers(source: CharacterSource): readonly DrawCommand[][] {
  return [
    source.sourceLayers.torsoAndClothing.commands,
    source.sourceLayers.headAndFace.commands,
    source.sourceLayers.hair.commands,
    source.sourceLayers.accessory.commands,
    source.sourceLayers.heldItem?.commands ?? [],
  ];
}

export function composeLateralFrame(
  source: CharacterSource,
  direction: 'left' | 'right',
  frameIndex: 0 | 1,
): TokenFrame {
  const frame = emptyTokenFrame(WORLD_CELL.width, WORLD_CELL.height);
  const authoredLegs = source.sourceLayers.legs.lateralFrames[frameIndex];
  drawTokenCommands(frame, direction === 'left' ? authoredLegs : authoredLegs.map(mirrorCommand));
  for (const commands of staticLayers(source)) {
    drawTokenCommands(frame, commands);
  }
  return frame;
}
