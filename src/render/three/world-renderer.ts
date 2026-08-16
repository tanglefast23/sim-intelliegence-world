import {
  BufferGeometry,
  CanvasTexture,
  AdditiveBlending,
  ClampToEdgeWrapping,
  DoubleSide,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  NearestFilter,
  ACESFilmicToneMapping,
  NoToneMapping,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Uint32BufferAttribute,
  WebGLRenderer,
} from 'three';

import type {
  WorldCharacterPlacement,
  WorldFloorPlacement,
  WorldFrameState,
  WorldPropPlacement,
  WorldRoofPlacement,
  WorldWallPlacement,
} from '../world-frame';
import type { ToneMappingKind } from '../renderer-selection';
import { threeCameraBounds, threeDrawingBufferSize, threeQuadIndices, threeRasterViewport } from './coordinate-contract';

const TILE_SIZE = 32;

/**
 * Props that emit light. Glow is drawn at the sprite, so a lit room reads as lit wherever the
 * player is standing, rather than only near the map's three fixed district pools.
 */
const LAMP_SPRITE_IDS: ReadonlySet<string> = new Set([
  'tile.fixture-lamp',
  'tile.fixture-dock-lamp-amber',
  'tile.fixture-dock-lamp-cold',
  'tile.fixture-festival-lantern',
  'tile.fixture-neon-lamp-cyan',
  'tile.fixture-neon-lamp-magenta',
]);
const LAMP_GLOW_RADIUS = 44;

/** Handoff technique 6: silhouette shadow tint, opacity and offset, in logical pixels. */
const SPRITE_SHADOW_COLOR = '#111519';
const SPRITE_SHADOW_OPACITY = 0.48;
const SPRITE_SHADOW_OFFSET_X = 3;
const SPRITE_SHADOW_OFFSET_Y = 3;
/** Stage 4 recorded ACES calibration value, not a hidden magic number. */
export const ACES_EXPOSURE = 1;
const COMPOSITE_BATCHES = [
  'floor-and-ground-detail',
  'doors',
  'door-wear',
  'contact-shadows-and-thresholds',
  // Handoff technique 6: a tinted copy of each grounded sprite, offset, so the shadow follows the
  // real pixel silhouette instead of a generic blob. This is what gives furniture and characters
  // contact with the floor and makes their edges read as sharper.
  'sprite-shadows',
  'selection-ring',
  'grounded-props-and-characters',
  'effects',
  // Lamp glow lights the room it is in, so it must sit under walls and roofs. Drawn after the
  // district pools it would paint over a roof, which is what made interior lamps glow through it.
  'lamp-glow',
  'walls',
  'wall-bases',
  'roofs',
  'shelter-shade',
  'district-shadows',
  'district-light-pools',
  'atmosphere',
  'destination-pulse',
  'journal-markers',
  'failure-marker',
] as const;
type BatchId = typeof COMPOSITE_BATCHES[number];

type AtlasPlacement = WorldFloorPlacement | WorldPropPlacement | WorldCharacterPlacement | WorldWallPlacement | WorldRoofPlacement;
type GeometryData = Readonly<{
  positions: number[];
  uvs: number[];
  tints: number[];
  indices: number[];
}>;

const emptyGeometryData = (): GeometryData => ({ positions: [], uvs: [], tints: [], indices: [] });

function rgba(color: string, opacity = 1): readonly [number, number, number, number] {
  const normalized = color.startsWith('#') ? color.slice(1) : color;
  const rgb = normalized.length >= 6 ? normalized.slice(0, 6) : 'ffffff';
  const alpha = normalized.length === 8 ? Number.parseInt(normalized.slice(6), 16) / 255 : 1;
  const parsed = new Color(`#${rgb}`);
  // Keep float alpha. The browser composites the legacy overlays without quantizing to 8 bits,
  // so rounding here introduced a systematic error wherever translucent quads stack.
  return [parsed.r, parsed.g, parsed.b, alpha * opacity];
}

function addQuad(
  data: GeometryData,
  points: readonly [number, number][],
  color: string,
  opacity = 1,
  uv: readonly [number, number, number, number] = [0, 0, 1, 1],
): void {
  const base = data.positions.length / 3;
  for (const [x, y] of points) data.positions.push(x, -y, 0);
  const [u0, v0, u1, v1] = uv;
  data.uvs.push(u0, v1, u1, v1, u1, v0, u0, v0);
  const tint = rgba(color, opacity);
  for (let index = 0; index < 4; index += 1) data.tints.push(...tint);
  data.indices.push(...threeQuadIndices(base));
}

