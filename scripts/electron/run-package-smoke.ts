import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

import { parseSaveEnvelope } from '../../electron/persistence/save-format';

import {
  findPackageArchive,
  findPackagedExecutable,
  parseSmokeResult,
  validatePackageListing,
  validateScreenshotBuffers,
  validateScreenshotEvidence,
  validateWorldZoomEvidence,
} from './package-smoke-utils';

const outputRoot = join(process.cwd(), 'out');
const executable = findPackagedExecutable(outputRoot);
const archive = findPackageArchive(outputRoot);
const asarCli = join(process.cwd(), 'node_modules/@electron/asar/bin/asar.js');
const listing = execFileSync(process.execPath, [asarCli, 'list', archive], {
  encoding: 'utf8',
  maxBuffer: 10_000_000,
});
validatePackageListing(listing);
const screenshotDirectory = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(process.cwd(), 'artifacts/phase-02');
const screenshotPath = join(screenshotDirectory, 'packaged-electron.png');
const loadingScreenshotPath = join(screenshotDirectory, 'packaged-loading.png');
const worldZoomPaths = [1, 2, 3].map((zoom) => join(screenshotDirectory, `world-${zoom}x.png`));
const roofScreenshotPath = join(screenshotDirectory, 'world-roof-restored.png');
const downtownScreenshotPath = join(screenshotDirectory, 'world-downtown.png');
const ferryScreenshotPath = join(screenshotDirectory, 'world-ferry.png');
const loopScreenshotPath = join(screenshotDirectory, 'world-loop-complete.png');
const conversationScreenshotPath = join(screenshotDirectory, 'world-conversation.png');
const socialScreenshotPath = join(screenshotDirectory, 'world-social.png');
const journalScreenshotPath = join(screenshotDirectory, 'world-journal.png');
const questScreenshotPath = join(screenshotDirectory, 'world-linda-quest.png');
const questOutcomeScreenshotPath = join(screenshotDirectory, 'world-linda-outcome.png');
const policeScreenshotPath = join(screenshotDirectory, 'world-police.png');
mkdirSync(screenshotDirectory, { recursive: true });
const smokeUserData = mkdtempSync(join(tmpdir(), 'si-world-smoke-'));
rmSync(loadingScreenshotPath, { force: true });
rmSync(screenshotPath, { force: true });
worldZoomPaths.forEach((path) => rmSync(path, { force: true }));
rmSync(roofScreenshotPath, { force: true });
rmSync(downtownScreenshotPath, { force: true });
rmSync(ferryScreenshotPath, { force: true });
rmSync(loopScreenshotPath, { force: true });
rmSync(conversationScreenshotPath, { force: true });
rmSync(socialScreenshotPath, { force: true });
rmSync(journalScreenshotPath, { force: true });
rmSync(questScreenshotPath, { force: true });
rmSync(questOutcomeScreenshotPath, { force: true });
rmSync(policeScreenshotPath, { force: true });
const child = spawn(executable, [], {
  detached: false,
  env: {
    ...process.env,
    SI_WORLD_SMOKE: '1',
    SI_WORLD_SMOKE_LOADING_SCREENSHOT: loadingScreenshotPath,
    SI_WORLD_SMOKE_SCREENSHOT: screenshotPath,
    SI_WORLD_SMOKE_USER_DATA: smokeUserData,
    SI_WORLD_SMOKE_WORLD_SCREENSHOT_DIR: screenshotDirectory,
  },
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
const appendBounded = (current: string, chunk: Buffer): string =>
  `${current}${chunk.toString('utf8')}`.slice(-1_000_000);
child.stdout.on('data', (chunk: Buffer) => {
  stdout = appendBounded(stdout, chunk);
});
child.stderr.on('data', (chunk: Buffer) => {
  stderr = appendBounded(stderr, chunk);
});

const timeout = setTimeout(() => child.kill('SIGKILL'), 90_000);
child.once('error', (error) => {
  clearTimeout(timeout);
  rmSync(smokeUserData, { force: true, recursive: true });
  throw error;
});
child.once('close', (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    rmSync(smokeUserData, { force: true, recursive: true });
    throw new Error(`Packaged app exited with ${String(code)}. ${stderr.slice(-2_000)}`);
  }
  const autosaveDirectory = join(smokeUserData, 'si-world', 'save-slots', 'slot-001', 'autosaves');
  const majorQuestAutosave = readdirSync(autosaveDirectory)
    .filter((name) => /^autosave-[0-9]{12}\.json$/u.test(name))
    .map((name) => parseSaveEnvelope(JSON.parse(readFileSync(join(autosaveDirectory, name), 'utf8')) as unknown))
    .some((envelope) => envelope.trigger === 'major_quest' &&
      envelope.state.quests.linda_boyfriend_check?.status === 'resolved');
  rmSync(smokeUserData, { force: true, recursive: true });
  const report = parseSmokeResult(stdout);
  validateScreenshotEvidence(loadingScreenshotPath, screenshotPath);
  validateWorldZoomEvidence(worldZoomPaths);
  validateScreenshotBuffers(readFileSync(worldZoomPaths[0]!), readFileSync(roofScreenshotPath));
  const worldResultLine = stdout.split(/\r?\n/u).find((line) => line.startsWith('SI_WORLD_WORLD_SMOKE_RESULT '));
  if (!worldResultLine) throw new Error('Packaged app did not emit world input evidence.');
  const worldResult = JSON.parse(worldResultLine.slice('SI_WORLD_WORLD_SMOKE_RESULT '.length)) as Record<string, unknown>;
  worldResult.questAutosave = worldResult.questAutosave === true && majorQuestAutosave;
  for (const key of [
    'zoomButtons', 'movement', 'middlePan', 'wheelZoom', 'centerKey', 'cancelKey', 'uiClickThrough',
    'roofRestore', 'roofEntry', 'pausedClock', 'doubleSpeedClock', 'nap', 'overnightSleep', 'sleepAutosave',
    'travel', 'travelAutosave',
    'closedFerry', 'allNeighborhoods', 'allTravelAutosaves',
    'conversationPause', 'conversationInputLocked', 'conversationSocialNavLocked', 'promptIdeasContextual', 'conversationBuffered', 'conversationFallback', 'conversationCommitSave',
    'structuredInvitation', 'relationshipPanel', 'hiddenFaction', 'journalInvitation', 'socialPurchase',
    'questStarted', 'questChoicePreview', 'questOutcome', 'questAutosave', 'policeHooks',
  ]) {
    if (worldResult[key] !== true) {
      throw new Error(`Packaged world input check failed: ${key}. ${JSON.stringify(worldResult)}`);
    }
  }
  if (readFileSync(worldZoomPaths[0]!).equals(readFileSync(worldZoomPaths[2]!))) {
    throw new Error('Packaged 1x and 3x world evidence is identical.');
  }
  validateScreenshotBuffers(readFileSync(roofScreenshotPath), readFileSync(downtownScreenshotPath));
  validateScreenshotBuffers(readFileSync(downtownScreenshotPath), readFileSync(ferryScreenshotPath));
  validateScreenshotBuffers(readFileSync(ferryScreenshotPath), readFileSync(loopScreenshotPath));
  validateScreenshotBuffers(readFileSync(loopScreenshotPath), readFileSync(conversationScreenshotPath));
  validateScreenshotBuffers(readFileSync(conversationScreenshotPath), readFileSync(socialScreenshotPath));
  validateScreenshotBuffers(readFileSync(socialScreenshotPath), readFileSync(journalScreenshotPath));
  validateScreenshotBuffers(readFileSync(journalScreenshotPath), readFileSync(questScreenshotPath));
  validateScreenshotBuffers(readFileSync(questScreenshotPath), readFileSync(questOutcomeScreenshotPath));
  validateScreenshotBuffers(readFileSync(questOutcomeScreenshotPath), readFileSync(policeScreenshotPath));
  process.stdout.write(
    `Packaged Electron smoke: ${JSON.stringify(report)} world=${JSON.stringify(worldResult)} loading=${loadingScreenshotPath} ready=${screenshotPath}\n`,
  );
});
