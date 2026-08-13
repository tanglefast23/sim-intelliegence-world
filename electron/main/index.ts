import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron';

import { ConversationService } from '../../src/ai/conversation/service';
import { FileCharacterWritingStore } from '../../src/ai/registry/file-writing-store';
import { WORLD_MAP_CATALOG } from '../../src/application/runtime/map-catalog';
import { CHARACTER_IDS } from '../../src/render/atlas';
import { responsiveSurface } from '../../src/render/responsive-layout';
import { EXPECTED_VFX_ANCHORS } from '../../src/render/vfx/fixtures';
import { registerConversationIpc } from '../conversation/ipc';
import { FileVerbalMissionContentStore } from '../conversation/file-verbal-mission-content-store';
import { registerRuntimeIpc, type RendererReadyReport } from '../ipc/contracts';
import { BundledConversationInference } from '../model/conversation-inference';
import { runPackagedModelSmoke } from '../model/model-smoke';
import { registerPersistenceIpc } from '../persistence/ipc';
import { registerPresentationPreferencesIpc } from '../persistence/presentation-preferences-ipc';
import {
  PresentationPreferencesRepository,
  presentationPreferencesPathForUserData,
} from '../persistence/presentation-preferences';
import { SaveRepository, saveRootForUserData } from '../persistence/save-repository';
import {
  APP_URL,
  createAppProtocolHandler,
  registerAppSchemePrivileges,
} from '../protocol/app-protocol';
import { lockWebContents, lockedWebPreferences } from './security';
import { captureLoadingSmokeFrame, captureNonEmptySmokeFrame } from './smoke-capture';

registerAppSchemePrivileges(protocol);

const smokeMode = process.env.SI_WORLD_SMOKE === '1';
const devHarnessMode = process.env.SI_WORLD_DEV_HARNESS === '1';
const devHarnessRoot = process.env.SI_WORLD_DEV_HARNESS_ROOT;
const modelSmokeMode = process.env.SI_WORLD_MODEL_SMOKE === '1';
const smokeExpectsModel = process.env.SI_WORLD_SMOKE_EXPECT_MODEL === '1';
const naturalMovementSmokeMode = process.env.SI_WORLD_NATURAL_MOVEMENT_SMOKE === '1';
const naturalMovementReducedMode = process.env.SI_WORLD_NATURAL_MOVEMENT_REDUCED === '1';
const responsiveSmokeMode = process.env.SI_WORLD_RESPONSIVE_SMOKE === '1';
const responsiveHighDpiMode = process.env.SI_WORLD_RESPONSIVE_HIGH_DPI === '1';
const fullCastPortraitSmokeMode = process.env.SI_WORLD_FULL_CAST_PORTRAIT_SMOKE === '1';
const proceduralVfxSmokeMode = process.env.SI_WORLD_PROCEDURAL_VFX_SMOKE === '1';
const proceduralVfxReducedMode = process.env.SI_WORLD_PROCEDURAL_VFX_REDUCED === '1';
const tierBArtSmokeMode = process.env.SI_WORLD_TIER_B_ART_SMOKE === '1';
const responsiveArtMode = process.env.SI_WORLD_ART_MODE;
const smokeVfxMode = process.env.SI_WORLD_VFX_MODE;
const presentationSeedSmokeMode = process.env.SI_WORLD_PRESENTATION_SEED_SMOKE === '1';
const presentationRestartSmokeMode = process.env.SI_WORLD_PRESENTATION_RESTART_SMOKE === '1';
const saveMigrationSmokeMode = process.env.SI_WORLD_SAVE_MIGRATION_SMOKE === '1';
const saveReloadSmokeMode = process.env.SI_WORLD_SAVE_RELOAD_SMOKE === '1';
if (smokeMode && devHarnessMode) {
  throw new Error('The developer harness and automated smoke mode cannot run together.');
}
if (devHarnessRoot && (!devHarnessMode || !isAbsolute(devHarnessRoot))) {
  throw new Error('SI_WORLD_DEV_HARNESS_ROOT requires dev harness mode and an absolute path.');
}
const processStartedAt = performance.now();
let smokeFinished = false;
let activeMainWindow: BrowserWindow | undefined;
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
  app.commandLine.appendSwitch('mute-audio');
}

if (responsiveHighDpiMode) {
  app.commandLine.appendSwitch('force-device-scale-factor', '2');
}

if (responsiveArtMode !== undefined && (!responsiveSmokeMode || !['legacy', 'enhanced'].includes(responsiveArtMode))) {
  throw new Error('Art mode is available only to responsive smoke as legacy or enhanced.');
}

if (smokeVfxMode !== undefined && (!smokeMode || !['circle', 'procedural'].includes(smokeVfxMode))) {
  throw new Error('VFX mode is available only to smoke runs as circle or procedural.');
}

if (naturalMovementReducedMode || proceduralVfxReducedMode) {
  app.commandLine.appendSwitch('force-prefers-reduced-motion', 'reduce');
}

if (smokeMode && process.env.SI_WORLD_SMOKE_SOFTWARE_RENDERING === '1') {
  app.disableHardwareAcceleration();
}

const waitForSmokeRetry = (milliseconds: number): Promise<void> =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function writeSmokeScreenshot(screenshotPath: string, image: Awaited<ReturnType<BrowserWindow['webContents']['capturePage']>>): Promise<Buffer> {
  const buffer = image.toPNG();
  await writeFile(screenshotPath, buffer, { flush: true });
  return buffer;
}

async function captureSmokeScreenshot(
  window: BrowserWindow,
  screenshotPath: string,
  deadlineMilliseconds?: number,
): Promise<Buffer> {
  const image = await captureNonEmptySmokeFrame(
    () => window.webContents.capturePage(undefined, { stayHidden: true }),
    waitForSmokeRetry,
    { deadlineMilliseconds },
  );
  return writeSmokeScreenshot(screenshotPath, image);
}

async function captureLoadingSmokeScreenshot(window: BrowserWindow, screenshotPath: string): Promise<Buffer> {
  const loadingVisible = (): Promise<boolean> => window.webContents.executeJavaScript(
    `Boolean(document.querySelector('#loading-shell'))`,
    true,
  ) as Promise<boolean>;
  const image = await captureLoadingSmokeFrame(
    () => window.webContents.capturePage(undefined, { stayHidden: true }),
    loadingVisible,
    waitForSmokeRetry,
  );
  return writeSmokeScreenshot(screenshotPath, image);
}

async function waitForRendererPaint(window: BrowserWindow): Promise<void> {
  await window.webContents.executeJavaScript(
    `Promise.race([
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
      new Promise((resolve) => setTimeout(() => resolve(false), 250)),
    ])`,
    true,
  );
}

