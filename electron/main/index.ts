import { writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron';

import { registerRuntimeIpc, type RendererReadyReport } from '../ipc/contracts';
import { runPackagedModelSmoke } from '../model/model-smoke';
import { registerPersistenceIpc } from '../persistence/ipc';
import { SaveRepository, saveRootForUserData } from '../persistence/save-repository';
import {
  APP_URL,
  createAppProtocolHandler,
  registerAppSchemePrivileges,
} from '../protocol/app-protocol';
import { lockWebContents, lockedWebPreferences } from './security';

registerAppSchemePrivileges(protocol);

const smokeMode = process.env.SI_WORLD_SMOKE === '1';
const modelSmokeMode = process.env.SI_WORLD_MODEL_SMOKE === '1';
let smokeFinished = false;

const smokeUserData = process.env.SI_WORLD_SMOKE_USER_DATA;
if (smokeMode && smokeUserData) {
  if (!isAbsolute(smokeUserData)) throw new Error('Smoke user-data path must be absolute.');
  app.setPath('userData', smokeUserData);
}

if (smokeMode && process.env.SI_WORLD_SMOKE_SOFTWARE_RENDERING === '1') {
  app.disableHardwareAcceleration();
}

async function captureSmokeScreenshot(window: BrowserWindow, screenshotPath: string): Promise<void> {
  const image = await window.webContents.capturePage();
  await writeFile(screenshotPath, image.toPNG(), { flush: true });
}

type SurfaceBounds = Readonly<{ x: number; y: number; width: number; height: number }>;

async function rendererText(window: BrowserWindow, selector: string): Promise<string> {
  return window.webContents.executeJavaScript(
    `document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`,
    true,
  ) as Promise<string>;
}

async function cameraLabel(window: BrowserWindow): Promise<string> {
  return window.webContents.executeJavaScript(
    `document.querySelector('#world-camera-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as Promise<string>;
}

async function roofLabel(window: BrowserWindow): Promise<string> {
  return window.webContents.executeJavaScript(
    `document.querySelector('#world-roof-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as Promise<string>;
}

async function worldStateLabel(window: BrowserWindow): Promise<string> {
  return window.webContents.executeJavaScript(
    `document.querySelector('#world-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as Promise<string>;
}

function parseWorldStateLabel(label: string): Readonly<{ mapName: string; x: number; y: number; minute: number; speed: number }> {
  const match = /^(.*); tile (\d+),(\d+); minute (\d+); speed (\d+)$/u.exec(label);
  if (!match) throw new Error(`Invalid world-state label: ${label}`);
  return { mapName: match[1]!, x: Number(match[2]), y: Number(match[3]), minute: Number(match[4]), speed: Number(match[5]) };
}

async function surfaceBounds(window: BrowserWindow): Promise<SurfaceBounds> {
  return window.webContents.executeJavaScript(`(() => {
    const element = document.querySelector('#world-input-viewport');
    if (!(element instanceof HTMLElement)) throw new Error('World input viewport is missing.');
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  })()`, true) as Promise<SurfaceBounds>;
}

function parseCameraLabel(label: string): Readonly<{ x: number; y: number; zoom: number }> {
  const match = /^World camera (\d+),(\d+) at (\d+)x$/u.exec(label);
  if (!match) throw new Error(`Invalid camera label: ${label}`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}

async function clickZoomButton(window: BrowserWindow, zoom: 1 | 2 | 3): Promise<void> {
  await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('[aria-label="Set ${zoom}x zoom"]');
    if (!(button instanceof HTMLElement)) throw new Error('${zoom}x zoom button is missing.');
    button.click();
  })()`, true);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
}

async function clickAriaButton(window: BrowserWindow, label: string): Promise<void> {
  const clicked = await window.webContents.executeJavaScript(`(() => {
    const button = document.querySelector('[aria-label=${JSON.stringify(label)}]');
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  })()`, true) as boolean;
  if (!clicked) throw new Error(`Button is missing: ${label}`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
}

function sendMouseClick(window: BrowserWindow, x: number, y: number): void {
  window.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
}

function sendKey(window: BrowserWindow, keyCode: 'F' | 'Escape'): void {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
}


async function clickWorldTile(window: BrowserWindow, tile: Readonly<{ x: number; y: number }>): Promise<void> {
  const bounds = await surfaceBounds(window);
  const camera = parseCameraLabel(await cameraLabel(window));
  const x = bounds.x + (tile.x * 32 + 16 - camera.x) * camera.zoom;
  const y = bounds.y + (tile.y * 32 + 16 - camera.y) * camera.zoom;
  if (x < bounds.x || y < bounds.y || x >= bounds.x + bounds.width || y >= bounds.y + bounds.height) {
    throw new Error(`Tile ${tile.x},${tile.y} is outside the visible camera.`);
  }
  sendMouseClick(window, x, y);
}

async function panWorld(window: BrowserWindow, deltaX: number, deltaY: number): Promise<void> {
  const bounds = await surfaceBounds(window);
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  window.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(start.x), y: Math.round(start.y), button: 'middle', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(start.x + deltaX), y: Math.round(start.y + deltaY), button: 'middle' });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(start.x + deltaX), y: Math.round(start.y + deltaY), button: 'middle', clickCount: 1 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
}

async function captureWorldSmoke(window: BrowserWindow, directory: string): Promise<Record<string, boolean>> {
  const zoomLabels: string[] = [];
  for (const zoom of [1, 2, 3] as const) {
    await clickZoomButton(window, zoom);
    zoomLabels.push(await cameraLabel(window));
    await captureSmokeScreenshot(window, join(directory, `world-${zoom}x.png`));
  }
  const zoomButtons = zoomLabels.every((label, index) => label.endsWith(`at ${index + 1}x`));

  await clickZoomButton(window, 2);
  let bounds = await surfaceBounds(window);
  const center = { x: bounds.x + 560, y: bounds.y + 310 };
  sendMouseClick(window, center.x + 3 * 32 * 2, center.y);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
  const movedText = await rendererText(window, '#world-ui-location');
  const movement = movedText.includes('TILE 21,18');

  const beforePan = await cameraLabel(window);
  window.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(center.x), y: Math.round(center.y), button: 'middle', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(center.x + 32), y: Math.round(center.y), button: 'middle' });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  window.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(center.x + 96), y: Math.round(center.y), button: 'middle' });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(center.x + 96), y: Math.round(center.y), button: 'middle', clickCount: 1 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  const afterPan = await cameraLabel(window);
  const beforePanState = parseCameraLabel(beforePan);
  const afterPanState = parseCameraLabel(afterPan);
  const middlePan = afterPanState.x === beforePanState.x - 48 &&
    afterPanState.y === beforePanState.y && afterPanState.zoom === beforePanState.zoom;

  sendKey(window, 'F');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  const afterCenter = await cameraLabel(window);
  const centerKey = afterCenter !== afterPan && afterCenter === 'World camera 408,437 at 2x';

  bounds = await surfaceBounds(window);
  const wheelX = Math.round(bounds.x + 560);
  const wheelY = Math.round(bounds.y + 310);
  await window.webContents.executeJavaScript(`(() => {
    const element = document.querySelector('#world-input-surface');
    if (!(element instanceof HTMLElement)) throw new Error('World input surface is missing.');
    element.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: ${wheelX},
      clientY: ${wheelY},
      deltaY: -100,
    }));
  })()`, true);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  const wheelZoom = (await cameraLabel(window)).endsWith('at 3x');

  await clickZoomButton(window, 2);
  sendKey(window, 'F');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  bounds = await surfaceBounds(window);
  sendMouseClick(window, bounds.x + 560 - 4 * 32 * 2, bounds.y + 310);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 35));
  sendKey(window, 'Escape');
  const cancelStart = await rendererText(window, '#world-ui-location');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 350));
  const cancelKey = (await rendererText(window, '#world-ui-location')) === cancelStart && cancelStart.includes('TILE 21,18');

  const beforeUi = await rendererText(window, '#world-ui-location');
  await clickZoomButton(window, 1);
  const afterUi = await rendererText(window, '#world-ui-location');
  const tilePattern = /TILE \d+,\d+/u;
  const uiClickThrough = beforeUi.match(tilePattern)?.[0] === afterUi.match(tilePattern)?.[0];

  bounds = await surfaceBounds(window);
  sendMouseClick(window, bounds.x + 560 - 6 * 32, bounds.y + 310 + 7 * 32);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_300));
  const outsideText = await rendererText(window, '#world-ui-location');
  const roofRestore = outsideText.includes('TILE 15,25') && await roofLabel(window) === 'Villa roof restored';
  await captureSmokeScreenshot(window, join(directory, 'world-roof-restored.png'));

  sendMouseClick(window, bounds.x + 560 - 6 * 32, bounds.y + 310 + 5 * 32);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  const roofEntry = (await rendererText(window, '#world-ui-location')).includes('TILE 15,23') &&
    await roofLabel(window) === 'Villa roof hidden';

  const beforePause = parseWorldStateLabel(await worldStateLabel(window));
  await clickAriaButton(window, 'Pause time');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_100));
  const afterPause = parseWorldStateLabel(await worldStateLabel(window));
  const pausedClock = afterPause.minute === beforePause.minute && afterPause.speed === 0;

  await clickAriaButton(window, 'Set 2x time');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_100));
  const afterFast = parseWorldStateLabel(await worldStateLabel(window));
  const doubleSpeedClock = afterFast.speed === 2 && afterFast.minute - afterPause.minute >= 2 && afterFast.minute - afterPause.minute <= 4;

  await clickWorldTile(window, { x: 14, y: 13 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_300));
  const bedroomReached = (await rendererText(window, '#world-ui-location')).includes('TILE 14,13');
  await clickAriaButton(window, 'Pause time');
  const beforeNap = parseWorldStateLabel(await worldStateLabel(window));
  await clickAriaButton(window, 'Nap for two hours');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  const afterNap = parseWorldStateLabel(await worldStateLabel(window));
  const nap = bedroomReached && afterNap.minute === beforeNap.minute + 120 && (await rendererText(window, '#world-ui-help')).includes('NAP COMPLETE');

  let napCount = 0;
  let beforeOvernight = afterNap;
  while (beforeOvernight.minute % 1_440 < 20 * 60 && napCount < 6) {
    await clickAriaButton(window, 'Nap for two hours');
    beforeOvernight = parseWorldStateLabel(await worldStateLabel(window));
    napCount += 1;
  }
  await clickAriaButton(window, 'Sleep until 8 AM');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 400));
  const afterOvernight = parseWorldStateLabel(await worldStateLabel(window));
  const overnightSleep = afterOvernight.minute > beforeOvernight.minute && afterOvernight.minute % 1_440 === 8 * 60;
  const sleepAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 1');

  await clickAriaButton(window, 'Set 2x time');
  await clickWorldTile(window, { x: 16, y: 25 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
  await clickZoomButton(window, 1);
  await panWorld(window, -500, 0);
  await panWorld(window, -500, 0);
  await clickWorldTile(window, { x: 63, y: 24 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 6_500));
  const afterTravel = parseWorldStateLabel(await worldStateLabel(window));
  const travel = afterTravel.mapName === 'Neon Crescent' && afterTravel.x === 0 && afterTravel.y === 24;
  const travelAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 2');
  await captureSmokeScreenshot(window, join(directory, 'world-downtown.png'));

  await panWorld(window, 0, -500);
  await clickWorldTile(window, { x: 32, y: 47 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_200));
  const docks = parseWorldStateLabel(await worldStateLabel(window));
  await panWorld(window, 0, -500);
  const closedFerry = docks.mapName === 'Harbor Authority' &&
    (await rendererText(window, 'body')).includes('FERRY TERMINAL · CLOSED');
  await captureSmokeScreenshot(window, join(directory, 'world-ferry.png'));

  await panWorld(window, 500, 0);
  await clickWorldTile(window, { x: 0, y: 24 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_200));
  const commercial = parseWorldStateLabel(await worldStateLabel(window));

  await panWorld(window, 500, 500);
  await clickWorldTile(window, { x: 32, y: 0 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_200));
  const loopCompleteState = parseWorldStateLabel(await worldStateLabel(window));
  const allNeighborhoods = commercial.mapName === 'Palm Exchange' &&
    loopCompleteState.mapName === 'Sunward Villas' && loopCompleteState.x === 32 && loopCompleteState.y === 47;
  const allTravelAutosaves = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 5');
  await captureSmokeScreenshot(window, join(directory, 'world-loop-complete.png'));
  return {
    zoomButtons, movement, middlePan, wheelZoom, centerKey, cancelKey, uiClickThrough, roofRestore, roofEntry,
    pausedClock, doubleSpeedClock, nap, overnightSleep, sleepAutosave, travel, travelAutosave,
    closedFerry, allNeighborhoods, allTravelAutosaves,
  };
}

async function emitSmokeResult(report: RendererReadyReport, window: BrowserWindow): Promise<void> {
  if (!smokeMode || smokeFinished) {
    return;
  }
  smokeFinished = true;
  const worldScreenshotDirectory = process.env.SI_WORLD_SMOKE_WORLD_SCREENSHOT_DIR;
  if (worldScreenshotDirectory) {
    const worldResult = await captureWorldSmoke(window, worldScreenshotDirectory);
    process.stdout.write(`SI_WORLD_WORLD_SMOKE_RESULT ${JSON.stringify(worldResult)}\n`);
  }
  const screenshotPath = process.env.SI_WORLD_SMOKE_SCREENSHOT;
  if (screenshotPath) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    await captureSmokeScreenshot(window, screenshotPath);
  }
  process.stdout.write(`SI_WORLD_SMOKE_RESULT ${JSON.stringify(report)}\n`);
  setTimeout(() => app.quit(), 50);
}

