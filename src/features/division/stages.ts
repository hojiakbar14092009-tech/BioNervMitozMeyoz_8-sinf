// Schematic 2n = 4 cell (two homologous pairs: long A, short B; paternal = blue, maternal = rose).
// Stage texts and n/c formulas follow Biologiya 10, pp.73–77.

export interface Chromatid {
  id: string;
  x: number;
  y: number;
  rot: number; // radians; 0 = horizontal
  len: number;
  color: 'p' | 'm';
  tip?: 'p' | 'm'; // crossing-over exchanged segment
  scale: number; // 1 = condensed chromosome, ~0.25 = chromatin thread
}

export interface CellShape {
  x: number;
  y: number;
  r: number;
  nucleus: number; // 0..1 nuclear envelope opacity
  poles?: [[number, number], [number, number]];
}

export interface Frame {
  id: string;
  name: string;
  formula: string;
  text: string;
  cells: CellShape[];
  chromatids: Chromatid[];
}

type Mode = 'mitosis' | 'meiosis';

const LEN = { A: 0.42, B: 0.26 };
const CHR = [
  ['A', 'p'],
  ['A', 'm'],
  ['B', 'p'],
  ['B', 'm'],
] as const;

const ct = (c: 'A' | 'B', par: 'p' | 'm', s: 1 | 2, x: number, y: number, rot: number, scale = 1, tip?: 'p' | 'm'): Chromatid => ({
  id: `${c}${par}${s}`,
  x,
  y,
  rot,
  len: LEN[c],
  color: par,
  scale,
  tip,
});

/** Both sisters of a chromosome, offset perpendicular to its axis. */
function chromosome(c: 'A' | 'B', par: 'p' | 'm', x: number, y: number, rot: number, scale = 1, gap = 0.045, tips: [('p' | 'm')?, ('p' | 'm')?] = [undefined, undefined]) {
  const dx = -Math.sin(rot) * gap;
  const dy = Math.cos(rot) * gap;
  return [ct(c, par, 1, x - dx, y - dy, rot, scale, tips[0]), ct(c, par, 2, x + dx, y + dy, rot, scale, tips[1])];
}

const chromatin = (cx: number, cy: number, spread = 0.28) =>
  CHR.flatMap(([c, par], i) =>
    ([1, 2] as const).map((s) => ct(c, par, s, cx + Math.cos(i * 1.7 + s) * spread * 0.7, cy + Math.sin(i * 2.3 + s * 1.3) * spread * 0.6, i + s * 0.8, 0.22)),
  );

const one = (nucleus: number, poles = false): CellShape[] => [{ x: 0, y: 0, r: 1, nucleus, poles: poles ? [[-0.95, 0], [0.95, 0]] : undefined }];

const interphase = (formula: string, text: string): Frame => ({
  id: 'interfaza',
  name: 'Interfaza',
  formula,
  text,
  cells: one(1),
  chromatids: chromatin(0, 0),
});

