import * as THREE from '/node_modules/three/build/three.module.js';

const mount = document.querySelector('#three-2d-frame');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#171b18');

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(298, 298, false);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
mount.prepend(renderer.domElement);

const camera = new THREE.OrthographicCamera(-5.8, 5.8, 5.8, -5.8, 0.1, 100);
camera.position.set(0, 0, 20);

const [atlasIndex, atlasImage] = await Promise.all([
  fetch('/assets/generated/atlas-index.json').then((response) => response.json()),
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = '/assets/generated/world-atlas.png';
  }),
]);
const textureCache = new Map();

function textureFor(name) {
  const cached = textureCache.get(name);
  if (cached) return cached;
  const source = atlasIndex.sprites[name];
  if (!source) throw new Error(`Unknown atlas sprite: ${name}`);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(atlasImage, source.x, source.y, source.width, source.height, 0, 0, source.width, source.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  textureCache.set(name, texture);
  return texture;
}

function addSprite(name, x, y, z, options = {}) {
  const source = atlasIndex.sprites[name];
  const map = textureFor(name);
  const scale = options.scale ?? 1;
  if (options.shadow) {
    const shadow = new THREE.Sprite(new THREE.SpriteMaterial({
      map,
      color: '#111519',
      transparent: true,
      opacity: 0.48,
      alphaTest: 0.15,
      depthWrite: false,
    }));
    shadow.position.set(x + 0.16, y - 0.18, z - 0.08);
    shadow.scale.set(scale * source.width / 32, scale * source.height / 32, 1);
    shadow.renderOrder = Math.round(z * 100) - 1;
    scene.add(shadow);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map,
    transparent: true,
    alphaTest: 0.15,
    depthWrite: false,
  }));
  sprite.position.set(x, y, z);
  sprite.scale.set(scale * source.width / 32, scale * source.height / 32, 1);
  sprite.renderOrder = Math.round(z * 100);
  scene.add(sprite);
  return sprite;
}

const floorNames = ['tile.villa-floor', 'tile.villa-floor-b', 'tile.villa-floor-c', 'tile.villa-floor-d'];
for (let row = 0; row < 9; row += 1) {
  for (let column = 0; column < 10; column += 1) {
    addSprite(floorNames[(column * 3 + row * 5) % floorNames.length], column - 4.5, 4 - row, 0);
  }
}

const wallNames = {
  horizontal: 'tile.wall-villa-a',
  vertical: 'tile.wall-villa-5',
  topLeft: 'tile.wall-villa-6',
  topRight: 'tile.wall-villa-c',
  bottomLeft: 'tile.wall-villa-3',
  bottomRight: 'tile.wall-villa-9',
};
for (let column = 1; column < 9; column += 1) {
  addSprite(wallNames.horizontal, column - 4.5, 4, 1);
  if (column !== 4 && column !== 5) addSprite(wallNames.horizontal, column - 4.5, -4, 1);
}
for (let row = 1; row < 8; row += 1) {
  addSprite(wallNames.vertical, -4.5, 4 - row, 1);
  addSprite(wallNames.vertical, 4.5, 4 - row, 1);
}
addSprite(wallNames.topLeft, -4.5, 4, 1.01);
addSprite(wallNames.topRight, 4.5, 4, 1.01);
addSprite(wallNames.bottomLeft, -4.5, -4, 1.01);
addSprite(wallNames.bottomRight, 4.5, -4, 1.01);
addSprite('tile.closed-door', 0, -4, 1.1);

function addOcclusion(width, height, x, y) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color: '#111314', transparent: true, opacity: 0.3, depthWrite: false }),
  );
  mesh.position.set(x, y, 1.2);
  mesh.renderOrder = 120;
  scene.add(mesh);
}
addOcclusion(8, 0.48, 0, 3.48);
addOcclusion(0.48, 7, -3.98, 0);
addOcclusion(0.48, 7, 3.98, 0);

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  for (const [inset, alpha] of [[2, 0.04], [6, 0.06], [10, 0.08], [13, 0.12]]) {
    context.fillStyle = `rgba(255, 180, 75, ${alpha})`;
    context.fillRect(inset, inset, 32 - inset * 2, 32 - inset * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}
const glow = glowTexture();
function addGlow(x, y, scale) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow,
    color: '#ffb34f',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sprite.position.set(x, y, 1.4);
  sprite.scale.set(scale, scale, 1);
  sprite.renderOrder = 140;
  scene.add(sprite);
}

addGlow(-3, 1.7, 4.6);
addGlow(3.2, -1.2, 4.3);
addSprite('tile.fixture-lamp', -3, 1.7, 2.2, { shadow: true });
addSprite('tile.fixture-lamp', 3.2, -1.2, 2.2, { shadow: true });
addSprite('tile.fixture-planter', -3.1, -2.2, 2.3, { shadow: true, scale: 1.08 });
addSprite('tile.fixture-planter', 3.2, 2.1, 2.3, { shadow: true, scale: 1.08 });
addSprite('tile.sofa-left', 1.2, 1.45, 2.5, { shadow: true, scale: 1.12 });
addSprite('tile.sofa-right', 2.2, 1.45, 2.5, { shadow: true, scale: 1.12 });
addSprite('tile.table-left', -0.6, -1.3, 2.6, { shadow: true, scale: 1.08 });
addSprite('tile.table-right', 0.4, -1.3, 2.6, { shadow: true, scale: 1.08 });
addSprite('tile.table-left', 2.1, -2.25, 2.6, { shadow: true, scale: 1.08 });
addSprite('tile.table-right', 3.1, -2.25, 2.6, { shadow: true, scale: 1.08 });

const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.42, 0.52, 20),
  new THREE.MeshBasicMaterial({ color: '#e8bd50', transparent: true, opacity: 0.9, depthWrite: false }),
);
ring.position.set(-1.05, 0.35, 3.2);
ring.renderOrder = 320;
scene.add(ring);
addSprite('character.protagonist.front-1', -1.05, 0.65, 3.3, { shadow: true, scale: 1.22 });

renderer.render(scene, camera);
window.__THREE_2D_SLICE__ = {
  renderer: `three.js r${THREE.REVISION}`,
  internalResolution: [298, 298],
  style: 'pixel-2d',
  atlasSprites: true,
  staticFrame: true,
};
document.body.dataset.ready2d = 'true';
if (document.body.dataset.ready25d === 'true') document.body.dataset.ready = 'true';
