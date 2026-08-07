import { CircuitBreaker, type CircuitBreakerOptions } from './circuit-breaker';

export class ExternalProviderError extends Error {
  constructor(
    readonly serviceName: string,
    readonly reason: 'timeout' | 'network' | 'http_error' | 'invalid_payload',
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ExternalProviderError';
  }
}

export interface ResilientHttpOptions {
  readonly serviceName: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly circuit: CircuitBreakerOptions;
}

type FetchLike = typeof globalThis.fetch;
type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Un 4xx distinto de 429 es un error nuestro: reintentarlo sólo gasta cuota. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Cliente HTTP para las APIs públicas de terceros.
 *
 * SpaceX y REST Countries son servicios gratuitos sin garantía de disponibilidad
 * ni latencia. Las tres protecciones que aplica —timeout, reintento con espera
 * creciente y cortocircuito— existen porque la sincronización corre desatendida:
 * nadie va a estar mirando cuando uno de los dos empiece a fallar.
 */
export class ResilientHttpClient {
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly options: ResilientHttpOptions,
    private readonly fetchFn: FetchLike = globalThis.fetch,
    private readonly sleep: SleepFn = defaultSleep,
  ) {
    this.breaker = new CircuitBreaker(options.serviceName, options.circuit);
  }

  get circuitState() {
    return this.breaker.state;
  }

  async getJson<T = unknown>(path: string): Promise<T> {
    return this.breaker.execute(() => this.attemptWithRetries<T>(path));
  }

  /**
   * Igual que `getJson`, pero exige que la respuesta sea una colección.
   *
   * Existe por un caso real: al deprecar su API, REST Countries dejó de devolver
   * el array y pasó a responder **HTTP 200** con un sobre de error. Un 200 no
   * dispara ninguna protección —ni reintento, ni circuito—, así que el objeto
   * llegaba intacto hasta el código que esperaba una lista y reventaba allí con
   * un TypeError ilegible.
   *
   * Comprobar la forma aquí convierte ese fallo en un error de proveedor con el
   * motivo real, que es lo que alguien necesita leer a las tres de la mañana.
   */
  async getJsonCollection(path: string): Promise<unknown[]> {
    const payload = await this.getJson<unknown>(path);

    if (Array.isArray(payload)) {
      return payload;
    }

    throw new ExternalProviderError(
      this.options.serviceName,
      'invalid_payload',
      `${this.options.serviceName} devolvió un objeto donde se esperaba una lista. ` +
        `${describeUpstreamError(payload) ?? `Recibido: ${describeShape(payload)}.`}`,
    );
  }

  private async attemptWithRetries<T>(path: string): Promise<T> {
    const url = `${this.options.baseUrl}${path}`;
    let lastError: ExternalProviderError | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        return await this.attemptOnce<T>(url);
      } catch (error) {
        if (!(error instanceof ExternalProviderError)) {
          throw error;
        }
        lastError = error;

        const isLastAttempt = attempt === this.options.maxRetries;
        const isRetryable =
          error.reason !== 'invalid_payload' &&
          (error.statusCode === undefined || isRetryableStatus(error.statusCode));

        if (isLastAttempt || !isRetryable) {
          throw error;
        }

        await this.sleep(backoffWithJitter(attempt));
      }
    }

    /* c8 ignore next -- el bucle sólo sale por return o throw */
    throw lastError;
  }

  private async attemptOnce<T>(url: string): Promise<T> {
    const { serviceName, timeoutMs } = this.options;
    let response: Response;

    try {
      response = await this.fetchFn(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      throw new ExternalProviderError(
        serviceName,
        isTimeout ? 'timeout' : 'network',
        isTimeout
          ? `${serviceName} no respondió en ${timeoutMs} ms`
          : `No se pudo contactar con ${serviceName}: ${describe(error)}`,
      );
    }

    if (!response.ok) {
      throw new ExternalProviderError(
        serviceName,
        'http_error',
        `${serviceName} respondió ${response.status} ${response.statusText} en ${url}`,
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new ExternalProviderError(
        serviceName,
        'invalid_payload',
        `${serviceName} devolvió una respuesta que no es JSON válido: ${describe(error)}`,
      );
    }
  }
}

/**
 * Espera creciente con desviación aleatoria. El componente aleatorio evita que
 * varios recursos que fallaron a la vez vuelvan a golpear al proveedor en el mismo
 * instante y lo tumben justo cuando se está recuperando.
 */
export function backoffWithJitter(attempt: number, baseMs = 300, capMs = 8000): number {
  const exponential = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.round(exponential / 2 + Math.random() * (exponential / 2));
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Extrae el mensaje de un sobre de error servido con estado 200. Se contemplan
 * las dos formas habituales: `{ errors: [{ message }] }`, que es la que usa
 * REST Countries al anunciar su deprecación, y un `{ message }` suelto.
 */
function describeUpstreamError(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const { errors, message } = payload as { errors?: unknown; message?: unknown };

  if (Array.isArray(errors)) {
    const messages = errors
      .map((entry) =>
        typeof entry === 'object' && entry !== null && typeof (entry as { message?: unknown }).message === 'string'
          ? (entry as { message: string }).message
          : null,
      )
      .filter((entry): entry is string => entry !== null);

    if (messages.length > 0) {
      return `El proveedor informa: ${messages.join(' ')}`;
    }
  }

  return typeof message === 'string' ? `El proveedor informa: ${message}` : null;
}

function describeShape(payload: unknown): string {
  if (payload === null) {
    return 'null';
  }
  if (typeof payload !== 'object') {
    return typeof payload;
  }
  return `objeto con las claves [${Object.keys(payload).slice(0, 6).join(', ')}]`;
}
