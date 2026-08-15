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

function fakeCanvas(): HTMLCanvasElement {
  const canvas = new EventTarget();
  Object.defineProperty(canvas, 'getContext', { value: () => ({}) });
  return canvas as HTMLCanvasElement;
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

  test('disposes every owned geometry, material, texture, and WebGL renderer', async () => {
    const geometryDispose = jest.spyOn(BufferGeometry.prototype, 'dispose');
    const materialDispose = jest.spyOn(ShaderMaterial.prototype, 'dispose');
    const textureDispose = jest.spyOn(Texture.prototype, 'dispose');
    const renderer = await ThreeWorldRenderer.create(fakeCanvas(), 'atlas.png', true, jest.fn(), jest.fn());
    const gpuRenderer = jest.mocked(WebGLRenderer).mock.results.at(-1)?.value as unknown as { dispose: jest.Mock };
    renderer.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(17);
    expect(materialDispose).toHaveBeenCalledTimes(3);
    expect(textureDispose).toHaveBeenCalledTimes(2);
    expect(gpuRenderer.dispose).toHaveBeenCalledTimes(1);
    geometryDispose.mockRestore();
    materialDispose.mockRestore();
    textureDispose.mockRestore();
  });
});
