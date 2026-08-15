import * as THREE from 'three';

const WIDTH = 455;
const HEIGHT = 666;
const INK = '#171821';
const SKIN = '#f4e4e3';
const BLUSH = '#efaeb8';
const HAIR = '#697db8';
const HAIR_DARK = '#465a91';
const LIP = '#d96f9b';
const GOLD = '#c89225';

const mount = document.querySelector('#portrait');
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor('#e65b12');
mount.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 100);
camera.position.z = 20;
const portrait = new THREE.Group();
scene.add(portrait);

function random(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function canvas(width, height) {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}

function textureFrom(draw, width, height, variant = 0) {
  const source = canvas(width, height);
  const context = source.getContext('2d');
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.translate((random(variant + 4) - 0.5) * 0.8, (random(variant + 19) - 0.5) * 0.8);
  draw(context, variant);
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function sketchStroke(context, width = 2.2, color = INK) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
  context.save();
  context.globalAlpha = 0.22;
  context.translate(0.55, -0.35);
  context.lineWidth = Math.max(0.7, width * 0.38);
  context.stroke();
  context.restore();
}

function point(x, y) {
  return { x: x - WIDTH / 2, y: HEIGHT / 2 - y };
}

const parts = [];
function addPart(name, { width = WIDTH, height = HEIGHT, x = WIDTH / 2, y = HEIGHT / 2, z, draw, variants = 3, parent = portrait }) {
  const textures = Array.from({ length: variants }, (_, variant) => textureFrom(draw, width, height, variant));
  const material = new THREE.MeshBasicMaterial({ map: textures[0], transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  const group = new THREE.Group();
  const position = point(x, y);
  group.position.set(position.x, position.y, z);
  mesh.renderOrder = z * 10;
  group.add(mesh);
  parent.add(group);
  const part = { name, group, mesh, material, textures, baseX: position.x, baseY: position.y, offsetX: 0, offsetY: 0 };
  parts.push(part);
  return part;
}

function drawBackground(context) {
  context.fillStyle = '#e75c13';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  for (let index = 0; index < 230; index += 1) {
    const x = random(index + 1) * WIDTH;
    const y = random(index + 101) * HEIGHT;
    const length = 10 + random(index + 201) * 42;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + length * 0.3, y - 6, x + length * 0.6, y + 7, x + length, y + 1);
    context.strokeStyle = index % 3 === 0 ? '#f28a20' : '#c94317';
    context.globalAlpha = 0.2 + random(index + 301) * 0.18;
    context.lineWidth = 1 + random(index + 401) * 2;
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawBackHair(context, variant) {
  context.beginPath();
  context.moveTo(180, 68);
  context.bezierCurveTo(115, 75, 91, 133, 93, 210);
  context.bezierCurveTo(50, 280, 73, 353, 50, 432);
  context.bezierCurveTo(26, 493, 34, 554, 15, 590);
  context.bezierCurveTo(87, 600, 116, 560, 164, 563);
  context.lineTo(292, 563);
  context.bezierCurveTo(341, 559, 376, 602, 441, 591);
  context.bezierCurveTo(420, 545, 433, 496, 405, 435);
  context.bezierCurveTo(382, 355, 404, 288, 362, 209);
  context.bezierCurveTo(359, 127, 325, 80, 275, 70);
  context.closePath();
  context.fillStyle = HAIR;
  context.fill();
  sketchStroke(context, 3);

  context.strokeStyle = HAIR_DARK;
  context.lineWidth = 2;
  for (let index = 0; index < 24; index += 1) {
    const side = index < 12 ? -1 : 1;
    const lane = index % 12;
    const x = side < 0 ? 76 + lane * 7 : 379 - lane * 7;
    const phase = variant * 0.8 + lane;
    context.beginPath();
    context.moveTo(x, 225 + lane * 7);
    context.bezierCurveTo(x + side * (16 + Math.sin(phase) * 6), 315, x - side * 12, 405, x + side * 10, 535);
    context.stroke();
  }
}

function drawBody(context) {
  context.beginPath();
  context.moveTo(190, 401);
  context.lineTo(190, 528);
  context.bezierCurveTo(132, 541, 72, 563, 46, 620);
  context.lineTo(38, 666);
  context.lineTo(424, 666);
  context.lineTo(410, 614);
  context.bezierCurveTo(379, 558, 318, 539, 263, 526);
  context.lineTo(263, 401);
  context.closePath();
  context.fillStyle = SKIN;
  context.fill();
  sketchStroke(context, 2.6);

  context.beginPath();
  context.moveTo(187, 525);
  context.quadraticCurveTo(227, 558, 268, 525);
  context.bezierCurveTo(333, 539, 400, 569, 426, 666);
  context.lineTo(28, 666);
  context.bezierCurveTo(52, 574, 121, 541, 187, 525);
  context.closePath();
  context.fillStyle = '#c7d68f';
  context.fill();
  sketchStroke(context, 2.8);

  context.save();
  context.translate(227, 631);
  context.rotate(-0.05);
  context.font = '900 64px Arial Black, sans-serif';
  context.textAlign = 'center';
  context.strokeStyle = INK;
  context.lineWidth = 6;
  context.strokeText('CATS', 0, 20);
  context.fillStyle = '#ef5d16';
  context.fillText('CATS', 0, 20);
  context.restore();
}

function drawFace(context) {
  context.beginPath();
  context.moveTo(116, 184);
  context.bezierCurveTo(115, 123, 151, 91, 227, 91);
  context.bezierCurveTo(307, 91, 342, 126, 340, 190);
  context.lineTo(345, 287);
  context.bezierCurveTo(340, 363, 294, 419, 228, 435);
  context.bezierCurveTo(161, 420, 113, 367, 108, 288);
  context.closePath();
  context.fillStyle = SKIN;
  context.fill();
  sketchStroke(context, 2.8);

  context.fillStyle = '#f2b9c1';
  context.globalAlpha = 0.35;
  context.beginPath();
  context.ellipse(142, 328, 36, 15, -0.08, 0, Math.PI * 2);
  context.ellipse(313, 328, 36, 15, 0.08, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawEar(context, variant, direction) {
  context.save();
  if (direction < 0) context.scale(-1, 1);
  context.beginPath();
  context.moveTo(23, 18);
  context.bezierCurveTo(64, 4, 78, 38, 67, 67);
  context.bezierCurveTo(57, 96, 31, 87, 20, 61);
  context.bezierCurveTo(2, 49, 3, 26, 23, 18);
  context.closePath();
  context.fillStyle = SKIN;
  context.fill();
  sketchStroke(context, 2.5);
  context.beginPath();
  context.moveTo(28, 31);
  context.bezierCurveTo(55, 17, 62, 43, 47, 50);
  context.bezierCurveTo(29, 57, 42, 72, 53, 67);
  sketchStroke(context, 1.8, '#7d5057');
  context.fillStyle = '#f4c4c7';
  context.globalAlpha = 0.55;
  context.beginPath();
  context.ellipse(42 + variant * 0.2, 48, 18, 24, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.restore();
}

function drawHairFront(context, variant) {
  context.beginPath();
  context.moveTo(91, 226);
  context.bezierCurveTo(85, 140, 116, 82, 179, 68);
  context.quadraticCurveTo(182, 52, 177, 39);
  context.quadraticCurveTo(187, 51, 211, 45);
  context.quadraticCurveTo(229, 34, 248, 46);
  context.quadraticCurveTo(278, 52, 289, 39);
  context.quadraticCurveTo(298, 57, 286, 71);
  context.bezierCurveTo(337, 88, 367, 142, 363, 225);
  context.bezierCurveTo(350, 206, 344, 190, 339, 174);
  context.lineTo(333, 189);
  context.lineTo(311, 185);
  context.lineTo(290, 192);
  context.lineTo(268, 186);
  context.lineTo(245, 191);
  context.lineTo(219, 185);
  context.lineTo(190, 191);
  context.lineTo(165, 185);
  context.lineTo(139, 190);
  context.lineTo(113, 185);
  context.bezierCurveTo(107, 201, 101, 218, 91, 226);
  context.closePath();
  context.fillStyle = HAIR;
  context.fill();
  sketchStroke(context, 2.8);

  context.strokeStyle = HAIR_DARK;
  context.lineWidth = 1.7;
  for (let index = 0; index < 21; index += 1) {
    const x = 112 + index * 11.3;
    context.beginPath();
    context.moveTo(227 + (x - 227) * 0.35, 69 + Math.sin(index + variant) * 2);
    context.quadraticCurveTo(x - 5, 116, x, 181 - Math.abs(index - 10) * 0.25);
    context.stroke();
  }

  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(side < 0 ? 112 : 343, 192);
    context.bezierCurveTo(side < 0 ? 104 : 351, 242, side < 0 ? 110 : 345, 307, side < 0 ? 151 : 304, 357);
    context.bezierCurveTo(side < 0 ? 169 : 286, 378, side < 0 ? 174 : 281, 350, side < 0 ? 160 : 295, 340);
    sketchStroke(context, 6, HAIR);
    sketchStroke(context, 2.2, INK);
  }
}

function drawBrow(context, variant, direction) {
  context.translate(50, 22);
  if (direction < 0) context.scale(-1, 1);
  context.beginPath();
  context.moveTo(-38, 7 + variant * 0.2);
  context.quadraticCurveTo(-3, -8, 36, 5);
  sketchStroke(context, 2.1);
}

function eyeDrawer(state, direction) {
  return (context, variant) => {
    const cx = 65;
    const cy = 53;
    const open = Math.max(0.04, state.open);
    context.save();
    context.beginPath();
    context.moveTo(12, cy);
    context.bezierCurveTo(29, cy - 27 * open, 49, cy - 30 * open, 65, cy - 24 * open);
    context.bezierCurveTo(83, cy - 30 * open, 105, cy - 24 * open, 118, cy);
    context.bezierCurveTo(100, cy + 22 * open, 82, cy + 26 * open, 65, cy + 20 * open);
    context.bezierCurveTo(46, cy + 26 * open, 26, cy + 20 * open, 12, cy);
    context.closePath();
    context.fillStyle = '#fffdf8';
    context.fill();
    context.save();
    context.clip();
    const irisX = cx + state.gazeX + direction * 0.8;
    const irisY = cy + state.gazeY;
    context.fillStyle = GOLD;
    context.beginPath();
    context.ellipse(irisX, irisY, 17, 19 * open, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = INK;
    context.beginPath();
    context.ellipse(irisX, irisY, 9, 13 * open, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff7d5';
    context.beginPath();
    context.arc(irisX - 4, irisY - 5 * open, 3.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    sketchStroke(context, 2.8);

    const lashCount = 7;
    for (let index = 0; index < lashCount; index += 1) {
      const t = index / (lashCount - 1);
      const x = 20 + t * 88;
      const arch = Math.sin(t * Math.PI);
      context.beginPath();
      context.moveTo(x, cy - arch * 22 * open);
      context.lineTo(x + (t - 0.5) * 7, cy - arch * 22 * open - 11 * open);
      sketchStroke(context, 1.8);
      context.beginPath();
      context.moveTo(x, cy + arch * 18 * open);
      context.lineTo(x + (t - 0.5) * 5, cy + arch * 18 * open + 9 * open);
      sketchStroke(context, 1.5);
    }
    context.restore();
  };
}

function drawNose(context, variant) {
  context.fillStyle = BLUSH;
  context.globalAlpha = 0.42;
  context.beginPath();
  context.ellipse(39, 33, 17 + variant * 0.2, 15, -0.15, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
  context.beginPath();
  context.moveTo(27, 37);
  context.quadraticCurveTo(22, 46, 31, 48);
  context.moveTo(47, 48);
  context.quadraticCurveTo(57, 46, 51, 37);
  sketchStroke(context, 1.9);
}

function mouthDrawer(state) {
  return (context, variant) => {
    const open = state.mood === 1 ? 0.72 : state.mood === 2 ? 1.18 : 0.35;
    const lift = state.mood === 1 ? 7 : state.mood === 2 ? -2 : 0;
    context.translate(68, 43);
    context.beginPath();
    context.moveTo(-55, 2);
    context.bezierCurveTo(-34, -4 - lift, -19, -20, 0, -10);
    context.bezierCurveTo(18, -21, 35, -5 - lift, 55, 2);
    context.bezierCurveTo(32, 8 + lift, 16, 23 * open, 0, 25 * open);
    context.bezierCurveTo(-18, 23 * open, -34, 8 + lift, -55, 2);
    context.closePath();
    context.fillStyle = LIP;
    context.fill();
    sketchStroke(context, 2.5);
    context.beginPath();
    context.moveTo(-52, 2);
    context.quadraticCurveTo(0, 9 * open, 52, 2);
    sketchStroke(context, 1.7, '#7b3a58');
    context.fillStyle = '#ffe7e5';
    context.beginPath();
    context.ellipse(17, 10 * open, 13, 6, -0.25, 0, Math.PI * 2);
    context.fill();
  };
}

const background = addPart('background', { z: 0, draw: drawBackground, variants: 1, parent: scene });
const hairBack = addPart('back hair', { z: 1, draw: drawBackHair });
const body = addPart('body', { z: 2, draw: drawBody, variants: 1 });
const leftEar = addPart('left ear', { width: 82, height: 108, x: 82, y: 293, z: 3, draw: (context, variant) => drawEar(context, variant, 1) });
const rightEar = addPart('right ear', { width: 82, height: 108, x: 373, y: 293, z: 3, draw: (context, variant) => drawEar(context, variant, -1) });
const face = addPart('face', { z: 4, draw: drawFace });
const eyeState = { open: 1, gazeX: 0, gazeY: 0 };
const leftEye = addPart('left eye', { width: 130, height: 106, x: 169, y: 282, z: 6, draw: eyeDrawer(eyeState, -1), variants: 1 });
const rightEye = addPart('right eye', { width: 130, height: 106, x: 296, y: 282, z: 6, draw: eyeDrawer(eyeState, 1), variants: 1 });
const leftBrow = addPart('left brow', { width: 100, height: 44, x: 171, y: 234, z: 7, draw: (context, variant) => drawBrow(context, variant, 1) });
const rightBrow = addPart('right brow', { width: 100, height: 44, x: 294, y: 234, z: 7, draw: (context, variant) => drawBrow(context, variant, -1) });
const nose = addPart('nose', { width: 78, height: 70, x: 228, y: 331, z: 7, draw: drawNose });
const mouthState = { mood: 0 };
const mouth = addPart('mouth', { width: 136, height: 92, x: 228, y: 386, z: 8, draw: mouthDrawer(mouthState), variants: 1 });
const hairFront = addPart('front hair', { z: 9, draw: drawHairFront });

const dynamicParts = [leftEye, rightEye, mouth];
function redraw(part, draw) {
  const texture = part.material.map;
  const source = texture.image;
  const context = source.getContext('2d');
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, source.width, source.height);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  draw(context, 0);
  texture.needsUpdate = true;
}

function blinkAt(time, every, offset) {
  const phase = (time + offset) % every;
  if (phase > 0.22) return 1;
  return Math.max(0.04, Math.abs(phase - 0.11) / 0.11);
}

const pointer = { x: 0, y: 0, active: false };
mount.addEventListener('pointermove', (event) => {
  const bounds = mount.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
  pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  pointer.active = true;
});
mount.addEventListener('pointerleave', () => { pointer.active = false; });

let mood = 0;
function changeMood() {
  mood = (mood + 1) % 3;
  mouthState.mood = mood;
  redraw(mouth, mouthDrawer(mouthState));
}
mount.addEventListener('click', changeMood);
document.querySelector('#mood').addEventListener('click', changeMood);

let exploded = false;
const explodeOffsets = new Map([
  [hairBack, [-145, 8]], [body, [152, 85]], [leftEar, [-105, 12]], [rightEar, [105, 12]],
  [face, [0, -34]], [leftEye, [-115, -30]], [rightEye, [115, -30]],
  [leftBrow, [-125, -90]], [rightBrow, [125, -90]], [nose, [0, 70]],
  [mouth, [0, 135]], [hairFront, [0, -150]],
]);
document.querySelector('#layers').addEventListener('click', (event) => {
  exploded = !exploded;
  event.currentTarget.setAttribute('aria-pressed', String(exploded));
  event.currentTarget.textContent = exploded ? 'ASSEMBLE FACE' : 'EXPLODE LAYERS';
});

let previousDynamicFrame = -1;
let previousBoilFrame = -1;
function update(time) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionTime = reducedMotion && forcedTime === null ? 0 : time;
  const blink = Math.min(blinkAt(motionTime, 4.6, 0), blinkAt(motionTime, 7.3, 1.8));
  eyeState.open = blink;
  eyeState.gazeX = pointer.active ? pointer.x * 12 : Math.sin(motionTime * 0.72) * 9 + Math.sin(motionTime * 0.21) * 3;
  eyeState.gazeY = pointer.active ? pointer.y * 6 : Math.sin(motionTime * 0.47) * 4;

  const dynamicFrame = Math.floor(motionTime * 12);
  if (dynamicFrame !== previousDynamicFrame) {
    redraw(leftEye, eyeDrawer(eyeState, -1));
    redraw(rightEye, eyeDrawer(eyeState, 1));
    previousDynamicFrame = dynamicFrame;
  }

  const boilFrame = Math.floor(motionTime * 7);
  if (boilFrame !== previousBoilFrame) {
    for (const part of parts) {
      if (dynamicParts.includes(part) || part.textures.length === 1) continue;
      part.material.map = part.textures[boilFrame % part.textures.length];
    }
    previousBoilFrame = boilFrame;
  }

  portrait.scale.y = 1 + Math.sin(motionTime * 2.1) * 0.004;
  portrait.rotation.z = Math.sin(motionTime * 0.75) * 0.006;
  hairBack.group.rotation.z = Math.sin(motionTime * 0.8) * 0.009;
  hairFront.group.rotation.z = Math.sin(motionTime * 0.92 + 0.7) * 0.007;
  leftEar.group.rotation.z = Math.sin(motionTime * 1.3) * 0.018;
  rightEar.group.rotation.z = -leftEar.group.rotation.z;
  leftBrow.group.rotation.z = Math.sin(motionTime * 0.6) * 0.025 - mood * 0.02;
  rightBrow.group.rotation.z = -leftBrow.group.rotation.z;

  for (const part of parts) {
    if (part === background) continue;
    const [targetX, targetY] = exploded ? (explodeOffsets.get(part) ?? [0, 0]) : [0, 0];
    part.offsetX += (targetX - part.offsetX) * 0.1;
    part.offsetY += (targetY - part.offsetY) * 0.1;
    part.group.position.x = part.baseX + part.offsetX;
    part.group.position.y = part.baseY - part.offsetY;
  }
}

function render(time) {
  update(time);
  renderer.render(scene, camera);
}

const forcedTime = new URLSearchParams(window.location.search).get('t');
if (forcedTime === null) {
  renderer.setAnimationLoop((milliseconds) => render(milliseconds / 1000));
} else {
  render(Number(forcedTime));
}

document.body.dataset.ready = 'true';
window.__ANIMATED_SKETCH__ = {
  renderer: `three.js r${THREE.REVISION}`,
  layers: parts.map((part) => part.name),
  canvasTextures: parts.reduce((total, part) => total + part.textures.length, 0),
  dynamicTextures: dynamicParts.length,
};

window.addEventListener('beforeunload', () => {
  renderer.setAnimationLoop(null);
  for (const part of parts) {
    part.mesh.geometry.dispose();
    part.material.dispose();
    for (const texture of part.textures) texture.dispose();
  }
  renderer.dispose();
});
