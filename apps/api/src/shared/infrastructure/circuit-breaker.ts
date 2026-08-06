export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Fallos consecutivos que abren el circuito. */
  readonly failureThreshold: number;
  /** Tiempo que permanece abierto antes de permitir una llamada de prueba. */
  readonly resetTimeoutMs: number;
}

export class CircuitOpenError extends Error {
  constructor(readonly serviceName: string, readonly retryInMs: number) {
    super(
      `El servicio "${serviceName}" está marcado como no disponible tras varios fallos consecutivos. ` +
        `Se reintentará en ${Math.ceil(retryInMs / 1000)} s.`,
    );
    this.name = 'CircuitOpenError';
  }
}

/**
 * Evita castigar a un proveedor que ya ha demostrado estar caído.
 *
 * Sin esto, cada ciclo de sincronización volvería a esperar el timeout completo
 * contra un servicio que no responde: el coste no es sólo la espera, es que un
 * proveedor caído bloquearía la ventana de sincronización de los demás.
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly serviceName: string,
    private readonly options: CircuitBreakerOptions,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): CircuitState {
    if (this.openedAt === null) {
      return 'closed';
    }
    return this.now() - this.openedAt >= this.options.resetTimeoutMs ? 'half_open' : 'open';
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = this.now() - (this.openedAt ?? 0);
      throw new CircuitOpenError(this.serviceName, this.options.resetTimeoutMs - elapsed);
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.openedAt = this.now();
    }
  }
}
