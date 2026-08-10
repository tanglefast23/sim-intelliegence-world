import { execFileSync } from 'node:child_process';

export function resolveTestedCommit(): string {
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(checkedOut)) throw new Error('Checked-out Git commit is invalid.');
  const supplied = process.env.GITHUB_SHA;
  if (supplied && supplied !== checkedOut) {
    throw new Error(`GITHUB_SHA does not match the checked-out commit: expected ${checkedOut}.`);
  }
  return checkedOut;
}