async function createMainWindow(): Promise<void> {
  const applicationRoot = app.getAppPath();
  const distributionRoot = join(applicationRoot, 'dist');
  const preloadPath = join(applicationRoot, 'build/electron/preload/index.js');

  await protocol.handle(
    'app',
    createAppProtocolHandler(distributionRoot, (fileUrl) => net.fetch(fileUrl)),
  );

  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => callback({ cancel: true }),
  );

  const window = new BrowserWindow({
    backgroundColor: '#17201b',
    height: 720,
    show: true,
    title: 'SI World',
    webPreferences: lockedWebPreferences(preloadPath),
    width: 1280,
  });
  window.removeMenu();
  registerRuntimeIpc(
    ipcMain,
    {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      packaged: app.isPackaged,
      platform: process.platform as 'darwin' | 'linux' | 'win32',
    },
    (report) => {
      void emitSmokeResult(report, window).catch((error: unknown) => {
        process.stderr.write(`SI_WORLD_SMOKE_FAILURE ${String(error)}\n`);
        app.exit(1);
      });
    },
  );
  const saveRepository = new SaveRepository(saveRootForUserData(app.getPath('userData')));
  registerPersistenceIpc(ipcMain, {
    loadSave: (slotId) => saveRepository.load(slotId),
    migrateSave: (request) => saveRepository.migrate(request),
    requestSave: (request) => saveRepository.save(request),
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (smokeMode && !smokeFinished) {
      smokeFinished = true;
      process.stderr.write(`SI_WORLD_SMOKE_FAILURE ${errorCode} ${errorDescription}\n`);
      app.exit(1);
    }
  });
  window.webContents.on('did-finish-load', () => {
    const loadingScreenshotPath = process.env.SI_WORLD_SMOKE_LOADING_SCREENSHOT;
    if (smokeMode && loadingScreenshotPath) {
      setTimeout(() => {
        void captureSmokeScreenshot(window, loadingScreenshotPath).catch((error: unknown) => {
          smokeFinished = true;
          process.stderr.write(`SI_WORLD_SMOKE_FAILURE ${String(error)}\n`);
          app.exit(1);
        });
      }, 100);
    }
  });
  await window.loadURL(APP_URL);
}

app.on('web-contents-created', (_event, contents) => lockWebContents(contents));

app
  .whenReady()
  .then(async () => {
    if (modelSmokeMode) {
      const report = await runPackagedModelSmoke(app, process.resourcesPath);
      process.stdout.write(`SI_WORLD_MODEL_SMOKE_RESULT ${JSON.stringify(report)}\n`);
      app.quit();
      return;
    }
    await createMainWindow();
  })
  .catch((error: unknown) => {
    process.stderr.write(`SI_WORLD_BOOT_FAILURE ${String(error)}\n`);
    app.exit(1);
  });

app.on('window-all-closed', () => app.quit());

if (smokeMode) {
  setTimeout(() => {
    if (!smokeFinished) {
      process.stderr.write('SI_WORLD_SMOKE_FAILURE renderer readiness timeout\n');
      app.exit(1);
    }
  }, 30_000);
}
