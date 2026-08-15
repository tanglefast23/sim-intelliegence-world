# Intel macOS and the WebGL 2 blocklist

Stage 6 surfaced this and Stage 7 makes it consequential.

## What was measured

The `macos-15-intel` CI runner reports, from the packaged app:

```
ContextResult::kTransientFailure: Failed to send GpuControl.CreateCommandBuffer.
ContextResult::kFatalFailure: WebGL2 blocklisted
```

Chromium blocklists WebGL 2 on that runner's GPU. Before the cutover that job ran
the Skia renderer, which needs no WebGL, so the constraint was invisible.

## Why Stage 7 changes the stakes

Stage 7 deletes Skia. There is no longer any renderer that can run without
WebGL 2, and specification section 9.3 requires initialization to fail with a
clear loading-shell message rather than silently fall back. That is the correct
behaviour, but for a user on blocklisted hardware it means the game does not run.

## What this stage does

Intel macOS is qualified here by packaging, ad-hoc signing, and a RECORDED
WebGL 2 probe. The probe step does not fail the job, so the blocklist is visible
in the run rather than either hidden by a software-rendering flag, which Stage 0
task 19 forbids, or blocking the whole pipeline on a runner-image property.

Functional coverage runs on the ARM64 job, which has working WebGL 2.

## What must be settled before an Intel release

1. Establish whether the blocklist is a property of this CI runner image or of
   Intel Mac GPUs generally. That needs evidence from real hardware, which no
   amount of CI configuration can substitute for.
2. If real Intel Macs are affected, decide between keeping a supported fallback,
   which contradicts the decommission this stage completed and needs a
   specification amendment, or dropping Intel macOS from the release targets.

Until one of those is settled, treat Intel macOS as packaged but not proven
playable. The recorded probe in each run is the evidence to watch.
