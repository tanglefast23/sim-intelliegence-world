import { createBitmap, parseHexColor, setPixel, type Bitmap } from './png';

export const HFM_PILOT_WORLD_CELL = { width: 24, height: 30 } as const;
export const HFM_PILOT_PORTRAIT_CELL = { width: 24, height: 29 } as const;

export type PilotExpression = 'rest' | 'joy' | 'upset';
export type PilotId = 'protagonist' | 'linda' | 'devon-price' | 'mina-park' | 'rafael-cruz';
type FaceShape = 'hero' | 'round' | 'long' | 'wide';
type EyeStyle = 'normal' | 'large' | 'beady' | 'angled-small';
type Build = 'slim' | 'normal' | 'broad' | 'round';
type Feature = 'prize-forelock' | 'cloud-hair' | 'tower-flat-top' | 'spa-stone-bun' | 'curl-moustache';
type Outfit = 'traveler' | 'socialite' | 'night-jacket' | 'spa-robe' | 'cook';
type Grid = string[][];

export type HfmPilotLook = Readonly<{
  id: PilotId;
  name: string;
  shortFeature: string;
  faceShape: FaceShape;
  eyes: EyeStyle;
  build: Build;
  feature: Feature;
  outfit: Outfit;
  palette: Readonly<Record<string, string>>;
}>;

const basePalette = Object.freeze({
  K: '#241f2e',
  W: '#ffffff',
  w: '#d9d5cf',
  D: '#49415f',
  d: '#272333',
  x: '#241a17',
  y: '#534537',
});

function palette(
  skin: readonly [string, string, string],
  hair: readonly [string, string, string],
  clothing: readonly [string, string, string],
  accent: readonly [string, string],
): Readonly<Record<string, string>> {
  return Object.freeze({
    ...basePalette,
    s: skin[0], S: skin[1], L: skin[2],
    h: hair[0], H: hair[1], J: hair[2],
    c: clothing[0], C: clothing[1], E: clothing[2],
    a: accent[0], A: accent[1],
  });
}

export const HFM_PILOT_LOOKS: readonly HfmPilotLook[] = Object.freeze([
  {
    id: 'protagonist',
    name: 'PROTAGONIST',
    shortFeature: 'PRIZE FORELOCK + TRAVEL STRAP',
    faceShape: 'hero',
    eyes: 'angled-small',
    build: 'normal',
    feature: 'prize-forelock',
    outfit: 'traveler',
    palette: palette(
      ['#a86a42', '#cf9268', '#eab48c'],
      ['#16121f', '#241f2e', '#534537'],
      ['#0e6f57', '#1d9e75', '#67c8a5'],
      ['#ba7517', '#edb54a'],
    ),
  },
  {
    id: 'linda',
    name: 'LINDA',
    shortFeature: 'CLOUD HAIR + FLARED DRESS',
    faceShape: 'round',
    eyes: 'large',
    build: 'round',
    feature: 'cloud-hair',
    outfit: 'socialite',
    palette: palette(
      ['#cf9268', '#eab48c', '#f7d7ba'],
      ['#241f2e', '#3d2a22', '#6a4326'],
      ['#a83440', '#d94f52', '#f2938c'],
      ['#3f6fb5', '#a3c8f0'],
    ),
  },
  {
    id: 'devon-price',
    name: 'DEVON PRICE',
    shortFeature: 'TOWER FLAT-TOP + TINY WAIST',
    faceShape: 'wide',
    eyes: 'beady',
    build: 'broad',
    feature: 'tower-flat-top',
    outfit: 'night-jacket',
    palette: palette(
      ['#6a4326', '#8a4f38', '#a86a42'],
      ['#16121f', '#241f2e', '#534537'],
      ['#2f55b8', '#3f6fb5', '#a3c8f0'],
      ['#ba7517', '#edb54a'],
    ),
  },
  {
    id: 'mina-park',
    name: 'MINA PARK',
    shortFeature: 'SPA-STONE BUN + TOWEL SLEEVE',
    faceShape: 'long',
    eyes: 'normal',
    build: 'normal',
    feature: 'spa-stone-bun',
    outfit: 'spa-robe',
    palette: palette(
      ['#a86a42', '#cf9268', '#eab48c'],
      ['#241f2e', '#3d2a22', '#6a4326'],
      ['#5b3a91', '#9a63d6', '#c9a6ec'],
      ['#6b6675', '#f4f1ea'],
    ),
  },
  {
    id: 'rafael-cruz',
    name: 'RAFAEL CRUZ',
    shortFeature: 'CURLED MOUSTACHE + COOK BUILD',
    faceShape: 'round',
    eyes: 'beady',
    build: 'round',
    feature: 'curl-moustache',
    outfit: 'cook',
    palette: palette(
      ['#8a4f38', '#a86a42', '#cf9268'],
      ['#241a17', '#3d2a22', '#6a4326'],
      ['#7a2731', '#c22f2c', '#f2938c'],
      ['#ba7517', '#edb54a'],
    ),
  },
]);

