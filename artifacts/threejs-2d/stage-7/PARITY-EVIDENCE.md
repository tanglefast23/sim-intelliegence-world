# Where final renderer parity evidence lives

Stage 7 retired `smoke:renderer-parity` and `smoke:renderer-all-maps` along with
their fixture builders. Those scripts launched the packaged app twice, once per
renderer, and compared the two. With Skia deleted there is no second renderer, so
they could only have compared Three.js against itself, which proves nothing.
The port plan calls this migration-only code and asks for its removal.

The authoritative Skia-versus-Three.js comparison is therefore the Stage 6
evidence, captured while both renderers still existed and both could run:

- `artifacts/threejs-2d/stage-6/renderer-comparison-parity.json`, 25 of 25
  fixtures passing with Three.js as the production renderer;
- `artifacts/threejs-2d/stage-6/remote-gate.json`, all four required CI jobs
  passing on the exact pushed SHA;
- the Stage 3, 4 and 5 reports beneath the same tree for each earlier contract.

Those files are the final record. Nothing in Stage 7 can regenerate them, which
is the point: they document a comparison that is no longer possible to make.

Ongoing renderer coverage after this stage is behavioural rather than
comparative: the packaged smokes, the art-quality and responsive qualifications,
the VFX evidence, and the lifecycle and security suites all still run against
Three.js on every supported platform.
