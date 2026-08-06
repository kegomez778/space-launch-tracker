import { useState } from 'react';
import { Link } from 'react-router';
import type { LaunchSummaryDto } from '@slt/shared';
import { formatLaunchDate } from '../lib/launch-date.format';
import { CountryFlag } from './CountryFlag';
import styles from './LaunchCard.module.css';

const STATUS_LABEL: Record<LaunchSummaryDto['outcome'], string> = {
  success: 'Éxito',
  failure: 'Fallo',
  pending: 'Sin resultado',
};

interface LaunchCardProps {
  launch: LaunchSummaryDto;
  isFollowing?: boolean;
  onToggleFollow?: (launchId: string, isFollowing: boolean) => void;
}

export function LaunchCard({ launch, isFollowing, onToggleFollow }: LaunchCardProps) {
  const [patchFailed, setPatchFailed] = useState(false);
  const variant = launch.timing === 'upcoming' ? styles.upcoming : styles[launch.outcome];
  const statusLabel = launch.timing === 'upcoming' ? 'Programado' : STATUS_LABEL[launch.outcome];

  return (
    <article className={`${styles.card} ${variant}`}>
      {launch.patchUrl !== null && !patchFailed ? (
        <img
          className={styles.patch}
          src={launch.patchUrl}
          alt={`Parche de la misión ${launch.name}`}
          loading="lazy"
          width={56}
          height={56}
          onError={() => setPatchFailed(true)}
        />
      ) : (
        // Las imágenes vienen de hosts de terceros que pueden perderlas (riesgo
        // R7). El número de vuelo siempre existe y es información real.
        <div className={styles.patchFallback} aria-hidden="true">
          #{launch.flightNumber}
        </div>
      )}

      <div className={styles.body}>
        <h3 className={styles.name}>
          <Link to={`/lanzamientos/${launch.id}`} className={styles.nameText}>
            {launch.name}
          </Link>
          <span className={styles.flightNumber}>Vuelo {launch.flightNumber}</span>
        </h3>

        <div className={styles.meta}>
          <time dateTime={launch.date.dateUtc} className={launch.date.isProvisional ? styles.provisional : undefined}>
            {formatLaunchDate(launch.date)}
          </time>
          <span>{launch.rocketName}</span>
        </div>
      </div>

      <div className={styles.side}>
        {launch.siteCountry !== null && <CountryFlag country={launch.siteCountry} />}

        <span className={styles.status}>{statusLabel}</span>

        {onToggleFollow !== undefined && (
          <button
            type="button"
            className={`${styles.followButton} ${isFollowing === true ? styles.followButtonActive : ''}`}
            onClick={() => onToggleFollow(launch.id, isFollowing === true)}
            aria-pressed={isFollowing === true}
            aria-label={isFollowing === true ? `Dejar de seguir ${launch.name}` : `Seguir ${launch.name}`}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z"
                fill={isFollowing === true ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}
