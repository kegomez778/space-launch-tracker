import { Link, useParams } from 'react-router';
import type { PayloadDto } from '@slt/shared';
import { ErrorState, LoadingList } from '../components/StateViews';
import { useAuth } from '../features/auth/auth-context';
import { useFollowedIds, useLaunchDetail, useToggleFollow } from '../features/launches/launch-queries';
import { formatLaunchDate } from '../lib/launch-date.format';
import { Countdown } from '../components/Countdown';
import styles from './page.module.css';
import detail from './LaunchDetailPage.module.css';

export function LaunchDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch } = useLaunchDetail(id);
  const { data: followedIds } = useFollowedIds(user !== null);
  const toggleFollow = useToggleFollow();

  if (isPending) {
    return <LoadingList count={3} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const isFollowing = followedIds?.includes(data.id) === true;

  return (
    <>
      <Link to="/" className={styles.backLink}>
        ← Volver al catálogo
      </Link>

      <header className={detail.hero}>
        <div>
          <p className={detail.flightNumber}>Vuelo {data.flightNumber}</p>
          <h1 className={styles.title}>{data.name}</h1>
          <p className={detail.date}>{formatLaunchDate(data.date)}</p>
        </div>

        {user !== null && (
          <button
            type="button"
            className={isFollowing ? detail.followActive : detail.follow}
            onClick={() => toggleFollow.mutate({ launchId: data.id, isFollowing })}
            aria-pressed={isFollowing}
          >
            {isFollowing ? 'Siguiendo' : 'Seguir misión'}
          </button>
        )}
      </header>

      {data.timing === 'upcoming' && data.date.supportsCountdown && (
        <div className={styles.section}>
          <Countdown targetDate={data.date.dateUtc} />
        </div>
      )}

      {data.outcome === 'failure' && data.failureReason !== null && (
        <p className={detail.failure} role="note">
          <strong>Motivo del fallo:</strong> {data.failureReason}
        </p>
      )}

      {data.details !== null && <p className={detail.description}>{data.details}</p>}

      <section className={styles.section}>
        <div className={styles.dataGrid}>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Cohete</span>
            <span className={styles.dataValue}>{data.rocket?.name ?? 'No informado'}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Sitio</span>
            <span className={styles.dataValue}>{data.launchpad?.name ?? 'No informado'}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>País del sitio</span>
            <span className={styles.dataValue}>{data.launchpad?.country?.name ?? '—'}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Cargas útiles</span>
            <span className={styles.dataValue}>{data.payloads.length}</span>
          </div>
        </div>
      </section>

      {data.payloads.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Cargas útiles</h2>
          <div className={styles.list}>
            {data.payloads.map((payload) => (
              <PayloadPanel key={payload.id} payload={payload} />
            ))}
          </div>
        </section>
      )}

      {(data.links.webcast !== null || data.links.wikipedia !== null || data.links.article !== null) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Enlaces oficiales</h2>
          <div className={styles.tagRow}>
            {data.links.webcast !== null && (
              <a className={detail.link} href={data.links.webcast} target="_blank" rel="noreferrer noopener">
                Retransmisión
              </a>
            )}
            {data.links.wikipedia !== null && (
              <a className={detail.link} href={data.links.wikipedia} target="_blank" rel="noreferrer noopener">
                Wikipedia
              </a>
            )}
            {data.links.article !== null && (
              <a className={detail.link} href={data.links.article} target="_blank" rel="noreferrer noopener">
                Artículo
              </a>
            )}
          </div>
        </section>
      )}
    </>
  );
}

/**
 * Las nacionalidades muestran su estado de resolución, incluido lo que no se pudo
 * clasificar. Es el compromiso del alcance: un hueco reconocido es información;
 * un hueco escondido es una mentira por omisión.
 */
function PayloadPanel({ payload }: { payload: PayloadDto }) {
  return (
    <article className={styles.panel}>
      <h3 className={detail.payloadName}>{payload.name}</h3>

      <p className={detail.payloadMeta}>
        {[payload.type, payload.orbit, payload.massKg !== null ? `${payload.massKg.toLocaleString('es-ES')} kg` : null]
          .filter((value) => value !== null)
          .join(' · ') || 'Sin datos técnicos'}
      </p>

      {payload.nationalities.length > 0 && (
        <div className={detail.nationalities}>
          <span className={styles.dataLabel}>Nacionalidades declaradas</span>
          <div className={styles.tagRow}>
            {payload.nationalities.map((nationality, index) => (
              <span
                key={`${nationality.rawValue}-${index}`}
                className={`${styles.tag} ${
                  nationality.resolution === 'resolved'
                    ? styles.tagResolved
                    : nationality.resolution === 'not_a_country'
                      ? styles.tagNonCountry
                      : styles.tagUnresolved
                }`}
                title={
                  nationality.resolution === 'resolved'
                    ? `Resuelto como ${nationality.country?.name ?? ''}`
                    : nationality.resolution === 'not_a_country'
                      ? 'No es un país: entidad supranacional u organización'
                      : 'No se pudo resolver a ningún país'
                }
              >
                {nationality.rawValue}
                {nationality.resolution === 'not_a_country' && ' · no es un país'}
                {nationality.resolution === 'unresolved' && ' · sin resolver'}
              </span>
            ))}
          </div>
        </div>
      )}

      {payload.customers.length > 0 && (
        <p className={detail.customers}>Cliente: {payload.customers.join(', ')}</p>
      )}
    </article>
  );
}
