import { WEB_ACCESSIBILITY_CSS } from '../../application/accessibility';
import { UI_LAYER } from '../ui-layers';
import { UI_MOTION_CSS } from '../ui-motion';

const MAXIMUM_DURATION_MS = 320;
const MAXIMUM_DELAY_MS = 200;

function withoutComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');
}

/** Drops every `@keyframes name { ... }` block, so only ordinary rules are left to inspect. */
function withoutKeyframes(css: string): string {
  let output = '';
  let index = 0;
  while (index < css.length) {
    const start = css.indexOf('@keyframes', index);
    if (start === -1) {
      output += css.slice(index);
      break;
    }
    output += css.slice(index, start);
    let cursor = css.indexOf('{', start);
    let depth = 0;
    while (cursor < css.length) {
      if (css[cursor] === '{') depth += 1;
      else if (css[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      cursor += 1;
    }
    index = cursor + 1;
  }
  return output;
}

function ruleHeads(css: string): readonly string[] {
  return withoutKeyframes(withoutComments(css))
    .split('}')
    .map((block) => block.split('{')[0]?.trim() ?? '')
    .filter((head) => head.length > 0);
}

function millisecondValues(css: string, property: string): readonly number[] {
  const matches = withoutComments(css).matchAll(new RegExp(`${property}:\\s*([\\d.]+)ms`, 'gu'));
  return [...matches].map((match) => Number(match[1]));
}

describe('ui motion css', () => {
  test('is wired into the installed accessibility stylesheet', () => {
    expect(WEB_ACCESSIBILITY_CSS).toContain(UI_MOTION_CSS);
  });

  test('never uses !important, so the reduced-motion block always wins', () => {
    // The reduced-motion guard is structural: !important beats any declaration here regardless of
    // specificity. One !important in this file would silently exempt that animation.
    expect(UI_MOTION_CSS).not.toContain('!important');
  });

  test('reduced motion neutralises duration AND delay', () => {
    // A staggered entry uses animation-delay with backwards fill. Zeroing only the duration would
    // leave the item held at opacity 0 for the delay and then pop into place.
    const reduced = WEB_ACCESSIBILITY_CSS.slice(WEB_ACCESSIBILITY_CSS.indexOf('prefers-reduced-motion'));
    for (const declaration of [
      'animation-delay: 0.01ms !important',
      'animation-duration: 0.01ms !important',
      'transition-delay: 0.01ms !important',
      'transition-duration: 0.01ms !important',
    ]) {
      expect(reduced).toContain(declaration);
    }
  });

  test('stays inside the motion budget and never loops', () => {
    const durations = [
      ...millisecondValues(UI_MOTION_CSS, 'transition-duration'),
      ...millisecondValues(UI_MOTION_CSS, 'animation-duration'),
    ];
    expect(durations.length).toBeGreaterThan(0);
    for (const duration of durations) expect(duration).toBeLessThanOrEqual(MAXIMUM_DURATION_MS);
    for (const delay of millisecondValues(UI_MOTION_CSS, 'animation-delay')) {
      expect(delay).toBeLessThanOrEqual(MAXIMUM_DELAY_MS);
    }
    expect(UI_MOTION_CSS).not.toContain('infinite');
  });

  test('every rule is anchored to an id, so nothing leaks to the whole document', () => {
    const heads = ruleHeads(UI_MOTION_CSS);
    expect(heads.length).toBeGreaterThan(0);
    for (const head of heads) {
      for (const selector of head.split(',')) {
        expect(selector.trim().startsWith('#')).toBe(true);
      }
    }
  });

  test('hover and keyboard focus share one rule, so they cannot drift apart', () => {
    const shared = ruleHeads(UI_MOTION_CSS).find((head) => head.includes(':hover'));
    expect(shared).toBeDefined();
    expect(shared).toContain(':focus-visible');
  });

  test('uses css animation-name, never react-native-web’s silent animationName', () => {
    // RNW's validate() deletes animationName and suggests animationKeyframes, so a style object
    // written that way compiles, runs, and does nothing. Raw CSS avoids the trap entirely.
    expect(UI_MOTION_CSS).toContain('animation-name:');
    expect(UI_MOTION_CSS).not.toContain('animationName');
  });

  test('the transcript rule reaches the lines, not the scroll content container', () => {
    // #conversation-transcript is the ScrollView. RNW renders scrollable div > content div > lines,
    // so a single child combinator would animate the container once and no line ever.
    expect(UI_MOTION_CSS).toContain('#conversation-transcript > * > *');
  });
});

describe('ui layers', () => {
  test('are unique and ascending in declaration order', () => {
    const values = Object.values(UI_LAYER);
    expect(new Set(values).size).toBe(values.length);
    expect([...values]).toEqual([...values].sort((left, right) => left - right));
  });

  test('put the vocal-cue caption above every panel that can be open when a cue fires', () => {
    expect(UI_LAYER.caption).toBeGreaterThan(UI_LAYER.conversation);
    expect(UI_LAYER.caption).toBeGreaterThan(UI_LAYER.sideSheet);
  });
});
