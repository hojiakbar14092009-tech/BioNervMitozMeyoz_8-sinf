import { useLocation, useNavigate } from 'react-router-dom';
import { hasInAppHistory, parentOf } from '../lib/nav';

/** Goes back within the app when possible; otherwise to the page's parent (never out of the app). */
export default function BackButton({ fallback, label = 'Orqaga' }: { fallback?: string; label?: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <button type="button" className="back-btn" onClick={() => (hasInAppHistory() ? navigate(-1) : navigate(fallback ?? parentOf(pathname)))}>
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
