import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GROUP_LABEL,
  applyUpdate,
  cancelOffline,
  clearOffline,
  dismissInstall,
  install,
  prepareOffline,
  shouldOfferInstall,
  usePwa,
  type GroupId,
} from './pwa';

const ICON = '/icons/icon-192.png';

/** iPhone/iPad have no install prompt: Safari's Share sheet → “Bosh ekranga qo‘shish”. */
function IOSGuide({ onClose }: { onClose: () => void }) {
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    head.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return createPortal(
    <div className="pwa-backdrop" onClick={onClose}>
      <div className="pwa-sheet" role="dialog" aria-modal="true" aria-labelledby="ios-guide-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="ios-guide-title" ref={head} tabIndex={-1}>
          Ilovani o‘rnatish
        </h2>
        <ol className="pwa-steps">
          <li>
            <span className="pwa-step-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span>
              Safari pastidagi (iPad’da tepasidagi) <strong>«Ulashish»</strong> tugmasini bosing
            </span>
          </li>
          <li>
            <span className="pwa-step-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </span>
            <span>
              <strong>«Bosh ekranga qo‘shish»</strong>ni tanlang
            </span>
          </li>
          <li>
            <span className="pwa-step-icon" aria-hidden="true">✓</span>
            <span>
              <strong>«Qo‘shish»</strong>ni bosing — Biologiya belgisi bosh ekranda paydo bo‘ladi
            </span>
          </li>
        </ol>
        <p className="small muted">Boshqa brauzerda bo‘lsangiz, saytni Safari’da oching.</p>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Tushunarli
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Compact, dismissible install offer; hidden once installed or where installing is impossible. */
export function InstallCard() {
  const s = usePwa((x) => x);
  const [guide, setGuide] = useState(false);
  if (!shouldOfferInstall(s)) return guide ? <IOSGuide onClose={() => setGuide(false)} /> : null;
  return (
    <section className="pwa-card install-card" aria-labelledby="install-title">
      <img src={ICON} alt="" width="48" height="48" className="pwa-icon" />
      <div className="pwa-card-body">
        <h2 id="install-title">Biologiya ilovasini o‘rnating</h2>
        <p className="muted small">Darslar, testlar va 3D modellardan internet bo‘lmasa ham foydalaning.</p>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => (s.ios ? setGuide(true) : void install())}>
            Ilovani o‘rnatish
          </button>
          <button type="button" className="btn" onClick={dismissInstall}>
            Keyinroq
          </button>
        </div>
      </div>
      {guide && <IOSGuide onClose={() => setGuide(false)} />}
    </section>
  );
}

/** Subtle connectivity hint. navigator.onLine is a hint, not a guarantee. */
export function OfflineStatus() {
  const online = usePwa((s) => s.online);
  return (
    <span className={`net-pill ${online ? 'on' : 'off'}`} role="status" aria-live="polite" title={online ? 'Internetga ulangan' : 'Internet yo‘q — saqlangan materiallar ishlaydi'}>
      <span className="net-dot" aria-hidden="true" />
      <span className="net-text">{online ? 'Onlayn' : 'Offline'}</span>
    </span>
  );
}

const ROWS: GroupId[] = ['app', 'audio', '3d', 'interactive'];

/** “Offline uchun tayyorlash”: real per-group progress, cancel, retry, size, refresh and removal of downloaded files. */
export function OfflinePanel() {
  const { pack, coreReady, online, usageMB } = usePwa((s) => s);
  const [confirm, setConfirm] = useState(false);
  if (pack.status === 'unknown') return null; // dev server / no service worker: nothing to manage
  const pct = pack.totalBytes ? Math.floor((pack.doneBytes / pack.totalBytes) * 100) : 0;
  const busy = pack.status === 'downloading';
  // core is precached automatically; “continue” only once part of the optional pack is on the device
  const started = pack.groups['3d'].done + pack.groups.interactive.done > 0;
  return (
    <section className="pwa-card offline-card" aria-labelledby="offline-title">
      <div className="pwa-card-body">
        <h2 id="offline-title">Offline rejim</h2>
        {pack.status === 'unsupported' ? (
          <p className="muted small">Bu brauzer offline saqlashni qo‘llab-quvvatlamaydi.</p>
        ) : pack.status === 'ready' ? (
          <p className="offline-ok">✓ Offline foydalanishga tayyor</p>
        ) : busy ? (
          <p>Offline materiallar tayyorlanmoqda…</p>
        ) : pack.status === 'error' ? (
          <p className="offline-err">Offline materiallarni to‘liq yuklab bo‘lmadi.</p>
        ) : (
          <p className="muted small">
            {coreReady ? 'Darslar, testlar va audiolar allaqachon saqlangan. ' : ''}
            Barcha 3D modellar va interaktiv mashqlarni ham internet bo‘lmasa ishlashi uchun bir marta yuklab oling.
          </p>
        )}

        {pack.status !== 'unsupported' && (
          <>
            <ul className="offline-rows">
              {ROWS.map((id) => {
                const g = pack.groups[id];
                const done = g.total > 0 && g.done === g.total;
                return (
                  <li key={id}>
                    <span>{GROUP_LABEL[id]}</span>
                    <span className={done ? 'offline-ok' : 'muted'}>{done ? '✓' : g.total ? `${g.done}/${g.total}` : '—'}</span>
                  </li>
                );
              })}
            </ul>
            {(busy || pack.status === 'error' || (pack.status === 'partial' && started)) && (
              <div className="offline-progress" role="progressbar" aria-label="Offline yuklab olish" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <span style={{ width: `${pct}%` }} />
                <b>{pct}%</b>
              </div>
            )}
            {usageMB !== null && pack.status === 'ready' && <p className="small muted">Qurilmada band joy (brauzer hisobi): ~{usageMB} MB</p>}
            <div className="row-actions">
              {busy ? (
                <button type="button" className="btn" onClick={cancelOffline}>
                  Bekor qilish
                </button>
              ) : pack.status !== 'ready' ? (
                <button type="button" className="btn btn-primary" disabled={!online} onClick={() => void prepareOffline()}>
                  {pack.status === 'error' ? 'Qayta urinish' : started ? 'Yuklashni davom ettirish' : 'Offline uchun tayyorlash'}
                </button>
              ) : (
                <button type="button" className="btn" disabled={!online} onClick={() => void prepareOffline()}>
                  Offline materiallarni tekshirish
                </button>
              )}
              {!busy && pack.doneBytes > 0 && !confirm && (
                <button type="button" className="btn" onClick={() => setConfirm(true)}>
                  Offline materiallarni o‘chirish
                </button>
              )}
            </div>
            {!online && pack.status !== 'ready' && <p className="small muted">Yuklab olish uchun internetga ulaning.</p>}
            {confirm && (
              <div className="offline-confirm" role="alert">
                <p className="small">Yuklab olingan 3D va mashq fayllari o‘chiriladi. Natijalaringiz, belgilanganlar va sozlamalar saqlanib qoladi.</p>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setConfirm(false);
                      void clearOffline();
                    }}
                  >
                    O‘chirish
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirm(false)}>
                    Bekor qilish
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** A waiting new version: the learner chooses when to reload (never in the middle of a quiz or selection). */
export function UpdateBar() {
  const available = usePwa((s) => s.updateAvailable);
  const [later, setLater] = useState(false);
  if (!available || later) return null;
  return createPortal(
    <div className="update-bar" role="status">
      <span>Yangi versiya mavjud</span>
      <div className="row-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => applyUpdate()}>
          Yangilash
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setLater(true)}>
          Keyinroq
        </button>
      </div>
    </div>,
    document.body,
  );
}
