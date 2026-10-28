import { describe, expect, it } from 'vitest';
import { PROBLEMS, energy } from '../features/interactives/energy';
import { GENETIC_CODE, TRANSLATION_CODONS, codons, transcribe } from '../features/three/sequences';
import { segments } from '../features/highlights/Highlights';
import { meiosisFrames, mitosisFrames } from '../features/division/stages';

describe('energy (Biologiya 10, pp.62–64)', () => {
  it('matches the book totals per glucose', () => {
    const e = energy(1, true);
    expect(e.atp).toBe(38);
    expect(e.atpKJ).toBe(1520);
    expect(e.glycolysis.total + e.aerobic.total).toBe(2800);
    expect(energy(1, false).atp).toBe(2);
  });

  it('book problems resolve to the book answers', () => {
    const byN = Object.fromEntries(PROBLEMS.map((p) => [p.n, p.answer]));
    expect(((720 / 120) * 2 / 2) * 1440).toBe(byN[1]);
    expect((7680 / (120 + 1160)) * 80).toBe(byN[2]);
    expect((6400 / 1280) * 80).toBe(byN[4]);
    expect(Math.round(((((152 / 38) * 36) / 152) * 1000)) / 10).toBe(byN[5]);
    expect(0.5 * (252 / 21) * 38).toBe(byN[3]);
  });
});

describe('genetic code (fig. 2.26)', () => {
  it('has 64 codons, 3 stops, AUG = metionin', () => {
    expect(Object.keys(GENETIC_CODE)).toHaveLength(64);
    expect(Object.values(GENETIC_CODE).filter((a) => a === 'stop')).toHaveLength(3);
    expect(GENETIC_CODE.AUG).toBe('metionin');
  });

  it('transcribes like the book example', () => {
    expect(transcribe('ACGTGA')).toBe('UGCACU');
    expect(codons(transcribe('GTCATGGATAGTCCTAAT'))).toHaveLength(6);
  });

  it('translation demo starts with AUG and ends with a stop codon', () => {
    expect(TRANSLATION_CODONS[0].codon).toBe('AUG');
    expect(TRANSLATION_CODONS.at(-1)!.amino).toBe('stop');
  });
});

describe('division frames', () => {
  it('use the book formulas', () => {
    expect(mitosisFrames.map((f) => f.formula)).toContain('4n4c');
    expect(meiosisFrames.find((f) => f.id === 'telofaza1')!.formula).toBe('1n2c');
    expect(meiosisFrames.find((f) => f.id === 'telofaza2')!.cells).toHaveLength(4);
    expect(mitosisFrames.at(-1)!.cells).toHaveLength(2);
  });
});

describe('highlight segments', () => {
  it('splits and merges overlapping ranges', () => {
    const s = segments('abcdefgh', [
      { start: 1, end: 3, id: 'a' },
      { start: 2, end: 5, id: 'b' },
    ]);
    expect(s.map((x) => x.text).join('')).toBe('abcdefgh');
    expect(s.filter((x) => x.id).map((x) => x.text)).toEqual(['bc', 'de']);
  });
});
