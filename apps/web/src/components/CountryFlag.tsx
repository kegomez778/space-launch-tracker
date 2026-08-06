import { useState } from 'react';
import type { CountrySummaryDto } from '@slt/shared';
import styles from './CountryFlag.module.css';

interface CountryFlagProps {
  country: Pick<CountrySummaryDto, 'code' | 'name' | 'flagSvg' | 'flagAlt'>;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Bandera con sustituto propio (riesgo R7).
 *
 * Las banderas se sirven desde un CDN de terceros que puede caerse, perder el
 * fichero o estar bloqueado por la red del usuario. Cuando eso ocurre, el
 * navegador renderiza el texto alternativo dentro de la caja de la imagen: con un
 * alt descriptivo y un ancho de 20px, eso convierte una fila de 80px en una
 * columna de 400px y destroza la retícula.
 *
 * Por eso el sustituto es el código ISO del país: cabe siempre, es información
 * real y ocupa exactamente lo mismo que la bandera que reemplaza.
 */
export function CountryFlag({ country, size = 'sm' }: CountryFlagProps) {
  const [hasFailed, setHasFailed] = useState(false);

  if (country.flagSvg === null || hasFailed) {
    return (
      <span className={`${styles.fallback} ${styles[size]}`} title={country.name}>
        {country.code}
      </span>
    );
  }

  return (
    <img
      className={`${styles.flag} ${styles[size]}`}
      src={country.flagSvg}
      alt={country.flagAlt ?? `Bandera de ${country.name}`}
      loading="lazy"
      onError={() => setHasFailed(true)}
    />
  );
}
