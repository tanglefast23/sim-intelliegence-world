import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

const spikeRoot = fileURLToPath(new URL('.', import.meta.url));
const chrome = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await stat(chrome);
const scratch = await mkdtemp(join(tmpdir(), 'animated-sketch-'));
const page = pathToFileURL(join(spikeRoot, 'index.html')).href;

function runChrome(time, output) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(chrome, [
      '--headless=new', '--hide-scrollbars', '--mute-audio', '--disable-background-networking',
      '--use-angle=swiftshader', '--enable-webgl', '--allow-file-access-from-files',
      '--force-prefers-reduced-motion=no-preference', '--window-size=900,820',
      '--virtual-time-budget=2500',
      `--screenshot=${output}`, `${page}?t=${time}`,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.on('error', rejectRun);
    child.on('exit', (code) => code === 0 ? resolveRun() : rejectRun(new Error(error || `Chrome exited ${code}.`)));
  });
}

try {
  const firstPath = join(scratch, 'first.png');
  const secondPath = join(scratch, 'second.png');
  await runChrome(0.7, firstPath);
  await runChrome(2.2, secondPath);
  const first = PNG.sync.read(await readFile(firstPath));
  const second = PNG.sync.read(await readFile(secondPath));
  if (first.width !== 900 || first.height !== 820 || second.width !== first.width || second.height !== first.height) {
    throw new Error(`Unexpected capture size: ${first.width}x${first.height}.`);
  }
  let changed = 0;
  const colors = new Set();
  for (let offset = 0; offset < first.data.length; offset += 4) {
    if (offset % 64 === 0) colors.add(first.data.readUInt32BE(offset));
    if (first.data.readUInt32BE(offset) !== second.data.readUInt32BE(offset)) changed += 1;
  }
  if (colors.size < 12 || changed < 1_000) {
    throw new Error(`Render lacks detail or motion: ${colors.size} sampled colors, ${changed} changed pixels.`);
  }
  console.log(`Animated sketch check passed: ${first.width}x${first.height}, ${colors.size} sampled colors, ${changed} changed pixels.`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
