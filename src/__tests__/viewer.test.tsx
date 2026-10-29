// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Viewer from '../features/three/Viewer';
import { getTopic, topicsByBook } from '../data/registry';
import { PRESETS, VIEWER, presetDirection } from '../features/three/viewerConfig';
import { daughterLayout, fusedPairs, meiosisFrames, mitosisFrames } from '../features/division/stages';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; // no WebGL
  // jsdom has no IntersectionObserver / WebGL: the viewer shows its schematic fallback, which is what we exercise
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(cleanup);

describe('2.12 Prokariot / Eukariot switch', () => {
  const scene = getTopic('grade10-2-12')!.scene!;

  it('switches model identity, structures and stages without stale state', () => {
    render(<Viewer scene={scene} />);
    const tab = (name: string) => screen.getByRole('tab', { name });
    for (let round = 0; round < 2; round++) {
      fireEvent.click(tab('Prokariot'));
      expect(tab('Prokariot').getAttribute('aria-selected')).toBe('true');
      expect(screen.getAllByRole('heading', { level: 2 }).some((h) => h.textContent === 'Bakteriyaning ikkiga bo‘linishi')).toBe(true);
      expect(screen.getByRole('button', { name: 'DNK' })).toBeTruthy();
      // WebGL fallback shows the bacterium, not the mitosis schematic
      expect(screen.getByRole('img', { name: /Bakteriyaning ikkiga/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Urchuq' })).toBeNull();

      fireEvent.click(tab('Eukariot'));
      expect(tab('Eukariot').getAttribute('aria-selected')).toBe('true');
      expect(screen.queryByRole('button', { name: 'DNK' })).toBeNull();
      expect(screen.queryByRole('img', { name: /Bakteriyaning ikkiga/ })).toBeNull();
      expect(screen.getAllByRole('tablist', { name: 'Model turi' })).toHaveLength(1);
    }
  });
});

describe('3D camera configuration', () => {
  it('every scene used by a lesson frames inside its zoom limits', () => {
    for (const t of [...topicsByBook.grade8, ...topicsByBook.grade10]) {
      const c = t.scene && VIEWER[t.scene.key];
      if (!c) continue;
      expect(c.distance).toBeGreaterThanOrEqual(c.minDistance);
      expect(c.distance).toBeLessThanOrEqual(c.maxDistance);
      // a fitted model must still fit at the farthest allowed distance on a square canvas
      const tan = Math.tan((38 / 2) * (Math.PI / 180));
      if (c.span) expect(c.span / tan).toBeLessThanOrEqual(c.maxDistance * 1.25);
      if (c.halfHeight) expect(c.halfHeight / tan).toBeLessThanOrEqual(c.maxDistance);
    }
  });
  it('the six presets are distinct unit directions for every scene', () => {
    for (const c of Object.values(VIEWER)) {
      const dirs = PRESETS.map((p) => presetDirection(c.front, p.id));
      for (const d of dirs) expect(Math.hypot(...d)).toBeCloseTo(1, 5);
      expect(new Set(dirs.map((d) => d.map((x) => x.toFixed(3)).join())).size).toBe(PRESETS.length);
    }
  });
});

describe('division geometry', () => {
  it('daughter bacteria fill the pinched mother cell exactly, then separate without overlapping', () => {
    for (const half of [0.6, 0.88, 1.1]) {
      const at = daughterLayout(half, 0);
      expect(at.x - at.half - at.cap).toBeCloseTo(0, 6); // inner tips meet at the furrow
      expect(at.x + at.half + at.cap).toBeCloseTo(half + at.cap, 6); // outer tips at the mother's poles
      const apart = daughterLayout(half, 0.34);
      expect(apart.x - apart.half - apart.cap).toBeGreaterThan(0);
    }
  });
  it('overlapping cells are drawn as one furrowed membrane, separate cells stay separate', () => {
    const telo = mitosisFrames.find((f) => f.id === 'telofaza')!;
    expect(fusedPairs(telo.cells)).toEqual([[0, 1]]);
    expect(fusedPairs(mitosisFrames[mitosisFrames.length - 1].cells)).toEqual([]);
    expect(fusedPairs(meiosisFrames[meiosisFrames.length - 1].cells)).toEqual([]);
  });
});
