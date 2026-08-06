import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CountryDetailDto,
  CountryListItemDto,
  DataQualityDto,
  FollowedLaunchDto,
  LaunchDetailDto,
  LaunchSummaryDto,
  PaginatedDto,
} from '@slt/shared';
import { api, buildQueryString } from '../../lib/api-client';

export interface CatalogFilters {
  readonly search: string;
  readonly timing: string;
  readonly outcome: string;
  readonly country: string;
  readonly year: string;
  readonly sort: string;
  readonly page: number;
}

/**
 * El catálogo cambia como mucho cada cuarto de hora (cadencia de sincronización),
 * así que refrescarlo con más frecuencia sería gastar peticiones sin cambiar nada
 * en pantalla.
 */
const CATALOG_STALE_MS = 5 * 60 * 1000;

export function useLaunches(filters: CatalogFilters) {
  return useQuery({
    queryKey: ['launches', filters],
    queryFn: () =>
      api.get<PaginatedDto<LaunchSummaryDto>>(
        `/launches${buildQueryString({
          search: filters.search,
          timing: filters.timing,
          outcome: filters.outcome,
          country: filters.country,
          year: filters.year,
          sort: filters.sort,
          page: filters.page,
        })}`,
      ),
    staleTime: CATALOG_STALE_MS,
    // Mantener la página anterior visible mientras llega la siguiente evita que
    // la lista parpadee a vacío en cada cambio de filtro.
    placeholderData: (previous) => previous,
  });
}

export function useLaunchDetail(id: string) {
  return useQuery({
    queryKey: ['launch', id],
    queryFn: () => api.get<LaunchDetailDto>(`/launches/${id}`),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: () => api.get<readonly CountryListItemDto[]>('/countries'),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useCountryDetail(code: string) {
  return useQuery({
    queryKey: ['country', code],
    queryFn: async () => {
      const [country, launches] = await Promise.all([
        api.get<CountryDetailDto>(`/countries/${code}`),
        api.get<{ fromSoil: readonly LaunchSummaryDto[]; withPayload: readonly LaunchSummaryDto[] }>(
          `/countries/${code}/launches`,
        ),
      ]);
      return { country, ...launches };
    },
    staleTime: CATALOG_STALE_MS,
  });
}

export function useDataQuality() {
  return useQuery({
    queryKey: ['data-quality'],
    queryFn: () => api.get<DataQualityDto>('/data-quality'),
    staleTime: CATALOG_STALE_MS,
  });
}

export function useFollowedLaunches(enabled: boolean) {
  return useQuery({
    queryKey: ['follows'],
    queryFn: () => api.get<readonly FollowedLaunchDto[]>('/follows'),
    enabled,
  });
}

export function useFollowedIds(enabled: boolean) {
  return useQuery({
    queryKey: ['follows', 'ids'],
    queryFn: () => api.get<readonly string[]>('/follows/ids'),
    enabled,
  });
}

/**
 * Actualización optimista: el botón responde al instante y sólo revierte si el
 * servidor rechaza. Seguir una misión es una acción de bajo riesgo y alta
 * frecuencia; esperar el ida y vuelta la haría sentir lenta sin ganar nada.
 */
export function useToggleFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ launchId, isFollowing }: { launchId: string; isFollowing: boolean }) =>
      isFollowing ? api.delete(`/follows/${launchId}`) : api.put(`/follows/${launchId}`),

    onMutate: async ({ launchId, isFollowing }) => {
      await queryClient.cancelQueries({ queryKey: ['follows', 'ids'] });
      const previous = queryClient.getQueryData<readonly string[]>(['follows', 'ids']) ?? [];

      queryClient.setQueryData<readonly string[]>(
        ['follows', 'ids'],
        isFollowing ? previous.filter((id) => id !== launchId) : [...previous, launchId],
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['follows', 'ids'], context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['follows'] });
    },
  });
}
