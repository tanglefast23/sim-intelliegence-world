import * as THREE from '/node_modules/three/build/three.module.js';

const mount = document.querySelector('#three-frame');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#171b18');

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(318, 318, false);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
mount.prepend(renderer.domElement);

const camera = new THREE.OrthographicCamera(-6.2, 6.2, 6.2, -6.2, 0.1, 100);
camera.position.set(8.2, 12.5, 11.5);
camera.lookAt(0, 0.2, -0.25);

scene.add(new THREE.HemisphereLight('#f5dcb0', '#202824', 1.7));
const sun = new THREE.DirectionalLight('#ffd995', 3.2);
sun.position.set(-5, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(256, 256);
sun.shadow.camera.left = -7;
sun.shadow.camera.right = 7;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -7;
sun.shadow.bias = -0.001;
scene.add(sun);

const material = (color, options = {}) => new THREE.MeshStandardMaterial({
  color,
  flatShading: true,
  roughness: options.roughness ?? 0.88,
  metalness: options.metalness ?? 0,
  emissive: options.emissive ?? '#000000',
  emissiveIntensity: options.emissiveIntensity ?? 0,
  map: options.map,
});

function addBox(parent, { x, y, z, width, height, depth, color, map, cast = true, receive = true, emissive }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material(color, emissive ? { emissive, emissiveIntensity: 1.8, map } : { map }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  paint(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const floorTexture = canvasTexture(16, 16, (context) => {
  context.fillStyle = '#413935';
  context.fillRect(0, 0, 16, 16);
  context.fillStyle = '#51443e';
  context.fillRect(1, 1, 14, 14);
  context.fillStyle = '#5d4b43';
  context.fillRect(2, 2, 12, 2);
  context.fillStyle = '#342f2e';
  context.fillRect(0, 0, 16, 1);
  context.fillRect(0, 0, 1, 16);
  context.fillStyle = '#68574e';
  context.fillRect(4, 7, 2, 1);
  context.fillRect(11, 12, 3, 1);
});
floorTexture.repeat.set(10, 9);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 9),
  material('#51443e', { map: floorTexture }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallTexture = canvasTexture(32, 16, (context) => {
  context.fillStyle = '#6f4c3b';
  context.fillRect(0, 0, 32, 16);
  context.fillStyle = '#8a5b43';
  for (let y = 1; y < 16; y += 7) {
    const offset = y === 1 ? 0 : 5;
    for (let x = -offset; x < 32; x += 10) context.fillRect(x + 1, y, 8, 5);
  }
  context.fillStyle = '#4b352d';
  for (let y = 0; y < 16; y += 7) context.fillRect(0, y, 32, 1);
});
wallTexture.repeat.set(5, 1);

addBox(scene, { x: 0, y: 0.72, z: -4.5, width: 10.5, height: 1.45, depth: 0.36, color: '#704c3b', map: wallTexture });
addBox(scene, { x: -5, y: 0.72, z: 0, width: 0.36, height: 1.45, depth: 9.35, color: '#704c3b', map: wallTexture });
addBox(scene, { x: 5, y: 0.72, z: 0, width: 0.36, height: 1.45, depth: 9.35, color: '#704c3b', map: wallTexture });
addBox(scene, { x: -3.1, y: 0.3, z: 4.5, width: 3.8, height: 0.6, depth: 0.36, color: '#704c3b', map: wallTexture });
addBox(scene, { x: 3.1, y: 0.3, z: 4.5, width: 3.8, height: 0.6, depth: 0.36, color: '#704c3b', map: wallTexture });
addBox(scene, { x: 0, y: 0.08, z: 4.52, width: 2.25, height: 0.16, depth: 0.52, color: '#b47a56' });

function sofa(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  addBox(group, { x: 0, y: 0.42, z: 0.05, width: 2.5, height: 0.38, depth: 0.82, color: '#4d9b98' });
  addBox(group, { x: 0, y: 0.83, z: -0.35, width: 2.5, height: 0.82, depth: 0.2, color: '#397b7b' });
  addBox(group, { x: -1.16, y: 0.65, z: 0.05, width: 0.22, height: 0.58, depth: 0.9, color: '#316c6f' });
  addBox(group, { x: 1.16, y: 0.65, z: 0.05, width: 0.22, height: 0.58, depth: 0.9, color: '#316c6f' });
  addBox(group, { x: -0.56, y: 0.64, z: -0.01, width: 0.94, height: 0.1, depth: 0.58, color: '#6bb9b2' });
  addBox(group, { x: 0.56, y: 0.64, z: -0.01, width: 0.94, height: 0.1, depth: 0.58, color: '#5aaba6' });
  scene.add(group);
}

function table(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  addBox(group, { x: 0, y: 0.55, z: 0, width: 1.85, height: 0.25, depth: 0.72, color: '#c27637' });
  addBox(group, { x: 0, y: 0.69, z: 0, width: 1.62, height: 0.08, depth: 0.56, color: '#e09a51' });
  for (const legX of [-0.68, 0.68]) addBox(group, { x: legX, y: 0.25, z: 0, width: 0.18, height: 0.5, depth: 0.18, color: '#77432c' });
  addBox(group, { x: -0.45, y: 0.72, z: 0, width: 0.28, height: 0.04, depth: 0.2, color: '#f4d78c', cast: false });
  addBox(group, { x: 0.45, y: 0.72, z: 0, width: 0.28, height: 0.04, depth: 0.2, color: '#f4d78c', cast: false });
  scene.add(group);
}

function planter(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  addBox(group, { x: 0, y: 0.24, z: 0, width: 0.72, height: 0.48, depth: 0.62, color: '#8b5238' });
  addBox(group, { x: 0, y: 0.5, z: 0, width: 0.86, height: 0.12, depth: 0.74, color: '#b46b46' });
  for (const leaf of [
    [-0.22, 0.73, 0, 0.46, 0.36], [0.22, 0.78, 0, 0.46, 0.38],
    [0, 0.96, -0.08, 0.5, 0.42], [0, 0.72, 0.19, 0.58, 0.35],
  ]) addBox(group, { x: leaf[0], y: leaf[1], z: leaf[2], width: leaf[3], height: leaf[4], depth: 0.28, color: '#427145' });
  scene.add(group);
}

function lamp(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  addBox(group, { x: 0, y: 0.08, z: 0, width: 0.58, height: 0.16, depth: 0.58, color: '#333338' });
  addBox(group, { x: 0, y: 0.75, z: 0, width: 0.12, height: 1.35, depth: 0.12, color: '#4e4a48' });
  addBox(group, { x: 0, y: 1.45, z: 0, width: 0.48, height: 0.42, depth: 0.48, color: '#ffd05a', emissive: '#ffb534' });
  const light = new THREE.PointLight('#ffbc58', 5.5, 5.2, 2);
  light.position.set(0, 1.5, 0);
  light.castShadow = false;
  group.add(light);
  scene.add(group);
}

sofa(2.15, -1.35);
table(0.45, 1.25);
table(3.1, 1.25);
planter(-3.45, -2.25);
planter(3.7, -2.45);
planter(-3.6, 2.5);
lamp(-3.5, 0.25);
lamp(3.9, 1.2);

for (const detail of [
  [-2.1, 0.025, 2.9, 0.52, 0.05, 0.12, '#6a5547'],
  [1.75, 0.025, 3.18, 0.34, 0.05, 0.1, '#8a694d'],
  [-0.9, 0.025, -2.8, 0.28, 0.05, 0.1, '#6a5547'],
]) addBox(scene, { x: detail[0], y: detail[1], z: detail[2], width: detail[3], height: detail[4], depth: detail[5], color: detail[6], cast: false });

function atlasSpriteTexture() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 30;
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 755, 341, 24, 30, 0, 0, 24, 30);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      resolve(texture);
    };
    image.onerror = reject;
    image.src = '/assets/generated/world-atlas.png';
  });
}

const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.48, 0.58, 20),
  new THREE.MeshBasicMaterial({ color: '#e8bd50', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.set(-0.8, 0.035, -0.2);
scene.add(ring);

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.52, 16),
  new THREE.MeshBasicMaterial({ color: '#15151a', transparent: true, opacity: 0.55, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.scale.z = 0.42;
shadow.position.set(-0.8, 0.045, -0.16);
scene.add(shadow);

const protagonistTexture = await atlasSpriteTexture();
const protagonist = new THREE.Sprite(new THREE.SpriteMaterial({
  map: protagonistTexture,
  transparent: true,
  alphaTest: 0.2,
  depthWrite: false,
}));
protagonist.scale.set(1.28, 1.6, 1);
protagonist.position.set(-0.8, 0.87, -0.2);
scene.add(protagonist);

renderer.render(scene, camera);
window.__THREE_SLICE__ = {
  renderer: `three.js r${THREE.REVISION}`,
  internalResolution: [318, 318],
  style: 'pixel-2.5d',
  sourceSprite: 'character.protagonist.front-1',
  staticFrame: true,
};
document.body.dataset.ready25d = 'true';
if (document.body.dataset.ready2d === 'true') document.body.dataset.ready = 'true';