function makeGrid(height: number): Grid {
  return Array.from({ length: height }, () => Array(HFM_PILOT_WORLD_CELL.width).fill('.'));
}

function set(grid: Grid, x: number, y: number, token: string): void {
  if (grid[y]?.[x] !== undefined) grid[y][x] = token;
}

function rect(grid: Grid, x0: number, y0: number, x1: number, y1: number, token: string): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) set(grid, x, y, token);
  }
}

function line(grid: Grid, x0: number, y0: number, x1: number, y1: number, token: string): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let index = 0; index <= steps; index += 1) {
    set(
      grid,
      Math.round(x0 + ((x1 - x0) * index) / Math.max(1, steps)),
      Math.round(y0 + ((y1 - y0) * index) / Math.max(1, steps)),
      token,
    );
  }
}

function addOutline(grid: Grid, cropClosure: 'closed' | 'foot-open'): void {
  const additions: Array<readonly [number, number]> = [];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < HFM_PILOT_WORLD_CELL.width; x += 1) {
      if (grid[y]?.[x] !== '.') continue;
      const nearFill = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const token = grid[y + (dy as number)]?.[x + (dx as number)];
        return token !== undefined && token !== '.' && token !== 'K';
      });
      if (nearFill) additions.push([x, y]);
    }
  }
  additions.forEach(([x, y]) => set(grid, x, y, 'K'));
  for (let x = 0; x < HFM_PILOT_WORLD_CELL.width; x += 1) {
    if (grid[0]?.[x] !== '.') set(grid, x, 0, 'K');
    if (cropClosure === 'closed' && grid[grid.length - 1]?.[x] !== '.') {
      set(grid, x, grid.length - 1, 'K');
    }
  }
  for (let y = 0; y < grid.length; y += 1) {
    if (grid[y]?.[0] !== '.') set(grid, 0, y, 'K');
    if (grid[y]?.[HFM_PILOT_WORLD_CELL.width - 1] !== '.') {
      set(grid, HFM_PILOT_WORLD_CELL.width - 1, y, 'K');
    }
  }
}

function faceBounds(shape: FaceShape): Readonly<{ left: number; right: number; top: number; bottom: number }> {
  switch (shape) {
    case 'wide': return { left: 5, right: 18, top: 5, bottom: 14 };
    case 'round': return { left: 6, right: 17, top: 4, bottom: 14 };
    case 'long': return { left: 6, right: 17, top: 4, bottom: 15 };
    case 'hero': return { left: 5, right: 18, top: 4, bottom: 15 };
  }
}

function drawEyesAndMouth(grid: Grid, look: HfmPilotLook, expression: PilotExpression): void {
  if (expression === 'joy') {
    set(grid, 7, 9, 'K'); set(grid, 8, 8, 'K'); set(grid, 9, 9, 'K');
    set(grid, 14, 9, 'K'); set(grid, 15, 8, 'K'); set(grid, 16, 9, 'K');
    set(grid, 11, 11, 's'); set(grid, 12, 11, 's');
    rect(grid, 9, 12, 14, 12, 'K');
    rect(grid, 10, 12, 13, 12, 'W');
    return;
  }
  if (expression === 'upset') {
    line(grid, 7, 7, 10, 8, 'K');
    line(grid, 13, 8, 16, 7, 'K');
    set(grid, 9, 9, 'K'); set(grid, 14, 9, 'K');
    set(grid, 11, 11, 's'); set(grid, 12, 11, 's');
    line(grid, 10, 13, 13, 12, 'K');
    return;
  }
  if (look.eyes === 'large') {
    rect(grid, 7, 7, 9, 10, 'W');
    rect(grid, 14, 7, 16, 10, 'W');
    rect(grid, 8, 9, 9, 10, 'K');
    rect(grid, 14, 9, 15, 10, 'K');
  } else if (look.eyes === 'beady') {
    set(grid, 9, 9, 'K'); set(grid, 14, 9, 'K');
  } else if (look.eyes === 'angled-small') {
    set(grid, 8, 8, 'K'); set(grid, 9, 9, 'K');
    set(grid, 15, 8, 'K'); set(grid, 14, 9, 'K');
  } else {
    rect(grid, 8, 8, 9, 9, 'W');
    rect(grid, 14, 8, 15, 9, 'W');
    set(grid, 9, 9, 'K'); set(grid, 14, 9, 'K');
  }
  set(grid, 11, 11, 's'); set(grid, 12, 11, 's');
  rect(grid, 10, 12, 13, 12, 'K');
}

