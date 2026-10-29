import { Component, type ReactNode } from 'react';

/** Message for content whose code is not on this device yet (offline before it was ever opened or downloaded). */
export function OfflineMissing({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="offline-missing" role="status">
      <strong>{navigator.onLine ? 'Material yuklanmadi' : 'Internet mavjud emas'}</strong>
      <p className="small muted">
        Bu material hali offline saqlanmagan. Internetga ulangach uni bir marta oching yoki bosh sahifadagi «Offline uchun tayyorlash» orqali yuklab oling.
      </p>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Qayta urinish
        </button>
      )}
    </div>
  );
}

/** Catches a failed lazy chunk (no network, not cached) so the rest of the lesson keeps working; retry re-mounts. */
export class OfflineSafe extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <OfflineMissing onRetry={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))} />;
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
