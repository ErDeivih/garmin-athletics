import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  ActivitySummary,
  AlertsResponse,
  CalendarResponse,
  DailyMetrics,
  ExerciseDetailResponse,
  ExerciseHistoryResponse,
  ExerciseList,
  GarminLinkResult,
  GarminStatus,
  LastMarksResponse,
  LeaderboardResponse,
  LoadResponse,
  PerformanceSummary,
  PersonalRecord,
  PlannedRoute,
  SessionDetail,
  SessionInput,
  SessionList,
  SyncResult,
  SyncStatus,
  TemplateList,
  TrendResponse,
  UserProfile,
  ZonesResponse,
} from './types';

/**
 * Claves de consulta en un solo sitio: invalidar «todo lo que depende de una
 * sincronización» es una sola llamada, no una lista de strings sueltos.
 */
export const queryKeys = {
  me: ['me'] as const,
  daily: ['metrics', 'daily'] as const,
  load: (days: number) => ['metrics', 'load', days] as const,
  alerts: ['alerts'] as const,
  sync: ['sync', 'status'] as const,
  garmin: ['garmin', 'status'] as const,
  templates: ['gym', 'templates'] as const,
  sessions: ['gym', 'sessions'] as const,
  session: (id: string) => ['gym', 'session', id] as const,
  lastMarks: (ids: string) => ['gym', 'last-marks', ids] as const,
  exerciseHistory: (id: string) => ['gym', 'exercise-history', id] as const,
  exercises: (search: string, muscle: string, equipment: string) =>
    ['gym', 'exercises', search, muscle, equipment] as const,
  activities: ['activities'] as const,
  routes: ['routes'] as const,
  leaderboard: ['social', 'leaderboard'] as const,
  trends: (metric: string, days: number) => ['metrics', 'trends', metric, days] as const,
  performance: ['performance', 'summary'] as const,
  zones: ['performance', 'zones'] as const,
  prs: ['performance', 'prs'] as const,
  calendar: ['calendar'] as const,
};

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<UserProfile>('/api/v1/auth/me'),
  });
}

export function useDailyMetrics() {
  return useQuery({
    queryKey: queryKeys.daily,
    queryFn: () => apiFetch<DailyMetrics>('/api/v1/metrics/daily'),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => apiFetch<AlertsResponse>('/api/v1/alerts/'),
  });
}

/** Serie ATL/CTL/TSB de los últimos días: la gráfica de carga del panel Hoy (T-03). */
export function useLoad(days = 30) {
  return useQuery({
    queryKey: queryKeys.load(days),
    queryFn: () => apiFetch<LoadResponse>(`/api/v1/metrics/load?days=${days}`),
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: queryKeys.sync,
    queryFn: () => apiFetch<SyncStatus>('/api/v1/sync/status'),
  });
}

export function useGarminStatus() {
  return useQuery({
    queryKey: queryKeys.garmin,
    queryFn: () => apiFetch<GarminStatus>('/api/v1/auth/garmin-status'),
  });
}

/** Borrado GDPR: el backend debe borrar también el gimnasio (T-22). */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiFetch<{ status: string }>('/api/v1/auth/account', { method: 'DELETE' }),
  });
}

export function useSyncNow() {  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<SyncResult>('/api/v1/sync/garmin', { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sync }),
        queryClient.invalidateQueries({ queryKey: queryKeys.daily }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
      ]);
    },
  });
}

export function useLinkGarmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { garmin_email: string; garmin_password: string }) =>
      apiFetch<GarminLinkResult>('/api/v1/auth/garmin-credentials', {
        method: 'PUT',
        body: payload,
        // Ver AuthContext/client: un 401 de Garmin no es una sesión caducada.
        session: 'external',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sync }),
        queryClient.invalidateQueries({ queryKey: queryKeys.garmin }),
      ]);
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: () => apiFetch<TemplateList>('/api/v1/strength/templates'),
  });
}

export function useSessions(limit = 5) {
  return useQuery({
    queryKey: [...queryKeys.sessions, limit],
    queryFn: () => apiFetch<SessionList>(`/api/v1/strength/sessions?limit=${limit}`),
  });
}

