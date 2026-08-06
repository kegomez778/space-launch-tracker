import { describe, expect, it, vi } from 'vitest';
import { CircuitOpenError } from './circuit-breaker';
import { ExternalProviderError, ResilientHttpClient, backoffWithJitter } from './resilient-http.client';

const options = {
  serviceName: 'SpaceX',
  baseUrl: 'https://example.test/v4',
  timeoutMs: 1000,
  maxRetries: 2,
  circuit: { failureThreshold: 3, resetTimeoutMs: 60_000 },
};

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const errorResponse = (status: number) => new Response('boom', { status, statusText: 'Server Error' });

/** Sin espera real: los tests no deben tardar lo que tarda un backoff. */
const noSleep = () => Promise.resolve();

describe('ResilientHttpClient', () => {
  it('devuelve el JSON cuando el proveedor responde bien', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse([{ id: 'a' }]));
    const client = new ResilientHttpClient(options, fetchFn, noSleep);

    await expect(client.getJson('/launches')).resolves.toEqual([{ id: 'a' }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('reintenta ante un 5xx y acaba devolviendo el resultado', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new ResilientHttpClient(options, fetchFn, noSleep);

    await expect(client.getJson('/launches')).resolves.toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('agota los reintentos y falla con un error descriptivo', async () => {
    const fetchFn = vi.fn().mockResolvedValue(errorResponse(500));
    const client = new ResilientHttpClient(options, fetchFn, noSleep);

    await expect(client.getJson('/launches')).rejects.toThrow(ExternalProviderError);
    expect(fetchFn).toHaveBeenCalledTimes(options.maxRetries + 1);
  });

  // Reintentar un 404 o un 400 no lo va a arreglar: el error es nuestro.
  it('no reintenta un 4xx que no sea 429', async () => {
    const fetchFn = vi.fn().mockResolvedValue(errorResponse(404));
    const client = new ResilientHttpClient(options, fetchFn, noSleep);

    await expect(client.getJson('/nope')).rejects.toMatchObject({ reason: 'http_error', statusCode: 404 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sí reintenta un 429, porque el límite de cuota se recupera solo', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new ResilientHttpClient(options, fetchFn, noSleep);

    await expect(client.getJson('/launches')).resolves.toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('distingue un timeout de un fallo de red, con mensaje útil', async () => {
    const timeout = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    const fetchFn = vi.fn().mockRejectedValue(timeout);
    const client = new ResilientHttpClient(options, fetchFn, noSleep);

    await expect(client.getJson('/launches')).rejects.toMatchObject({
      reason: 'timeout',
      message: 'SpaceX no respondió en 1000 ms',
    });
  });

  it('no reintenta una respuesta que no es JSON: repetirla daría lo mismo', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>maintenance</html>', { status: 200 }));
    const client = new ResilientHttpClient(options, fetchFn, noSleep);

    await expect(client.getJson('/launches')).rejects.toMatchObject({ reason: 'invalid_payload' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('abre el circuito tras varios fallos y deja de llamar al proveedor', async () => {
    const fetchFn = vi.fn().mockResolvedValue(errorResponse(500));
    const client = new ResilientHttpClient(
      { ...options, maxRetries: 0, circuit: { failureThreshold: 2, resetTimeoutMs: 60_000 } },
      fetchFn,
      noSleep,
    );

    await expect(client.getJson('/a')).rejects.toThrow(ExternalProviderError);
    await expect(client.getJson('/b')).rejects.toThrow(ExternalProviderError);
    expect(client.circuitState).toBe('open');

    const callsBefore = fetchFn.mock.calls.length;
    await expect(client.getJson('/c')).rejects.toThrow(CircuitOpenError);
    expect(fetchFn.mock.calls.length).toBe(callsBefore);
  });
});

describe('backoffWithJitter', () => {
  it('crece con cada intento', () => {
    const first = backoffWithJitter(0);
    const third = backoffWithJitter(2);

    expect(first).toBeLessThanOrEqual(300);
    expect(third).toBeGreaterThan(first);
  });

  it('respeta el techo para no esperar indefinidamente', () => {
    expect(backoffWithJitter(20, 300, 8000)).toBeLessThanOrEqual(8000);
  });

  it('introduce variación entre llamadas para no sincronizar reintentos', () => {
    const samples = new Set(Array.from({ length: 40 }, () => backoffWithJitter(4)));

    expect(samples.size).toBeGreaterThan(1);
  });
});
