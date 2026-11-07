import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type {
  ActivityDetail,
  ActivitySplitsResponse,
  ActivityStreams,
  ActivitySummary,
  ActivityTrack,
  AlertsResponse,
  CalendarResponse,
  DailyMetrics,
  ExerciseDetailResponse,
  ExerciseHistoryResponse,
  ExerciseList,
  GymStatsResponse,
  LastMarksResponse,
  LeaderboardResponse,
  LoadResponse,
  LoadSummaryResponse,
  MotionProfileResponse,
  MotionProfileSaveResult,
  PerformanceSummary,
  PersonalRecord,
  PlannedRoute,
  RouteDetail,
  RoutePoint,
  PushWorkoutPreview,
  PushWorkoutSent,
  SessionDetail,
  SessionInput,
  SessionList,
  SleepPhasesResponse,
  SyncResult,
  SyncStatus,
  TemplateList,
  TrendResponse,
  UserProfile,
  WorkoutTemplate,
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
  loadSummary: (days: number) => ['metrics', 'load-summary', days] as const,
  sleepPhases: (days: number) => ['metrics', 'sleep-phases', days] as const,
  gymStats: (days: number) => ['gym', 'stats', days] as const,
  alerts: ['alerts'] as const,
  sync: ['sync', 'status'] as const,
  watchAccount: ['watch', 'account'] as const,
  templates: ['gym', 'templates'] as const,
  sessions: ['gym', 'sessions'] as const,
  session: (id: string) => ['gym', 'session', id] as const,
  lastMarks: (ids: string) => ['gym', 'last-marks', ids] as const,
  exerciseHistory: (id: string) => ['gym', 'exercise-history', id] as const,
  exercises: (search: string, muscle: string, equipment: string) =>
    ['gym', 'exercises', search, muscle, equipment] as const,
  activities: ['activities'] as const,
  activity: (id: string) => ['activities', id] as const,
  activityStreams: (id: string) => ['activities', id, 'streams'] as const,
  activitySplits: (id: string) => ['activities', id, 'splits'] as const,
  activityTrack: (id: string) => ['activities', id, 'track'] as const,
  motionProfile: (exerciseId: string) => ['gym', 'motion-profile', exerciseId] as const,
  routes: ['routes'] as const,
  route: (id: string) => ['routes', id] as const,
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

/** Semanas, monotonía/tensión (Foster) y ACWR: agregados de carga del servidor (T-26). */
export function useLoadSummary(days = 30) {
  return useQuery({
    queryKey: queryKeys.loadSummary(days),
    queryFn: () => apiFetch<LoadSummaryResponse>(`/api/v1/metrics/load-summary?days=${days}`),
  });
}

/** Volumen, series por músculo, empuje/tirón y 1RM estimado (T-26). */
/** Fases de sueño por noche: solo noches con dato real (T-27). */
export function useSleepPhases(days = 30) {
  return useQuery({
    queryKey: queryKeys.sleepPhases(days),
    queryFn: () => apiFetch<SleepPhasesResponse>(`/api/v1/metrics/sleep-phases?days=${days}`),
  });
}

export function useGymStats(days = 90) {
  return useQuery({
    queryKey: queryKeys.gymStats(days),
    queryFn: () => apiFetch<GymStatsResponse>(`/api/v1/strength/stats?days=${days}`),
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: queryKeys.sync,
    queryFn: () => apiFetch<SyncStatus>('/api/v1/sync/status'),
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

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: () => apiFetch<TemplateList>('/api/v1/strength/templates'),
  });
}

export function useTemplate(templateId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.templates, templateId ?? ''],
    queryFn: () => apiFetch<WorkoutTemplate>(`/api/v1/strength/templates/${templateId}`),
    enabled: templateId !== null,
  });
}

export function useUpdateTemplate(templateId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      weekday: number | null;
      focus: string | null;
      notes: string | null;
      exercises: {
        exercise_id: string;
        sets: number;
        reps: number;
        weight_kg: number;
        rest_seconds: number;
        set_targets: { set_number: number; reps: number; weight_kg: number }[];
      }[];
    }) => apiFetch<WorkoutTemplate>(`/api/v1/strength/templates/${templateId}`, {
      method: 'PUT',
      body: payload,
    }),
    onSuccess: (data) => {
      queryClient.setQueryData([...queryKeys.templates, data.id], data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates });
    },
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

export function useUpdateSession(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SessionInput) =>
      apiFetch<SessionDetail>(`/api/v1/strength/sessions/${sessionId}`, {
        method: 'PUT',
        body: payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId ?? '') });
    },
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
/** Previsualiza o envía una plantilla al reloj de Garmin (T-31). */
export function usePushWorkout() {
  return useMutation({
    mutationFn: (input: {
      routineName: string;
      exercises: { name: string; sets: number; reps: number; weight_kg: number; rest_seconds: number; set_targets?: { set_number: number; reps: number; weight_kg: number }[] }[];
      dryRun: boolean;
      pushToDevice?: boolean;
    }) =>
      apiFetch<PushWorkoutPreview | PushWorkoutSent>('/api/v1/strength/push-to-garmin', {
        method: 'POST',
        body: {
          routine_name: input.routineName,
          exercises: input.exercises,
          dry_run: input.dryRun,
          push_to_device: input.pushToDevice ?? true,
        },
      }),
  });
}