/** Detalle de una sesión guardada: series individuales incluidas (T-04/T-08). */
export function useSession(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.session(sessionId ?? ''),
    queryFn: () => apiFetch<SessionDetail>(`/api/v1/strength/sessions/${sessionId}`),
    enabled: sessionId !== null,
  });
}

/** Última marca por ejercicio: lo que T-04 precarga en la sesión. */
export function useLastMarks(exerciseIds: string[]) {
  const ids = [...new Set(exerciseIds)].filter(Boolean);
  return useQuery({
    queryKey: queryKeys.lastMarks(ids.join(',')),
    queryFn: () => apiFetch<LastMarksResponse>(`/api/v1/strength/last-marks?exercise_ids=${ids.join(',')}`),
    enabled: ids.length > 0,
  });
}

export function useExerciseHistory(exerciseId: string | null) {
  return useQuery({
    queryKey: queryKeys.exerciseHistory(exerciseId ?? ''),
    queryFn: () => apiFetch<ExerciseHistoryResponse>(`/api/v1/strength/exercises/${exerciseId}/history`),
    enabled: exerciseId !== null,
  });
}

export function useExerciseDetail(exerciseId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.exerciseHistory(exerciseId ?? ''), 'detail'],
    queryFn: () => apiFetch<ExerciseDetailResponse>(`/api/v1/strength/exercises/${exerciseId}`),
    enabled: exerciseId !== null,
  });
}

/** Terminar la sesión: el borrador vive en el navegador y se manda una vez (D-02). */
export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SessionInput) =>
      apiFetch<SessionDetail>('/api/v1/strength/sessions', { method: 'POST', body: payload }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.daily }),
        queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activities }),
      ]);
    },
  });
}

export function useExercises(search = '', muscle = '', equipment = '') {
  const params = new URLSearchParams();
  if (search.trim()) params.set('q', search.trim());
  if (muscle) params.set('muscle_group', muscle);
  if (equipment) params.set('equipment', equipment);
  const query = params.toString();
  return useQuery({
    queryKey: queryKeys.exercises(search, muscle, equipment),
    queryFn: () => apiFetch<ExerciseList>(`/api/v1/strength/exercises${query ? `?${query}` : ''}`),
  });
}

export function useActivities() {
  return useQuery({
    queryKey: queryKeys.activities,
    queryFn: () => apiFetch<ActivitySummary[]>('/api/v1/activities/?limit=20'),
  });
}

export function useRoutes() {
  return useQuery({
    queryKey: queryKeys.routes,
    queryFn: () => apiFetch<PlannedRoute[]>('/api/v1/routes/'),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: () => apiFetch<LeaderboardResponse>('/api/v1/social/leaderboard?days=7&order_by=weekly_tss'),
  });
}

export function useTrends(metric: string, days: number) {
  return useQuery({
    queryKey: queryKeys.trends(metric, days),
    queryFn: () => apiFetch<TrendResponse>(`/api/v1/metrics/trends?metric=${metric}&days=${days}`),
  });
}

export function usePerformanceSummary(sport = 'running') {
  return useQuery({
    queryKey: [...queryKeys.performance, sport],
    queryFn: () => apiFetch<PerformanceSummary>(`/api/v1/performance/summary?sport=${sport}&days=30`),
  });
}

export function useZones(sport = 'all') {
  return useQuery({
    queryKey: [...queryKeys.zones, sport],
    queryFn: () => apiFetch<ZonesResponse>(`/api/v1/performance/zones?sport=${sport}&days=30`),
  });
}

export function usePrs() {
  return useQuery({
    queryKey: queryKeys.prs,
    queryFn: () => apiFetch<PersonalRecord[]>('/api/v1/performance/prs'),
  });
}

export function useCalendar() {
  return useQuery({
    queryKey: queryKeys.calendar,
    queryFn: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      // Fecha local, no UTC: a las 00:30 en Madrid, toISOString() daría el día anterior.
      const localIso = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return apiFetch<CalendarResponse>(`/api/v1/calendar/?from=${localIso(from)}&to=${localIso(to)}`);
    },
  });
}
