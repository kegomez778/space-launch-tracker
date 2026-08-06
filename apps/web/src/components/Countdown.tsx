import { useEffect, useState } from 'react';
import { computeCountdown } from '../lib/launch-date.format';
import styles from './Countdown.module.css';

const UNITS = [
  { key: 'days', label: 'días' },
  { key: 'hours', label: 'horas' },
  { key: 'minutes', label: 'min' },
  { key: 'seconds', label: 'seg' },
] as const;

/**
 * Sólo se monta para fechas con hora conocida y confirmada: contar segundos hacia
 * "algún momento de 2027" daría al usuario una precisión que la fuente no tiene.
 * La decisión la toma el dominio (`supportsCountdown`), no este componente.
 */
export function Countdown({ targetDate }: { targetDate: string }) {
  const [remaining, setRemaining] = useState(() => computeCountdown(targetDate));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(computeCountdown(targetDate)), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (remaining.hasArrived) {
    return <p className={styles.arrived}>La ventana de lanzamiento ya ha comenzado</p>;
  }

  return (
    <div className={styles.countdown}>
      <span className={styles.label}>Cuenta atrás</span>
      <div className={styles.units}>
        {UNITS.map((unit) => (
          <div key={unit.key} className={styles.unit}>
            <span className={styles.value}>{String(remaining[unit.key]).padStart(2, '0')}</span>
            <span className={styles.unitLabel}>{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