export const mitosisFrames: Frame[] = [
  interphase('2n2c → 2n4c', 'G1 da hujayra o‘sadi (2n2c); S davrida DNK reduplikatsiyalanadi va har bir xromosoma ikki xromatidali bo‘ladi (2n4c); G2 da tubulin sintezlanadi.'),
  {
    id: 'profaza',
    name: 'Profaza',
    formula: '2n4c',
    text: 'Xromosomalar spirallashib kaltalashadi va yo‘g‘onlashadi. Sentriolalar qutblarga tarqaladi, bo‘linish urchug‘i shakllanadi. Yadrocha eriydi, yadro qobig‘i parchalanadi.',
    cells: one(0.25, true),
    chromatids: [...chromosome('A', 'p', -0.35, 0.3, 0.6), ...chromosome('A', 'm', 0.32, 0.32, -0.4), ...chromosome('B', 'p', -0.28, -0.32, -0.9), ...chromosome('B', 'm', 0.34, -0.28, 0.3)],
  },
  {
    id: 'metafaza',
    name: 'Metafaza',
    formula: '2n4c',
    text: 'Xromosomalar ekvator tekisligiga joylashadi. Urchuq iplari har bir xromosoma sentromerasiga ikki tomondan birikadi.',
    cells: one(0, true),
    chromatids: [...chromosome('A', 'p', 0, 0.48, Math.PI / 2), ...chromosome('A', 'm', 0, 0.16, Math.PI / 2), ...chromosome('B', 'p', 0, -0.16, Math.PI / 2), ...chromosome('B', 'm', 0, -0.44, Math.PI / 2)],
  },
  {
    id: 'anafaza',
    name: 'Anafaza',
    formula: '4n4c',
    text: 'Sentromeralar ikkiga bo‘linadi. Urchuq iplari qisqarib, xromatidalarni qarama-qarshi qutblarga tortadi; ular qutblarga xromosoma sifatida yetib boradi.',
    cells: one(0, true),
    chromatids: CHR.flatMap(([c, par], i) => [ct(c, par, 1, -0.58, 0.42 - i * 0.28, Math.PI / 2), ct(c, par, 2, 0.58, 0.42 - i * 0.28, Math.PI / 2)]),
  },
  {
    id: 'telofaza',
    name: 'Telofaza',
    formula: '2n2c',
    text: 'Xromosomalar despirallanib xromatinga aylanadi. Urchuq parchalanadi, yadrocha va yadro qobig‘i paydo bo‘ladi. Sitokinez boshlanadi.',
    cells: [
      { x: -0.5, y: 0, r: 0.82, nucleus: 0.6 },
      { x: 0.5, y: 0, r: 0.82, nucleus: 0.6 },
    ],
    chromatids: CHR.flatMap(([c, par], i) => [ct(c, par, 1, -0.62 + (i % 2) * 0.12, 0.2 - i * 0.13, 1 + i, 0.5), ct(c, par, 2, 0.62 - (i % 2) * 0.12, 0.2 - i * 0.13, 1 + i, 0.5)]),
  },
  {
    id: 'natija',
    name: 'Natija',
    formula: '2 × 2n2c',
    text: 'Ona hujayradan genetik jihatdan bir xil ikkita qiz hujayra hosil bo‘ladi. Ular yana bo‘linishi mumkin.',
    cells: [
      { x: -1.05, y: 0, r: 0.8, nucleus: 1 },
      { x: 1.05, y: 0, r: 0.8, nucleus: 1 },
    ],
    chromatids: CHR.flatMap(([c, par], i) => [ct(c, par, 1, -1.05 + Math.cos(i * 1.9) * 0.2, Math.sin(i * 2.1) * 0.18, i, 0.22), ct(c, par, 2, 1.05 + Math.cos(i * 1.9) * 0.2, Math.sin(i * 2.1) * 0.18, i, 0.22)]),
  },
];

const L = -1.05;
const R = 1.05;
const vpoles = (x: number): [[number, number], [number, number]] => [
  [x, 0.72],
  [x, -0.72],
];