/** Mote positions as viewport percentages, matching the legacy atmosphere overlay. */
const ATMOSPHERE_MOTES: readonly (readonly [number, number])[] = Object.freeze([
  [18, 24], [36, 64], [58, 31], [74, 53], [87, 18],
] as const);

/**
 * Rebuilds the legacy atmosphere drift from a sampled timestamp.
 * The overlay looped 0 to 1 over 3800 ms then back over 4600 ms, easing in and out of a sine.
 */
function atmosphereDrift(timestampMilliseconds: number): number {
  const inOutSin = (t: number): number => (
    t < 0.5 ? (1 - Math.cos(t * Math.PI)) / 2 : 1 - (1 - Math.cos((1 - t) * Math.PI)) / 2
  );
  const phase = ((timestampMilliseconds % 8_400) + 8_400) % 8_400;
  return phase < 3_800
    ? inOutSin(phase / 3_800)
    : 1 - inOutSin((phase - 3_800) / 4_600);
}

function addRect(data: GeometryData, x: number, y: number, width: number, height: number, color: string, opacity = 1): void {
  addQuad(data, [[x, y], [x + width, y], [x + width, y + height], [x, y + height]], color, opacity);
}

function addLine(
  data: GeometryData,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
  roundCaps = false,
): void {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length === 0) return;
  const px = -(y2 - y1) * width / length / 2;
  const py = (x2 - x1) * width / length / 2;
  addQuad(data, [[x1 + px, y1 + py], [x2 + px, y2 + py], [x2 - px, y2 - py], [x1 - px, y1 - py]], color);
  if (roundCaps) {
    addEllipse(data, x1, y1, width / 2, width / 2, color);
    addEllipse(data, x2, y2, width / 2, width / 2, color);
  }
}

function addEllipse(
  data: GeometryData,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string,
  opacity = 1,
  strokeWidth = 0,
): void {
  const segments = 32;
  if (strokeWidth > 0) {
    const innerRadiusX = Math.max(0, radiusX - strokeWidth / 2);
    const innerRadiusY = Math.max(0, radiusY - strokeWidth / 2);
    const outerRadiusX = radiusX + strokeWidth / 2;
    const outerRadiusY = radiusY + strokeWidth / 2;
    for (let index = 0; index < segments; index += 1) {
      const start = index * Math.PI * 2 / segments;
      const end = (index + 1) * Math.PI * 2 / segments;
      addQuad(data, [
        [centerX + Math.cos(start) * innerRadiusX, centerY + Math.sin(start) * innerRadiusY],
        [centerX + Math.cos(start) * outerRadiusX, centerY + Math.sin(start) * outerRadiusY],
        [centerX + Math.cos(end) * outerRadiusX, centerY + Math.sin(end) * outerRadiusY],
        [centerX + Math.cos(end) * innerRadiusX, centerY + Math.sin(end) * innerRadiusY],
      ], color, opacity);
    }
    return;
  }
  const center = data.positions.length / 3;
  data.positions.push(centerX, -centerY, 0);
  data.uvs.push(0.5, 0.5);
  data.tints.push(...rgba(color, opacity));
  for (let index = 0; index <= segments; index += 1) {
    const angle = index * Math.PI * 2 / segments;
    data.positions.push(centerX + Math.cos(angle) * radiusX, -(centerY + Math.sin(angle) * radiusY), 0);
    data.uvs.push(0.5 + Math.cos(angle) / 2, 0.5 - Math.sin(angle) / 2);
    data.tints.push(...rgba(color, opacity));
    if (index > 0) data.indices.push(center, center + index + 1, center + index);
  }
}

function addAtlasPlacement(data: GeometryData, placement: AtlasPlacement, atlasWidth: number, atlasHeight: number): void {
  const width = placement.source.width * placement.scale;
  const height = placement.source.height * placement.scale;
  const radians = placement.rotationDegrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const pivotX = placement.pivot.x * placement.scale;
  const pivotY = placement.pivot.y * placement.scale;
  const point = (x: number, y: number): [number, number] => {
    const localX = x - pivotX;
    const localY = y - pivotY;
    return [
      placement.worldX + pivotX + cosine * localX - sine * localY,
      placement.worldY + pivotY + sine * localX + cosine * localY,
    ];
  };
  addQuad(
    data,
    [point(0, 0), point(width, 0), point(width, height), point(0, height)],
    placement.color,
    placement.opacity,
    [
      placement.source.x / atlasWidth,
      1 - (placement.source.y + placement.source.height) / atlasHeight,
      (placement.source.x + placement.source.width) / atlasWidth,
      1 - placement.source.y / atlasHeight,
    ],
  );
}