async function captureDistinctSmokeScreenshot(
  window: BrowserWindow,
  screenshotPath: string,
  previousBuffers: readonly Buffer[],
  timeoutMilliseconds = 2_000,
): Promise<Buffer> {
  const deadline = Date.now() + timeoutMilliseconds;
  do {
    await waitForRendererPaint(window);
    if (Date.now() >= deadline) break;
    const buffer = await captureSmokeScreenshot(window, screenshotPath, deadline);
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

async function waitForRoofLabel(
  window: BrowserWindow,
  expectedLabel: 'Villa roof restored' | 'Villa roof hidden',
  timeoutMilliseconds = 6_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastLabel = '';
  while (Date.now() < deadline) {
    lastLabel = await roofLabel(window);
    if (lastLabel === expectedLabel) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for roof label ${expectedLabel}. Last label: ${lastLabel}`);
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

async function protagonistStateLabel(window: BrowserWindow): Promise<string> {
  return window.webContents.executeJavaScript(
    `document.querySelector('#world-protagonist-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as Promise<string>;
}

async function waitForSelector(window: BrowserWindow, selector: string, timeoutMilliseconds = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const found = await window.webContents.executeJavaScript(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      true,
    ) as boolean;
    if (found) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for renderer selector: ${selector}`);
}

async function waitForSelectorMissing(window: BrowserWindow, selector: string, timeoutMilliseconds = 6_000): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const found = await window.webContents.executeJavaScript(
      `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      true,
    ) as boolean;
    if (!found) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for renderer selector to close: ${selector}`);
}

function parseWorldStateLabel(label: string): Readonly<{ mapName: string; x: number; y: number; minute: number; speed: number }> {
  const match = /^(.*); tile (\d+),(\d+); minute (\d+); speed (\d+)(?:;.*)?$/u.exec(label);
  if (!match) throw new Error(`Invalid world-state label: ${label}`);
  return { mapName: match[1]!, x: Number(match[2]), y: Number(match[3]), minute: Number(match[4]), speed: Number(match[5]) };
}

async function waitForWorldState(
  window: BrowserWindow,
  predicate: (state: ReturnType<typeof parseWorldStateLabel>) => boolean,
  timeoutMilliseconds = 6_000,
): Promise<ReturnType<typeof parseWorldStateLabel>> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastState = parseWorldStateLabel(await worldStateLabel(window));
  while (Date.now() < deadline) {
    lastState = parseWorldStateLabel(await worldStateLabel(window));
    if (predicate(lastState)) return lastState;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for world state. Last state: ${JSON.stringify(lastState)}`);
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
  const match = /^World camera (-?\d+),(-?\d+) at (\d+(?:\.\d+)?)x$/u.exec(label);
  if (!match) throw new Error(`Invalid camera label: ${label}`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
}

async function clickZoomButton(window: BrowserWindow, zoom: 1 | 2 | 3): Promise<void> {
  await window.webContents.executeJavaScript(`(async () => {
    let value = document.querySelector('#world-ui-zoom-value');
    const settings = document.querySelector('[aria-label="Open display settings"]');
    if (!(value instanceof HTMLElement)) {
      if (!(settings instanceof HTMLElement)) throw new Error('Display settings button is missing.');
      settings.click();
      const deadline = Date.now() + 2_000;
      while (!(document.querySelector('#world-ui-zoom-value') instanceof HTMLElement) && Date.now() < deadline) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
      }
      value = document.querySelector('#world-ui-zoom-value');
    }
    if (!(value instanceof HTMLElement)) throw new Error('World zoom value is missing.');
    const currentPercentage = Number.parseInt(value.textContent ?? '', 10);
    const targetPercentage = ${zoom * 100};
    if (!Number.isFinite(currentPercentage)) throw new Error('World zoom value is invalid.');
    const label = targetPercentage > currentPercentage ? 'Increase world zoom' : 'Decrease world zoom';
    const button = document.querySelector('[aria-label="' + label + '"]');
    const clicks = Math.abs(targetPercentage - currentPercentage) / 10;
    if (!Number.isInteger(clicks)) throw new Error('World zoom cannot reach the requested ten-percent step.');
    if (clicks > 0 && !(button instanceof HTMLElement)) throw new Error(label + ' button is missing.');
    for (let index = 0; index < clicks; index += 1) button.click();
  })()`, true);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
}

async function captureTierBMapZoomSet(
  window: BrowserWindow,
  directory: string,
  label: 'downtown' | 'commercial' | 'ferry',
  oneXBuffer: Buffer,
): Promise<Buffer> {
  await writeFile(join(directory, `world-${label}-1x.png`), oneXBuffer, { flush: true });
  const buffers = [oneXBuffer];
  for (const zoom of [2, 3] as const) {
    await clickZoomButton(window, zoom);
    buffers.push(await captureDistinctSmokeScreenshot(
      window,
      join(directory, `world-${label}-${zoom}x.png`),
      buffers,
      4_000,
    ));
  }
  await clickZoomButton(window, 1);
  return buffers.at(-1) as Buffer;
}

async function clickUiScaleButton(window: BrowserWindow, percentage: 100 | 125 | 150): Promise<void> {
  await clickAriaButton(window, `Set ${percentage} percent interface scale`);
}

async function responsiveEvidence(window: BrowserWindow): Promise<Record<string, unknown>> {
  const label = await window.webContents.executeJavaScript(
    `document.querySelector('#world-responsive-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as string;
  if (!label) throw new Error('Responsive evidence is missing.');
  return JSON.parse(label) as Record<string, unknown>;
}

async function vfxEvidence(window: BrowserWindow): Promise<Record<string, unknown>> {
  const label = await window.webContents.executeJavaScript(
    `document.querySelector('#world-vfx-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as string;
  if (!label) throw new Error('VFX evidence is missing.');
  return JSON.parse(label) as Record<string, unknown>;
}

async function waitForVfxEvidence(
  window: BrowserWindow,
  predicate: (evidence: Record<string, unknown>) => boolean,
  timeoutMilliseconds = 10_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastEvidence: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    lastEvidence = await vfxEvidence(window);
    if (predicate(lastEvidence)) return lastEvidence;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for VFX evidence. Last evidence: ${JSON.stringify(lastEvidence)}`);
}

async function geometryEvidence(window: BrowserWindow): Promise<Readonly<{
  mapId: string;
  start: Readonly<{
    protagonist: Readonly<{ x: number; y: number }>;
    movementTarget: Readonly<{ x: number; y: number }>;
  }>;
  roof: Readonly<{ exteriorTile: Readonly<{ x: number; y: number }> }>;
}>> {
  const label = await window.webContents.executeJavaScript(
    `document.querySelector('#world-geometry-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as string;
  if (!label) throw new Error('Stable smoke geometry evidence is missing.');
  const candidate = JSON.parse(label) as Record<string, unknown>;
  const start = candidate.start as Record<string, unknown> | undefined;
  const protagonist = start?.protagonist as Record<string, unknown> | undefined;
  const movementTarget = start?.movementTarget as Record<string, unknown> | undefined;
  const roof = candidate.roof as Record<string, unknown> | undefined;
  const exteriorTile = roof?.exteriorTile as Record<string, unknown> | undefined;
  if (
    candidate.mapId !== 'northwest_residential' ||
    !Number.isInteger(protagonist?.x) || !Number.isInteger(protagonist?.y) ||
    !Number.isInteger(movementTarget?.x) || !Number.isInteger(movementTarget?.y) ||
    !Number.isInteger(exteriorTile?.x) || !Number.isInteger(exteriorTile?.y)
  ) {
    throw new Error('Stable smoke geometry evidence is invalid.');
  }
  return candidate as unknown as Readonly<{
    mapId: string;
    start: Readonly<{
      protagonist: Readonly<{ x: number; y: number }>;
      movementTarget: Readonly<{ x: number; y: number }>;
    }>;
    roof: Readonly<{ exteriorTile: Readonly<{ x: number; y: number }> }>;
  }>;
}

async function waitForResponsiveEvidence(
  window: BrowserWindow,
  predicate: (evidence: Record<string, unknown>) => boolean,
  timeoutMilliseconds = 6_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMilliseconds;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    try {
      last = await responsiveEvidence(window);
      if (predicate(last)) return last;
    } catch {
      // The first responsive evidence is emitted after two rendered frames.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Responsive evidence did not reach the expected state. Last: ${JSON.stringify(last)}`);
}

async function resizeContentAndWait(
  window: BrowserWindow,
  width: number,
  height: number,
  timeoutMilliseconds = 6_000,
): Promise<SurfaceBounds> {
  if (window.isMaximized()) {
    window.unmaximize();
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  window.setContentSize(width, height);
  const expected = responsiveSurface(width, height).surface;
  const deadline = Date.now() + timeoutMilliseconds;
  let last = await surfaceBounds(window);
  while (Date.now() < deadline) {
    last = await surfaceBounds(window);
    if (Math.abs(last.width - expected.width) <= 1 && Math.abs(last.height - expected.height) <= 1) {
      await waitForRendererPaint(window);
      return last;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Responsive surface did not reach ${expected.width}x${expected.height}. Last: ${JSON.stringify(last)}`);
}

async function clickAriaButton(window: BrowserWindow, label: string): Promise<void> {
  const result = await window.webContents.executeJavaScript(`(() => {
    try {
      const button = Array.from(document.querySelectorAll('[aria-label]')).find(
        (element) => (element.getAttribute('aria-label') ?? '').toLowerCase() === ${JSON.stringify(label)}.toLowerCase(),
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

async function waitForWorldMinuteStable(
  window: BrowserWindow,
  stableMilliseconds = 1_500,
  timeoutMilliseconds = 8_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  let stableSince = Date.now();
  let lastMinute = parseWorldStateLabel(await worldStateLabel(window)).minute;
  while (Date.now() < deadline) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    const minute = parseWorldStateLabel(await worldStateLabel(window)).minute;
    if (minute !== lastMinute) {
      lastMinute = minute;
      stableSince = Date.now();
      continue;
    }
    if (Date.now() - stableSince >= stableMilliseconds) return;
  }
  throw new Error(`Timed out waiting for the world clock to pause. Last minute: ${lastMinute}`);
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

async function waitForAriaButtonEnabled(
  window: BrowserWindow,
  label: string,
  timeoutMilliseconds = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const enabled = await window.webContents.executeJavaScript(`(() => {
      const button = Array.from(document.querySelectorAll('[aria-label]')).find(
        (element) => (element.getAttribute('aria-label') ?? '').toLowerCase() === ${JSON.stringify(label)}.toLowerCase(),
      );
      return button instanceof HTMLElement && button.getAttribute('aria-disabled') !== 'true' &&
        !('disabled' in button && button.disabled === true);
    })()`, true) as boolean;
    if (enabled) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for enabled button: ${label}`);
}

async function conversationTranscriptMeasure(window: BrowserWindow): Promise<number> {
  return window.webContents.executeJavaScript(`(() => {
    const transcript = document.querySelector('#conversation-transcript');
    if (!(transcript instanceof HTMLElement)) throw new Error('Conversation transcript is missing.');
    return transcript.textContent?.length ?? 0;
  })()`, true) as Promise<number>;
}

async function waitForConversationTurnComplete(
  window: BrowserWindow,
  priorTranscriptChildCount: number,
  timeoutMilliseconds = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastChildCount = priorTranscriptChildCount;
  while (Date.now() < deadline) {
    const state = await window.webContents.executeJavaScript(`(() => {
      const transcript = document.querySelector('#conversation-transcript');
      const endButton = Array.from(document.querySelectorAll('[aria-label]')).find(
        (element) => element.getAttribute('aria-label') === 'End conversation',
      );
      if (!(transcript instanceof HTMLElement) || !(endButton instanceof HTMLElement)) {
        return { childCount: 0, endEnabled: false };
      }
      const endEnabled = endButton.getAttribute('aria-disabled') !== 'true' &&
        !('disabled' in endButton && endButton.disabled === true);
      return { childCount: transcript.textContent?.length ?? 0, endEnabled };
    })()`, true) as Readonly<{ childCount: number; endEnabled: boolean }>;
    lastChildCount = state.childCount;
    if (state.endEnabled && state.childCount >= priorTranscriptChildCount + 2) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(
    `Timed out waiting for a completed conversation turn. Transcript children: ${lastChildCount}; prior: ${priorTranscriptChildCount}`,
  );
}

function sendMouseClick(window: BrowserWindow, x: number, y: number): void {
  window.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
}

function sendKey(window: BrowserWindow, keyCode: 'Enter' | 'F' | 'Q' | 'Escape'): void {
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
    const viewport = element.querySelector('#world-input-viewport');
    if (!(viewport instanceof HTMLElement)) throw new Error('World input viewport is missing.');
    const bounds = viewport.getBoundingClientRect();
    const clientX = bounds.left + (${tile.x} * 32 + 16 - ${camera.x}) * ${camera.zoom};
    const clientY = bounds.top + (${tile.y} * 32 + 16 - ${camera.y}) * ${camera.zoom};
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX, clientY, pointerId: 91 }));
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX, clientY, pointerId: 91 }));
  })()`, true);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
}

type MovementSmokeActor = Readonly<{
  committed: Readonly<{ x: number; y: number }>;
  visualFoot: Readonly<{ x: number; y: number }>;
  direction: 'up' | 'down' | 'left' | 'right';
  walkFrame: 0 | 1;
  status: 'idle' | 'moving' | 'waiting' | 'unreachable';
  target?: Readonly<{ x: number; y: number }> | null;
  curveActive: boolean;
  horizontalRunDistance?: number;
  protagonistWobbleDegrees?: number;
}>;

type MovementSmokeState = Readonly<{
  reducedMotion: boolean;
  player: MovementSmokeActor;
  npcs: Readonly<Record<string, MovementSmokeActor>>;
}>;

type MovementSmokeSample = MovementSmokeState & Readonly<{
  evidenceTag?: 'interruption';
}>;

async function movementSmokeState(window: BrowserWindow): Promise<MovementSmokeState> {
  const label = await window.webContents.executeJavaScript(
    `document.querySelector('#world-movement-state')?.getAttribute('aria-label') ?? ''`,
    true,
  ) as string;
  if (!label) throw new Error('Natural-movement smoke evidence is missing.');
  const candidate = JSON.parse(label) as MovementSmokeState;
  if (
    !candidate.player || !candidate.npcs || typeof candidate.reducedMotion !== 'boolean' ||
    !Number.isFinite(candidate.player.visualFoot?.x) || !Number.isFinite(candidate.player.visualFoot?.y)
  ) throw new Error('Natural-movement smoke evidence is invalid.');
  return candidate;
}

async function waitForMovementSmokeState(
  window: BrowserWindow,
  predicate: (state: MovementSmokeState) => boolean,
  timeoutMilliseconds = 12_000,
): Promise<MovementSmokeState> {
  const deadline = Date.now() + timeoutMilliseconds;
  let last: MovementSmokeState | undefined;
  while (Date.now() < deadline) {
    await waitForRendererPaint(window);
    last = await movementSmokeState(window);
    if (predicate(last)) return last;
  }
  throw new Error(`Natural-movement smoke state timed out. Last: ${JSON.stringify(last)}`);
}

async function startMovementSmokeSampling(window: BrowserWindow): Promise<void> {
  await window.webContents.executeJavaScript(`(() => {
    if (globalThis.__siWorldMovementSampler?.active) {
      throw new Error('Natural-movement sampling is already active.');
    }
    const sampler = { active: true, samples: [] };
    globalThis.__siWorldMovementSampler = sampler;
    const frame = () => {
      if (!sampler.active) return;
      const label = document.querySelector('#world-movement-state')?.getAttribute('aria-label') ?? '';
      if (label && sampler.samples.length < 900) sampler.samples.push(JSON.parse(label));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })()`, true);
}

async function stopMovementSmokeSampling(window: BrowserWindow): Promise<MovementSmokeState[]> {
  return window.webContents.executeJavaScript(`(() => {
    const sampler = globalThis.__siWorldMovementSampler;
    if (!sampler) throw new Error('Natural-movement sampling was not started.');
    sampler.active = false;
    delete globalThis.__siWorldMovementSampler;
    return sampler.samples;
  })()`, true) as Promise<MovementSmokeState[]>;
}

async function captureMovementPass(
  window: BrowserWindow,
  directory: string,
  mode: 'standard' | 'reduced',
): Promise<Record<string, unknown>> {
  await startResponsiveSmokeGame(window);
  await clickZoomButton(window, 1);
  await clickAriaButton(window, 'Set 1x time');
  await waitForWorldState(window, (state) => state.speed === 1, 10_000);

  const start = { x: 18, y: 18 };
  const target = { x: 22, y: 22 };
  await startMovementSmokeSampling(window);
  await clickWorldTile(window, target);
  const samples: MovementSmokeSample[] = [];
  const screenshotNames: string[] = [];
  const screenshotBuffers: Buffer[] = [];
  const firstSegmentPositions = new Set<string>();
  const playerWalkFrames = new Set<0 | 1>();
  const npcWalkFrames = new Set<0 | 1>();
  let curveObserved = false;

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await waitForRendererPaint(window);
    const sample = await movementSmokeState(window);
    if (sample.player.status === 'moving' && screenshotNames.length < (mode === 'standard' ? 4 : 1)) {
      const name = `${mode}-1x-frame-${String(screenshotNames.length + 1).padStart(2, '0')}.png`;
      screenshotBuffers.push(await captureDistinctSmokeScreenshot(
        window,
        join(directory, name),
        screenshotBuffers,
        4_000,
      ));
      screenshotNames.push(name);
    }
    const atTarget = sample.player.committed.x === target.x && sample.player.committed.y === target.y;
    if (atTarget && sample.player.status === 'idle') break;
  }
  const lastRouteSample = await movementSmokeState(window);
  if (lastRouteSample.player.committed.x !== target.x || lastRouteSample.player.committed.y !== target.y) {
    throw new Error('Natural-movement package pass did not reach the diagonal target.');
  }
  const routeSamples = await stopMovementSmokeSampling(window);
  for (const sample of routeSamples) {
    samples.push(sample);
    playerWalkFrames.add(sample.player.walkFrame);
    for (const npc of Object.values(sample.npcs)) {
      if (npc.status === 'moving') npcWalkFrames.add(npc.walkFrame);
    }
    curveObserved ||= sample.player.curveActive;
    if (sample.player.committed.x === start.x && sample.player.committed.y === start.y) {
      firstSegmentPositions.add(`${sample.player.visualFoot.x},${sample.player.visualFoot.y}`);
    }
  }

  let interruptionObserved = false;
  let rendererFps: number | null = null;
  let displayRafFps: number | null = null;
  if (mode === 'standard') {
    for (const zoom of [2, 3] as const) {
      await clickZoomButton(window, zoom);
      const destination = zoom === 2 ? start : target;
      await dispatchWorldTileClick(window, destination);
      await waitForMovementSmokeState(window, (state) => state.player.status === 'moving');
      const name = `standard-${zoom}x-moving.png`;
      screenshotBuffers.push(await captureDistinctSmokeScreenshot(window, join(directory, name), screenshotBuffers, 4_000));
      screenshotNames.push(name);
      await waitForMovementSmokeState(window, (state) => (
        state.player.status === 'idle' &&
        state.player.committed.x === destination.x && state.player.committed.y === destination.y
      ));
    }

    await dispatchWorldTileClick(window, start);
    await waitForMovementSmokeState(window, (state) => state.player.status === 'moving');
    await dispatchWorldTileClick(window, { x: 24, y: 22 });
    const interrupted = await waitForMovementSmokeState(window, (state) => (
      state.player.status === 'moving' && state.player.target?.x === 24 && state.player.target.y === 22
    ));
    samples.push({ ...interrupted, evidenceTag: 'interruption' });
    interruptionObserved = interrupted.player.committed.x !== 24 || interrupted.player.committed.y !== 22;
    const interruptName = 'standard-interruption.png';
    screenshotBuffers.push(await captureDistinctSmokeScreenshot(window, join(directory, interruptName), screenshotBuffers, 4_000));
    screenshotNames.push(interruptName);
    await waitForMovementSmokeState(window, (state) => (
      state.player.status === 'idle' && state.player.committed.x === 24 && state.player.committed.y === 22
    ), 20_000);

    await clickZoomButton(window, 1);
    await dispatchWorldTileClick(window, { x: 40, y: 36 });
    await waitForMovementSmokeState(window, (state) => state.player.status === 'moving');
    const performance = await measureRendererFps(window, 2_000);
    rendererFps = performance.rendererFps;
    displayRafFps = performance.displayRafFps;
    const crowdName = 'standard-crowd-performance.png';
    screenshotBuffers.push(await captureDistinctSmokeScreenshot(window, join(directory, crowdName), screenshotBuffers, 4_000));
    screenshotNames.push(crowdName);
  }

  return {
    schemaVersion: 2,
    mode,
    samples: samples.map((sample) => ({
      ...sample,
      npcs: Object.fromEntries(
        Object.entries(sample.npcs).filter(([, movement]) => movement.status === 'moving'),
      ),
    })),
    firstSegmentUniquePositions: firstSegmentPositions.size,
    curveObserved,
    interruptionObserved,
    playerWalkFrames: [...playerWalkFrames].sort(),
    npcWalkFrames: [...npcWalkFrames].sort(),
    rendererFps,
    displayRafFps,
    screenshotNames,
  };
}

async function panWorld(window: BrowserWindow, deltaX: number, deltaY: number): Promise<void> {
  const bounds = await surfaceBounds(window);
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  window.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(start.x), y: Math.round(start.y), button: 'middle', clickCount: 1 });
  window.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(start.x + deltaX), y: Math.round(start.y + deltaY), button: 'middle' });
  window.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(start.x + deltaX), y: Math.round(start.y + deltaY), button: 'middle', clickCount: 1 });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  await waitForRendererPaint(window);
}

type ResponsiveSmokeTarget = Readonly<{ width: number; height: number }>;

const RESPONSIVE_SMOKE_TARGETS: readonly ResponsiveSmokeTarget[] = [
  { width: 1_280, height: 720 },
  { width: 1_440, height: 900 },
  { width: 1_920, height: 1_080 },
  { width: 2_560, height: 1_440 },
  { width: 1_600, height: 720 },
];

const FULL_CAST_PORTRAIT_IDS = CHARACTER_IDS;

function cameraCenter(camera: Readonly<{ x: number; y: number; zoom: number }>, bounds: SurfaceBounds) {
  return {
    x: Math.round((camera.x + bounds.width / camera.zoom / 2) * 100) / 100,
    y: Math.round((camera.y + bounds.height / camera.zoom / 2) * 100) / 100,
  };
}

async function measureRendererFps(window: BrowserWindow, durationMilliseconds = 2_000): Promise<Readonly<{
  rendererFps: number;
  displayRafFps: number;
  medianFrameTimeMilliseconds: number;
  sampledFrames: number;
  cameraChangeFrames: number;
}>> {
  return await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const surface = document.querySelector('#world-input-surface');
      if (!surface) {
        reject(new Error('World input surface is missing for active-render measurement.'));
        return;
      }
      const startedAt = performance.now();
      const frames = [];
      let cameraChangeFrames = 0;
      let lastCamera = document.querySelector('#world-camera-state')?.getAttribute('aria-label') ?? '';
      let panDirection = 6;
      const frame = (now) => {
        frames.push(now);
        const camera = document.querySelector('#world-camera-state')?.getAttribute('aria-label') ?? '';
        if (camera !== lastCamera) {
          cameraChangeFrames += 1;
          lastCamera = camera;
        }
        if (now - startedAt >= ${durationMilliseconds}) {
          const duration = frames.length > 1 ? frames[frames.length - 1] - frames[0] : 0;
          const displayRafFps = duration > 0 ? (frames.length - 1) * 1000 / duration : 0;
          const rendererFps = duration > 0 ? cameraChangeFrames * 1000 / duration : 0;
          const intervals = frames.slice(1).map((value, index) => value - frames[index]).sort((left, right) => left - right);
          const middle = Math.floor(intervals.length / 2);
          const medianFrameTimeMilliseconds = intervals.length === 0
            ? 0
            : intervals.length % 2 === 0
              ? (intervals[middle - 1] + intervals[middle]) / 2
              : intervals[middle];
          resolve({
            rendererFps: Math.round(rendererFps * 100) / 100,
            displayRafFps: Math.round(displayRafFps * 100) / 100,
            medianFrameTimeMilliseconds: Math.round(medianFrameTimeMilliseconds * 1000) / 1000,
            sampledFrames: frames.length,
            cameraChangeFrames,
          });
          return;
        }
        surface.dispatchEvent(new CustomEvent('si-world-active-pan-proof', {
          detail: { x: 0, y: panDirection },
        }));
        panDirection = -panDirection;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    })`, true) as Readonly<{
      rendererFps: number;
      displayRafFps: number;
      medianFrameTimeMilliseconds: number;
      sampledFrames: number;
      cameraChangeFrames: number;
    }>;
}

async function startResponsiveSmokeGame(window: BrowserWindow): Promise<void> {
  await waitForSelector(window, '#new-game-flow');
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Player name"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Player name input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'MATRIX');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  })()`, true);
  sendKey(window, 'Enter');
  await waitForSelector(window, '#world-state', 20_000);
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 1');
  await clickAriaButton(window, 'Pause time');
}

async function openLindaConversationForResponsiveSmoke(window: BrowserWindow): Promise<Record<string, unknown>> {
  const lindaTile = parseLindaTile(await npcStateLabel(window));
  await dispatchWorldTileClick(window, lindaTile);
  await clickAriaButton(window, 'Talk to Linda');
  if (await window.webContents.executeJavaScript(`Boolean(document.querySelector('#world-ui-quest-offer-panel'))`, true) as boolean) {
    await clickAriaButton(window, "Accept Linda's request");
    await waitForSelectorMissing(window, '#world-ui-quest-offer-panel');
    await clickAriaButton(window, 'Talk to Linda');
  }
  await waitForRendererText(window, '#world-ui-conversation-panel', 'TIME PAUSED');
  return waitForResponsiveEvidence(window, (evidence) => {
    const panel = evidence.activePanel as { id?: unknown; rect?: { width?: unknown; height?: unknown } } | null;
    const input = evidence.conversationInput as { width?: unknown; height?: unknown } | null;
    return panel?.id === 'world-ui-conversation-panel' && Number(panel.rect?.width) > 0 &&
      Number(panel.rect?.height) > 0 && Number(input?.width) > 0 && Number(input?.height) > 0;
  });
}

async function captureFullCastPortraitMatrix(
  window: BrowserWindow,
  directory: string,
): Promise<readonly Record<string, unknown>[]> {
  if (responsiveHighDpiMode) throw new Error('Full-cast portrait smoke must use the ordinary responsive shell.');
  await resizeContentAndWait(window, 1_440, 900, 10_000);
  const entries: Record<string, unknown>[] = [];
  const portraitDirectory = join(directory, 'full-cast-portraits');
  await mkdir(portraitDirectory, { recursive: true });

  for (const uiScale of [1, 1.25, 1.5] as const) {
    const percentage = uiScale === 1 ? 100 : uiScale === 1.25 ? 125 : 150;
    await clickUiScaleButton(window, percentage);
    await waitForResponsiveEvidence(window, (evidence) => evidence.uiScale === uiScale);
    for (const characterId of FULL_CAST_PORTRAIT_IDS) {
      await window.webContents.executeJavaScript(
        `window.siWorldOpenConversationFixture?.(${JSON.stringify(characterId)})`,
        true,
      );
      await waitForSelector(window, `#conversation-portrait-${characterId}`, 10_000);
      await waitForSelector(window, `#conversation-portrait-${characterId}-ready`, 10_000);
      await waitForRendererText(window, '#world-ui-conversation-panel', 'TIME PAUSED', 10_000);
      await waitForRendererPaint(window);
      await waitForRendererPaint(window);
      const evidence = await waitForResponsiveEvidence(window, (candidate) => (
        candidate.uiScale === uiScale &&
        (candidate.activePanel as { id?: unknown } | null)?.id === 'world-ui-conversation-panel' &&
        candidate.conversationInput !== null
      ));
      const geometry = await window.webContents.executeJavaScript(`(() => {
        const portrait = document.querySelector(${JSON.stringify(`#conversation-portrait-${characterId}`)});
        const input = document.querySelector('[aria-label="Conversation message"]');
        const transcript = document.querySelector('#conversation-transcript');
        if (!(portrait instanceof HTMLElement) || !(input instanceof HTMLElement) || !(transcript instanceof HTMLElement)) {
          throw new Error('Full-cast portrait fixture is incomplete.');
        }
        const rectangle = (element) => {
          const value = element.getBoundingClientRect();
          return { x: value.x, y: value.y, width: value.width, height: value.height };
        };
        return {
          portraitRect: rectangle(portrait),
          inputRect: rectangle(input),
          transcriptFontSize: Number.parseFloat(getComputedStyle(transcript).fontSize),
        };
      })()`, true) as Record<string, unknown>;
      const screenshot = `full-cast-portraits/${percentage}-${characterId}.png`;
      await captureSmokeScreenshot(window, join(directory, screenshot));
      entries.push({ characterId, uiScale, screenshot, evidence, ...geometry });
      await window.webContents.executeJavaScript('window.siWorldCloseConversationFixture?.()', true);
      await waitForSelectorMissing(window, '#world-ui-conversation-panel');
    }
  }
  return entries;
}

async function captureResponsiveSmoke(
  window: BrowserWindow,
  directory: string,
): Promise<Record<string, unknown>> {
  await startResponsiveSmokeGame(window);
  const geometry = await geometryEvidence(window);
  const targets = responsiveHighDpiMode ? [RESPONSIVE_SMOKE_TARGETS[3]!] : RESPONSIVE_SMOKE_TARGETS;
  const targetReports: Record<string, unknown>[] = [];
  let clickAlternate = false;

  for (const target of targets) {
    const label = `${target.width}x${target.height}`;
    process.stdout.write(`SI_WORLD_RESPONSIVE_PROGRESS ${label}\n`);
    const beforeBounds = await surfaceBounds(window);
    const beforeCamera = parseCameraLabel(await cameraLabel(window));
    const centerBefore = cameraCenter(beforeCamera, beforeBounds);
    const bounds = await resizeContentAndWait(window, target.width, target.height, 10_000);
    const afterResizeEvidence = await waitForResponsiveEvidence(window, (evidence) => {
      const content = evidence.content as { width?: unknown; height?: unknown } | undefined;
      const candidateSurface = evidence.surface as { width?: unknown; height?: unknown } | undefined;
      const overflow = evidence.overflow as { body?: unknown; surface?: unknown } | undefined;
      return content?.width === target.width && content.height === target.height &&
        typeof candidateSurface?.width === 'number' && typeof candidateSurface.height === 'number' &&
        Math.abs(candidateSurface.width - bounds.width) <= 1 &&
        Math.abs(candidateSurface.height - bounds.height) <= 1 &&
        overflow?.body === false && overflow.surface === false;
    }, 10_000);
    const afterCamera = parseCameraLabel(await cameraLabel(window));
    const centerAfter = cameraCenter(afterCamera, bounds);

    const zoomScreenshots: string[] = [];
    const zoomBuffers: Buffer[] = [];
    for (const zoom of [1, 2, 3] as const) {
      await clickZoomButton(window, zoom);
      await waitForResponsiveEvidence(window, (evidence) => evidence.selectedWorldZoom === zoom);
      const screenshotPath = join(directory, `${label}-${zoom}x.png`);
      zoomBuffers.push(await captureDistinctSmokeScreenshot(window, screenshotPath, zoomBuffers, 4_000));
      zoomScreenshots.push(`${label}-${zoom}x.png`);
    }
    await clickZoomButton(window, 1);
    const clickedTile = clickAlternate ? geometry.start.protagonist : geometry.start.movementTarget;
    clickAlternate = !clickAlternate;
    await clickAriaButton(window, 'Set 1x time');
    await waitForWorldState(window, (state) => state.speed === 1, 10_000);
    await dispatchWorldTileClick(window, clickedTile);
    await waitForWorldTile(window, clickedTile, 10_000);
    await clickAriaButton(window, 'Pause time');
    await waitForWorldState(window, (state) => state.speed === 0, 10_000);

    const conversationEvidence = await openLindaConversationForResponsiveSmoke(window);
    const conversationScreenshot = join(directory, `${label}-conversation.png`);
    await captureDistinctSmokeScreenshot(window, conversationScreenshot, zoomBuffers, 4_000);
    await clickAriaButton(window, 'Cancel conversation');
    await waitForSelectorMissing(window, '#world-ui-conversation-panel');

    targetReports.push({
      requested: target,
      measuredSurface: bounds,
      centerBefore,
      centerAfter,
      clickedTile,
      afterResizeEvidence,
      conversationEvidence,
      screenshots: { zoom: zoomScreenshots, conversation: `${label}-conversation.png` },
    });
  }

  const fullCastPortraitMatrix = fullCastPortraitSmokeMode
    ? await captureFullCastPortraitMatrix(window, directory)
    : null;

  let maximumLoad: Record<string, unknown> | null = null;
  if (responsiveHighDpiMode) {
    await clickZoomButton(window, 1);
    await clickAriaButton(window, 'Set 1x time');
    await waitForWorldState(window, (state) => state.speed === 1, 10_000);
    await dispatchWorldTileClick(window, geometry.roof.exteriorTile);
    await waitForWorldTile(window, geometry.roof.exteriorTile, 20_000);
    await clickAriaButton(window, 'Pause time');
    await waitForWorldState(window, (state) => state.speed === 0, 10_000);
    await waitForRoofLabel(window, 'Villa roof restored', 10_000);
    const evidence = await waitForResponsiveEvidence(window, (candidate) =>
      candidate.selectedWorldZoom === 1 && candidate.roofState === 'restored');
    const drawCounts = evidence.drawCounts as Record<string, number> | undefined;
    const ordinaryLayers = ['floor', 'prop', 'shadow', 'character', 'effect', 'wall', 'roof'];
    const allOrdinaryLayersEnabled = ordinaryLayers.every((layer) => Number(drawCounts?.[layer]) > 0);
    const rendererMeasurement = await measureRendererFps(window);
    const roundedFps = Math.round(rendererMeasurement.rendererFps);
    const qualificationRequired = process.env.SI_WORLD_SMOKE_PROFILE === 'qualification';
    if (Number(evidence.devicePixelRatio) < 2) throw new Error('High-DPI smoke did not reach device pixel ratio 2.');
    if (!allOrdinaryLayersEnabled) {
      throw new Error(`Maximum-load smoke did not include every ordinary world layer: ${JSON.stringify(drawCounts)}`);
    }
    if (qualificationRequired && roundedFps < 60) {
      throw new Error(`Maximum-load active-render rounded FPS is below 60: ${roundedFps}.`);
    }
    const screenshotName = 'maximum-load.png';
    await captureSmokeScreenshot(window, join(directory, screenshotName));
    maximumLoad = {
      evidence,
      ...rendererMeasurement,
      roundedFps,
      qualificationRequired,
      allOrdinaryLayersEnabled,
      screenshot: screenshotName,
    };
  } else {
    await clickZoomButton(window, 3);
    await clickUiScaleButton(window, 125);
    await waitForResponsiveEvidence(window, (evidence) => evidence.selectedWorldZoom === 3 && evidence.uiScale === 1.25);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 400));
  }

  return {
    schemaVersion: 1,
    highDpi: responsiveHighDpiMode,
    geometry,
    targets: targetReports,
    fullCastPortraitMatrix,
    maximumLoad,
  };
}

async function captureProceduralVfxSmoke(
  window: BrowserWindow,
  directory: string,
): Promise<Record<string, unknown>> {
  await startResponsiveSmokeGame(window);
  await clickAriaButton(window, 'Set 1x time');
  await waitForWorldState(window, (state) => state.speed === 1, 10_000);
  const mode = smokeVfxMode === 'circle' ? 'circle' : 'procedural';
  const motionMode = proceduralVfxReducedMode ? 'reduced' : 'standard';
  const anchorReports: Record<string, unknown>[] = [];

  for (const anchor of EXPECTED_VFX_ANCHORS) {
    await window.webContents.executeJavaScript(
      `window.siWorldOpenVfxFixture?.(${JSON.stringify(anchor.mapId)}, ${JSON.stringify(anchor.id)})`,
      true,
    );
    const fixtureEvidence = await waitForVfxEvidence(window, (candidate) => (
      candidate.mapId === anchor.mapId &&
      Array.isArray(candidate.visibleEmitterIds) &&
      candidate.visibleEmitterIds.includes(anchor.id) &&
      candidate.mode === mode &&
      candidate.reducedMotion === proceduralVfxReducedMode
    ));
    const screenshots: string[] = [];
    for (const zoom of [1, 2, 3] as const) {
      await clickZoomButton(window, zoom);
      await window.webContents.executeJavaScript(
        `window.siWorldOpenVfxFixture?.(${JSON.stringify(anchor.mapId)}, ${JSON.stringify(anchor.id)})`,
        true,
      );
      await waitForVfxEvidence(window, (candidate) => (
        candidate.mapId === anchor.mapId &&
        Array.isArray(candidate.visibleEmitterIds) &&
        candidate.visibleEmitterIds.includes(anchor.id)
      ));
      await window.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))', true);
      const name = `${anchor.mapId}-${anchor.id}-${mode}-${motionMode}-${zoom}x.png`;
      await captureSmokeScreenshot(window, join(directory, name));
      screenshots.push(name);
    }
    anchorReports.push({
      ...anchor,
      fixtureEvidence,
      camera: parseCameraLabel(await cameraLabel(window)),
      screenshots,
    });
  }

  const pauseAnchor = EXPECTED_VFX_ANCHORS.find(({ id }) => id === 'patio-fire');
  if (!pauseAnchor) throw new Error('The patio-fire VFX fixture is missing.');
  await clickZoomButton(window, 1);
  await window.webContents.executeJavaScript(
    `window.siWorldOpenVfxFixture?.(${JSON.stringify(pauseAnchor.mapId)}, ${JSON.stringify(pauseAnchor.id)})`,
    true,
  );
  const activeBefore = await waitForVfxEvidence(window, (candidate) => candidate.mapId === pauseAnchor.mapId);
  if (mode === 'procedural') {
    await waitForVfxEvidence(window, (candidate) => (
      candidate.mapId === pauseAnchor.mapId &&
      Number(candidate.ageStep) > Number(activeBefore.ageStep)
    ));
  } else {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 450));
  }
  await clickAriaButton(window, 'Pause time');
  await waitForWorldState(window, (state) => state.speed === 0, 10_000);
  const pausedBefore = await vfxEvidence(window);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 450));
  const pausedAfter = await vfxEvidence(window);
  if (pausedBefore.ageStep !== pausedAfter.ageStep) {
    throw new Error(`VFX age advanced while paused: ${String(pausedBefore.ageStep)} to ${String(pausedAfter.ageStep)}.`);
  }
  const pausedScreenshot = `patio-fire-${mode}-${motionMode}-paused.png`;
  await captureSmokeScreenshot(window, join(directory, pausedScreenshot));
  await clickAriaButton(window, 'Set 1x time');
  await waitForWorldState(window, (state) => state.speed === 1, 10_000);
  await window.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))', true);
  const resumedEvidence = await vfxEvidence(window);
  const resumedScreenshot = `patio-fire-${mode}-${motionMode}-resumed.png`;
  await captureSmokeScreenshot(window, join(directory, resumedScreenshot));

  const rendererMeasurement = await measureRendererFps(window);
  const roundedFps = Math.round(rendererMeasurement.rendererFps);
  if (process.env.SI_WORLD_SMOKE_PROFILE === 'qualification' && roundedFps < 60) {
    throw new Error(`Procedural VFX package smoke is below 60 rounded FPS: ${roundedFps}.`);
  }

  return {
    schemaVersion: 1,
    mode,
    motionMode,
    artPresentation: await window.webContents.executeJavaScript(
      `document.querySelector('#world-art-presentation')?.getAttribute('aria-label') ?? ''`,
      true,
    ) as string,
    contentSize: Object.freeze((() => {
      const [width, height] = window.getContentSize();
      return { width, height };
    })()),
    devicePixelRatio: await window.webContents.executeJavaScript('window.devicePixelRatio', true) as number,
    anchors: anchorReports,
    pause: {
      frozen: true,
      ageStep: pausedAfter.ageStep,
      pausedScreenshot,
      resumedAgeStep: resumedEvidence.ageStep,
      resumedScreenshot,
    },
    maximumLoad: {
      ...rendererMeasurement,
      roundedFps,
      evidence: resumedEvidence,
    },
  };
}

async function capturePresentationPreferenceSmoke(
  window: BrowserWindow,
  mode: 'seed' | 'restart',
): Promise<Record<string, unknown>> {
  if (mode === 'seed') {
    await startResponsiveSmokeGame(window);
    await clickZoomButton(window, 3);
    await clickUiScaleButton(window, 125);
  } else {
    await waitForSelector(window, '#world-state', 20_000);
  }
  const evidence = await waitForResponsiveEvidence(
    window,
    (candidate) => candidate.selectedWorldZoom === 3 && candidate.uiScale === 1.25,
    20_000,
  );
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
  return { mode, evidence };
}

async function captureSaveMigrationSmoke(
  window: BrowserWindow,
  mode: 'migration' | 'reload',
): Promise<Record<string, unknown>> {
  await waitForSelector(window, '#world-state', 20_000);
  const expectedSaveStatus = mode === 'migration' ? 'MIGRATED GEN 8' : 'LOADED GEN 8';
  await waitForRendererText(window, '#world-save-status', expectedSaveStatus, 20_000);
  const loaded = await window.webContents.executeJavaScript(
    `window.siWorldDesktop?.loadSave('slot-001')`,
    true,
  ) as Record<string, unknown>;
  return {
    mode,
    expectedSaveStatus,
    visibleSaveStatus: await rendererText(window, '#world-save-status'),
    loaded,
    worldStateLabel: await worldStateLabel(window),
  };
}

async function captureWorldSmoke(window: BrowserWindow, directory: string): Promise<Record<string, boolean | number | string>> {
  const progress = (stage: string): void => {
    process.stdout.write(`SI_WORLD_SMOKE_PROGRESS ${stage}\n`);
  };
  progress('new-game');
  await waitForSelector(window, '#new-game-flow');
  await captureSmokeScreenshot(window, join(directory, 'world-new-game.png'));
  const newGameText = (await rendererText(window, '#new-game-flow')).replace(/\s+/gu, ' ').trim();
  const newGameFlow = newGameText.includes('WELCOME TO HALCYRA') && newGameText.includes('$800');
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Player name"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Player name input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'MISTAKE');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  })()`, true);
  sendKey(window, 'Enter');
  await waitForSelector(window, '#world-state', 20_000);
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 1');
  const protagonistLabel = await protagonistStateLabel(window);
  const stableProtagonist = protagonistLabel.includes('Protagonist protagonist') && protagonistLabel.includes('name MISTAKE');
  const allowanceReceipt = protagonistLabel.includes('allowance 800') && protagonistLabel.includes('money 800') &&
    (await rendererText(window, '#world-ui-help')).includes('$800 WEEKLY ALLOWANCE RECEIVED');
  const newGameSave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 1');
  const accessibilityPolicy = await window.webContents.executeJavaScript(`(() => {
    const policy = document.querySelector('#si-world-accessibility');
    return policy instanceof HTMLStyleElement && policy.textContent.includes(':focus-visible') &&
      policy.textContent.includes('prefers-reduced-motion: reduce');
  })()`, true) as boolean;

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
  const responsiveBoundsBefore = await surfaceBounds(window);
  const responsiveCameraBefore = parseCameraLabel(await cameraLabel(window));
  const responsiveCenterBefore = {
    x: responsiveCameraBefore.x + responsiveBoundsBefore.width / responsiveCameraBefore.zoom / 2,
    y: responsiveCameraBefore.y + responsiveBoundsBefore.height / responsiveCameraBefore.zoom / 2,
  };
  const resizedBounds = await resizeContentAndWait(window, 1_440, 900);
  const resizedCamera = parseCameraLabel(await cameraLabel(window));
  const resizedCenter = {
    x: resizedCamera.x + resizedBounds.width / resizedCamera.zoom / 2,
    y: resizedCamera.y + resizedBounds.height / resizedCamera.zoom / 2,
  };
  const resizeCamera = resizedCamera.zoom === 2 &&
    Math.abs(resizedCenter.x - responsiveCenterBefore.x) <= 1 &&
    Math.abs(resizedCenter.y - responsiveCenterBefore.y) <= 1;
  const responsiveDto = await waitForResponsiveEvidence(window, (evidence) => {
    const content = evidence.content as { width?: number; height?: number } | undefined;
    return content?.width === 1_440 && content.height === 900;
  });
  const coverage = responsiveDto.coverage as { width?: number; height?: number } | undefined;
  const responsiveSurface = Number(coverage?.width) >= 0.9 && Number(coverage?.height) >= 0.85 &&
    responsiveDto.automaticWorldZoom === 1 && responsiveDto.selectedWorldZoom === 2;
  await clickUiScaleButton(window, 150);
  const scaledDto = await waitForResponsiveEvidence(window, (evidence) => evidence.uiScale === 1.5);
  const uiScaleControls = scaledDto.minimumFontSize === 17 && scaledDto.minimumPointerTarget === 54;
  await clickUiScaleButton(window, 100);
  await resizeContentAndWait(window, 1_280, 720);

  progress('camera-and-movement');
  await clickZoomButton(window, 2);
  let bounds = await surfaceBounds(window);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await dispatchWorldTileClick(window, { x: 19, y: 20 });
  await waitForWorldTile(window, { x: 19, y: 20 }, 10_000);
  const movedText = await rendererText(window, '#world-ui-location');
  const movement = movedText.includes('TILE 19,20');

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
  const expectedCenteredCamera = {
    x: Math.round(19 * 32 + 16 - bounds.width / 2 / 2),
    y: Math.round(20 * 32 + 29 - bounds.height / 2 / 2),
  };
  const centeredState = parseCameraLabel(afterCenter);
  const centerKey = afterCenter !== afterPan && centeredState.zoom === 2 &&
    centeredState.x === expectedCenteredCamera.x && centeredState.y === expectedCenteredCamera.y;

  bounds = await surfaceBounds(window);
  const wheelX = Math.round(bounds.x + bounds.width / 2);
  const wheelY = Math.round(bounds.y + bounds.height / 2);
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
  const wheelZoom = (await cameraLabel(window)).endsWith('at 2.1x');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
  const presentationAfterWheel = await window.webContents.executeJavaScript(
    'window.siWorldDesktop?.loadPresentationPreferences()',
    true,
  ) as Readonly<{ worldZoom?: number }>;
  const gradualZoomPersistence = presentationAfterWheel.worldZoom === 2.1;

  await clickZoomButton(window, 2);
  sendKey(window, 'F');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  bounds = await surfaceBounds(window);
  sendMouseClick(window, bounds.x + bounds.width / 2 - 4 * 32 * 2, bounds.y + bounds.height / 2);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 35));
  sendKey(window, 'Escape');
  const cancelStart = await rendererText(window, '#world-ui-location');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 350));
  const cancelKey = (await rendererText(window, '#world-ui-location')) === cancelStart && cancelStart.includes('TILE 19,20');

  const beforeUi = await rendererText(window, '#world-ui-location');
  await clickZoomButton(window, 1);
  const afterUi = await rendererText(window, '#world-ui-location');
  const tilePattern = /TILE \d+,\d+/u;
  const uiClickThrough = beforeUi.match(tilePattern)?.[0] === afterUi.match(tilePattern)?.[0];

  await clickWorldTile(window, { x: 15, y: 25 });
  await waitForWorldTile(window, { x: 15, y: 25 }, 10_000);
  await waitForRoofLabel(window, 'Villa roof restored');
  const outsideText = await rendererText(window, '#world-ui-location');
  const roofRestore = outsideText.includes('TILE 15,25') && await roofLabel(window) === 'Villa roof restored';
  let previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window,
    join(directory, 'world-roof-restored.png'),
    [zoomBuffers[0]!],
  );

  progress('villa-interior');
  await clickWorldTile(window, { x: 15, y: 23 });
  await waitForWorldTile(window, { x: 15, y: 23 }, 10_000);
  await waitForRoofLabel(window, 'Villa roof hidden');
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
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 2');
  const sleepAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 2');

  progress('neighborhood-loop');
  await clickAriaButton(window, 'Set 1x time');
  await dispatchWorldTileClick(window, { x: 16, y: 25 });
  await waitForWorldTile(window, { x: 16, y: 25 });
  await clickZoomButton(window, 1);
  await panWorld(window, -500, 0);
  await panWorld(window, -500, 0);
  await dispatchWorldTileClick(window, { x: 63, y: 24 });
  await waitForWorldLocation(window, 'Neon Crescent', { x: 0, y: 24 });
  const afterTravel = parseWorldStateLabel(await worldStateLabel(window));
  const travel = afterTravel.mapName === 'Neon Crescent' && afterTravel.x === 0 && afterTravel.y === 24;
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 3');
  const travelAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 3');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-downtown.png'), [previousWorldBuffer],
  );
  if (tierBArtSmokeMode) {
    previousWorldBuffer = await captureTierBMapZoomSet(window, directory, 'downtown', previousWorldBuffer);
  }

  await panWorld(window, 0, -500);
  await dispatchWorldTileClick(window, { x: 32, y: 47 });
  await waitForWorldLocation(window, 'Greywake Harbor', { x: 32, y: 0 });
  const docks = parseWorldStateLabel(await worldStateLabel(window));
  await panWorld(window, 0, -500);
  await panWorld(window, -500, 0);
  const ferryMap = WORLD_MAP_CATALOG.southeast_docks;
  const ferryObject = ferryMap.source.objects.find(({ id }) => id === 'ferry-landmark');
  const ferryCamera = parseCameraLabel(await cameraLabel(window));
  const ferrySurface = await surfaceBounds(window);
  const ferryVisible = ferryObject?.renderParts.some(({ offset }) => {
    const x = (ferryObject.anchor.x + offset.x) * 32;
    const y = (ferryObject.anchor.y + offset.y) * 32;
    return x >= ferryCamera.x && x < ferryCamera.x + ferrySurface.width / ferryCamera.zoom &&
      y >= ferryCamera.y && y < ferryCamera.y + ferrySurface.height / ferryCamera.zoom;
  }) === true;
  const closedFerry = docks.mapName === 'Greywake Harbor' && ferryVisible &&
    ferryObject?.interactions.length === 0;
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-ferry.png'), [previousWorldBuffer],
  );
  if (tierBArtSmokeMode) {
    previousWorldBuffer = await captureTierBMapZoomSet(window, directory, 'ferry', previousWorldBuffer);
  }

  await panWorld(window, 500, 0);
  await dispatchWorldTileClick(window, { x: 0, y: 24 });
  await waitForWorldLocation(window, 'Saffron Bazaar', { x: 63, y: 24 });
  const commercial = parseWorldStateLabel(await worldStateLabel(window));
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-commercial.png'), [previousWorldBuffer],
  );
  if (tierBArtSmokeMode) {
    previousWorldBuffer = await captureTierBMapZoomSet(window, directory, 'commercial', previousWorldBuffer);
  }

  await panWorld(window, 500, 500);
  await dispatchWorldTileClick(window, { x: 32, y: 0 });
  await waitForWorldLocation(window, 'Sunward Villas', { x: 32, y: 47 });
  const loopCompleteState = parseWorldStateLabel(await worldStateLabel(window));
  const allNeighborhoods = commercial.mapName === 'Saffron Bazaar' &&
    loopCompleteState.mapName === 'Sunward Villas' && loopCompleteState.x === 32 && loopCompleteState.y === 47;
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 6');
  const allTravelAutosaves = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 6');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-loop-complete.png'), [previousWorldBuffer],
  );

  progress('conversation');
  await clickZoomButton(window, 1);
  await panWorld(window, 0, 500);
  const lindaTile = parseLindaTile(await npcStateLabel(window));
  const questOfferApproachTile = { x: lindaTile.x + 1, y: lindaTile.y };
  await dispatchWorldTileClick(window, questOfferApproachTile);
  await waitForWorldTile(window, questOfferApproachTile, 10_000);
  await dispatchWorldTileClick(window, lindaTile);
  const talkLabels = await window.webContents.executeJavaScript(
    `Array.from(document.querySelectorAll('[aria-label^="Talk to "]')).map((element) => element.getAttribute('aria-label'))`,
    true,
  ) as readonly (string | null)[];
  if (!talkLabels.some((label) => label?.toLowerCase() === 'talk to linda')) {
    throw new Error(`Linda selection failed: talk ${JSON.stringify(talkLabels)}; NPC ${await npcStateLabel(window)}; world ${await worldStateLabel(window)}`);
  }
  await clickAriaButton(window, 'Talk to Linda');
  await waitForRendererText(window, '#world-ui-quest-offer-panel', "LINDA'S REQUEST");
  const questOfferText = await rendererText(window, '#world-ui-quest-offer-panel');
  const portraitsReady = await window.webContents.executeJavaScript(`Boolean(
    document.querySelector('#conversation-portrait-protagonist-ready') &&
    document.querySelector('#conversation-portrait-linda-ready')
  )`, true) as boolean;
  const questOfferDialogue = questOfferText.includes('AUTHORED SCENE · TIME PAUSED') &&
    questOfferText.includes('LINDA') && questOfferText.includes('MISTAKE') &&
    questOfferText.includes('YES · HELP LINDA') && questOfferText.includes('NO · NOT NOW') && portraitsReady;
  const questOfferMinute = parseWorldStateLabel(await worldStateLabel(window)).minute;
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_100));
  const questOfferPause = parseWorldStateLabel(await worldStateLabel(window)).minute === questOfferMinute;
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-linda-offer.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, "Accept Linda's request");
  await waitForSelectorMissing(window, '#world-ui-quest-offer-panel');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 7');
  const questStarted = (await questStateLabel(window)).includes('Linda quest active');
  await clickAriaButton(window, 'Talk to Linda');
  await waitForRendererText(window, '#world-ui-conversation-panel', 'TIME PAUSED');
  await waitForRendererText(window, '#world-audio-caption', 'GREETING CHIRP');
  const audioCaptions = (await rendererText(window, '#world-audio-caption')).includes('GREETING CHIRP');
  await waitForWorldMinuteStable(window);
  const conversationPause = (await rendererText(window, '#world-ui-conversation-panel')).includes('TIME PAUSED');
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
  const responsiveTranscriptCount = await conversationTranscriptMeasure(window);
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Conversation message"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Conversation input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'KEEP THIS DRAFT');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`, true);
  await resizeContentAndWait(window, 1_440, 900);
  await clickUiScaleButton(window, 150);
  const conversationResponsiveDto = await waitForResponsiveEvidence(
    window,
    (evidence) => evidence.uiScale === 1.5 &&
      (evidence.activePanel as { id?: string } | null)?.id === 'world-ui-conversation-panel',
  );
  const responsiveDraft = await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Conversation message"]');
    return input instanceof HTMLInputElement ? input.value : '';
  })()`, true) as string;
  const conversationResponsiveState = responsiveDraft === 'KEEP THIS DRAFT' &&
    await conversationTranscriptMeasure(window) === responsiveTranscriptCount &&
    conversationResponsiveDto.conversationInput !== null &&
    (await rendererText(window, '#world-ui-conversation-panel')).includes('TIME PAUSED');
  await clickUiScaleButton(window, 100);
  await resizeContentAndWait(window, 1_280, 720);
  const transcriptChildrenBeforeFirstTurn = await conversationTranscriptMeasure(window);
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Conversation message"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Conversation input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'I have a cat');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`, true);
  const generationMetrics = await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const button = Array.from(document.querySelectorAll('[aria-label]')).find(
      (element) => element.getAttribute('aria-label') === 'Send conversation message',
    );
    if (!(button instanceof HTMLElement)) {
      reject(new Error('Send conversation button is missing.'));
      return;
    }
    const startedAt = performance.now();
    const frameTimes = [];
    let feedbackMilliseconds = null;
    let finished = false;
    const finish = (timedOut) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      const measuredFrames = frameTimes.filter((time) => time >= startedAt + (feedbackMilliseconds ?? 0));
      const duration = measuredFrames.length > 1
        ? measuredFrames[measuredFrames.length - 1] - measuredFrames[0]
        : 0;
      const rendererFps = duration > 0 ? ((measuredFrames.length - 1) * 1000) / duration : 0;
      resolve({ feedbackMilliseconds, rendererFps, timedOut });
    };
    const timeout = setTimeout(() => finish(true), 30000);
    button.click();
    const frame = (now) => {
      frameTimes.push(now);
      const thinking = Boolean(document.querySelector('[aria-label="NPC is thinking"]'));
      if (thinking && feedbackMilliseconds === null) feedbackMilliseconds = Math.max(0, now - startedAt);
      if (feedbackMilliseconds !== null && !thinking) {
        finish(false);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })`, true) as Readonly<{
    feedbackMilliseconds: number | null;
    rendererFps: number;
    timedOut: boolean;
  }>;
  const conversationFeedbackMilliseconds = Math.round((generationMetrics.feedbackMilliseconds ?? 99_999) * 100) / 100;
  const rendererFpsDuringGeneration = Math.round(generationMetrics.rendererFps * 100) / 100;
  const conversationBuffered = !generationMetrics.timedOut && conversationFeedbackMilliseconds <= 100;
  progress('conversation-first-turn-complete');
  await waitForConversationTurnComplete(window, transcriptChildrenBeforeFirstTurn);
  const transcript = await rendererText(window, '#conversation-transcript');
  const modelStatus = await rendererText(window, '#conversation-model-status');
  const conversationFallback = smokeExpectsModel
    ? modelStatus.includes('REPLY RECEIVED') && !modelStatus.includes('SAFE REPLY')
    : transcript.includes('I lost the thread') && !transcript.includes('jsonSchema');
  const modelFailureFeedback = smokeExpectsModel
    ? modelStatus.includes('REPLY RECEIVED') && !modelStatus.includes('SAFE REPLY')
    : modelStatus.includes('SAFE REPLY USED');
  const firstFreeTextTurnSource = smokeExpectsModel ? 'model' : 'authored-fallback';
  const transcriptChildrenBeforeInvitation = await conversationTranscriptMeasure(window);
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('[aria-label="Conversation message"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Conversation input is missing.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'Would you like to visit my villa?');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`, true);
  await clickAriaButton(window, 'Send conversation message');
  await waitForConversationTurnComplete(window, transcriptChildrenBeforeInvitation);
  await waitForAriaButtonEnabled(window, 'End conversation');
  const invitationStatus = await rendererText(window, '#conversation-model-status');
  const invitationTranscript = await rendererText(window, '#conversation-transcript');
  const structuredInvitation = invitationTranscript.includes('current situation') && (
    !smokeExpectsModel ||
    (invitationStatus.includes('REPLY RECEIVED') || invitationStatus.includes('AUTHORED REPLY USED')) &&
      !invitationStatus.includes('SAFE REPLY')
  );
  const structuredInvitationSource = invitationStatus.includes('REPLY RECEIVED')
    ? 'model'
    : 'authored-structured';
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-conversation.png'), [previousWorldBuffer],
  );
  progress('conversation-second-turn-complete');
  await clickAriaButton(window, 'End conversation');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 8');
  const conversationCommitSave = !(await window.webContents.executeJavaScript(
    `Boolean(document.querySelector('#world-ui-conversation-panel'))`, true,
  )) && (await rendererText(window, '#world-save-status')).includes('SAVED GEN 8');
  await clickAriaButton(window, 'Open relationships');
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  const relationshipText = await rendererText(window, '#world-ui-relationship-panel');
  const relationshipPanel = ['FAMILIARITY', 'TRUST', 'ATTRACTION'].every((label) => relationshipText.includes(label)) &&
    ['STRANGER', 'ACQUAINTANCE', 'FRIEND', 'DATING', 'PARTNER', 'ENGAGED', 'MARRIED']
      .some((stage) => relationshipText.includes(stage));
  const hiddenFaction = relationshipText.includes('OTHER NETWORKS REMAIN HIDDEN') && !relationshipText.includes('VELVET TIDE');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-social.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Close relationships');
  const currentLindaTile = parseLindaTile(await npcStateLabel(window));
  const lindaApproachTile = { x: currentLindaTile.x + 1, y: currentLindaTile.y };
  await dispatchWorldTileClick(window, lindaApproachTile);
  await waitForWorldTile(window, lindaApproachTile, 10_000);
  await dispatchWorldTileClick(window, currentLindaTile);
  await clickAriaButton(window, 'Open quests');
  await waitForRendererText(window, '#world-ui-journal-panel', 'LINDA · REJECTED');
  const journalInvitation = (await rendererText(window, '#world-ui-journal-panel')).includes('LINDA · REJECTED');
  await clickAriaButton(window, 'Buy villa security report');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 9');
  const socialPurchase = (await rendererText(window, '#world-ui-journal-panel')).includes('SECURITY REPORT PURCHASED') &&
    (await rendererText(window, '#world-save-status')).includes('SAVED GEN 9');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-journal.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Close quests');
  progress('quest');
  const questPreparationPreserved = (await questStateLabel(window)).includes('flags security_report_purchased');
  await dispatchWorldTileClick(window, { x: 22, y: 28 });
  await waitForWorldTile(window, { x: 22, y: 28 }, 10_000);
  sendKey(window, 'Q');
  await waitForRendererText(window, '#world-ui-journal-panel', 'QUESTS');
  const questShortcut = (await rendererText(window, '#world-ui-journal-panel')).includes('QUEST 01');
  await clickAriaButton(window, "Confirm Linda's villa");
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 10');
  const choiceText = await rendererText(window, '#world-ui-journal-panel');
  const questChoicePreview = choiceText.includes('PROTECT LINDA') && choiceText.includes('BETRAY LINDA') &&
    choiceText.includes('WITHDRAW') && choiceText.includes('ACTION') && choiceText.includes('RESULT') &&
    choiceText.includes('SOCIAL') && choiceText.includes('ROUTE');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-linda-quest.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Protect Linda');
  const consequenceCaption = (await rendererText(window, '#world-audio-caption')).includes('CONSEQUENCE TONE');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 11');
  const questLabel = await questStateLabel(window);
  const questOutcome = questLabel.includes('Linda quest resolved') && questLabel.includes('linda_protected') &&
    questLabel.includes('police noticed') && questLabel.includes('evidence 1') &&
    (await rendererText(window, '#world-ui-help')).includes('LINDA PROTECTED');
  const questAutosave = (await rendererText(window, '#world-save-status')).includes('SAVED GEN 11');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-linda-outcome.png'), [previousWorldBuffer],
  );
  await clickAriaButton(window, 'Close quests');
  await clickAriaButton(window, 'Open quests');
  await clickAriaButton(window, 'Answer police questions');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 12');
  await clickAriaButton(window, 'Ignore police summons');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 13');
  await clickAriaButton(window, 'Trigger wanted encounter');
  await waitForRendererText(window, '#world-save-status', 'SAVED GEN 14');
  const policeHooks = (await questStateLabel(window)).includes('police arrest-on-sight') &&
    (await rendererText(window, '#world-ui-journal-panel')).includes('POLICE · ARREST-ON-SIGHT');
  previousWorldBuffer = await captureDistinctSmokeScreenshot(
    window, join(directory, 'world-police.png'), [previousWorldBuffer],
  );
  const loaded = await window.webContents.executeJavaScript(
    `window.siWorldDesktop?.loadSave('slot-001')`,
    true,
  ) as Readonly<{
    status?: string;
    saveGeneration?: number;
    state?: Readonly<{
      protagonist?: Readonly<{ id?: string; displayName?: string }>;
      quests?: Readonly<Record<string, Readonly<{ status?: string }>>>;
      policeAttention?: string;
    }>;
  }>;
  const saveReload = loaded.status === 'unchanged' && loaded.saveGeneration === 14 &&
    loaded.state?.protagonist?.id === 'protagonist' && loaded.state.protagonist.displayName === 'MISTAKE' &&
    loaded.state.quests?.linda_boyfriend_check?.status === 'resolved' && loaded.state.policeAttention === 'arrest-on-sight';
  progress('complete');
  return {
    newGameFlow, stableProtagonist, allowanceReceipt, newGameSave, accessibilityPolicy,
    responsiveSurface, resizeCamera, uiScaleControls,
    zoomButtons, movement, middlePan, wheelZoom, gradualZoomPersistence, centerKey, cancelKey, uiClickThrough,
    roofRestore, roofEntry,
    pausedClock, doubleSpeedClock, nap, overnightSleep, sleepAutosave, travel, travelAutosave,
    closedFerry, allNeighborhoods, allTravelAutosaves,
    conversationPause, conversationInputLocked, conversationSocialNavLocked, conversationResponsiveState, promptIdeasContextual, conversationBuffered,
    conversationFeedbackMilliseconds, rendererFpsDuringGeneration,
    conversationFallback, firstFreeTextTurnSource, modelFailureFeedback, audioCaptions, conversationCommitSave,
    structuredInvitation, structuredInvitationSource, relationshipPanel, hiddenFaction, journalInvitation, socialPurchase,
    questOfferDialogue, questOfferPause, questStarted, questPreparationPreserved, questShortcut,
    questChoicePreview, questOutcome, questAutosave, consequenceCaption, policeHooks, saveReload,
  };
}