function drawFace(grid: Grid, look: HfmPilotLook, expression: PilotExpression): void {
  const bounds = faceBounds(look.faceShape);
  rect(grid, bounds.left, bounds.top, bounds.right, bounds.bottom, 'S');
  set(grid, bounds.left, bounds.top, '.');
  set(grid, bounds.right, bounds.top, '.');
  set(grid, bounds.left, bounds.bottom, '.');
  set(grid, bounds.right, bounds.bottom, '.');
  set(grid, bounds.left - 1, 9, 'S');
  set(grid, bounds.right + 1, 9, 'S');
  set(grid, bounds.left - 1, 10, 's');
  set(grid, bounds.right + 1, 10, 's');
  rect(grid, Math.max(7, bounds.left + 1), bounds.top + 1, Math.min(9, bounds.right - 1), bounds.top + 2, 'L');
  rect(grid, Math.max(15, bounds.left + 1), 11, bounds.right, 12, 's');
  set(grid, 15, 13, 's'); set(grid, 16, 13, 's');
  rect(grid, 10, Math.min(15, bounds.bottom), 13, Math.min(15, bounds.bottom), 's');
  drawEyesAndMouth(grid, look, expression);
}

function drawCap(grid: Grid, top = 2): void {
  rect(grid, 5, top + 2, 18, 6, 'H');
  rect(grid, 7, top, 16, top + 1, 'H');
  rect(grid, 6, top + 1, 17, top + 1, 'H');
  rect(grid, 6, top + 1, 8, top + 2, 'J');
  rect(grid, 5, 6, 18, 6, 'h');
  set(grid, 5, 7, 'H'); set(grid, 18, 7, 'H');
}

function drawFeature(grid: Grid, look: HfmPilotLook): void {
  switch (look.feature) {
    case 'prize-forelock':
      drawCap(grid, 3);
      line(grid, 7, 3, 14, 1, 'H');
      line(grid, 14, 1, 21, 4, 'H');
      set(grid, 20, 5, 'H'); set(grid, 18, 5, 'J'); set(grid, 15, 2, 'J');
      break;
    case 'cloud-hair':
      rect(grid, 6, 3, 17, 6, 'H');
      rect(grid, 4, 5, 6, 14, 'H');
      rect(grid, 3, 7, 5, 12, 'H');
      set(grid, 2, 7, 'H'); set(grid, 2, 8, 'H'); set(grid, 2, 11, 'H'); set(grid, 2, 12, 'H');
      set(grid, 4, 15, 'H'); set(grid, 5, 16, 'H');
      rect(grid, 17, 4, 19, 15, 'H');
      rect(grid, 19, 6, 20, 13, 'H');
      set(grid, 21, 6, 'H'); set(grid, 21, 7, 'H'); set(grid, 21, 10, 'H'); set(grid, 21, 11, 'H');
      set(grid, 20, 14, 'H'); set(grid, 19, 16, 'H');
      set(grid, 4, 7, 'J'); set(grid, 3, 11, 'J'); set(grid, 18, 5, 'J'); set(grid, 20, 9, 'J');
      set(grid, 4, 14, 'A'); rect(grid, 20, 13, 20, 15, 'A');
      break;
    case 'tower-flat-top':
      rect(grid, 5, 4, 18, 6, 'H');
      rect(grid, 6, 1, 17, 5, 'H');
      rect(grid, 8, 1, 15, 2, 'J');
      rect(grid, 5, 6, 18, 6, 'h');
      break;
    case 'spa-stone-bun':
      drawCap(grid, 4);
      rect(grid, 8, 4, 15, 5, 'H');
      rect(grid, 9, 2, 14, 4, 'H');
      rect(grid, 10, 1, 13, 2, 'H');
      rect(grid, 10, 2, 12, 2, 'J');
      break;
    case 'curl-moustache':
      drawCap(grid, 3);
      rect(grid, 7, 11, 16, 12, 'H');
      line(grid, 7, 11, 4, 13, 'H');
      line(grid, 16, 11, 19, 13, 'H');
      set(grid, 5, 12, 'J'); set(grid, 18, 12, 'J');
      set(grid, 4, 12, 'H'); set(grid, 19, 12, 'H');
      break;
  }
}

