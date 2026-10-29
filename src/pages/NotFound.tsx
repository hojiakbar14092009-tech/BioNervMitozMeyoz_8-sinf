import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';

export default function NotFound() {
  return (
    <div className="page center">
      <div className="page-top">
        <BackButton fallback="/" />
      </div>
      <h1>Sahifa topilmadi</h1>
      <p className="muted">Bunday mavzu yo‘q. Darslikni qaytadan tanlang.</p>
      <div className="row-actions center">
        <Link className="btn btn-primary" to="/">📚 Kitoblar</Link>
      </div>
    </div>
  );
}
