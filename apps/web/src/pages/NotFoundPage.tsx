import { Link } from 'react-router';
import { EmptyState } from '../components/StateViews';
import missions from './MyMissionsPage.module.css';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Esta página no existe"
      description="El enlace puede estar mal escrito o apuntar a una misión que ya no está en el catálogo."
      action={
        <Link to="/" className={missions.cta}>
          Ir al catálogo
        </Link>
      }
    />
  );
}
