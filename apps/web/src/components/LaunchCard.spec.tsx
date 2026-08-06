import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { DataFreshnessDto, LaunchSummaryDto } from '@slt/shared';
import { FreshnessBanner } from './FreshnessBanner';
import { LaunchCard } from './LaunchCard';
import { EmptyState, ErrorState, LoadingList } from './StateViews';
import { ApiError } from '../lib/api-client';

const launch: LaunchSummaryDto = {
  id: 'l1',
  flightNumber: 42,
  name: 'Starlink 6-1',
  date: {
    dateUtc: '2026-09-01T10:00:00.000Z',
    precision: 'hour',
    isProvisional: false,
    supportsCountdown: true,
  },
  timing: 'upcoming',
  outcome: 'pending',
  rocketName: 'Falcon 9',
  patchUrl: 'https://images.example/patch.png',
  siteCountry: { code: 'US', name: 'United States', flagSvg: 'https://flags.example/us.svg', flagAlt: 'Bandera' },
};

const renderCard = (props: Partial<Parameters<typeof LaunchCard>[0]> = {}) =>
  render(
    <MemoryRouter>
      <LaunchCard launch={launch} {...props} />
    </MemoryRouter>,
  );

describe('LaunchCard', () => {
  it('etiqueta como programado un lanzamiento futuro', () => {
    renderCard();
    expect(screen.getByText('Programado')).toBeInTheDocument();
  });

  it('distingue éxito de fallo con texto, no sólo con color', () => {
    render(
      <MemoryRouter>
        <LaunchCard launch={{ ...launch, timing: 'launched', outcome: 'failure' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Fallo')).toBeInTheDocument();
  });

  // Riesgo R7: las imágenes vienen de terceros y desaparecen.
  it('sustituye el parche por el número de vuelo cuando la imagen falla', async () => {
    renderCard();
    const patch = screen.getByAltText(/Parche de la misión/);

    patch.dispatchEvent(new Event('error', { bubbles: false }));

    expect(await screen.findByText('#42')).toBeInTheDocument();
  });

  it('sustituye la bandera por el código ISO cuando el CDN falla', async () => {
    renderCard();
    const flag = screen.getByAltText('Bandera');

    flag.dispatchEvent(new Event('error', { bubbles: false }));

    expect(await screen.findByTitle('United States')).toHaveTextContent('US');
  });

  it('no ofrece el botón de seguir a un visitante anónimo', () => {
    renderCard();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('comunica el estado de seguimiento a los lectores de pantalla', async () => {
    const onToggleFollow = vi.fn();
    renderCard({ isFollowing: true, onToggleFollow });

    const button = screen.getByRole('button', { name: /Dejar de seguir/ });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(button);
    expect(onToggleFollow).toHaveBeenCalledWith('l1', true);
  });

  it('muestra la precisión real de una fecha sin confirmar', () => {
    render(
      <MemoryRouter>
        <LaunchCard
          launch={{
            ...launch,
            date: { ...launch.date, precision: 'month', isProvisional: true, supportsCountdown: false },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/día por confirmar/)).toBeInTheDocument();
  });
});

describe('estados de la interfaz', () => {
  it('el esqueleto de carga se anuncia sin leer contenido falso', () => {
    render(<LoadingList count={2} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando lanzamientos');
  });

  it('el estado vacío explica qué hacer, no sólo que no hay nada', () => {
    render(<EmptyState title="Sin resultados" description="Prueba a quitar algún filtro." />);

    expect(screen.getByText('Prueba a quitar algún filtro.')).toBeInTheDocument();
  });

  it('el error muestra el mensaje del servidor y permite reintentar', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError(503, 'UPSTREAM', 'SpaceX no responde')} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('SpaceX no responde');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('FreshnessBanner', () => {
  const freshness = (overrides: Partial<DataFreshnessDto>): DataFreshnessDto => ({
    lastSyncedAt: '2026-08-06T00:00:00.000Z',
    ageSeconds: 3600,
    isStale: false,
    lastSyncFailed: false,
    ...overrides,
  });

  it('dice la antigüedad de los datos en lenguaje llano', () => {
    render(<FreshnessBanner freshness={freshness({})} />);
    expect(screen.getByText(/hace 1 h/)).toBeInTheDocument();
  });

  // La degradación honesta: la aplicación sigue sirviendo, pero lo dice.
  it('avisa cuando la última sincronización falló', () => {
    render(<FreshnessBanner freshness={freshness({ lastSyncFailed: true })} />);
    expect(screen.getByText(/la última sincronización falló/)).toBeInTheDocument();
  });
});
