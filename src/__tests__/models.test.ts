import { describe, expect, it } from 'vitest';
import { makeRootTip } from '../features/interactives/Microscope';
import { PRESETS, VIEWER, presetDirection } from '../features/three/viewerConfig';
import { modelReferences } from '../data/modelReferences';
import { getTopic, topicsByBook } from '../data/registry';

describe('virtual microscope preparation', () => {
  const cells = makeRootTip();
  it('is deterministic and contains every mitosis phase', () => {
    expect(makeRootTip()).toEqual(cells);
    for (const p of [0, 1, 2, 3, 4]) expect(cells.some((c) => c.phase === p)).toBe(true);
  });
  it('keeps divisions in the meristem near the tip, interphase elsewhere', () => {
    for (const c of cells) if (c.phase !== 0) expect(c.y).toBeGreaterThan(880);
    expect(cells.filter((c) => c.y < 800).every((c) => c.phase === 0)).toBe(true);
  });
});

describe('3D viewer configuration', () => {
  it('every scene key has a camera config with sane limits', () => {
    for (const cfg of Object.values(VIEWER)) {
      expect(cfg.minDistance).toBeLessThan(cfg.distance);
      expect(cfg.maxDistance).toBeGreaterThan(cfg.distance);
      expect(cfg.minPolar).toBeGreaterThan(0);
      expect(cfg.maxPolar).toBeLessThan(Math.PI);
    }
  });
  it('presets are unit directions; left/right and front/back are opposite', () => {
    for (const cfg of Object.values(VIEWER)) {
      for (const p of PRESETS) expect(Math.hypot(...presetDirection(cfg.front, p.id))).toBeCloseTo(1, 5);
      const l = presetDirection(cfg.front, 'chap');
      const r = presetDirection(cfg.front, 'ong');
      expect(l[0] + r[0] + l[2] + r[2]).toBeCloseTo(0, 5);
    }
    // brain: front is −x, so the left-side view looks from +z (left hemisphere)
    expect(presetDirection(VIEWER.brain.front, 'chap')).toEqual([0, 0, 1]);
  });
});

describe('reference images', () => {
  it('cover every 3D lesson and the microscope, each mapped to its own book', () => {
    const mapped = new Set(modelReferences.flatMap((r) => r.topicKeys));
    for (const t of [...topicsByBook.grade8, ...topicsByBook.grade10]) {
      if (t.scene && t.number !== '39') expect(mapped.has(t.key)).toBe(true); // §39 neuron has no reference sheet
    }
    for (const r of modelReferences) for (const k of r.topicKeys) expect(getTopic(k)?.bookId).toBe(r.bookId);
    expect(new Set(modelReferences.map((r) => r.referenceFile)).size).toBe(modelReferences.length);
  });
});
