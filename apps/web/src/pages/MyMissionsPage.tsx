import { Link } from 'react-router';
import { Countdown } from '../components/Countdown';
import { LaunchCard } from '../components/LaunchCard';
import { EmptyState, ErrorState, LoadingList } from '../components/StateViews';
import { useAuth } from '../features/auth/auth-context';
import { useFollowedIds, useFollowedLaunches, useToggleFollow } from '../features/launches/launch-queries';
import styles from './page.module.css';
import missions from './MyMissionsPage.module.css';

export function MyMissionsPage() {
  const { user, isLoading } = useAuth();
  const { data, isPending, isError, error, refetch } = useFollowedLaunches(user !== null);
  const { data: followedIds } = useFollowedIds(user !== null);
  const toggleFollow = useToggleFollow();

  if (isLoading) {
    return <LoadingList count={3} />;
  }

  if (user === null) {
    return (
      <EmptyState
        title="Necesitas una cuenta para seguir misiones"
        description="El catálogo completo es público, pero el seguimiento se guarda en tu cuenta para que esté disponible desde cualquier dispositivo."
        action={
          <Link to="/acceder" className={missions.cta}>
            Acceder o crear cuenta
          </Link>
        }
      />
    );
  }

  if (isPending) {
    return <LoadingList count={3} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const upcoming = data.filter((launch) => launch.timing === 'upcoming');
  const launched = data.filter((launch) => launch.timing === 'launched');
  const next = upcoming.find((launch) => launch.date.supportsCountdown);

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Mis misiones</h1>
          <p className={styles.subtitle}>
            {data.length === 0
              ? 'Todavía no sigues ninguna misión.'
              : `Sigues ${data.length} ${data.length === 1 ? 'misión' : 'misiones'}: ${upcoming.length} por lanzar y ${launched.length} ya ${launched.length === 1 ? 'lanzada' : 'lanzadas'}.`}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState
          title="Aún no sigues ninguna misión"
          description="Marca cualquier lanzamiento del catálogo con el icono de marcador y aparecerá aquí, ordenado por proximidad."
          action={
            <Link to="/" className={missions.cta}>
              Explorar el catálogo
            </Link>
          }
        />
      ) : (
        <>
          {next !== undefined && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Siguiente: {next.name}</h2>
              <Countdown targetDate={next.date.dateUtc} />
            </section>
          )}

          {upcoming.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Por lanzar</h2>
              <div className={styles.list}>
                {upcoming.map((launch) => (
                  <LaunchCard
                    key={launch.id}
                    launch={launch}
                    isFollowing={followedIds?.includes(launch.id) ?? true}
                    onToggleFollow={(launchId, isFollowing) => toggleFollow.mutate({ launchId, isFollowing })}
                  />
                ))}
              </div>
            </section>
          )}

          {launched.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Ya lanzadas</h2>
              <div className={styles.list}>
                {launched.map((launch) => (
                  <LaunchCard
                    key={launch.id}
                    launch={launch}
                    isFollowing={followedIds?.includes(launch.id) ?? true}
                    onToggleFollow={(launchId, isFollowing) => toggleFollow.mutate({ launchId, isFollowing })}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