export const meiosisFrames: Frame[] = [
  interphase('2n2c → 2n4c', 'ATF va oqsil sintezi tezlashadi, DNK miqdori ikki hissa ortadi, hayvon hujayralarida sentriolalar ko‘payadi.'),
  {
    id: 'profaza1',
    name: 'Profaza I',
    formula: '2n4c',
    text: 'Eng uzoq davom etadigan davr. Gomologik xromosomalar yaqinlashib (konyugatsiya) to‘rt xromatidali tetrada hosil qiladi va qismlar bilan almashinadi (krossingover). Yadrocha va yadro qobig‘i parchalanadi.',
    cells: one(0.25, true),
    chromatids: [
      ...chromosome('A', 'p', -0.3, 0.28, 0.4, 1, 0.045, [undefined, 'm']),
      ...chromosome('A', 'm', -0.3 - Math.sin(0.4) * -0.1, 0.28 - Math.cos(0.4) * 0.1, 0.4, 1, 0.045, ['p', undefined]),
      ...chromosome('B', 'p', 0.3, -0.25, -0.5),
      ...chromosome('B', 'm', 0.3 + Math.sin(-0.5) * 0.1, -0.25 - Math.cos(-0.5) * 0.1, -0.5),
    ],
  },
  {
    id: 'metafaza1',
    name: 'Metafaza I',
    formula: '2n4c',
    text: 'Xromosomalar tetradasi ekvator tekisligi bo‘ylab joylashadi; gomologlar ekvatorning ikki tomonida turadi. Urchuq iplari sentromeraga birikadi.',
    cells: one(0, true),
    chromatids: [
      ...chromosome('A', 'p', -0.13, 0.26, Math.PI / 2, 1, 0.045, [undefined, 'm']),
      ...chromosome('A', 'm', 0.13, 0.26, Math.PI / 2, 1, 0.045, ['p', undefined]),
      ...chromosome('B', 'm', -0.13, -0.26, Math.PI / 2),
      ...chromosome('B', 'p', 0.13, -0.26, Math.PI / 2),
    ],
  },
  {
    id: 'anafaza1',
    name: 'Anafaza I',
    formula: '2n4c',
    text: 'Gomologik xromosomalar xromatidalarga ajralmagan holda qarama-qarshi qutblarga tarqaladi. Ota va ona xromosomalari qutblarga tasodifiy kombinatsiyalarda boradi.',
    cells: one(0, true),
    chromatids: [
      ...chromosome('A', 'p', -0.58, 0.24, Math.PI / 2, 1, 0.045, [undefined, 'm']),
      ...chromosome('A', 'm', 0.58, 0.24, Math.PI / 2, 1, 0.045, ['p', undefined]),
      ...chromosome('B', 'm', -0.58, -0.24, Math.PI / 2),
      ...chromosome('B', 'p', 0.58, -0.24, Math.PI / 2),
    ],
  },
  {
    id: 'telofaza1',
    name: 'Telofaza I',
    formula: '1n2c',
    text: 'Xromatinlar despirallashadi, yadro qobig‘i hosil bo‘ladi. Gaploid to‘plamli ikkita qiz hujayra hosil bo‘ladi. Keyin interkinez — DNK replikatsiyasi bo‘lmaydi.',
    cells: [
      { x: -0.5, y: 0, r: 0.82, nucleus: 0.6 },
      { x: 0.5, y: 0, r: 0.82, nucleus: 0.6 },
    ],
    chromatids: [
      ...chromosome('A', 'p', -0.62, 0.18, Math.PI / 2, 0.7, 0.045, [undefined, 'm']),
      ...chromosome('A', 'm', 0.62, 0.18, Math.PI / 2, 0.7, 0.045, ['p', undefined]),
      ...chromosome('B', 'm', -0.62, -0.2, Math.PI / 2, 0.7),
      ...chromosome('B', 'p', 0.62, -0.2, Math.PI / 2, 0.7),
    ],
  },
  {
    id: 'profaza2',
    name: 'Profaza II',
    formula: '1n2c',
    text: 'Mitoz profazasiga o‘xshaydi: xromosoma spirallashadi, yadro qobig‘i va yadrocha eriydi, sentriolalar qutblarga tarqalib urchuq hosil qiladi.',
    cells: [
      { x: L, y: 0, r: 0.8, nucleus: 0.25, poles: vpoles(L) },
      { x: R, y: 0, r: 0.8, nucleus: 0.25, poles: vpoles(R) },
    ],
    chromatids: [
      ...chromosome('A', 'p', L - 0.15, 0.18, 0.5, 1, 0.045, [undefined, 'm']),
      ...chromosome('B', 'm', L + 0.2, -0.2, -0.6),
      ...chromosome('A', 'm', R + 0.15, 0.2, -0.4, 1, 0.045, ['p', undefined]),
      ...chromosome('B', 'p', R - 0.2, -0.18, 0.7),
    ],
  },
  {
    id: 'metafaza2',
    name: 'Metafaza II',
    formula: '1n2c',
    text: 'Har bir hujayraning ekvatorida ikki xromatidali xromosomalar joylashadi. Urchuq iplari sentromeraga birikadi.',
    cells: [
      { x: L, y: 0, r: 0.8, nucleus: 0, poles: vpoles(L) },
      { x: R, y: 0, r: 0.8, nucleus: 0, poles: vpoles(R) },
    ],
    chromatids: [
      ...chromosome('A', 'p', L - 0.2, 0, 0, 1, 0.045, [undefined, 'm']),
      ...chromosome('B', 'm', L + 0.25, 0, 0),
      ...chromosome('A', 'm', R - 0.2, 0, 0, 1, 0.045, ['p', undefined]),
      ...chromosome('B', 'p', R + 0.25, 0, 0),
    ],
  },
  {
    id: 'anafaza2',
    name: 'Anafaza II',
    formula: '2n2c',
    text: 'Urchuq iplari qisqarib, xromatidalarni sentromeradan turli qutblarga tortadi. Har bir xromatida mustaqil xromosomaga aylanadi.',
    cells: [
      { x: L, y: 0, r: 0.8, nucleus: 0, poles: vpoles(L) },
      { x: R, y: 0, r: 0.8, nucleus: 0, poles: vpoles(R) },
    ],
    chromatids: [
      ct('A', 'p', 1, L - 0.2, 0.45, 0),
      ct('A', 'p', 2, L - 0.2, -0.45, 0, 1, 'm'),
      ct('B', 'm', 1, L + 0.25, 0.45, 0),
      ct('B', 'm', 2, L + 0.25, -0.45, 0),
      ct('A', 'm', 1, R - 0.2, 0.45, 0, 1, 'p'),
      ct('A', 'm', 2, R - 0.2, -0.45, 0),
      ct('B', 'p', 1, R + 0.25, 0.45, 0),
      ct('B', 'p', 2, R + 0.25, -0.45, 0),
    ],
  },
  {
    id: 'telofaza2',
    name: 'Telofaza II',
    formula: '4 × 1n1c',
    text: 'Xromosomalar despirallashadi, yadro qobig‘i va yadrocha shakllanadi, sitokinez amalga oshadi. Ona hujayradan farq qiluvchi, bir-biriga o‘xshamagan to‘rtta gaploid hujayra hosil bo‘ladi.',
    cells: [
      { x: L, y: 0.62, r: 0.55, nucleus: 1 },
      { x: L, y: -0.62, r: 0.55, nucleus: 1 },
      { x: R, y: 0.62, r: 0.55, nucleus: 1 },
      { x: R, y: -0.62, r: 0.55, nucleus: 1 },
    ],
    chromatids: [
      ct('A', 'p', 1, L - 0.1, 0.66, 0.3, 0.45),
      ct('B', 'm', 1, L + 0.12, 0.58, -0.6, 0.45),
      ct('A', 'p', 2, L - 0.1, -0.58, 0.4, 0.45, 'm'),
      ct('B', 'm', 2, L + 0.12, -0.66, -0.5, 0.45),
      ct('A', 'm', 1, R - 0.1, 0.66, 0.2, 0.45, 'p'),
      ct('B', 'p', 1, R + 0.12, 0.58, -0.7, 0.45),
      ct('A', 'm', 2, R - 0.1, -0.58, 0.5, 0.45),
      ct('B', 'p', 2, R + 0.12, -0.66, -0.4, 0.45),
    ],
  },
];

export const framesFor = (mode: Mode) => (mode === 'mitosis' ? mitosisFrames : meiosisFrames);
