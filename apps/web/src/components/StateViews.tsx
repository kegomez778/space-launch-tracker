import type { ReactNode } from 'react';
import { ApiError } from '../lib/api-client';
import styles from './StateViews.module.css';

/**
 * Los tres estados que casi nunca se cuidan porque el camino feliz los tapa.
 * Cada uno dice qué ha pasado y qué puede hacer el usuario a continuación; un
 * "Ha ocurrido un error" no cumple ninguna de las dos cosas.
 */

export function LoadingList({ count = 6 }: { count?: number }) {
  return (
    <div className={styles.skeletonGrid} role="status" aria-live="polite">
      <span className="visually-hidden">Cargando lanzamientos</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.skeletonCard} aria-hidden="true">
          <div className={`${styles.skeletonPatch} ${styles.pulse}`} />
          <div className={styles.skeletonLines}>
            <div className={`${styles.skeletonLine} ${styles.pulse}`} style={{ width: '45%' }} />
            <div className={`${styles.skeletonLine} ${styles.pulse}`} style={{ width: '70%' }} />
            <div className={`${styles.skeletonLine} ${styles.pulse}`} style={{ width: '30%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state}>
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isApiError = error instanceof ApiError;
  const message = isApiError ? error.message : 'Se produjo un error inesperado al cargar los datos';

  return (
    <div className={`${styles.state} ${styles.errorState}`} role="alert">
      <p className={styles.title}>No se pudieron cargar los datos</p>
      <p className={styles.description}>{message}</p>
      {isApiError && error.code !== 'UNKNOWN' && <p className={styles.errorCode}>{error.code}</p>}
      {onRetry !== undefined && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