async function emitSmokeResult(report: RendererReadyReport, window: BrowserWindow): Promise<void> {
  if (!smokeMode || smokeFinished) {
    return;
  }
  smokeFinished = true;
  process.stdout.write(`SI_WORLD_RENDERER_READY ${JSON.stringify({
    milliseconds: Math.round((performance.now() - processStartedAt) * 100) / 100,
  })}\n`);
  if (saveMigrationSmokeMode || saveReloadSmokeMode) {
    const mode = saveMigrationSmokeMode ? 'migration' : 'reload';
    const migrationResult = await captureSaveMigrationSmoke(window, mode);
    const migrationScreenshot = process.env.SI_WORLD_SAVE_MIGRATION_SCREENSHOT;
    if (!migrationScreenshot || !isAbsolute(migrationScreenshot)) {
      throw new Error('Save-migration smoke screenshot path must be absolute.');
    }
    await captureSmokeScreenshot(window, migrationScreenshot);
    process.stdout.write(`SI_WORLD_SAVE_MIGRATION_SMOKE_RESULT ${JSON.stringify(migrationResult)}\n`);
  } else if (presentationSeedSmokeMode || presentationRestartSmokeMode) {
    const mode = presentationSeedSmokeMode ? 'seed' : 'restart';
    const presentationResult = await capturePresentationPreferenceSmoke(window, mode);
    const presentationScreenshot = process.env.SI_WORLD_PRESENTATION_SCREENSHOT;
    if (!presentationScreenshot || !isAbsolute(presentationScreenshot)) {
      throw new Error('Presentation smoke screenshot path must be absolute.');
    }
    await captureSmokeScreenshot(window, presentationScreenshot);
    process.stdout.write(`SI_WORLD_PRESENTATION_SMOKE_RESULT ${JSON.stringify(presentationResult)}\n`);
  } else if (proceduralVfxSmokeMode) {
    const vfxDirectory = process.env.SI_WORLD_PROCEDURAL_VFX_SCREENSHOT_DIR;
    if (!vfxDirectory || !isAbsolute(vfxDirectory)) {
      throw new Error('Procedural-VFX smoke screenshot directory must be absolute.');
    }
    const vfxResult = await captureProceduralVfxSmoke(window, vfxDirectory);
    process.stdout.write(`SI_WORLD_PROCEDURAL_VFX_SMOKE_RESULT ${JSON.stringify(vfxResult)}\n`);
  } else if (naturalMovementSmokeMode) {
    const naturalMovementDirectory = process.env.SI_WORLD_NATURAL_MOVEMENT_SCREENSHOT_DIR;
    if (!naturalMovementDirectory || !isAbsolute(naturalMovementDirectory)) {
      throw new Error('Natural-movement smoke screenshot directory must be absolute.');
    }
    const mode = naturalMovementReducedMode ? 'reduced' : 'standard';
    const movementResult = await captureMovementPass(window, naturalMovementDirectory, mode);
    process.stdout.write(`SI_WORLD_NATURAL_MOVEMENT_SMOKE_RESULT ${JSON.stringify(movementResult)}\n`);
  } else if (responsiveSmokeMode) {
    const responsiveDirectory = process.env.SI_WORLD_RESPONSIVE_SCREENSHOT_DIR;
    if (!responsiveDirectory || !isAbsolute(responsiveDirectory)) {
      throw new Error('Responsive smoke screenshot directory must be absolute.');
    }
    const responsiveResult = await captureResponsiveSmoke(window, responsiveDirectory);
    process.stdout.write(`SI_WORLD_RESPONSIVE_SMOKE_RESULT ${JSON.stringify(responsiveResult)}\n`);
  } else {
    const worldScreenshotDirectory = process.env.SI_WORLD_SMOKE_WORLD_SCREENSHOT_DIR;
    if (worldScreenshotDirectory) {
      const worldResult = await captureWorldSmoke(window, worldScreenshotDirectory);
      process.stdout.write(`SI_WORLD_WORLD_SMOKE_RESULT ${JSON.stringify(worldResult)}\n`);
    }
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
  const applicationRoot = devHarnessRoot ?? app.getAppPath();
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

  const presentationPreferences = new PresentationPreferencesRepository(
    presentationPreferencesPathForUserData(app.getPath('userData')),
  );
  const initialPresentation = await presentationPreferences.load();
  const window = new BrowserWindow({
    backgroundColor: '#17201b',
    enableLargerThanScreen: smokeMode,
    height: initialPresentation.windowSize?.height ?? 720,
    minHeight: 640,
    minWidth: 960,
    show: !smokeMode,
    title: devHarnessMode ? 'SI World · Dev Harness' : 'SI World',
    useContentSize: true,
    webPreferences: {
      ...lockedWebPreferences(preloadPath),
      ...(smokeMode ? { backgroundThrottling: false } : {}),
      additionalArguments: [
        ...(smokeMode ? [
          '--si-world-smoke-mode=1',
          ...(responsiveArtMode ? [`--si-world-art-mode=${responsiveArtMode}`] : []),
          ...(smokeVfxMode ? [`--si-world-vfx-mode=${smokeVfxMode}`] : []),
        ] : []),
        ...(devHarnessMode ? ['--si-world-dev-harness=1'] : []),
      ],
    },
    width: initialPresentation.windowSize?.width ?? 1280,
  });
  activeMainWindow = window;
  if (smokeMode) window.webContents.setAudioMuted(true);
  if (smokeMode) {
    window.webContents.on('console-message', (details) => {
      if (details.level === 'error' || details.message.includes('SI_WORLD_RENDERER_READY_FAILURE')) {
        process.stderr.write(`SI_WORLD_RENDERER_CONSOLE ${details.message}\n`);
      }
    });
  }
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
  const contentRoot = app.isPackaged ? join(process.resourcesPath, 'content') : join(applicationRoot, 'content');
  conversationInference = new BundledConversationInference(app, process.resourcesPath);
  conversationService = new ConversationService(
    conversationInference,
    new FileCharacterWritingStore(contentRoot),
    smokeExpectsModel
      ? (diagnostic) => process.stdout.write(`SI_WORLD_CONVERSATION_DIAGNOSTIC ${JSON.stringify(diagnostic)}\n`)
      : undefined,
    new FileVerbalMissionContentStore(contentRoot),
  );
  registerConversationIpc(ipcMain, conversationService);
  window.webContents.once('destroyed', () => conversationService?.abortAll());
  const saveRepository = new SaveRepository(
    saveRootForUserData(app.getPath('userData')),
    WORLD_MAP_CATALOG,
  );
  registerPersistenceIpc(ipcMain, {
    loadSave: (slotId) => saveRepository.load(slotId),
    migrateSave: (request) => saveRepository.migrate(request),
    requestSave: (request) => saveRepository.save(request),
  });
  registerPresentationPreferencesIpc(ipcMain, presentationPreferences);
  let presentationResizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.on('resize', () => {
    if (presentationResizeTimer) clearTimeout(presentationResizeTimer);
    presentationResizeTimer = setTimeout(() => {
      const [width, height] = window.getContentSize();
      void presentationPreferences.saveWindowSize({ width, height }).catch((error: unknown) => {
        process.stderr.write(`SI_WORLD_PRESENTATION_SAVE_FAILURE ${String(error)}\n`);
      });
    }, 180);
  });
  window.once('closed', () => {
    if (presentationResizeTimer) clearTimeout(presentationResizeTimer);
  });
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (smokeMode && !smokeFinished) {
      smokeFinished = true;
      process.stderr.write(`SI_WORLD_SMOKE_FAILURE ${errorCode} ${errorDescription}\n`);
      app.exit(1);
    }
  });
  window.webContents.on('did-finish-load', () => {
    if (devHarnessMode) {
      void window.webContents.executeJavaScript(`JSON.stringify({
        enabled: window.siWorldDevHarnessMode === true,
        hash: window.location.hash,
      })`, true).then((proof) => {
        process.stdout.write(`SI_WORLD_DEV_HARNESS_BOOT ${String(proof)}\n`);
      });
    }
    const loadingScreenshotPath = process.env.SI_WORLD_SMOKE_LOADING_SCREENSHOT;
    if (smokeMode && loadingScreenshotPath) {
      setTimeout(() => {
        void captureLoadingSmokeScreenshot(window, loadingScreenshotPath).catch((error: unknown) => {
          smokeFinished = true;
          process.stderr.write(`SI_WORLD_SMOKE_FAILURE ${String(error)}\n`);
          app.exit(1);
        });
      }, 100);
    }
  });
  await window.loadURL(devHarnessMode ? `${APP_URL}#/dev` : APP_URL);
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
      void activeMainWindow?.webContents.executeJavaScript(`(() => ({
        bodyText: document.body?.innerText?.slice(0, 1000) ?? '',
        canvasCount: document.querySelectorAll('canvas').length,
        ids: Array.from(document.querySelectorAll('[id]')).map((element) => element.id).filter(Boolean).slice(0, 100),
        loading: Boolean(document.querySelector('#loading-shell')),
        newGame: Boolean(document.querySelector('#new-game-flow')),
      }))()`, true).then((diagnostic) => {
        process.stderr.write(`SI_WORLD_RENDERER_READY_TIMEOUT_DIAGNOSTIC ${JSON.stringify(diagnostic)}\n`);
      }).catch((error: unknown) => {
        process.stderr.write(`SI_WORLD_RENDERER_READY_TIMEOUT_DIAGNOSTIC_FAILED ${String(error)}\n`);
      }).finally(() => {
        process.stderr.write('SI_WORLD_SMOKE_FAILURE renderer readiness timeout\n');
        app.exit(1);
      });
    }
  }, 30_000);
}
