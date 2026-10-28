import { useState } from 'react';
import { play } from '../../lib/audio';
import { BrainSVG } from '../three/Fallback';
import { Matcher, NumberCheck, Panel, TapOrder } from './shared';

// 40-§ p.125, 127: speed 4.4–100 m/s; book problem: 100 m/s, height 1.8 m.
export function ImpulseTimer() {
  const [v, setV] = useState(100);
  const [d, setD] = useState(1.8);
  const t = d / v;
  return (
    <Panel title="Impuls qancha vaqtda yetib boradi?" note="Darslik: qo‘zg‘alish sekundiga 4,4 m dan 100 m gacha tezlikda o‘tadi (125-bet). Masala: 127-bet.">
      <div className="sliders">
        <label>
          Tezlik: <strong>{v.toLocaleString('uz')}</strong> m/s
          <input type="range" min={4.4} max={100} step={0.1} value={v} onChange={(e) => setV(Number(e.target.value))} />
        </label>
        <label>
          Masofa (bo‘y): <strong>{d.toFixed(2)}</strong> m
          <input type="range" min={0.5} max={2} step={0.01} value={d} onChange={(e) => setD(Number(e.target.value))} />
        </label>
      </div>
      <p className="big-result">
        t = {d.toFixed(2)} m ÷ {v} m/s = <strong>{t.toFixed(4)} s</strong> ({(t * 1000).toFixed(1)} ms)
      </p>
      <NumberCheck label="Masala: impuls 100 m/s, bo‘y 1,8 m. Oyoqdan signal necha sekundda yetadi?" answer={0.018} unit="s" />
    </Panel>
  );
}

// 41-§ p.128
export function ReflexBuilder() {
  return (
    <Panel title="Orqa miya orqali refleks yo‘lini tuzing" note="Darslik 128-bet: retseptor → orqa ildizcha → oraliq neyronlar → oldingi ildizcha → ishchi organ.">
      <TapOrder seed="g8-41" items={['Retseptor', 'Orqa ildizcha (sezuvchi nerv)', 'Oraliq neyronlar (kulrang modda)', 'Oldingi ildizcha (harakatlantiruvchi nerv)', 'Ishchi organ']} />
    </Panel>
  );
}

// 43-§ p.135
const CENTERS: { name: string; lobe: string }[] = [
  { name: 'Ko‘rish markazi', lobe: 'occipital' },
  { name: 'Eshitish markazi', lobe: 'temporal' },
  { name: 'Hid bilish markazi', lobe: 'frontal' },
  { name: 'Tana terisi sezgisi (orqa markaziy pushta)', lobe: 'parietal' },
];
const LOBE_NAME: Record<string, string> = { frontal: 'peshana', parietal: 'tepa', temporal: 'chakka', occipital: 'ensa' };

export function BrainMap() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const c = CENTERS[i];
  const done = i >= CENTERS.length;
  const pick = (lobe: string) => {
    if (done || picked) return;
    play('click');
    setPicked(lobe);
    if (lobe === c.lobe) setScore(score + 1);
  };
  return (
    <Panel title="Markazni po‘stloqda toping" note="Darslik 135-bet: ensa — ko‘rish, chakka — eshitish, peshana qismining ostki ichkari sohasi — hid bilish, tepa qismi orqa markaziy pushtasi — teri sezgisi.">
      {!done ? (
        <p>
          <strong>{i + 1}/{CENTERS.length}.</strong> «{c.name}» qaysi bo‘lakda? Rasmda bosing.
        </p>
      ) : (
        <p className="big-result">Natija: {score} / {CENTERS.length}</p>
      )}
      <BrainSVG active={picked} onPick={pick} />
      <p className="fb-line" aria-live="polite">
        {picked && (picked === c.lobe ? `✓ To‘g‘ri — ${LOBE_NAME[c.lobe]} bo‘lagi.` : `✕ Bu ${LOBE_NAME[picked]} bo‘lagi. To‘g‘risi: ${LOBE_NAME[c.lobe]}.`)}
      </p>
      {picked && !done && (
        <button type="button" className="btn btn-sm btn-primary" onClick={() => { setPicked(null); setI(i + 1); }}>
          Keyingisi →
        </button>
      )}
      {done && (
        <button type="button" className="btn btn-sm" onClick={() => { setI(0); setScore(0); setPicked(null); }}>
          Qaytadan
        </button>
      )}
    </Panel>
  );
}

