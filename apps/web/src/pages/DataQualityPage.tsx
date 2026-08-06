import { ErrorState, LoadingList } from '../components/StateViews';
import { useDataQuality } from '../features/launches/launch-queries';
import styles from './page.module.css';
import quality from './DataQualityPage.module.css';

/**
 * Esta página existe por una decisión de alcance explícita: lo que la
 * integración no logra resolver tiene que ser **visible**, no quedarse en un log.
 * Enseñar el 91% real y qué falta vale más que aparentar un 100%.
 */
export function DataQualityPage() {
  const { data, isPending, isError, error, refetch } = useDataQuality();

  if (isPending) {
    return <LoadingList count={3} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Calidad de los datos</h1>
          <p className={styles.subtitle}>
            Las fuentes públicas traen huecos e inconsistencias. En lugar de esconderlos, se miden y se muestran: es
            lo que permite distinguir un dato que falta de un dato que se inventó.
          </p>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Resolución de nacionalidades</h2>
        <p className={styles.sectionNote}>
          Las cargas útiles declaran su nacionalidad como texto libre. Cada valor se resuelve contra REST Countries
          por nombre común, oficial, grafías alternativas y una tabla de sinónimos curada.
        </p>

        <div className={styles.dataGrid}>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Clasificadas</span>
            <span className={`${styles.dataValue} ${quality.highlight}`}>{data.nationalities.coveragePercent}%</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Resueltas a país</span>
            <span className={styles.dataValue}>{data.nationalities.resolved}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>No son un país</span>
            <span className={styles.dataValue}>{data.nationalities.notACountry}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Sin resolver</span>
            <span className={`${styles.dataValue} ${data.nationalities.unresolved > 0 ? quality.warning : ''}`}>
              {data.nationalities.unresolved}
            </span>
          </div>
        </div>

        {data.nationalities.unresolvedValues.length > 0 && (
          <div className={quality.unresolvedPanel}>
            <h3 className={quality.unresolvedTitle}>Valores que no se pudieron resolver</h3>
            <p className={quality.unresolvedNote}>
              No se asignan a ningún país por aproximación. Un país inventado sería peor que un hueco reconocido.
            </p>
            <ul className={quality.unresolvedList}>
              {data.nationalities.unresolvedValues.map((entry) => (
                <li key={entry.rawValue} className={quality.unresolvedItem}>
                  <span>{entry.rawValue}</span>
                  <span className={quality.occurrences}>
                    {entry.occurrences} {entry.occurrences === 1 ? 'aparición' : 'apariciones'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Consistencia del catálogo</h2>
        <div className={styles.dataGrid}>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Lanzamientos</span>
            <span className={styles.dataValue}>{data.launches.total}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Flags temporales contradictorios</span>
            <span
              className={`${styles.dataValue} ${data.launches.contradictoryTimingFlags > 0 ? quality.warning : ''}`}
            >
              {data.launches.contradictoryTimingFlags}
            </span>
          </div>
        </div>
        <p className={quality.footnote}>
          La SpaceX API marca cada lanzamiento como próximo o pasado, pero su dataset arrastra registros cuyo flag
          contradice su propia fecha. La aplicación deriva el estado de la fecha e ignora el flag; el recuento de
          arriba es cuántas veces ha hecho falta.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Últimas sincronizaciones</h2>
        <div className={quality.syncTable} role="table">
          <div className={quality.syncHeader} role="row">
            <span role="columnheader">Recurso</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Procesados</span>
            <span role="columnheader">Descartados</span>
            <span role="columnheader">Fin</span>
          </div>
          {data.syncs.map((run, index) => (
            <div key={`${run.resource}-${index}`} className={quality.syncRow} role="row">
              <span role="cell">{run.resource}</span>
              <span role="cell" className={run.status === 'failed' ? quality.warning : quality.ok}>
                {run.status === 'success' ? 'correcta' : run.status === 'failed' ? 'fallida' : 'en curso'}
              </span>
              <span role="cell">{run.recordsProcessed}</span>
              <span role="cell" className={run.recordsRejected > 0 ? quality.warning : undefined}>
                {run.recordsRejected}
              </span>
              <span role="cell">
                {run.finishedAt === null ? '—' : new Date(run.finishedAt).toLocaleString('es-ES')}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
