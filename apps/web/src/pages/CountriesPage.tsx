import { Link, useParams } from 'react-router';
import { CountryFlag } from '../components/CountryFlag';
import { LaunchCard } from '../components/LaunchCard';
import { EmptyState, ErrorState, LoadingList } from '../components/StateViews';
import { useCountries, useCountryDetail } from '../features/launches/launch-queries';
import styles from './page.module.css';
import countryStyles from './CountriesPage.module.css';

export function CountriesPage() {
  const { data, isPending, isError, error, refetch } = useCountries();

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Países</h1>
          <p className={styles.subtitle}>
            Un país aparece aquí si tiene algún vínculo real con un lanzamiento: porque el despegue ocurrió en su
            territorio, o porque alguna carga útil declaró su nacionalidad. La SpaceX API no expone país, así que
            ambos vínculos se construyen y son auditables.
          </p>
        </div>
      </div>

      {isPending ? (
        <LoadingList count={4} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          title="Todavía no hay países vinculados"
          description="Sincroniza el catálogo para que se construyan los vínculos entre lanzamientos y países."
        />
      ) : (
        <ul className={countryStyles.grid}>
          {data.map((country) => (
            <li key={country.code}>
              <Link to={`/paises/${country.code}`} className={countryStyles.card}>
                <CountryFlag country={country} size="md" />
                <div>
                  <span className={countryStyles.name}>{country.name}</span>
                  <span className={countryStyles.region}>{country.region ?? 'Región no informada'}</span>
                </div>
                <span className={countryStyles.count}>{country.launchCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function CountryDetailPage() {
  const { code = '' } = useParams();
  const { data, isPending, isError, error, refetch } = useCountryDetail(code);

  if (isPending) {
    return <LoadingList count={3} />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const { country, fromSoil, withPayload } = data;

  return (
    <>
      <Link to="/paises" className={styles.backLink}>
        ← Volver a países
      </Link>

      <header className={countryStyles.hero}>
        <CountryFlag country={country} size="lg" />
        <div>
          <h1 className={styles.title}>{country.name}</h1>
          <p className={countryStyles.officialName}>{country.officialName}</p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.dataGrid}>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Región</span>
            <span className={styles.dataValue}>{country.subregion ?? country.region ?? '—'}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Capital</span>
            <span className={styles.dataValue}>{country.capital ?? '—'}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Desde su suelo</span>
            <span className={styles.dataValue}>{country.launchesFromSoil}</span>
          </div>
          <div className={styles.dataCell}>
            <span className={styles.dataLabel}>Con carga suya</span>
            <span className={styles.dataValue}>{country.launchesWithPayload}</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Lanzamientos desde su territorio</h2>
        {fromSoil.length === 0 ? (
          <EmptyState
            title="Ningún lanzamiento desde este país"
            description="SpaceX opera desde un número reducido de sitios. Que no haya despegues aquí no significa que el país no participe: mira la sección siguiente."
          />
        ) : (
          <div className={styles.list}>
            {fromSoil.map((launch) => (
              <LaunchCard key={launch.id} launch={launch} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Lanzamientos con carga útil de este país</h2>
        <p className={styles.sectionNote}>
          Derivado de la nacionalidad declarada en las cargas útiles, resuelta contra REST Countries.
        </p>
        {withPayload.length === 0 ? (
          <EmptyState
            title="Ninguna carga útil de este país"
            description="No hay lanzamientos en el catálogo que transporten cargas con esta nacionalidad declarada."
          />
        ) : (
          <div className={styles.list}>
            {withPayload.map((launch) => (
              <LaunchCard key={launch.id} launch={launch} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