/**
 * Additive light must not be tone mapped.
 *
 * ACES(floor) + ACES(glow) is not ACES(floor + glow). Running the curve on the glow before adding
 * it clips overlapping lamps and shifts their hue. Three.js only injects the tone-mapping chunk
 * when a material opts in, so the additive material leaves it out and adds linear light instead.
 */
function shaderMaterial(texture?: Texture, matchLegacyColors = false, additive = false): ShaderMaterial {
  const legacyColorTransform = matchLegacyColors ? `
        gl_FragColor.rgb = mat3(
          1.2249401, -0.0420569, -0.0196376,
          -0.2249404, 1.0420571, -0.0786361,
          0.0, 0.0, 1.0982735
        ) * gl_FragColor.rgb;
  ` : '';
  return new ShaderMaterial({
    // Lamp glow must ADD light to the floor. Alpha blending can only tint toward a colour, which
    // is why the shipped glow read as nothing while the spike's additive glow read as light.
    ...(additive ? { blending: AdditiveBlending, toneMapped: false } : {}),
    depthTest: false,
    depthWrite: false,
    // addLine emits its quad wound by segment direction, so a line running the other way is
    // back-facing. FrontSide culled those quads and left only the round caps, which is why the
    // failure marker's X rendered as four corner blobs with a hole through the middle.
    side: DoubleSide,
    transparent: true,
    uniforms: texture ? { map: { value: texture } } : {},
    vertexShader: `
      attribute vec4 tint;
      varying vec2 vUv;
      varying vec4 vTint;
      void main() {
        vUv = uv;
        vTint = tint;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: texture ? `
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec4 vTint;
      void main() {
        vec4 sampled = texture2D(map, vUv);
        gl_FragColor = sampled * vTint;
        ${legacyColorTransform}
        if (gl_FragColor.a <= 0.001) discard;
        ${additive ? '' : '#include <tonemapping_fragment>'}
        #include <colorspace_fragment>
      }
    ` : `
      varying vec4 vTint;
      void main() {
        gl_FragColor = vTint;
        ${legacyColorTransform}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function updateGeometry(geometry: BufferGeometry, data: GeometryData): void {
  const sameSize = geometry.getAttribute('position')?.count === data.positions.length / 3 &&
    geometry.getIndex()?.count === data.indices.length;
  if (!sameSize) {
    geometry.dispose();
    geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(data.uvs, 2));
    geometry.setAttribute('tint', new Float32BufferAttribute(data.tints, 4));
    geometry.setIndex(new Uint32BufferAttribute(data.indices, 1));
  } else {
    (geometry.getAttribute('position') as Float32BufferAttribute).copyArray(data.positions);
    (geometry.getAttribute('uv') as Float32BufferAttribute).copyArray(data.uvs);
    (geometry.getAttribute('tint') as Float32BufferAttribute).copyArray(data.tints);
    (geometry.getIndex() as Uint32BufferAttribute).copyArray(data.indices);
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('uv').needsUpdate = true;
    geometry.getAttribute('tint').needsUpdate = true;
    if (geometry.getIndex()) geometry.getIndex()!.needsUpdate = true;
  }
  geometry.setDrawRange(0, data.indices.length);
}

function generatedGlowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The generated glow canvas is unavailable.');
  // A solid disc reads as a flat bright circle once blended additively. Real lamp light falls off
  // smoothly, so this is a radial gradient that reaches zero at the rim. The curve is weighted so
  // most of the falloff happens in the outer half, which is what makes it look diffuse rather
  // than like a disc with a soft edge.
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [stop, alpha] of [
    [0, 1], [0.15, 0.92], [0.3, 0.74], [0.45, 0.52], [0.6, 0.32], [0.75, 0.16], [0.88, 0.05], [1, 0],
  ] as const) {
    gradient.addColorStop(stop, `rgba(255, 255, 255, ${alpha})`);
  }
  context.fillStyle = gradient;
  context.beginPath();
  // The rim UVs sit on the radius-32 circle, so fill to 32 or every pool fades early.
  context.arc(32, 32, 32, 0, Math.PI * 2);
  context.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  return texture;
}

export type ThreeRendererEvidence = Readonly<{
  rendererKind: 'threejs-2d';
  webgl2: true;
  toneMapping: ToneMappingKind;
  explicitSort: true;
  legacyColorParity: boolean;
  drawCalls: number;
  atlasDrawCalls: number;
  textures: number;
  materials: number;
  geometries: number;
  gpu: Readonly<{
    drawCalls: number;
    geometries: number;
    programs: number;
    textures: number;
  }>;
  atlasSize: Readonly<{ width: number; height: number }>;
  atlasSampling: Readonly<{
    magFilter: 'nearest';
    minFilter: 'nearest';
    generateMipmaps: false;
    anisotropy: 1;
    wrapS: 'clamp-to-edge';
    wrapT: 'clamp-to-edge';
  }>;
  presentedZoom: number | null;
  trianglesByBatch: Readonly<Record<string, number>>;
}>;

export class ThreeWorldRenderer {
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera = new OrthographicCamera();
  readonly #geometries = new Map<BatchId, BufferGeometry>();
  readonly #meshes = new Map<BatchId, Mesh>();
  readonly #atlasTexture: Texture;
  readonly #glowTexture: CanvasTexture;
  readonly #materials: readonly ShaderMaterial[];
  readonly #atlasWidth: number;
  readonly #atlasHeight: number;
  readonly #matchLegacyColors: boolean;
  #latestFrame?: WorldFrameState;
  #presentedFrame?: WorldFrameState;
  #animationFrame = 0;
  #lost = false;
  #timedOut = false;
  #restorePending = false;
  #ready = false;
  #disposed = false;
  #lossTimer?: ReturnType<typeof setTimeout>;

  private constructor(
    readonly canvas: HTMLCanvasElement,
    renderer: WebGLRenderer,
    atlasTexture: Texture,
    glowTexture: CanvasTexture,
    matchLegacyColors: boolean,
    private readonly onReady: () => void,
    private readonly onContextStateChange: (state: 'lost' | 'restored' | 'timed-out') => void,
  ) {
    this.#renderer = renderer;
    this.#atlasTexture = atlasTexture;
    this.#glowTexture = glowTexture;
    this.#matchLegacyColors = matchLegacyColors;
    const image = atlasTexture.image as Readonly<{ naturalHeight?: number; naturalWidth?: number; height?: number; width?: number }>;
    this.#atlasWidth = image.naturalWidth ?? image.width ?? 1;
    this.#atlasHeight = image.naturalHeight ?? image.height ?? 1;
    const atlasMaterial = shaderMaterial(atlasTexture, matchLegacyColors);
    const primitiveMaterial = shaderMaterial(undefined, matchLegacyColors);
    const glowMaterial = shaderMaterial(glowTexture, false, true);
    // The legacy atmosphere was plain React Native Views composited by the browser as sRGB CSS,
    // never through a Skia surface, so the legacy P3 matrix must not apply to it. Applying it
    // shifted the whole frame by about one count, because the wash covers every pixel.
    const overlayMaterial = shaderMaterial(undefined, false);
    this.#materials = [atlasMaterial, primitiveMaterial, glowMaterial, overlayMaterial];
    const atlasBatches = new Set<BatchId>(['floor-and-ground-detail', 'doors', 'grounded-props-and-characters', 'walls', 'roofs']);
    COMPOSITE_BATCHES.forEach((id, renderOrder) => {
      const geometry = new BufferGeometry();
      const material = atlasBatches.has(id)
        ? atlasMaterial
        : id === 'sprite-shadows' ? atlasMaterial
        : id === 'district-light-pools' || id === 'lamp-glow' ? glowMaterial
          : id === 'atmosphere' ? overlayMaterial : primitiveMaterial;
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = renderOrder;
      this.#geometries.set(id, geometry);
      this.#meshes.set(id, mesh);
      this.#scene.add(mesh);
    });
    canvas.addEventListener('webglcontextlost', this.#handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.#handleContextRestored);
  }

  static async create(
    canvas: HTMLCanvasElement,
    atlasUrl: string,
    matchLegacyColors: boolean,
    onReady: () => void,
    onContextStateChange: (state: 'lost' | 'restored' | 'timed-out') => void,
    toneMapping: ToneMappingKind = 'none',
  ): Promise<ThreeWorldRenderer> {
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    if (!context) throw new Error('Three.js requires WebGL 2.');
    const renderer = new WebGLRenderer({ canvas, context, alpha: false, antialias: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = SRGBColorSpace;
    // Stage 4 enables ACES in production. Exposure is a recorded calibration value.
    renderer.toneMapping = toneMapping === 'aces' ? ACESFilmicToneMapping : NoToneMapping;
    renderer.toneMappingExposure = ACES_EXPOSURE;
    renderer.sortObjects = false;
    renderer.setClearColor('#b77945', 1);
    const atlasTexture = await new TextureLoader().loadAsync(atlasUrl);
    atlasTexture.colorSpace = SRGBColorSpace;
    atlasTexture.magFilter = NearestFilter;
    atlasTexture.minFilter = NearestFilter;
    atlasTexture.generateMipmaps = false;
    atlasTexture.anisotropy = 1;
    atlasTexture.wrapS = ClampToEdgeWrapping;
    atlasTexture.wrapT = ClampToEdgeWrapping;
    return new ThreeWorldRenderer(canvas, renderer, atlasTexture, generatedGlowTexture(), matchLegacyColors, onReady, onContextStateChange);
  }

  setFrame(frame: WorldFrameState): void {
    this.#latestFrame = frame;
  }

  start(): void {
    if (this.#animationFrame !== 0 || this.#disposed) return;
    const present = () => {
      try {
        if (!this.#lost && !this.#timedOut && this.#latestFrame) {
          if (this.#presentedFrame !== this.#latestFrame) {
            this.#update(this.#latestFrame);
            this.#presentedFrame = this.#latestFrame;
          }
          this.#renderer.render(this.#scene, this.#camera);
          if (!this.#ready) {
            this.#ready = true;
            this.onReady();
          }
          if (this.#restorePending) {
            this.#restorePending = false;
            this.onContextStateChange('restored');
          }
        }
      } catch (error) {
        this.#timedOut = true;
        this.onContextStateChange('timed-out');
        console.error(`SI_WORLD_THREE_RENDERER_FRAME_FAILURE ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.#animationFrame = this.#disposed ? 0 : requestAnimationFrame(present);
      }
    };
    this.#animationFrame = requestAnimationFrame(present);
  }

  evidence(): ThreeRendererEvidence {
    if (this.#atlasTexture.magFilter !== NearestFilter || this.#atlasTexture.minFilter !== NearestFilter ||
        this.#atlasTexture.generateMipmaps !== false || this.#atlasTexture.anisotropy !== 1 ||
        this.#atlasTexture.wrapS !== ClampToEdgeWrapping || this.#atlasTexture.wrapT !== ClampToEdgeWrapping) {
      throw new Error('Atlas sampling contract changed.');
    }
    return {
      rendererKind: 'threejs-2d',
      webgl2: true,
      toneMapping: this.#renderer.toneMapping === ACESFilmicToneMapping ? 'aces' : 'none',
      explicitSort: true,
      legacyColorParity: this.#matchLegacyColors,
      drawCalls: COMPOSITE_BATCHES.filter((id) => this.#geometries.get(id)!.drawRange.count > 0).length,
      atlasDrawCalls: ['floor-and-ground-detail', 'doors', 'grounded-props-and-characters', 'walls', 'roofs']
        .filter((id) => this.#geometries.get(id as BatchId)!.drawRange.count > 0).length,
      textures: [this.#atlasTexture, this.#glowTexture].length,
      materials: this.#materials.length,
      geometries: this.#geometries.size,
      gpu: {
        drawCalls: this.#renderer.info.render.calls,
        geometries: this.#renderer.info.memory.geometries,
        programs: this.#renderer.info.programs?.length ?? 0,
        textures: this.#renderer.info.memory.textures,
      },
      atlasSize: { width: this.#atlasWidth, height: this.#atlasHeight },
      atlasSampling: {
        magFilter: 'nearest',
        minFilter: 'nearest',
        generateMipmaps: false,
        anisotropy: 1,
        wrapS: 'clamp-to-edge',
        wrapT: 'clamp-to-edge',
      },
      presentedZoom: this.#presentedFrame?.camera.zoom ?? null,
      trianglesByBatch: Object.fromEntries(COMPOSITE_BATCHES.map((id) => [id, this.#geometries.get(id)!.drawRange.count / 3])),
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#animationFrame !== 0) cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = 0;
    if (this.#lossTimer) clearTimeout(this.#lossTimer);
    this.canvas.removeEventListener('webglcontextlost', this.#handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.#handleContextRestored);
    this.#geometries.forEach((geometry) => geometry.dispose());
    this.#materials.forEach((material) => material.dispose());
    this.#atlasTexture.dispose();
    this.#glowTexture.dispose();
    this.#renderer.dispose();
  }

  readonly #handleContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.#lost || this.#timedOut) return;
    this.#lost = true;
    this.onContextStateChange('lost');
    this.#lossTimer = setTimeout(() => {
      this.#timedOut = true;
      this.onContextStateChange('timed-out');
    }, 10_000);
  };

  readonly #handleContextRestored = (): void => {
    if (this.#lossTimer) clearTimeout(this.#lossTimer);
    if (this.#timedOut) return;
    this.#lost = false;
    this.#restorePending = true;
    this.#presentedFrame = undefined;
    this.#atlasTexture.needsUpdate = true;
    this.#glowTexture.needsUpdate = true;
  };

  #set(id: BatchId, data: GeometryData): void {
    updateGeometry(this.#geometries.get(id)!, data);
  }

  #update(frame: WorldFrameState): void {
    const { camera, viewport } = frame;
    const drawingBuffer = threeDrawingBufferSize(viewport, frame.devicePixelRatio);
    this.#renderer.setPixelRatio(1);
    this.#renderer.setSize(drawingBuffer.width, drawingBuffer.height, false);
    const bounds = threeCameraBounds(camera, threeRasterViewport(viewport, frame.devicePixelRatio));
    this.#camera.left = bounds.left;
    this.#camera.right = bounds.right;
    this.#camera.top = bounds.top;
    this.#camera.bottom = bounds.bottom;
    this.#camera.near = -1;
    this.#camera.far = 1;
    this.#camera.updateProjectionMatrix();

    const atlas = (...placements: ReadonlyArray<readonly AtlasPlacement[]>): GeometryData => {
      const data = emptyGeometryData();
      placements.flat().forEach((placement) => addAtlasPlacement(data, placement, this.#atlasWidth, this.#atlasHeight));
      return data;
    };
    this.#set('floor-and-ground-detail', atlas(frame.floors, frame.groundDetails));
    this.#set('doors', atlas(frame.doors));
    const props = new Map(frame.props.map((placement) => [placement.id, placement]));
    const characters = new Map(frame.characters.map((placement) => [placement.id, placement]));
    const groundedPlacements = frame.groundedOrder.flatMap((entry) => {
      const placement = entry.kind === 'prop' ? props.get(entry.id) : characters.get(entry.id);
      return placement ? [placement] : [];
    });
    // Handoff technique 6. The offset and tint are the spike's, converted from its world units to
    // logical pixels. Every value comes from the placement already in the frame.
    this.#set('sprite-shadows', atlas(groundedPlacements.map((placement) => ({
      ...placement,
      color: SPRITE_SHADOW_COLOR,
      opacity: SPRITE_SHADOW_OPACITY,
      worldX: placement.worldX + SPRITE_SHADOW_OFFSET_X,
      worldY: placement.worldY + SPRITE_SHADOW_OFFSET_Y,
    }))));
    this.#set('grounded-props-and-characters', atlas(groundedPlacements));
    this.#set('walls', atlas(frame.walls));
    this.#set('roofs', atlas(frame.roofs));

    const doorWear = emptyGeometryData();
    frame.doorWear.forEach((door) => {
      const horizontal = door.horizontal;
      addLine(doorWear,
        door.worldX + (horizontal ? 5 : 24), door.worldY + (horizontal ? 29 : 6),
        door.worldX + (horizontal ? 15 : 27), door.worldY + (horizontal ? 31 : 16),
        2, door.darkColor, true);
      addLine(doorWear,
        door.worldX + (horizontal ? 17 : 27), door.worldY + (horizontal ? 28 : 18),
        door.worldX + (horizontal ? 25 : 25), door.worldY + (horizontal ? 30 : 26),
        1, door.lightColor, true);
    });
    this.#set('door-wear', doorWear);

    const shadows = emptyGeometryData();
    frame.propShadows.forEach((shadow) => {
      const centerX = shadow.worldX + shadow.width / 2;
      if (shadow.long) addLine(shadows, centerX, shadow.worldY, centerX + frame.lighting.shadow.x, shadow.worldY + frame.lighting.shadow.y, 4, frame.lighting.shadow.color, true);
      addRect(shadows, shadow.worldX, shadow.worldY, shadow.width, 4, shadow.color);
    });
    frame.thresholds.forEach((door) => {
      addRect(shadows, door.worldX + 3, door.worldY + 26, 26, 5, door.darkColor);
      addRect(shadows, door.worldX + 6, door.worldY + 26, 20, 1, door.lightColor);
    });
    frame.characterShadows.forEach((character) => {
      addLine(shadows, character.worldX + 5, character.worldY + 1, character.worldX + character.castX, character.worldY + character.castY, 9, frame.lighting.shadow.color, true);
      addEllipse(shadows, character.worldX + 7, character.worldY + 3.5, 11, 3.5, character.color);
    });
    this.#set('contact-shadows-and-thresholds', shadows);

    const selection = emptyGeometryData();
    addEllipse(selection, frame.selectionRing.worldX, frame.selectionRing.worldY, frame.selectionRing.radiusX, frame.selectionRing.radiusY, frame.selectionRing.color, 1, frame.selectionRing.strokeWidth / camera.zoom);
    this.#set('selection-ring', selection);

    const effects = emptyGeometryData();
    frame.effects.forEach((geometry) => geometry.rects.forEach((rectangle) => addRect(
      effects,
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
      frame.effectRoleColors[rectangle.role],
    )));
    frame.fallbackEffects.forEach((effect) => addEllipse(effects, effect.worldX, effect.worldY, 3, 3, effect.color));
    this.#set('effects', effects);

    const wallBases = emptyGeometryData();
    frame.wallBases.forEach((wall) => {
      addRect(wallBases, wall.worldX + 1, wall.worldY + 26, 30, 5, wall.darkColor);
      addRect(wallBases, wall.worldX + 3, wall.worldY + 26, 26, 1, wall.lightColor);
    });
    this.#set('wall-bases', wallBases);

    const shelter = emptyGeometryData();
    frame.shelterCells.forEach((cell) => addRect(shelter, cell.x * TILE_SIZE, cell.y * TILE_SIZE, cell.width * TILE_SIZE, cell.height * TILE_SIZE, frame.lighting.shelterShade));
    this.#set('shelter-shade', shelter);

    // Stage 4 owns district lighting on the Three.js path. The legacy overlay drew in screen
    // pixels, so every screen length divides by zoom to reach world units.
    const lighting = frame.lighting;
    const districtShadows = emptyGeometryData();
    lighting.casters.forEach((caster) => {
      const footX = caster.x * TILE_SIZE + TILE_SIZE / 2;
      const footY = caster.y * TILE_SIZE + TILE_SIZE / 2;
      addLine(
        districtShadows,
        footX,
        footY,
        footX + lighting.shadow.x * 1.5,
        footY + lighting.shadow.y * 1.5,
        5,
        lighting.shadow.color,
        true,
      );
    });
    this.#set('district-shadows', districtShadows);

    const pools = emptyGeometryData();
    lighting.pools.forEach((pool) => {
      const centerX = pool.x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = pool.y * TILE_SIZE + TILE_SIZE / 2;
      const radius = pool.radius;
      ([[1.18, 0.58, 0.18], [0.72, 0.34, 0.45], [0.38, 0.17, 0.8]] as const).forEach(
        ([scaleX, scaleY, opacityScale]) => {
          addEllipse(
            pools,
            centerX,
            centerY,
            radius * scaleX,
            radius * scaleY,
            lighting.accent,
            lighting.poolOpacity * opacityScale,
          );
        },
      );
    });
    this.#set('district-light-pools', pools);

    const lampGlow = emptyGeometryData();
    // The spike put its glow ON each lamp sprite, which is what made the room read as lit. The
    // district pools are three fixed points per map and need not sit near the lamps in the room
    // the player is standing in, so lamp props contribute their own glow here.
    //
    // Every value comes from the frame: the prop list, its sprite id and its world position. No
    // new content, no randomness, no clock of its own.
    // Glow is clipped so light cannot arrive from somewhere the player cannot see.
    //
    // An unclipped quad is 88 world pixels wide, so a 44 pixel halo crosses a 32 pixel wall into
    // the next room. Two rules fix that: a lamp under a roof the player has not entered emits
    // nothing, and when the player is inside a room the remaining glow is clipped to that room's
    // cells. Clipping emits the intersection with adjusted UVs, so the falloff stays correct.
    const inCells = (
      cells: readonly Readonly<{ x: number; y: number; width: number; height: number }>[],
      tileX: number,
      tileY: number,
    ): boolean => cells.some((cell) => (
      tileX >= cell.x && tileX < cell.x + cell.width && tileY >= cell.y && tileY < cell.y + cell.height
    ));

    frame.props.forEach((prop) => {
      if (!LAMP_SPRITE_IDS.has(prop.sprite)) return;
      if (inCells(frame.roofedCells, prop.tile.x, prop.tile.y)) return;
      const centerX = prop.worldX + prop.source.width / 2;
      const centerY = prop.worldY + prop.source.height / 2;
      const radius = LAMP_GLOW_RADIUS;
      const left = centerX - radius;
      const top = centerY - radius;
      const span = radius * 2;
      const clips = frame.shelterCells.length > 0
        ? frame.shelterCells.map((cell) => ({
          left: cell.x * TILE_SIZE,
          top: cell.y * TILE_SIZE,
          right: (cell.x + cell.width) * TILE_SIZE,
          bottom: (cell.y + cell.height) * TILE_SIZE,
        }))
        : [{ left, top, right: left + span, bottom: top + span }];
      clips.forEach((clip) => {
        const x0 = Math.max(left, clip.left);
        const y0 = Math.max(top, clip.top);
        const x1 = Math.min(left + span, clip.right);
        const y1 = Math.min(top + span, clip.bottom);
        if (x1 <= x0 || y1 <= y0) return;
        addQuad(
          lampGlow,
          [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
          lighting.accent,
          lighting.lampGlowOpacity,
          [(x0 - left) / span, (y0 - top) / span, (x1 - left) / span, (y1 - top) / span],
        );
      });
    });
    this.#set('lamp-glow', lampGlow);

    // Stage 4 owns the atmosphere treatment. The legacy overlay was viewport-relative, so the
    // wash, edge shades, and motes are converted from screen space through the camera.
    const atmosphere = emptyGeometryData();
    const screenRect = (
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      color: string,
      opacity: number,
    ): void => {
      addRect(
        atmosphere,
        camera.x + sx / camera.zoom,
        camera.y + sy / camera.zoom,
        sw / camera.zoom,
        sh / camera.zoom,
        color,
        opacity,
      );
    };
    const width = viewport.width;
    const height = viewport.height;
    screenRect(0, 0, width, height, frame.atmosphere.wash, 1);
    screenRect(0, 0, width, 16, frame.atmosphere.shade, 0.25);
    screenRect(0, height - 22, width, 22, frame.atmosphere.shade, 0.34);
    screenRect(0, 0, 16, height, frame.atmosphere.shade, 0.18);
    screenRect(width - 16, 0, 16, height, frame.atmosphere.shade, 0.18);
    // Reduced motion is the qualified packaged path: fixed opacity and no drift.
    // Otherwise the drift is rebuilt from the controller-sampled timestamp, so the renderer
    // still owns no clock of its own.
    const drift = frame.reducedMotion ? 0 : atmosphereDrift(frame.animationTimestampMilliseconds);
    const moteOpacity = frame.reducedMotion ? 0.28 : 0.18 + drift * 0.54;
    const moteShift = frame.reducedMotion ? 0 : drift * -8;
    ATMOSPHERE_MOTES.forEach(([leftPercent, topPercent]) => {
      screenRect(
        (leftPercent / 100) * width,
        (topPercent / 100) * height + moteShift,
        2,
        2,
        frame.atmosphere.accent,
        moteOpacity,
      );
    });
    this.#set('atmosphere', atmosphere);

    // Stage 4 owns feedback now that the React lighting and atmosphere overlays no longer mount
    // on this path, so these batches composite above them exactly as the locked order requires.
    // Skia drew the ring and pin scaled by zoom, but the failure X in fixed screen pixels.
    // Stage 5: the shared Skia feedback overlay no longer mounts on this path, because keeping it
    // would force the default path to load CanvasKit. Three.js owns lighting and atmosphere since
    // Stage 4, so these batches sit last in the composite order and land above both, exactly as
    // the locked order requires. Skia snapped every anchor to a whole screen pixel via
    // worldToScreen, so the same lattice is reproduced here.
    const snapWorld = (worldX: number, worldY: number): readonly [number, number] => [
      camera.x + Math.round((worldX - camera.x) * camera.zoom) / camera.zoom,
      camera.y + Math.round((worldY - camera.y) * camera.zoom) / camera.zoom,
    ];

    const destination = emptyGeometryData();
    if (frame.destinationPulse) {
      const pulse = frame.destinationPulse;
      const [px, py] = snapWorld(pulse.worldX, pulse.worldY);
      addEllipse(destination, px, py, pulse.radius, pulse.radius, pulse.color, pulse.opacity, 1);
    }
    this.#set('destination-pulse', destination);

    const journal = emptyGeometryData();
    frame.journalMarkers.forEach((marker) => {
      const [footX, footY] = snapWorld(marker.tile.x * TILE_SIZE + 16, marker.tile.y * TILE_SIZE + 29);
      const centerX = footX - 10;
      const centerY = footY - 30;
      addLine(journal, centerX, centerY + 4, footX - 4, footY - 5, 4, marker.darkColor);
      addLine(journal, centerX, centerY + 4, footX - 4, footY - 5, 2, marker.lightColor);
      addEllipse(journal, centerX, centerY, 7, 7, marker.darkColor);
      addEllipse(journal, centerX, centerY, 5, 5, marker.lightColor);
      addEllipse(journal, centerX, centerY, 2, 2, marker.darkColor);
    });
    this.#set('journal-markers', journal);

    const failure = emptyGeometryData();
    if (frame.failureMarker) {
      const marker = frame.failureMarker;
      const [fx, fy] = snapWorld(marker.worldX, marker.worldY);
      const radius = marker.radiusPixels / camera.zoom;
      const strokeWidth = 3 / camera.zoom;
      // Skia antialiased this diagonal, so a hard-edged stroke of the same width fills fewer
      // pixels inside the locked mask, dropping its median below the contrast floor.
      addLine(failure, fx - radius, fy - radius, fx + radius, fy + radius, strokeWidth, marker.color, true);
      addLine(failure, fx + radius, fy - radius, fx - radius, fy + radius, strokeWidth, marker.color, true);
    }
    this.#set('failure-marker', failure);
  }
}
