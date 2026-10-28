// Per-glucose values from Biologiya 10, pp.62–64.
export const PER_GLUCOSE = {
  glycolysis: { total: 200, atpKJ: 80, heat: 120, atp: 2, lactate: 2 },
  aerobic: { total: 2600, atpKJ: 1440, heat: 1160, atp: 36, co2: 6, water: 42 },
} as const;

export function energy(glucose: number, aerobic: boolean) {
  const g = PER_GLUCOSE.glycolysis;
  const a = PER_GLUCOSE.aerobic;
  const k = aerobic ? 1 : 0;
  return {
    glycolysis: { total: g.total * glucose, atpKJ: g.atpKJ * glucose, heat: g.heat * glucose, atp: g.atp * glucose },
    aerobic: { total: a.total * glucose * k, atpKJ: a.atpKJ * glucose * k, heat: a.heat * glucose * k, atp: a.atp * glucose * k },
    atp: (g.atp + a.atp * k) * glucose,
    atpKJ: (g.atpKJ + a.atpKJ * k) * glucose,
    heat: (g.heat + a.heat * k) * glucose,
  };
}

export interface Problem {
  n: number;
  text: string;
  answer: number;
  unit: string;
  steps: string[];
  note?: string;
}

export const PROBLEMS: Problem[] = [
  {
    n: 1,
    text: 'Achish jarayonida issiqlik sifatida 720 kJ energiya ajralgan bo‘lsa, aerob bosqichda ATFda to‘plangan energiya miqdorini aniqlang.',
    answer: 8640,
    unit: 'kJ',
    steps: [
      '1 glyukoza achishda 120 kJ issiqlik beradi → 720 ÷ 120 = 6 glyukoza.',
      '1 glyukoza → 2 sut kislota → 6 glyukoza → 12 sut kislota.',
      '2 sut kislota aerob bosqichda 1440 kJ ni ATFda to‘playdi → 12 ÷ 2 × 1440 = 8640 kJ.',
    ],
  },
  {
    n: 2,
    text: 'Glyukoza to‘liq parchalanganda 7680 kJ issiqlik ajraldi. Shu glyukoza achish jarayonida ishtirok etganda ATFda to‘plangan energiya qancha?',
    answer: 480,
    unit: 'kJ',
    steps: [
      'To‘liq parchalanishda 1 glyukozadan issiqlik: 120 + 1160 = 1280 kJ.',
      '7680 ÷ 1280 = 6 glyukoza.',
      'Achishda 1 glyukozadan ATFda 80 kJ → 6 × 80 = 480 kJ.',
    ],
  },
  {
    n: 4,
    text: 'Glyukoza to‘liq parchalanganda 6400 kJ issiqlik ajraladi. Achish jarayonida ishtirok etganda ATFdagi energiya miqdori qancha?',
    answer: 400,
    unit: 'kJ',
    steps: ['1 glyukoza to‘liq parchalanganda 1280 kJ issiqlik.', '6400 ÷ 1280 = 5 glyukoza.', 'Achishda 5 × 80 = 400 kJ.'],
  },
  {
    n: 5,
    text: 'Energetik almashinuv bosqichlarida 152 molekula ATF sintezlandi. Uning necha foizi mitoxondriyada sintezlangan?',
    answer: 94.7,
    unit: '%',
    steps: ['1 glyukozadan jami 38 ATF → 152 ÷ 38 = 4 glyukoza.', 'Mitoxondriyada 1 glyukozaga 36 ATF → 4 × 36 = 144.', '144 ÷ 152 × 100 ≈ 94,7%.'],
  },
  {
    n: 3,
    text: 'Glyukoza parchalanganda 252 ta ATF hosil bo‘ldi. To‘liq parchalangan glyukoza molekulalari soni to‘liq parchalanmaganlar sonidan 0,5 marta katta. To‘liq parchalangan glyukozadan ajralgan ATF sonini aniqlang.',
    answer: 228,
    unit: 'ta ATF',
    steps: [
      'To‘liq parchalangan — x, faqat achishga uchragan — y; shartga ko‘ra x = 0,5·y (darslik javobiga mos talqin).',
      'ATF: 38x + 2y = 252 → 19y + 2y = 252 → y = 12, x = 6.',
      'To‘liq parchalanganlardan: 6 × 38 = 228 ATF.',
    ],
    note: 'Shart matni darslikdan; javob darslikdagi 228 ga mos keladigan talqinda yechilgan.',
  },
];
