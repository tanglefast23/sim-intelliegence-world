jest.mock('three', () => {
  const actual = jest.requireActual<typeof import('three')>('three');
  return {
    ...actual,
    TextureLoader: jest.fn().mockImplementation(() => ({
      loadAsync: jest.fn(async () => {
        const texture = new actual.Texture();
        texture.image = { height: 512, width: 512 };
        return texture;
      }),
    })),
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      dispose: jest.fn(),
      info: { memory: { geometries: 17, textures: 2 }, programs: [], render: { calls: 0 } },
      render: jest.fn(),
      setClearColor: jest.fn(),
      setPixelRatio: jest.fn(),
      setSize: jest.fn(),
    })),
  };
});

import { BufferGeometry, ShaderMaterial, Texture, WebGLRenderer } from 'three';

import { ThreeWorldRenderer } from '../three/world-renderer';
import type { WorldFrameState } from '../world-frame';
import { VFX_ROLE_COLORS } from '../vfx/types';

function fakeCanvas(): HTMLCanvasElement {
  const canvas = new EventTarget();
  Object.defineProperty(canvas, 'getContext', { value: () => ({}) });
  return canvas as HTMLCanvasElement;
}

function frameWithEffects(rectCount: number, fallbackCount: number): WorldFrameState {
  return {
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { height: 240, width: 320 },
    devicePixelRatio: 1,
    floors: [],
    groundDetails: [],
    props: [],
    doors: [],
    characters: [],
    groundedOrder: [],
    walls: [],
    roofs: [],
    doorWear: [],
    propShadows: [],
    thresholds: [],
    characterShadows: [],
    wallBases: [],
    shelterCells: [],
    selectionRing: {
      id: 'selection-ring',
      worldX: 0,
      worldY: 0,
      radiusX: 10,
      radiusY: 5,
      color: '#ffffff',
      strokeWidth: 1,
    },
    effects: rectCount === 0 ? [] : [{
      emitterId: 'test-effect',
      kind: 'fire',
      recipeId: 'fire-v1',
      ageStep: 0,
      bounds: { bottom: 1, left: 0, right: 1, top: 0 },
      rects: Array.from({ length: rectCount }, (_, index) => ({
        role: 'fire-core' as const,
        x: index,
        y: 0,
        width: 1,
        height: 1,
      })),
    }],
    effectRoleColors: VFX_ROLE_COLORS,
    fallbackEffects: Array.from({ length: fallbackCount }, (_, index) => ({
      id: `fallback-${index}`,
      kind: 'fire' as const,
      tile: { x: index, y: 0 },
      worldX: index,
      worldY: 0,
      color: '#ffffff',
    })),
  } as unknown as WorldFrameState;
}

function installAnimationFrameQueue(): Readonly<{ callbacks: FrameRequestCallback[]; restore: () => void }> {
  const requestDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const cancelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  const callbacks: FrameRequestCallback[] = [];
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: jest.fn() });
  return {
    callbacks,
    restore: () => {
      if (requestDescriptor) Object.defineProperty(globalThis, 'requestAnimationFrame', requestDescriptor);
      else delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
      if (cancelDescriptor) Object.defineProperty(globalThis, 'cancelAnimationFrame', cancelDescriptor);
      else delete (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
    },
  };
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        getContext: () => ({ arc: jest.fn(), beginPath: jest.fn(), fill: jest.fn(), fillStyle: '' }),
        height: 0,
        width: 0,
      }),
    },
  });
});

afterAll(() => {
  delete (globalThis as { document?: unknown }).document;
});

describe('Three.js renderer lifecycle', () => {
  test('uses the exact ten-second context-loss timeout and removes listeners on dispose', async () => {
    jest.useFakeTimers();
    const states: string[] = [];
    const canvas = fakeCanvas();
    const renderer = await ThreeWorldRenderer.create(canvas, 'atlas.png', true, jest.fn(), (state) => states.push(state));
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(states).toEqual(['lost']);
    jest.advanceTimersByTime(9_999);
    expect(states).toEqual(['lost']);
    jest.advanceTimersByTime(1);
    expect(states).toEqual(['lost', 'timed-out']);
    renderer.dispose();
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(states).toEqual(['lost', 'timed-out']);
    jest.useRealTimers();
  });

  test('disposes every owned resource across unmount and remount', async () => {
    const geometryDispose = jest.spyOn(BufferGeometry.prototype, 'dispose');
    const materialDispose = jest.spyOn(ShaderMaterial.prototype, 'dispose');
    const textureDispose = jest.spyOn(Texture.prototype, 'dispose');
    const first = await ThreeWorldRenderer.create(fakeCanvas(), 'atlas.png', true, jest.fn(), jest.fn());
    const firstGpu = jest.mocked(WebGLRenderer).mock.results.at(-1)?.value as unknown as { dispose: jest.Mock };
    first.dispose();
    const second = await ThreeWorldRenderer.create(fakeCanvas(), 'atlas.png', true, jest.fn(), jest.fn());
    const secondGpu = jest.mocked(WebGLRenderer).mock.results.at(-1)?.value as unknown as { dispose: jest.Mock };
    second.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(34);
    expect(materialDispose).toHaveBeenCalledTimes(6);
    expect(textureDispose).toHaveBeenCalledTimes(4);
    expect(firstGpu.dispose).toHaveBeenCalledTimes(1);
    expect(secondGpu.dispose).toHaveBeenCalledTimes(1);
    geometryDispose.mockRestore();
    materialDispose.mockRestore();
    textureDispose.mockRestore();
  });

  test('reallocates an equal-vertex batch when its index count changes', async () => {
    const animation = installAnimationFrameQueue();
    try {
      const states: string[] = [];
      const renderer = await ThreeWorldRenderer.create(fakeCanvas(), 'atlas.png', true, jest.fn(), (state) => states.push(state));
      const gpuRenderer = jest.mocked(WebGLRenderer).mock.results.at(-1)?.value as unknown as { render: jest.Mock };
      renderer.setFrame(frameWithEffects(17, 0));
      renderer.start();
      animation.callbacks.shift()!(0);
      renderer.setFrame(frameWithEffects(0, 2));
      animation.callbacks.shift()!(16);
      expect(states).toEqual([]);
      expect(gpuRenderer.render).toHaveBeenCalledTimes(2);
      renderer.dispose();
    } finally {
      animation.restore();
    }
  });

  test('reports a frame failure and keeps the presentation loop scheduled', async () => {
    const animation = installAnimationFrameQueue();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const states: string[] = [];
      const renderer = await ThreeWorldRenderer.create(fakeCanvas(), 'atlas.png', true, jest.fn(), (state) => states.push(state));
      const gpuRenderer = jest.mocked(WebGLRenderer).mock.results.at(-1)?.value as unknown as { render: jest.Mock };
      gpuRenderer.render.mockImplementationOnce(() => { throw new Error('test frame failure'); });
      renderer.setFrame(frameWithEffects(0, 0));
      renderer.start();
      animation.callbacks.shift()!(0);
      expect(states).toEqual(['timed-out']);
      expect(animation.callbacks).toHaveLength(1);
      expect(consoleError).toHaveBeenCalledWith('SI_WORLD_THREE_RENDERER_FRAME_FAILURE test frame failure');
      renderer.dispose();
    } finally {
      consoleError.mockRestore();
      animation.restore();
    }
  });
});
