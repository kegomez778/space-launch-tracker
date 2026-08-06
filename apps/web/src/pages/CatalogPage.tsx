import { useSearchParams } from 'react-router';
import { FreshnessBanner } from '../components/FreshnessBanner';
import { LaunchCard } from '../components/LaunchCard';
import { EmptyState, ErrorState, LoadingList } from '../components/StateViews';
import { useAuth } from '../features/auth/auth-context';
import { useFollowedIds, useLaunches, useToggleFollow } from '../features/launches/launch-queries';
import { localTimeZoneLabel } from '../lib/launch-date.format';
import styles from './CatalogPage.module.css';

/**
 * Los filtros viven en la URL, no en estado local.
 *
 * Es una decisión de producto: hace que una vista filtrada sea compartible y
 * marcable, que el botón "atrás" del navegador funcione como el usuario espera,
 * y elimina de raíz los bugs de mantener el estado sincronizado con la
 * navegación (ADR-003).
 */
export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const filters = {
    search: searchParams.get('buscar') ?? '',
    timing: searchParams.get('estado') ?? 'all',
    outcome: searchParams.get('resultado') ?? 'all',
    country: searchParams.get('pais') ?? '',
    year: searchParams.get('anio') ?? '',
    sort: searchParams.get('orden') ?? 'date_desc',
    page: Number(searchParams.get('pagina') ?? '1'),
  };

  const { data, isPending, isError, error, refetch } = useLaunches(filters);
  const { data: followedIds } = useFollowedIds(user !== null);
  const toggleFollow = useToggleFollow();

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    // Cualquier cambio de filtro vuelve a la primera página: mantener la página 7
    // tras filtrar dejaría al usuario mirando un vacío que no entiende.
    next.delete('pagina');
    setSearchParams(next);
  };

  const goToPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('pagina', String(page));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Lanzamientos</h1>
          <p className={styles.subtitle}>
            Horarios en tu zona horaria ({localTimeZoneLabel()}). Las fechas sin confirmar se muestran con su
            grado de precisión real.
          </p>
        </div>
        {data !== undefined && <FreshnessBanner freshness={data.freshness} />}
      </div>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="buscar">
            Misión
          </label>
          <input
            id="buscar"
            type="search"
            className={styles.input}
            placeholder="Buscar por nombre"
            defaultValue={filters.search}
            onChange={(event) => updateFilter('buscar', event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="estado">
            Estado
          </label>
          <select
            id="estado"
            className={styles.select}
            value={filters.timing}
            onChange={(event) => updateFilter('estado', event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="upcoming">Próximos</option>
            <option value="launched">Ya lanzados</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="resultado">
            Resultado
          </label>
          <select
            id="resultado"
            className={styles.select}
            value={filters.outcome}
            onChange={(event) => updateFilter('resultado', event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="success">Éxito</option>
            <option value="failure">Fallo</option>
            <option value="pending">Sin resultado</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="orden">
            Orden
          </label>
          <select
            id="orden"
            className={styles.select}
            value={filters.sort}
            onChange={(event) => updateFilter('orden', event.target.value)}
          >
            <option value="date_desc">Más recientes primero</option>
            <option value="date_asc">Más antiguos primero</option>
          </select>
        </div>
      </div>

      {isPending ? (
        <LoadingList />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState
          title="Ningún lanzamiento coincide con estos filtros"
          description="Prueba a quitar alguno, o a buscar por otro nombre de misión. El catálogo cubre lanzamientos de SpaceX desde 2006."
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <p className={styles.resultCount}>
              {data.pagination.totalItems} {data.pagination.totalItems === 1 ? 'misión' : 'misiones'}
            </p>
          </div>

          <div className={styles.list}>
            {data.data.map((launch) => (
              <LaunchCard
                key={launch.id}
                launch={launch}
                isFollowing={followedIds?.includes(launch.id)}
                onToggleFollow={
                  user === null
                    ? undefined
                    : (launchId, isFollowing) => toggleFollow.mutate({ launchId, isFollowing })
                }
              />
            ))}
          </div>

          {data.pagination.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Paginación">
              <button
                type="button"
                className={styles.pageButton}
                disabled={filters.page <= 1}
                onClick={() => goToPage(filters.page - 1)}
              >
                Anterior
              </button>
              <span className={styles.pageIndicator}>
                Página {data.pagination.page} de {data.pagination.totalPages}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                disabled={filters.page >= data.pagination.totalPages}
                onClick={() => goToPage(filters.page + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