// 44-§ p.137 tasks
export function DiseaseMatch() {
  return (
    <Panel title="Kasallik va sababini juftlang" note="Darslik 137-betdagi topshiriqlar asosida.">
      <Matcher
        seed="g8-44"
        leftTitle="Kasallik"
        rightTitle="Sababi"
        pairs={[
          ['Nevralgiya', 'Sezuvchi nerv tolalarining zararlanishi'],
          ['Nevrit', 'Harakatlantiruvchi nervlarning zararlanishi'],
          ['Radikulit', 'Bel va dumg‘aza nervlarining siqilishi'],
          ['Poliomiyelit', 'Harakatlantiruvchi neyronlarning virusli kasalligi'],
          ['Gipertoniya', 'Qon bosimining ko‘tarilishi'],
          ['Ateroskleroz', 'Qon tomiri nayining torayishi'],
          ['Mikrosefaliya', 'Homiladorlikda onaning yuqumli kasallik bilan og‘rishi'],
        ]}
      />
    </Panel>
  );
}

// 46-§ pp.141–143. Repetition counts are a teaching model; the book says “bir necha marta”.
export function Conditioning() {
  const [pairs, setPairs] = useState(0);
  const [unreinforced, setUnreinforced] = useState(0);
  const [log, setLog] = useState('Itga ovqat berib ko‘ring — shartsiz refleks.');
  const [saliva, setSaliva] = useState(false);
  const learned = pairs >= 3 && unreinforced < 3;
  const act = (kind: 'food' | 'lamp' | 'both' | 'bell') => {
    play('click');
    if (kind === 'food') {
      setSaliva(true);
      setLog('Ovqat — shartsiz ta’sirlovchi: so‘lak ajraldi (shartsiz refleks).');
    } else if (kind === 'both') {
      const p = pairs + 1;
      setPairs(p);
      setUnreinforced(0);
      setSaliva(true);
      setLog(`Chiroq yoqildi, yarim minutdan so‘ng ovqat berildi (${p}-marta). ${p >= 3 ? 'Bog‘lanish mustahkamlandi.' : ''}`);
    } else if (kind === 'lamp') {
      if (learned) {
        const u = unreinforced + 1;
        setUnreinforced(u);
        setSaliva(u < 3);
        setLog(u < 3 ? `Faqat chiroq — ovqatsiz ham so‘lak ajraldi: shartli refleks! (${u}-marta mustahkamlanmadi)` : 'Chiroq ovqat bilan mustahkamlanmadi — refleks so‘ndi (ichki, so‘nuvchi tormozlanish).');
      } else {
        setSaliva(false);
        setLog('Faqat chiroq — hali signal emas, so‘lak ajralmadi. Chiroqni ovqat bilan bir necha marta birga bering.');
      }
    } else {
      setSaliva(false);
      setLog('Kuchli qo‘ng‘iroq ovozi — notanish ta’sirlovchi: ovqatlanish refleksi so‘ndi (tashqi, induksion tormozlanish).');
    }
  };
  return (
    <Panel title="Pavlov tajribasi — simulyator" note="Takrorlar soni modelda shartli (darslikda «bir necha marta»). Mazmun: 141–143-betlar.">
      <div className="lab-grid">
        <button type="button" className="btn" onClick={() => act('food')}>🍖 Ovqat</button>
        <button type="button" className="btn" onClick={() => act('lamp')}>💡 Faqat chiroq</button>
        <button type="button" className="btn btn-primary" onClick={() => act('both')}>💡 + 🍖 Chiroq, keyin ovqat</button>
        <button type="button" className="btn" onClick={() => act('bell')}>🔔 Kuchli qo‘ng‘iroq</button>
      </div>
      <div className="meter-row">
        <span>Bog‘lanish:</span>
        <span className="meter" aria-label={`Bog‘lanish ${Math.min(pairs, 3)}/3`}>
          <span style={{ width: `${(Math.min(pairs, 3) / 3) * 100 * (unreinforced >= 3 ? 0 : 1)}%` }} />
        </span>
        <span className={`badge ${saliva ? 'ok' : ''}`}>{saliva ? '💧 So‘lak ajraldi' : '— So‘lak yo‘q'}</span>
      </div>
      <p className="fb-line" aria-live="polite">{log}</p>
      <button type="button" className="btn btn-sm" onClick={() => { setPairs(0); setUnreinforced(0); setSaliva(false); setLog('Itga ovqat berib ko‘ring — shartsiz refleks.'); }}>
        Qaytadan
      </button>
    </Panel>
  );
}