function bodyBounds(build: Build): Readonly<{ left: number; right: number }> {
  switch (build) {
    case 'slim': return { left: 8, right: 15 };
    case 'normal': return { left: 7, right: 16 };
    case 'broad': return { left: 5, right: 18 };
    case 'round': return { left: 6, right: 17 };
  }
}

function drawLegs(grid: Grid, frame: 0 | 1): void {
  const near = frame === 0 ? 9 : 13;
  const far = frame === 0 ? 13 : 9;
  rect(grid, 9, 25, 10, 27, 'D');
  rect(grid, 13, 25, 14, 27, 'D');
  rect(grid, near, 27, near + 1, 28, 'y');
  rect(grid, far, 27, far + 1, 28, 'y');
  rect(grid, near - 1, 28, near + 1, 29, 'W');
  rect(grid, far, 28, far + 2, 29, 'W');
  set(grid, near - 1, 29, 'x');
  set(grid, far + 2, 29, 'x');
}

function drawWorldBody(grid: Grid, look: HfmPilotLook, frame: 0 | 1): void {
  const { left, right } = bodyBounds(look.build);
  rect(grid, left + 1, 16, right - 1, 16, 'E');
  rect(grid, left, 17, right, 23, 'C');
  rect(grid, left, 17, left + 1, 22, 'E');
  rect(grid, right, 18, right, 23, 'c');
  rect(grid, left, 23, right, 24, 'c');
  rect(grid, left - 1, 16, left - 1, 18, 'C');
  rect(grid, right + 1, 16, right + 1, 18, 'C');
  rect(grid, left - 1, 19, left - 1, 21, 'S');
  rect(grid, right + 1, 19, right + 1, 21, 'S');
  set(grid, left - 1, 22, 's');
  set(grid, right + 1, 22, 's');
  if (look.build === 'broad') {
    set(grid, left - 2, 17, 'C'); set(grid, right + 2, 17, 'C');
    set(grid, left - 2, 18, 'S'); set(grid, right + 2, 18, 'S');
    rect(grid, left + 2, 22, right - 2, 24, 'C');
  }
  if (look.build === 'round') {
    rect(grid, left - 1, 20, right + 1, 23, 'C');
    rect(grid, right, 20, right + 1, 23, 'c');
    rect(grid, left - 2, 18, left - 2, 20, 'C');
    rect(grid, right + 2, 18, right + 2, 20, 'C');
    rect(grid, left - 2, 21, left - 2, 22, 'S');
    rect(grid, right + 2, 21, right + 2, 22, 'S');
  }

  switch (look.outfit) {
    case 'traveler':
      line(grid, left + 1, 16, right - 2, 24, 'A');
      line(grid, left + 2, 16, right - 1, 24, 'a');
      rect(grid, right + 1, 20, right + 3, 25, 'A');
      set(grid, right + 2, 21, 'E');
      break;
    case 'socialite':
      rect(grid, left - 2, 17, left, 22, 'C');
      rect(grid, left - 3, 20, left - 1, 23, 'E');
      set(grid, left - 2, 24, 'S');
      rect(grid, 10, 17, 13, 18, 'A');
      rect(grid, 8, 19, 15, 20, 'C');
      rect(grid, 7, 21, 16, 22, 'C');
      rect(grid, 6, 23, 17, 23, 'C');
      rect(grid, 5, 24, 18, 24, 'c');
      set(grid, 6, 23, 'E'); set(grid, 7, 22, 'E');
      break;
    case 'night-jacket':
      line(grid, 8, 16, 11, 21, 'E');
      line(grid, 15, 16, 12, 21, 'c');
      rect(grid, 9, 22, 14, 24, 'c');
      set(grid, 11, 20, 'A'); set(grid, 12, 20, 'A');
      break;
    case 'spa-robe':
      line(grid, 8, 16, 14, 23, 'A');
      rect(grid, left - 3, 17, left, 24, 'E');
      rect(grid, left - 4, 21, left - 1, 24, 'W');
      set(grid, left - 3, 25, 'S');
      break;
    case 'cook':
      rect(grid, 8, 18, 15, 24, 'W');
      rect(grid, 9, 17, 14, 18, 'A');
      set(grid, 11, 20, 'c'); set(grid, 13, 22, 'c');
      line(grid, right + 1, 21, right + 3, 16, 'y');
      rect(grid, right + 2, 16, right + 4, 18, 'W');
      set(grid, right + 2, 16, '.'); set(grid, right + 4, 16, '.');
      break;
  }
  drawLegs(grid, frame);
}

