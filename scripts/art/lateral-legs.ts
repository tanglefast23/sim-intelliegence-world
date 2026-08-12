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

function compressLateralFrame(frame: TokenFrame, direction: 'left' | 'right'): TokenFrame {
  const compressed = emptyTokenFrame(WORLD_CELL.width, WORLD_CELL.height);
  const center = (WORLD_CELL.width - 1) / 2;
  const shift = direction === 'left' ? 1 : -1;
  for (let y = 0; y < WORLD_CELL.height; y += 1) {
    const scale = y < 18 ? 0.86 : 0.625;
    const columns = direction === 'left'
      ? Array.from({ length: WORLD_CELL.width }, (_unused, x) => x)
      : Array.from({ length: WORLD_CELL.width }, (_unused, offset) => WORLD_CELL.width - 1 - offset);
    for (const x of columns) {
      const token = frame[y]?.[x];
      if (!token || token === '.') continue;
      const targetX = Math.max(1, Math.min(
        WORLD_CELL.width - 2,
        Math.round((x - center) * scale + center + shift),
      ));
      setToken(compressed, targetX, y, token);
    }
  }
  return compressed;
}

function applyLateralFace(frame: TokenFrame, direction: 'left' | 'right'): void {
  for (let y = 9; y <= 16; y += 1) {
    for (let x = 3; x <= 20; x += 1) {
      const token = frame[y]?.[x];
      if (token === 'W' || token === 'D') setToken(frame, x, y, 'S');
    }
  }
  const eyeRows = [13, 14].filter((y) => skinColumns(frame[y] as string).length >= 7);
  for (const y of eyeRows) {
    const columns = skinColumns(frame[y] as string);
    const anchor = direction === 'left'
      ? (columns[0] as number) + 2
      : (columns.at(-1) as number) - 5;
    const eye = direction === 'left' ? ['W', 'K', 'W', 'D'] : ['D', 'W', 'K', 'W'];
    eye.forEach((token, offset) => setToken(frame, anchor + offset, y, token));
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
  drawTokenCommands(frame, orient(source.sourceLayers.accessory.commands));
  drawTokenCommands(frame, orient(source.sourceLayers.heldItem?.commands ?? []));
  const compressed = compressLateralFrame(frame, direction);
  applyLateralFace(compressed, direction);
  return compressed;
}