// 50-§ pp.152–154
const NORMS: [string, string][] = [
  ['Chaqaloq', '21–22 soat'],
  ['1 yosh', '16–17 soat'],
  ['6–7 yosh', '12–13 soat'],
  ['13–14 yosh', '9,5–10 soat'],
  ['Katta yosh', '7–8 soat'],
];

export function SleepCycle() {
  const [age, setAge] = useState(3);
  // Schematic night of 5 cycles (book: 7–8 h = 4–5 cycles; REM after 1–1.5 h, lasting 10–15 min).
  const cycles = Array.from({ length: 5 }, (_, i) => i);
  return (
    <Panel title="Uyqu sikllari" note="Sxematik: 7–8 soatlik uyqu 4–5 sikldan iborat; tez uyqu uxlagandan 1–1,5 soat keyin boshlanib 10–15 minut davom etadi (152-bet).">
      <div className="hypno" role="img" aria-label="5 ta uyqu sikli: har birida uzun sekin uyqu va qisqa tez uyqu">
        {cycles.map((i) => (
          <div key={i} className="cycle">
            <span className="slow">Sekin</span>
            <span className="rem">Tez</span>
            <small>{i + 1}-sikl</small>
          </div>
        ))}
      </div>
      <div className="legend">
        <span><i className="sw slow" /> Sekin uyqu: nafas, tomir urishi sekinlashadi, muskullar bo‘shashadi</span>
        <span><i className="sw rem" /> Tez uyqu: tez nafas, ko‘z harakati, fantaziyali tush</span>
      </div>
      <label className="select-row">
        Sutkalik me’yor (153-bet):
        <select value={age} onChange={(e) => setAge(Number(e.target.value))}>
          {NORMS.map(([a], i) => (
            <option key={a} value={i}>{a}</option>
          ))}
        </select>
        <strong>{NORMS[age][1]}</strong>
      </label>
      <NumberCheck label="Masala (154-bet): odam umrining uchdan bir qismi uyquda o‘tadi. 72 yoshli odam necha yil uxlagan?" answer={24} unit="yil" />
    </Panel>
  );
}

// 51-§ p.154 (Pavlov classification)
export function Temperament() {
  const [strong, setStrong] = useState<boolean | null>(null);
  const [balanced, setBalanced] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState<boolean | null>(null);
  const result =
    strong === false
      ? ['Melanxolik', 'Kuchsiz, muvozanatlashmagan: kamharakat, his-tuyg‘usi chuqur va turg‘un, nozik ishlarni qoyil qiladi.']
      : strong && balanced === false
        ? ['Xolerik', 'Kuchli, muvozanatlashmagan: kuchli ta’sirchan, serharakat, tez o‘rtoqlashadi va tez urishib qoladi.']
        : strong && balanced && mobile !== null
          ? mobile
            ? ['Sangvinik', 'Kuchli, muvozanatlashgan, harakatchan: hozirjavob, xushchaqchaq, xushmuomala.']
            : ['Flegmatik', 'Kuchli, muvozanatlashgan, kamharakat: yuvosh, vazmin; Pavlov ularni «hayot zahmatkashlari» degan.']
          : null;
  const Choice = ({ q, value, set, yes, no }: { q: string; value: boolean | null; set: (v: boolean) => void; yes: string; no: string }) => (
    <div className="choice">
      <p>{q}</p>
      <div className="seg">
        <button type="button" aria-pressed={value === true} className={value === true ? 'on' : ''} onClick={() => { play('click'); set(true); }}>{yes}</button>
        <button type="button" aria-pressed={value === false} className={value === false ? 'on' : ''} onClick={() => { play('click'); set(false); }}>{no}</button>
      </div>
    </div>
  );
  return (
    <Panel title="Pavlov tasnifi bo‘yicha tipni aniqlang" note="Temperament yaxshi yoki yomon bo‘lmaydi va sof holatda kam uchraydi (155-bet).">
      <Choice q="1. Nerv sistemasi:" value={strong} set={(v) => { setStrong(v); setBalanced(null); setMobile(null); }} yes="Kuchli" no="Kuchsiz" />
      {strong && <Choice q="2. Qo‘zg‘alish va tormozlanish:" value={balanced} set={(v) => { setBalanced(v); setMobile(null); }} yes="Muvozanatlashgan" no="Muvozanatlashmagan" />}
      {strong && balanced && <Choice q="3. Harakatchanligi:" value={mobile} set={setMobile} yes="Harakatchan" no="Kamharakat" />}
      {result && (
        <p className="result-card" aria-live="polite">
          <strong>{result[0]}</strong> — {result[1]}
        </p>
      )}
    </Panel>
  );
}