function drawPortraitBust(grid: Grid, look: HfmPilotLook): void {
  const shoulderExtra = look.build === 'broad' || look.build === 'round' ? 1 : 0;
  rect(grid, 9, 16, 14, 16, 'C');
  rect(grid, 7, 17, 16, 17, 'C');
  rect(grid, 5 - shoulderExtra, 18, 18 + shoulderExtra, 18, 'C');
  rect(grid, 3 - shoulderExtra, 19, 20 + shoulderExtra, 19, 'C');
  rect(grid, 2, 20, 21, 28, 'C');
  rect(grid, 2, 20, 3, 27, 'E');
  rect(grid, 20, 21, 21, 28, 'c');
  rect(grid, 2, 28, 21, 28, 'c');
  rect(grid, 10, 16, 13, 17, 'c');

  switch (look.outfit) {
    case 'traveler':
      line(grid, 7, 17, 15, 28, 'A');
      line(grid, 8, 17, 16, 28, 'a');
      rect(grid, 18, 23, 21, 28, 'A');
      break;
    case 'socialite':
      rect(grid, 8, 17, 15, 18, 'A');
      rect(grid, 2, 21, 5, 28, 'E');
      line(grid, 7, 20, 4, 28, 'E');
      line(grid, 16, 20, 19, 28, 'c');
      break;
    case 'night-jacket':
      line(grid, 7, 17, 11, 23, 'E');
      line(grid, 16, 17, 12, 23, 'c');
      rect(grid, 9, 24, 14, 28, 'c');
      set(grid, 11, 22, 'A'); set(grid, 12, 22, 'A');
      break;
    case 'spa-robe':
      line(grid, 8, 17, 15, 25, 'A');
      rect(grid, 2, 20, 6, 28, 'E');
      rect(grid, 2, 24, 5, 28, 'W');
      break;
    case 'cook':
      rect(grid, 7, 19, 16, 28, 'W');
      rect(grid, 9, 17, 14, 19, 'A');
      set(grid, 10, 23, 'c'); set(grid, 13, 25, 'c');
      line(grid, 18, 28, 20, 18, 'y');
      rect(grid, 19, 16, 21, 18, 'W');
      set(grid, 19, 16, '.'); set(grid, 21, 16, '.');
      break;
  }
}

function rows(grid: Grid): readonly string[] {
  return Object.freeze(grid.map((row) => row.join('')));
}

export function makePilotPortraitGrid(
  look: HfmPilotLook,
  expression: PilotExpression,
): readonly string[] {
  const grid = makeGrid(HFM_PILOT_PORTRAIT_CELL.height);
  drawFace(grid, look, expression);
  drawFeature(grid, look);
  drawPortraitBust(grid, look);
  addOutline(grid, 'closed');
  return rows(grid);
}

export function makePilotWorldGrid(look: HfmPilotLook, frame: 0 | 1 = 0): readonly string[] {
  const grid = makeGrid(HFM_PILOT_WORLD_CELL.height);
  drawFace(grid, look, 'rest');
  drawFeature(grid, look);
  drawWorldBody(grid, look, frame);
  addOutline(grid, 'foot-open');
  return rows(grid);
}

export function pilotGridToBitmap(source: readonly string[], look: HfmPilotLook): Bitmap {
  const bitmap = createBitmap(HFM_PILOT_WORLD_CELL.width, source.length);
  source.forEach((row, y) => {
    [...row].forEach((token, x) => {
      if (token === '.') return;
      const color = look.palette[token];
      if (!color) throw new Error(`${look.id} uses unknown pilot palette token ${token}.`);
      setPixel(bitmap, x, y, parseHexColor(color));
    });
  });
  return bitmap;
}

export function renderPilotPortrait(look: HfmPilotLook, expression: PilotExpression): Bitmap {
  return pilotGridToBitmap(makePilotPortraitGrid(look, expression), look);
}

export function renderPilotWorld(look: HfmPilotLook, frame: 0 | 1 = 0): Bitmap {
  return pilotGridToBitmap(makePilotWorldGrid(look, frame), look);
}
