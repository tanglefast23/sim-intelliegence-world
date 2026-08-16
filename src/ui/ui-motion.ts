/**
 * Interface motion for the world UI, authored as plain CSS.
 *
 * Why a CSS string and not style objects:
 *
 * 1. React Native 0.86's `ViewStyle` has no `transitionProperty`, `animationKeyframes` or
 *    `backdropFilter`, so under `strict` these cannot be written in a `StyleSheet.create` object
 *    at all.
 * 2. React Native Web has no `animationName`. Its `validate()` logs
 *    `Did you mean "animationKeyframes"?` and then deletes the property, so a style object using
 *    `animationName` compiles, runs, and silently does nothing. Raw CSS never reaches that
 *    validator — the browser parses `@keyframes` and `animation-name` directly.
 * 3. Reanimated is a dependency here but is imported nowhere, there is no `babel.config.js`, and on
 *    web it has no separate UI thread to move work onto. CSS transitions on `transform` and
 *    `opacity` are the only option that genuinely leaves the main thread, which matters because
 *    every one of these frames is shared with a continuously presenting WebGL world render.
 *
 * Everything here is event-triggered and finite. Nothing loops, nothing runs at idle, and no
 * animation reads from or writes to the simulation.
 *
 * Reduced motion is handled structurally rather than per-animation: the
 * `@media (prefers-reduced-motion: reduce)` block in `src/application/accessibility.ts` forces
 * duration and delay to `0.01ms !important` on `*`, and `!important` beats any declaration here
 * regardless of specificity. Nothing in this file may use `!important`, or that guarantee breaks.
 */
export const UI_MOTION_CSS = `
@keyframes si-ui-panel-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@keyframes si-ui-sheet-in {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: none; }
}
@keyframes si-ui-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/*
 * Hover and keyboard focus share one state layer, so the two affordances cannot drift apart.
 * It animates opacity only: no render surface, no repaint of the control, and no collision with
 * the authored background-color, border-color or pressed opacity, which an id-scoped colour rule
 * would out-specify and flatten.
 *
 * The selector is [tabindex="0"] because react-native-web's Pressable already emits tabIndex 0 when
 * enabled and -1 when disabled. That needs no per-control markup and declines to show an
 * affordance on disabled controls for free. Nothing else in src/ sets tabIndex.
 *
 * position: absolute keeps the pseudo-element out of flow — every RNW View is display: flex, so an
 * in-flow ::after would become a flex item and change layout.
 */
#world-state [tabindex="0"]::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-color: #fff0c7;
  opacity: 0;
  transition-property: opacity;
  transition-duration: 110ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
#world-state [tabindex="0"]:hover::after,
#world-state [tabindex="0"]:focus-visible::after {
  opacity: 0.1;
}

/*
 * role="button" makes react-native-web render a real <button>. View's base style already resets
 * border, background-color, margin and padding; appearance is the only UA property left.
 * Deliberately not border/background here: an id-scoped rule would out-specify RNW's atomic
 * classes and erase every authored button border.
 */
#world-state button {
  appearance: none;
  -webkit-appearance: none;
}

#world-ui-conversation-panel {
  animation-name: si-ui-panel-in;
  animation-duration: 160ms;
  animation-timing-function: cubic-bezier(0, 0, 0, 1);
  animation-fill-mode: both;
}
#world-ui-journal-panel,
#world-ui-relationship-panel {
  animation-name: si-ui-sheet-in;
  animation-duration: 160ms;
  animation-timing-function: cubic-bezier(0, 0, 0, 1);
  animation-fill-mode: both;
}
#world-ui-conversation-overlay,
#world-ui-journal-overlay,
#world-ui-relationship-overlay,
#world-ui-quest-offer-overlay {
  animation-name: si-ui-fade-in;
  animation-duration: 160ms;
  animation-timing-function: linear;
  animation-fill-mode: both;
}
#world-ui-display-settings {
  animation-name: si-ui-panel-in;
  animation-duration: 140ms;
  animation-timing-function: cubic-bezier(0, 0, 0, 1);
  animation-fill-mode: both;
}

/*
 * Two levels deep on purpose. #conversation-transcript is the ScrollView, which RNW renders as
 * scrollable div > content-container div > lines. A single > * would match only the content
 * container, so the transcript would fade once on mount and no line would ever animate.
 *
 * Opacity only: the transcript auto-scrolls to the end on content size change, and a downward
 * translate on a newly inserted child would extend scrollHeight and fight that scroll.
 */
#conversation-transcript > * > * {
  animation-name: si-ui-fade-in;
  animation-duration: 140ms;
  animation-timing-function: linear;
  animation-fill-mode: both;
}

/*
 * Suggestions are direct children here. backwards fill holds the delayed items at opacity 0 instead
 * of flashing them; that is exactly why the reduced-motion block must also reset animation-delay.
 * Each item animates once when it is created, so a suggestion id repeated across turns is reused by
 * React and does not replay.
 */
#conversation-prompt-suggestions > * {
  animation-name: si-ui-fade-in;
  animation-duration: 140ms;
  animation-timing-function: linear;
  animation-fill-mode: backwards;
}
#conversation-prompt-suggestions > *:nth-child(2) { animation-delay: 40ms; }
#conversation-prompt-suggestions > *:nth-child(3) { animation-delay: 80ms; }
#conversation-prompt-suggestions > *:nth-child(n+4) { animation-delay: 120ms; }

/*
 * The meter fills are scaleX rather than width so the change composites instead of laying out.
 * This also fires on passive world-driven drain, not only on player action; it is finite and
 * composited, so that is accepted rather than special-cased.
 */
#world-ui-energy-fill,
#world-ui-health-fill {
  transition-property: transform;
  transition-duration: 320ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}

#world-ui-feedback {
  animation-name: si-ui-panel-in;
  animation-duration: 200ms;
  animation-timing-function: cubic-bezier(0, 0, 0, 1);
  animation-fill-mode: both;
}
`;
