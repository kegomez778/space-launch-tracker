import type { ApiErrorDto } from '@slt/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

/**
 * Cliente HTTP del backend propio.
 *
 * Todo pasa por `/api` en el mismo origen, así que no hay cabeceras de
 * autenticación que gestionar: la sesión viaja en una cookie httpOnly que este
 * código no puede leer, que es justamente el punto (ADR-004).
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo contactar con el servidor. ¿Está la API arrancada?');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body as ApiErrorDto | null;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Se produjo un error inesperado',
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string) => request<T>(path, { method: 'PUT' }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function buildQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}
