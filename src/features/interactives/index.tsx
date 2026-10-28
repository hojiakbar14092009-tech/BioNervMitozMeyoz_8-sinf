import { lazy, Suspense, type ComponentType } from 'react';
import type { InteractiveKey } from '../../types';

const g8 = (name: string) => lazy(() => import('./Grade8').then((m) => ({ default: (m as unknown as Record<string, ComponentType>)[name] })));
const g10 = (name: string) => lazy(() => import('./Grade10').then((m) => ({ default: (m as unknown as Record<string, ComponentType>)[name] })));

const MAP: Record<InteractiveKey, ComponentType> = {
  impulseTimer: g8('ImpulseTimer'),
  reflexBuilder: g8('ReflexBuilder'),
  brainMap: g8('BrainMap'),
  diseaseMatch: g8('DiseaseMatch'),
  conditioning: g8('Conditioning'),
  sleepCycle: g8('SleepCycle'),
  temperament: g8('Temperament'),
  energyLedger: g10('EnergyLedger'),
  energyProblems: g10('EnergyProblems'),
  codonBuilder: g10('CodonBuilder'),
  translationModel: g10('TranslationModel'),
  cellCycle: g10('CellCycle'),
  meiosisJourney: g10('MeiosisJourney'),
  microscope: g10('Microscope'),
  compareDivision: g10('CompareDivision'),
};

export default function Interactive({ k }: { k: InteractiveKey }) {
  const C = MAP[k];
  return (
    <Suspense fallback={<div className="skeleton" role="status">Yuklanmoqda…</div>}>
      <C />
    </Suspense>
  );
}