export function useMotionProfile(exerciseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.motionProfile(exerciseId ?? ''),
    queryFn: () => apiFetch<MotionProfileResponse>(`/api/v1/strength/exercises/${exerciseId}/motion-profile`),
    enabled: Boolean(exerciseId),
  });
}

export function useSaveMotionProfile(exerciseId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { profile: Record<string, unknown>; status: 'draft' | 'active' | 'retired'; calibration?: Record<string, unknown> }) =>
      apiFetch<MotionProfileSaveResult>(`/api/v1/strength/exercises/${exerciseId}/motion-profile`, {
        method: 'PUT',
        body: payload,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.motionProfile(exerciseId ?? '') }),
  });
}

export function useDeactivateMotionProfile(exerciseId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; count: number }>(
        `/api/v1/strength/exercises/${exerciseId}/motion-profile/active`,
        { method: 'DELETE' },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.motionProfile(exerciseId ?? '') }),
  });
}

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

export function useActivities(filters: { sport?: string; q?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(filters.limit ?? 50));
  if (filters.sport && filters.sport !== 'all') params.set('sport', filters.sport);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  return useQuery({
    queryKey: [...queryKeys.activities, filters.sport ?? 'all', filters.q ?? '', filters.limit ?? 50],
    queryFn: () => apiFetch<ActivitySummary[]>(`/api/v1/activities/?${params.toString()}`),
  });
}

export function useActivityDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.activity(id ?? ''),
    queryFn: () => apiFetch<ActivityDetail>(`/api/v1/activities/${id}`),
    enabled: Boolean(id),
  });
}

export function useActivityStreams(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.activityStreams(id ?? ''),
    queryFn: () => apiFetch<ActivityStreams>(`/api/v1/activities/${id}/streams?max_points=500`),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useActivitySplits(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.activitySplits(id ?? ''),
    queryFn: () => apiFetch<ActivitySplitsResponse>(`/api/v1/activities/${id}/splits`),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useActivityTrack(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.activityTrack(id ?? ''),
    queryFn: () => apiFetch<ActivityTrack>(`/api/v1/activities/${id}/track?max_points=400`),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useRoutes() {
  return useQuery({
    queryKey: queryKeys.routes,
    queryFn: () => apiFetch<PlannedRoute[]>('/api/v1/routes/'),
  });
}

export type GeneratedRoute = RouteDetail;

export function useRoute(routeId: string | null) {
  return useQuery({
    queryKey: queryKeys.route(routeId ?? ''),
    queryFn: () => apiFetch<RouteDetail>(`/api/v1/routes/${routeId}`),
    enabled: Boolean(routeId),
  });
}

export function useGenerateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      sport: string;
      start: RoutePoint;
      checkpoints: RoutePoint[];
      distance_km: number;
      effort: string;
      loop: boolean;
    }) => apiFetch<GeneratedRoute>('/api/v1/routes/generate', { method: 'POST', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.routes }),
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

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      event_type: string;
      start_local: string;
      duration_min: number;
      weekday: number | null;
      template_id: string;
      recurrence_until?: string | null;
    }) =>
      apiFetch<{ status: string; id: string }>('/api/v1/calendar/events', {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.calendar }),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; fromDate?: string }) => {
      const query = input.fromDate ? `?from=${input.fromDate}` : '';
      return apiFetch<{ status: string }>(`/api/v1/calendar/events/${input.id}${query}`, { method: 'DELETE' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.calendar }),
  });
}

export function usePreviewEventWorkout() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{
        status: string;
        blocks: number;
        estimated_seconds: number;
        unmapped_exercises: string[];
        target_date: string;
      }>(`/api/v1/calendar/events/${id}/preview`, { method: 'POST' }),
  });
}

export function useSendEventWorkout() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ status: string; target_date: string }>(
        `/api/v1/calendar/events/${id}/send`,
        { method: 'POST' },
      ),
  });
}

export function useSyncTodayWorkouts() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; sent: number; message?: string }>(
        '/api/v1/calendar/sync-today',
        { method: 'POST' },
      ),
  });
}

export function useSyncUpcomingWorkouts() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; sent: number; message?: string }>(
        '/api/v1/calendar/sync-upcoming?days=7',
        { method: 'POST' },
      ),
    onSuccess: () => undefined,
  });
}

export function useCalendar() {  return useQuery({
    queryKey: queryKeys.calendar,
    queryFn: () => {
      const to = new Date();
      const from = new Date();
      to.setDate(to.getDate() + 13);
      // Fecha local, no UTC: a las 00:30 en Madrid, toISOString() daría el día anterior.
      const localIso = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return apiFetch<CalendarResponse>(`/api/v1/calendar/?from=${localIso(from)}&to=${localIso(to)}`);
    },
  });
}
