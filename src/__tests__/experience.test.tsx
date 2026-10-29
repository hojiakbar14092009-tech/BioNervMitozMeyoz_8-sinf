// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { introMode } from '../lib/intro';
import { parentOf } from '../lib/nav';
import { resolveRange } from '../features/highlights/engine';
import { actions, getState } from '../lib/store';
import HighlightsPage from '../pages/HighlightsPage';
import BookPage from '../pages/BookPage';
import { ModelLegend, StructureInfo, stagesOf } from '../features/three/structures';
import { topicsByBook } from '../data/registry';

afterEach(() => {
  cleanup();
  for (const h of getState().highlights) actions.removeHighlight(h.id);
});

describe('intro policy', () => {
  it('plays fully once per session, reduced for reduced-motion users, never on repeat', () => {
    expect(introMode(false, false)).toBe('full');
    expect(introMode(false, true)).toBe('reduced');
    expect(introMode(true, false)).toBe('none');
    expect(introMode(true, true)).toBe('none');
  });
});

describe('safe back navigation', () => {
  it('falls back to a sensible parent', () => {
    expect(parentOf('/belgilanganlar')).toBe('/');
    expect(parentOf('/8-sinf')).toBe('/');
    expect(parentOf('/8-sinf/41')).toBe('/8-sinf');
    expect(parentOf('/10-sinf/2-13/')).toBe('/10-sinf');
    expect(parentOf('/unknown/page')).toBe('/');
  });

  it('shows a Back button on secondary pages', () => {
    render(<MemoryRouter><HighlightsPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Orqaga/ })).toBeTruthy();
    cleanup();
    render(<MemoryRouter><BookPage bookId="grade10" /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Orqaga/ })).toBeTruthy();
  });
});

describe('personal highlights', () => {
  it('re-anchors by exact text when offsets drift', () => {
    const text = 'Neyron nerv sistemasining tuzilish birligi';
    expect(resolveRange(text, { startOffset: 0, endOffset: 6, exactText: 'Neyron' })).toEqual({ start: 0, end: 6 });
    expect(resolveRange('Har bir ' + text, { startOffset: 0, endOffset: 6, exactText: 'Neyron' })).toEqual({ start: 8, end: 14 });
    expect(resolveRange(text, { startOffset: 0, endOffset: 4, exactText: 'akson' })).toBeNull();
  });

  it('appear in Belgilanganlar automatically, filter by grade, and delete everywhere', () => {
    const base = { blockId: 'tuzilish-0', startOffset: 0, endOffset: 6, createdAt: Date.now() };
    actions.addHighlight({ ...base, id: 'a1', bookId: 'grade8', topicKey: 'grade8-41', exactText: 'Katta odamda' });
    actions.addHighlight({ ...base, id: 'b1', bookId: 'grade10', topicKey: 'grade10-2-13', exactText: 'ikki bosqichda' });
    render(<MemoryRouter><HighlightsPage /></MemoryRouter>);
    expect(screen.getByText('Katta odamda')).toBeTruthy();
    expect(screen.getByText('ikki bosqichda')).toBeTruthy();
    const link = screen.getAllByRole('link', { name: /Mavzuga qaytish/ })[0].getAttribute('href');
    expect(link).toMatch(/^\/(8|10)-sinf\/[\d-]+#hl-/);

    fireEvent.click(screen.getByRole('button', { name: /^8-sinf/ }));
    expect(screen.queryByText('ikki bosqichda')).toBeNull();
    expect(screen.getByText('Katta odamda')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'O‘chirish' }));
    expect(getState().highlights.find((h) => h.id === 'a1')).toBeUndefined();
    expect(screen.queryByText('Katta odamda')).toBeNull();
  });
});

describe('3D identification layer', () => {
  const scene = topicsByBook.grade8[0].scene!;

  function Harness() {
    const [sel, setSel] = useState<string | null>(null);
    return (
      <>
        <ModelLegend hotspots={scene.hotspots} selected={sel} onSelect={setSel} />
        <StructureInfo hotspots={scene.hotspots} selected={sel} onClose={() => setSel(null)} />
      </>
    );
  }

  it('selecting a structure updates the information card', () => {
    render(<Harness />);
    expect(screen.getByText(/Modeldagi qismni bosing/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Akson' }));
    const card = screen.getByRole('region', { name: /Tanlangan qism: Akson/ });
    expect(card.textContent).toContain('uzun o‘simta');
    expect(card.textContent).toContain('122-bet');
    fireEvent.click(screen.getByRole('button', { name: 'Tanlovni bekor qilish' }));
    expect(screen.queryByRole('region', { name: /Tanlangan qism/ })).toBeNull();
  });

  it('every 3D scene states what it is and labels come from lesson pages', () => {
    for (const t of [...topicsByBook.grade8, ...topicsByBook.grade10]) {
      if (!t.scene) continue;
      expect(t.scene.what.length).toBeGreaterThan(20);
      expect(t.scene.hotspots.length).toBeGreaterThan(0);
      for (const h of t.scene.hotspots) expect(h.page).toBeGreaterThanOrEqual(t.pages[0] - 4);
    }
  });

  it('meiosis stages carry explicit Meyoz I / Meyoz II headers', () => {
    const meiosis = topicsByBook.grade10.find((t) => t.number === '2.13')!.scene!;
    const groups = stagesOf(meiosis)!.map((s) => s.group);
    expect(groups.filter((g) => g === 'Meyoz I')).toHaveLength(4);
    expect(groups.filter((g) => g === 'Meyoz II')).toHaveLength(4);
    const compare = topicsByBook.grade10.find((t) => t.number === '2.15')!.scene!;
    expect(stagesOf(compare)).toHaveLength(9);
  });
});
