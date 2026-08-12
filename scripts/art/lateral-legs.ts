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

function setToken(frame: TokenFrame, x: number, y: number, token: string): void {
  const row = [...(frame[y] as string)];
  row[x] = token;
  frame[y] = row.join('');
}

function skinColumns(row: string): number[] {
  return [...row].flatMap((token, x) => token === 'S' || token === 's' || token === 'L' ? [x] : []);
}

function applyLateralFace(frame: TokenFrame, direction: 'left' | 'right'): void {
  for (let y = 7; y <= 14; y += 1) {
    for (let x = 5; x <= 18; x += 1) {
      const token = frame[y]?.[x];
      if (token === 'W' || token === 'D' || token === 'K') setToken(frame, x, y, 'S');
    }
  }
  const eyeRows = [8, 9, 10].filter((y) => skinColumns(frame[y] as string).length >= 5).slice(0, 2);
  for (const y of eyeRows) {
    const columns = skinColumns(frame[y] as string);
    const anchor = direction === 'left'
      ? (columns[0] as number) + 2
      : (columns.at(-1) as number) - 3;
    setToken(frame, anchor, y, 'W');
    setToken(frame, anchor + 1, y, direction === 'left' ? 'K' : 'W');
    if (direction === 'right') setToken(frame, anchor + 2, y, 'K');
  }
  const mouthRow = 13;
  const mouthColumns = skinColumns(frame[mouthRow] as string);
  if (mouthColumns.length >= 5) {
    const mouthX = direction === 'left'
      ? (mouthColumns[0] as number) + 2
      : (mouthColumns.at(-1) as number) - 3;
    setToken(frame, mouthX, mouthRow, 'K');
    setToken(frame, mouthX + 1, mouthRow, 'K');
  }
}

export function composeLateralFrame(
  source: CharacterSource,
  direction: 'left' | 'right',
  frameIndex: 0 | 1,
): TokenFrame {
  const frame = emptyTokenFrame(WORLD_CELL.width, WORLD_CELL.height);
  const authoredLegs = source.sourceLayers.legs.lateralFrames[frameIndex];
  const orient = (commands: readonly DrawCommand[]) => direction === 'left'
    ? commands
    : commands.map(mirrorCommand);
  drawTokenCommands(frame, orient(authoredLegs));
  drawTokenCommands(frame, orient(source.sourceLayers.torsoAndClothing.commands));
  drawTokenCommands(frame, orient(source.sourceLayers.headAndFace.commands));
  drawTokenCommands(frame, orient(source.sourceLayers.hair.commands));
  applyLateralFace(frame, direction);
  drawTokenCommands(frame, orient(source.sourceLayers.accessory.commands));
  drawTokenCommands(frame, orient(source.sourceLayers.heldItem?.commands ?? []));
  return frame;
}
