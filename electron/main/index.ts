import { writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron';

import { ConversationService } from '../../src/ai/conversation/service';
import { FileCharacterWritingStore } from '../../src/ai/registry/file-writing-store';
import { registerConversationIpc } from '../conversation/ipc';
import { registerRuntimeIpc, type RendererReadyReport } from '../ipc/contracts';
import { BundledConversationInference } from '../model/conversation-inference';
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
let conversationService: ConversationService | undefined;
let conversationInference: BundledConversationInference | undefined;
let quitCleanupStarted = false;
let quitCleanupFinished = false;

const smokeUserData = process.env.SI_WORLD_SMOKE_USER_DATA;
if (smokeMode && smokeUserData) {
  if (!isAbsolute(smokeUserData)) throw new Error('Smoke user-data path must be absolute.');
  app.setPath('userData', smokeUserData);
}

if (smokeMode) {
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
}

if (smokeMode && process.env.SI_WORLD_SMOKE_SOFTWARE_RENDERING === '1') {
  app.disableHardwareAcceleration();
}

async function captureSmokeScreenshot(window: BrowserWindow, screenshotPath: string): Promise<Buffer> {
  const image = await window.webContents.capturePage();
  const buffer = image.toPNG();
  await writeFile(screenshotPath, buffer, { flush: true });
  return buffer;
}

async function captureDistinctSmokeScreenshot(
  window: BrowserWindow,
  screenshotPath: string,
  previousBuffers: readonly Buffer[],
  timeoutMilliseconds = 2_000,
): Promise<Buffer> {
  const deadline = Date.now() + timeoutMilliseconds;
  do {
    const buffer = await captureSmokeScreenshot(window, screenshotPath);
    if (previousBuffers.every((previous) => !buffer.equals(previous))) return buffer;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
  } while (Date.now() < deadline);
  throw new Error(`Screenshot did not change before timeout: ${screenshotPath}`);
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

async function npcStateLabel(window: BrowserWindow): Promise<string> {
  return window.webContents.executeJavaScript(
    `document.querySelector('#world-npc-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as Promise<string>;
}

async function questStateLabel(window: BrowserWindow): Promise<string> {
  return window.webContents.executeJavaScript(
    `document.querySelector('#world-quest-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as Promise<string>;
}

function parseWorldStateLabel(label: string): Readonly<{ mapName: string; x: number; y: number; minute: number; speed: number }> {
  const match = /^(.*); tile (\d+),(\d+); minute (\d+); speed (\d+)$/u.exec(label);
  if (!match) throw new Error(`Invalid world-state label: ${label}`);
  return { mapName: match[1]!, x: Number(match[2]), y: Number(match[3]), minute: Number(match[4]), speed: Number(match[5]) };
}

function parseLindaTile(label: string): Readonly<{ x: number; y: number }> {
  const match = /^Linda (-?\d+),(-?\d+);/u.exec(label);
  if (!match || Number(match[1]) < 0 || Number(match[2]) < 0) throw new Error(`Linda is not active: ${label}`);
  return { x: Number(match[1]), y: Number(match[2]) };
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
  const result = await window.webContents.executeJavaScript(`(() => {
    try {
      const button = Array.from(document.querySelectorAll('[aria-label]')).find(
        (element) => element.getAttribute('aria-label') === ${JSON.stringify(label)},
      );
      if (!(button instanceof HTMLElement)) return { clicked: false, error: null };
      button.click();
      return { clicked: true, error: null };
    } catch (error) {
      return { clicked: false, error: error instanceof Error ? error.stack ?? error.message : String(error) };
    }
  })()`, true) as Readonly<{ clicked: boolean; error: string | null }>;
  if (result.error) throw new Error(`Button ${label} failed: ${result.error}`);
  if (!result.clicked) throw new Error(`Button is missing: ${label}`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
}

async function waitForWorldTile(
  window: BrowserWindow,
  tile: Readonly<{ x: number; y: number }>,
  timeoutMilliseconds = 6_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastLabel = '';
  while (Date.now() < deadline) {
    lastLabel = await worldStateLabel(window);
    const state = parseWorldStateLabel(lastLabel);
    if (state.x === tile.x && state.y === tile.y) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for tile ${tile.x},${tile.y}. Last state: ${lastLabel}`);
}

async function waitForWorldLocation(
  window: BrowserWindow,
  mapName: string,
  tile: Readonly<{ x: number; y: number }>,
  timeoutMilliseconds = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastLabel = '';
  while (Date.now() < deadline) {
    lastLabel = await worldStateLabel(window);
    const state = parseWorldStateLabel(lastLabel);
    if (state.mapName === mapName && state.x === tile.x && state.y === tile.y) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${mapName} tile ${tile.x},${tile.y}. Last state: ${lastLabel}`);
}

async function waitForRendererText(
  window: BrowserWindow,
  selector: string,
  expectedText: string,
  timeoutMilliseconds = 6_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastText = '';
  while (Date.now() < deadline) {
    lastText = await rendererText(window, selector);
    if (lastText.includes(expectedText)) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${selector} to include ${expectedText}. Last text: ${lastText}`);
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

async function dispatchWorldTileClick(window: BrowserWindow, tile: Readonly<{ x: number; y: number }>): Promise<void> {
  const camera = parseCameraLabel(await cameraLabel(window));
  await window.webContents.executeJavaScript(`(() => {
    const element = document.querySelector('#world-input-surface');
    if (!(element instanceof HTMLElement)) throw new Error('World input surface is missing.');
    const bounds = element.getBoundingClientRect();
    const clientX = bounds.left + (${tile.x} * 32 + 16 - ${camera.x}) * ${camera.zoom};
    const clientY = bounds.top + (${tile.y} * 32 + 16 - ${camera.y}) * ${camera.zoom};
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX, clientY, pointerId: 91 }));
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 91 }));
  })()`, true);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
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
  const zoomBuffers: Buffer[] = [];
  for (const zoom of [1, 2, 3] as const) {
    await clickZoomButton(window, zoom);
    zoomLabels.push(await cameraLabel(window));
    zoomBuffers.push(await captureDistinctSmokeScreenshot(
      window,
      join(directory, `world-${zoom}x.png`),
      zoomBuffers,
    ));
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
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
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
  let previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window,
    join(directory, 'world-roof-restored.png'),
    [zoomBuffers[0]!],
  );

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

  await dispatchWorldTileClick(window, { x: 14, y: 13 });
  await waitForWorldTile(window, { x: 14, y: 13 });
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
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 1');
  const sleepAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 1');

  await clickAriaButton(window, 'Set 1x time');
  await clickWorldTile(window, { x: 16, y: 25 });
  await waitForWorldTile(window, { x: 16, y: 25 });
  await clickZoomButton(window, 1);
  await panWorld(window, -500, 0);
  await panWorld(window, -500, 0);
  await dispatchWorldTileClick(window, { x: 63, y: 24 });
  await waitForWorldLocation(window, 'Neon Crescent', { x: 0, y: 24 });
  const afterTravel = parseWorldStateLabel(await worldStateLabel(window));
  const travel = afterTravel.mapName === 'Neon Crescent' && afterTravel.x === 0 && afterTravel.y === 24;
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 2');
  const travelAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 2');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-downtown.png'), [previousWorldBuffer],
  );

  await panWorld(window, 0, -500);
  await dispatchWorldTileClick(window, { x: 32, y: 47 });
  await waitForWorldLocation(window, 'Harbor Authority', { x: 32, y: 0 });
  const docks = parseWorldStateLabel(await worldStateLabel(window));
  await panWorld(window, 0, -500);
  const closedFerry = docks.mapName === 'Harbor Authority' &&
    (await rendererText(window, 'body')).includes('FERRY TERMINAL · CLOSED');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-ferry.png'), [previousWorldBuffer],
  );

  await panWorld(window, 500, 0);
  await dispatchWorldTileClick(window, { x: 0, y: 24 });
  await waitForWorldLocation(window, 'Palm Exchange', { x: 63, y: 24 });
  const commercial = parseWorldStateLabel(await worldStateLabel(window));

  await panWorld(window, 500, 500);
  await dispatchWorldTileClick(window, { x: 32, y: 0 });
  await waitForWorldLocation(window, 'Sunward Villas', { x: 32, y: 47 });
  const loopCompleteState = parseWorldStateLabel(await worldStateLabel(window));
  const allNeighborhoods = commercial.mapName === 'Palm Exchange' &&
    loopCompleteState.mapName === 'Sunward Villas' && loopCompleteState.x === 32 && loopCompleteState.y === 47;
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 5');
  const allTravelAutosaves = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 5');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-loop-complete.png'), [previousWorldBuffer],
  );

  await clickZoomButton(window, 1);
  await panWorld(window, 0, 500);
  const lindaTile = parseLindaTile(await npcStateLabel(window));
  await dispatchWorldTileClick(window, lindaTile);
  await clickAriaButton(window, 'Talk to Linda');
  const conversationBefore = parseWorldStateLabel(await worldStateLabel(window));
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_100));
  const conversationAfter = parseWorldStateLabel(await worldStateLabel(window));
  const conversationPause = conversationBefore.minute === conversationAfter.minute &&
    (await rendererText(window, '#world-ui-conversation-panel')).includes('TIME PAUSED');
  const cameraBeforeConversationInput = await cameraLabel(window);
  const locationBeforeConversationInput = await rendererText(window, '#world-ui-location');
  await window.webContents.executeJavaScript(`(() => {
    const overlay = document.querySelector('#world-ui-conversation-overlay');
    if (!(overlay instanceof HTMLElement)) throw new Error('Conversation overlay is missing.');
    const bounds = overlay.getBoundingClientRect();
    const clientX = bounds.left + 20;
    const clientY = bounds.top + 20;
    overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX, clientY, pointerId: 92 }));
    overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1, clientX, clientY, pointerId: 93 }));
    overlay.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 1, clientX: clientX + 100, clientY, pointerId: 93 }));
    overlay.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 1, clientX: clientX + 100, clientY, pointerId: 93 }));
    overlay.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX, clientY, deltaY: -100 }));
  })()`, true);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  const conversationInputLocked = cameraBeforeConversationInput === await cameraLabel(window) &&
    locationBeforeConversationInput === await rendererText(window, '#world-ui-location');
  const conversationSocialNavLocked = !(await window.webContents.executeJavaScript(
    `Boolean(document.querySelector('#world-ui-social-nav'))`, true,
  ));
  const promptIdeasContextual = (await rendererText(window, '#conversation-prompt-suggestions')).trim().length === 0;
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Conversation message"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Conversation input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'I have a cat');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`, true);
  await clickAriaButton(window, 'Send conversation message');
  const conversationBuffered = Boolean(await window.webContents.executeJavaScript(
    `document.querySelector('[aria-label="NPC is thinking"]')`, true,
  ));
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  const transcript = await rendererText(window, '#conversation-transcript');
  const conversationFallback = transcript.includes('I lost the thread') && !transcript.includes('jsonSchema');
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Conversation message"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Conversation input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'Would you like to visit my villa?');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`, true);
  await clickAriaButton(window, 'Send conversation message');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 900));
  const structuredInvitation = (await rendererText(window, '#conversation-transcript')).includes('current situation');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-conversation.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'End conversation');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 6');
  const conversationCommitSave = !(await window.webContents.executeJavaScript(
    `Boolean(document.querySelector('#world-ui-conversation-panel'))`, true,
  )) && (await rendererText(window, '#world-save-status')).includes('SAVED GEN 6');
  await clickAriaButton(window, 'Open relationships');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  const relationshipText = await rendererText(window, '#world-ui-relationship-panel');
  const relationshipPanel = relationshipText.includes('FAMILIARITY') && relationshipText.includes('STAGE');
  const hiddenFaction = relationshipText.includes('OTHER NETWORKS REMAIN HIDDEN') && !relationshipText.includes('VELVET TIDE');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-social.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Close relationships');
  const currentLindaTile = parseLindaTile(await npcStateLabel(window));
  const lindaApproachTile = { x: currentLindaTile.x - 1, y: currentLindaTile.y };
  await dispatchWorldTileClick(window, lindaApproachTile);
  await waitForWorldTile(window, lindaApproachTile, 10_000);
  await dispatchWorldTileClick(window, currentLindaTile);
  await clickAriaButton(window, 'Open journal');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  const journalInvitation = (await rendererText(window, '#world-ui-journal-panel')).includes('LINDA · REJECTED');
  await clickAriaButton(window, 'Buy villa security report');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 7');
  const socialPurchase = (await rendererText(window, '#world-ui-journal-panel')).includes('SECURITY REPORT PURCHASED') &&
    (await rendererText(window, '#world-save-status')).includes('SAVED GEN 7');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-journal.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Close journal');
  await clickAriaButton(window, "Accept Linda's request");
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 8');
  const questStarted = (await questStateLabel(window)).includes('Linda quest active') &&
    (await questStateLabel(window)).includes('flags security_report_purchased');
  await dispatchWorldTileClick(window, { x: 22, y: 28 });
  await waitForWorldTile(window, { x: 22, y: 28 }, 10_000);
  await clickAriaButton(window, "Confirm Linda's villa");
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 9');
  const choiceText = await rendererText(window, '#world-ui-context-actions');
  const questChoicePreview = choiceText.includes('PROTECT LINDA') && choiceText.includes('BETRAY LINDA') &&
    choiceText.includes('WITHDRAW') && choiceText.includes('YOU DO') && choiceText.includes('RESULT') &&
    choiceText.includes('SOCIAL') && choiceText.includes('ROUTE');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-linda-quest.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Protect Linda');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 10');
  const questLabel = await questStateLabel(window);
  const questOutcome = questLabel.includes('Linda quest resolved') && questLabel.includes('linda_protected') &&
    questLabel.includes('police noticed') && questLabel.includes('evidence 1') &&
    (await rendererText(window, '#world-ui-help')).includes('LINDA PROTECTED');
  const questAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 10');
  await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-linda-outcome.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Open journal');
  await clickAriaButton(window, 'Answer police questions');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 11');
  await clickAriaButton(window, 'Ignore police summons');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 12');
  await clickAriaButton(window, 'Trigger wanted encounter');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 13');
  const policeHooks = (await questStateLabel(window)).includes('police arrest-on-sight') &&
    (await rendererText(window, '#world-ui-journal-panel')).includes('POLICE · ARREST-ON-SIGHT');
  await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-police.png'), [previousWorldBuffer],
  );
  return {
    zoomButtons, movement, middlePan, wheelZoom, centerKey, cancelKey, uiClickThrough, roofRestore, roofEntry,
    pausedClock, doubleSpeedClock, nap, overnightSleep, sleepAutosave, travel, travelAutosave,
    closedFerry, allNeighborhoods, allTravelAutosaves,
    conversationPause, conversationInputLocked, conversationSocialNavLocked, promptIdeasContextual, conversationBuffered, conversationFallback, conversationCommitSave,
    structuredInvitation, relationshipPanel, hiddenFaction, journalInvitation, socialPurchase,
    questStarted, questChoicePreview, questOutcome, questAutosave, policeHooks,
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
  const contentRoot = app.isPackaged ? join(process.resourcesPath, 'content') : join(app.getAppPath(), 'content');
  conversationInference = new BundledConversationInference(app, process.resourcesPath);
  conversationService = new ConversationService(
    conversationInference,
    new FileCharacterWritingStore(contentRoot),
  );
  registerConversationIpc(ipcMain, conversationService);
  window.webContents.once('destroyed', () => conversationService?.abortAll());
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

app.on('before-quit', (event) => {
  if (!conversationInference || quitCleanupFinished) return;
  event.preventDefault();
  if (quitCleanupStarted) return;
  quitCleanupStarted = true;
  conversationService?.abortAll();
  void conversationInference.stop().finally(() => {
    quitCleanupFinished = true;
    app.quit();
  });
});

if (smokeMode) {
  setTimeout(() => {
    if (!smokeFinished) {
      process.stderr.write('SI_WORLD_SMOKE_FAILURE renderer readiness timeout\n');
      app.exit(1);
    }
  }, 30_000);
}
