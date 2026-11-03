import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <div className="card">
      <EmptyState icon="🧱" title="Aquesta peça no existeix" action={<Link className="btn" to="/">Torna al tauler</Link>}>
        La pàgina que busqueu no s'ha trobat.
      </EmptyState>
    </div>
  );
}
