/**
 * Elevation for the top-level plates that are siblings inside `#world-state`.
 *
 * React Native Web gives every View `position: relative; z-index: 0`, so every View is its own
 * stacking context and z-index only competes between siblings. That makes one scale for the
 * `#world-state` sibling group the right granularity: a panel's own children never need to
 * participate, and `SelectionMarker` is deliberately absent because it lives inside
 * `#world-canvas`, a different group.
 *
 * Before this scale, `world-ui-help`, `world-audio-caption`, the transition overlays and
 * `BedActions` carried no z-index at all and worked only by DOM order.
 */
export const UI_LAYER = Object.freeze({
  statusStrip: 20,
  card: 24,
  hud: 30,
  /**
   * Shared by `#world-transition-overlay` and `#world-renderer-recovery-overlay`; they share one
   * style. Both stay below `conversation`, which preserves the existing behaviour where an open
   * conversation covers "GRAPHICS RESTART REQUIRED".
   */
  transition: 40,
  conversation: 50,
  sideSheet: 55,
  /**
   * The vocal-cue caption is written for players who cannot hear the cue, so it has to clear every
   * panel that can be open while a cue fires. It sat under the conversation overlay and was
   * therefore never visible. Above `transition` is a deliberate, practically unreachable trade.
   */
  caption: 60,
  cutscene: 65,
});

export type UiLayer = keyof typeof UI_LAYER;
