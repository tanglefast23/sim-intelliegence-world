---
date: 2026-08-11
topic: electron-dev-harness
---

# Electron Dev Harness

## What We Are Building

Add a human-facing Electron menu that opens important game views immediately. Keep the existing automated Electron smoke harness unchanged.

## Why This Approach

Reuse the HFM registry, case, deep-link, and reset pattern. Render production UI with disposable schema-valid states. Do not load or write the normal game save.

## Key Decisions

- Launch with `npm run dev:harness`.
- Keep `slot-001` isolated from all harness actions.
- Use one registry as the complete list of available views.
- Reset a view when its case changes and provide a manual Reset button.
- Start with welcome, locations, conversations, journal, quest, and relationship views.

## Open Questions

- Add more entries when a new game feature needs immediate visual review.

## Next Steps

Implement and verify the Electron window, routes, states, and no-save boundary.
