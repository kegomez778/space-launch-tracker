import type { DataFreshnessDto } from '@slt/shared';
import { formatAge } from '../lib/launch-date.format';
import styles from './FreshnessBanner.module.css';

/**
 * Antigüedad de los datos, siempre visible.
 *
 * La aplicación sirve una réplica, no la fuente. Decirlo es lo que separa una
 * degradación honesta de aparentar una actualidad que no se tiene — y es lo que
 * permite que una caída de SpaceX no se note como una aplicación rota.
 */
export function FreshnessBanner({ freshness }: { freshness: DataFreshnessDto }) {
  const tone = freshness.lastSyncFailed ? styles.failed : freshness.isStale ? styles.stale : styles.fresh;

  return (
    <p className={`${styles.banner} ${tone}`}>
      <span className={styles.dot} aria-hidden="true" />
      <span>
        Datos sincronizados <strong>{formatAge(freshness.ageSeconds)}</strong>
        {freshness.lastSyncFailed && ' · la última sincronización falló, se muestra la copia anterior'}
      </span>
    </p>
  );
}
