# The polish program has no capture path

Date: 2026-08-16. Found while running the plan's own verification loop.

## What happened

Item 4.1 landed and `npm run qualify:renderer` reported 25 of 25 fixtures passing.
That result is real but it does not measure the change. The comparator reads
committed baseline and candidate PNGs. Both sides are frozen files, so it
re-verified old evidence and would have passed identically had the renderer been
broken.

## Why the path is gone

Stage 7 deleted `run-renderer-parity-package-smoke.ts`,
`run-renderer-all-maps-package-smoke.ts`, `build-threejs-villa-fixtures.ts` and
`build-threejs-all-map-fixtures.ts` as migration-only code, and that was correct:
they launched the packaged app twice, once per renderer, to compare Skia against
Three.js. With Skia deleted they could only have compared Three.js against
itself.

What went with them was the only way to refresh the candidate side of a fixture.
The comparator survived; the thing that feeds it did not.

## What this means for the program

Every gate in the plan phrased as "the comparator enforces" is currently
unrunnable for a NEW change. That covers contrast retention, mask identity,
readable coverage and the light samples. The plan's own review already flagged
that the loop omitted the comparator; adding it exposed the deeper problem, which
is that the comparator has nothing fresh to read.

Item 4.1 is therefore supported by focused unit tests only:

- the snap is a no-op at DPR 1 with an integer camera;
- a fractional origin lands on the device-pixel lattice at DPR 1.25;
- the snap is idempotent;
- cameras differing by less than one device pixel collapse to one result;
- the visible extent is unchanged.

Those are real and they pass. They are not the pixel evidence the specification
asks for, and this file exists so nobody mistakes one for the other.

## What has to happen before any further item ships

Rebuild a Three.js-only capture path:

1. a packaged smoke that drives the app to each locked fixture case and writes a
   candidate capture, hidden and game-muted, as the retired runners did for one
   renderer instead of two;
2. a fixture builder that refreshes the candidate side of each manifest and
   leaves the frozen Skia baselines untouched, since those record a comparison
   that can no longer be made;
3. a check that a deliberately broken renderer fails the refreshed comparison, so
   the new path cannot be vacuous in the way this one was.

Until that exists, no polish item can show the measurement the specification
requires, and none should be claimed as verified.
