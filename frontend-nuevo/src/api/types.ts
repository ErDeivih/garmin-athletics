/**
 * Contrato de la API, escrito a mano y contrastado con las respuestas reales
 * (INVESTIGACION.md §4.2). El backend no declara `response_model` en casi
 * ninguna ruta: si un campo cambia, TypeScript no se entera. Por eso existe
 * `scripts/verify-api.mjs`, que comprueba las formas contra el backend de verdad.
 *
 * Regla: nada de `any` en datos de salud. Un campo puede faltar o ser null;
 * eso se representa con `| null`.
 */

// --- Autenticación y cuenta -------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  user_id: string;
  username: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name: string;
  created_at: string | null;
}

export interface WatchAccountStatus {
  linked: boolean;
  garmin_email?: string | null;
  needs_reauth?: boolean;
  last_sync_at?: string | null;
}

export interface WatchLinkResult {
  status: 'saved' | 'need_mfa';
  garmin_email?: string;
  ticket?: Record<string, unknown>;
  message?: string;
}

// --- Sincronización ---------------------------------------------------------

export interface SyncStatus {
  linked: boolean;
  garmin_email: string | null;
  needs_reauth: boolean;
  last_sync_at: string | null;
  activities_7d: number;
  tss_7d: number;
  scheduler_running: boolean;
}

export interface SyncResult {
  status: string;
  message: string;
}

// --- Métricas del panel -----------------------------------------------------

export type ReadinessStatus = 'VERDE' | 'AMARILLO' | 'ROJO';

export interface ReadinessComponents {
  sleep_contribution: number;
  hrv_contribution: number;
  tsb_contribution: number;
}

export interface Readiness {
  score: number;
  status: ReadinessStatus;
  message: string;
  components: ReadinessComponents;
}

export interface SleepMetrics {
  score: number | null;
  seconds: number | null;
  hours: number | null;
  avg_7d: number | null;
  deep_seconds: number | null;
  light_seconds: number | null;
  rem_seconds: number | null;
  awake_seconds: number | null;
  time_in_bed_seconds: number | null;
  efficiency: number | null;
  bedtime: string | null;
  wakeup: string | null;
}

export interface HrvMetrics {
  overnight: number | null;
  weekly_avg: number | null;
  status: string;
  avg_7d: number | null;
}

export interface BodyBattery {
  max: number | null;
  min: number | null;
  wake: number | null;
  curve: [number, number][] | null;
}

export interface DailyMetrics {
  date: string;
  biometrics_available: boolean;
  sleep: SleepMetrics;
  hrv: HrvMetrics;
  resting_hr: number | null;
  resting_hr_7d: number | null;
  body_battery: BodyBattery;
  stress_avg: number | null;
  tsb: number;
  atl: number;
  ctl: number;
  readiness: Readiness;
}

export type AlertSeverity = 'info' | 'warn' | 'high';

export interface AppAlert {
  type: string;
  severity: AlertSeverity;
  message: string;
}

export interface AlertsResponse {
  date: string;
  count: number;
  alerts: AppAlert[];
}

export interface TrendPoint {
  date: string;
  value: number | null;
}

export interface TrendResponse {
  metric: string;
  days: number;
  series: TrendPoint[];
}

export interface LoadPoint {
  date: string;
  atl: number;
  ctl: number;
  tsb: number;
  tss: number;
}

export interface LoadResponse {
  start_date: string;
  end_date: string;
  total_days: number;
  series: LoadPoint[];
}

export interface LoadWeek {
  week_start: string;
  week_end: string;
  tss: number;
  days_with_load: number;
  complete: boolean;
  monotony: number | null;
  strain: number | null;
  note: string | null;
}

export interface LoadSummaryResponse {
  days: number;
  end_date: string;
  series: LoadPoint[];
  weeks: LoadWeek[];
  latest: {
    date: string | null;
    atl: number | null;
    ctl: number | null;
    tsb: number | null;
    acwr: number | null;
  };
  method: string;
}

export interface GymStatsMuscle {
  muscle_group: string;
  label: string;
  sets: number;
  working_sets: number;
  tonnage_kg: number;
  exercises: number;
}

export interface GymStatsWeek {
  week_start: string;
  sessions: number;
  sets: number;
  working_sets: number;
  tonnage_kg: number;
}

export interface GymStatsExercise {
  exercise_id: string;
  name: string;
  muscle_group: string;
  sets: number;
  working_sets: number;
  tonnage_kg: number;
  max_weight_kg: number;
  estimated_1rm_kg: number | null;
}

export interface GymStatsResponse {
  from: string;
  to: string;
  days: number;
  totals: {
    sessions: number;
    sets: number;
    working_sets: number;
    tonnage_kg: number;
    reps: number;
    duration_min: number;
  };
  by_muscle: GymStatsMuscle[];
  by_week: GymStatsWeek[];
  by_exercise: GymStatsExercise[];
  sets_sample: {
    date: string | null;
    exercise: string;
    muscle_group: string;
    weight_kg: number;
    reps: number;
  }[];
  previous: {
    from: string;
    to: string;
    sessions: number;
    tonnage_kg: number;
    working_sets: number;
  };
  push_pull: {
    push_tonnage_kg: number;
    pull_tonnage_kg: number;
    ratio: number | null;
    classified_tonnage_kg: number;
    unclassified_tonnage_kg: number;
    note: string;
  };
  e1rm_note: string;
}

export interface SleepPhasePoint {
  date: string;
  deep_hours: number | null;
  light_hours: number | null;
  rem_hours: number | null;
  awake_hours: number | null;
  sleep_hours: number | null;
  in_bed_hours: number | null;
  sleep_score: number | null;
  efficiency: number | null;
}

export interface SleepPhasesResponse {
  days: number;
  series: SleepPhasePoint[];
  note: string;
}

export interface PushWorkoutPreview {
  status: 'dry_run';
  unmapped_exercises: string[];
  workout_json: {
    workoutName: string;
    sportType: { sportTypeId: number; sportTypeKey: string };
    estimatedDurationInSecs: number;
    workoutSegments: {
      segmentOrder: number;
      workoutSteps: {
        type: string;
        numberOfIterations?: number;
        workoutSteps?: { type: string; endConditionValue?: number; weightValue?: number }[];
      }[];
    }[];
  };
  builder: string;
  garmin_catalog_exercises: number;
  blocks: number;
  estimated_seconds: number;
  push_to_device: boolean;
  mapping: { name: string; enum: string; category: string; exercise: string }[];
  note: string;
}

export interface PushWorkoutSent {
  status: 'sent';
  unmapped_exercises: string[];
  garmin_response: Record<string, unknown>;
  pushed_to_device: unknown;
  note: string;
}

// --- Gimnasio ---------------------------------------------------------------

export interface ExerciseBrief {
  id: string;
  name: string;
  slug: string;
  muscle_group: string;
  equipment: string;
  is_timed: boolean;
  is_unilateral: boolean;
}

export interface Exercise extends ExerciseBrief {
  secondary_muscles: string[];
  muscle_group_label: string;
  equipment_label: string;
  notes: string | null;
  source: string;
  garmin_enum: string | null;
  is_custom: boolean;
}

export interface ExerciseList {
  total: number;
  items: Exercise[];
  muscle_groups: { value: string; label: string }[];
  equipment: { value: string; label: string }[];
}

export interface TemplateExercise {
  id: string;
  position: number;
  exercise: ExerciseBrief | null;
  sets: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
  notes: string | null;
  set_targets: { set_number: number; reps: number; weight_kg: number }[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  weekday: number | null;
  weekday_label: string | null;
  focus: string | null;
  notes: string | null;
  exercises: TemplateExercise[];
  total_sets: number;
  estimated_tonnage_kg: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface TemplateList {
  total: number;
  items: WorkoutTemplate[];
}

/** Serie con mejor peso×reps de una semana (o del periodo). */
export interface ProgressBestSet {
  weight_kg: number;
  reps: number;
  tonnage_kg: number;
}

export interface ProgressWeek {
  week_start: string;
  tonnage_kg: number;
  sets: number;
  sessions: number;
  best_set: ProgressBestSet | null;
}

export interface ProgressExerciseOption {
  id: string;
  name: string;
  tonnage_kg: number;
}

export interface ProgressResponse {
  exercise: { id: string; name: string; muscle_group: string | null } | null;
  weeks: ProgressWeek[];
  totals: { tonnage_kg: number; sets: number; best_set: ProgressBestSet | null };
  exercises: ProgressExerciseOption[];
}

/** Historial exportable: una fila por serie con su contexto de sesión. */
export interface HistoryExportSet {
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  set_type: string;
  rest_seconds: number | null;
  completed_at: string | null;
}

export interface HistoryExportExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  sets: HistoryExportSet[];
}

export interface HistoryExportSession {
  id: string;
  name: string;
  date: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_min: number | null;
  total_tonnage_kg: number;
  template_id: string | null;
  sets_count: number;
  exercises_count: number;
  exercises: HistoryExportExercise[];
}

export interface HistoryExportResponse {
  exported_at: string;
  sessions: HistoryExportSession[];
}

export interface SessionSummary {
  id: string;
  name: string;
  template_id: string | null;
  date: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_min: number | null;
  total_tonnage_kg: number;
  computed_tss: number;
  sets_count: number;
  exercises_count: number;
  notes: string | null;
}

export interface SessionList {
  total: number;
  limit: number;
  offset: number;
  items: SessionSummary[];
}

/** Las series tal y como las devuelve una sesión guardada. */
export interface SessionSet {
  id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  is_warmup: boolean;
  set_type: 'normal' | 'warmup' | 'drop' | 'failure';
  rest_seconds: number | null;
  completed_at: string | null;
  needs_review?: boolean;
  /** Objetivo del plan para esa serie; `null` si la sesión no viene de plantilla. */
  planned_weight_kg?: number | null;
  planned_reps?: number | null;
}

export interface SessionExercise {
  exercise: ExerciseBrief | null;
  position: number;
  sets: SessionSet[];
  tonnage_kg: number;
}

export interface SessionDetail extends Omit<SessionSummary, 'duration_min' | 'sets_count' | 'exercises_count'> {
  duration_min: number | null;
  status: string;
  activity_id: string | null;
  sets_count: number;
  exercises_count: number;
  exercises: SessionExercise[];
}

/** Cuerpo de POST/PUT /strength/sessions (el que usará T-04 al terminar). */
export interface SessionSetInput {
  exercise_id: string;
  set_number?: number;
  weight_kg: number;
  reps: number;
  rir?: number | null;
  rpe?: number | null;
  is_warmup?: boolean;
  set_type?: 'normal' | 'warmup' | 'drop' | 'failure';
  rest_seconds?: number | null;
  completed_at?: string | null;
  needs_review?: boolean;
}

export interface SessionInput {
  name?: string;
  template_id?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  notes?: string | null;
  sets: SessionSetInput[];
}

export interface LastMark {
  date: string | null;
  weight_kg: number;
  reps: number;
  set_number: number;
  rest_seconds: number | null;
}

export interface LastMarksResponse {
  marks: Record<string, LastMark>;
}

export interface ExerciseDetailResponse {
  exercise: Exercise;
  last: { date: string | null; weight_kg: number; reps: number; set_number: number } | null;
  pr: { date: string | null; weight_kg: number; reps: number } | null;
  sessions_count: number;
}

export interface ExerciseHistoryResponse {
  exercise: Exercise;
  pr: { weight_kg: number; reps: number; date: string | null } | null;
  sessions: {
    session_id: string;
    session_name: string;
    date: string | null;
    sets: SessionSet[];
    best_set: { weight_kg: number; reps: number };
    tonnage_kg: number;
  }[];
  series: { date: string | null; max_weight_kg: number; best_reps: number; tonnage_kg: number }[];
}

// --- Actividades, rutas, social, rendimiento, calendario --------------------

export interface ActivitySummary {
  id: string;
  source: string;
  type: string;
  name: string;
  start_time: string;
  duration_min: number;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  gain_m: number | null;
  has_track: boolean;
  tss: number | null;
  rpe: number | null;
}

export interface ActivityHrZone {
  zone?: number;
  secs?: number;
  seconds?: number;
  low?: number;
  label?: string;
}

export interface ActivityLap {
  n: number;
  distance_m: number;
  duration_s: number;
  pace: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  gain_m: number | null;
  loss_m: number | null;
  calories: number | null;
  avg_speed: number;
}

export interface MotionProfileResponse {
  configured: boolean;
  id?: string;
  version?: number;
  status?: string | null;
  profile?: Record<string, unknown> | null;
  calibration?: Record<string, unknown> | null;
  source?: string;
  hint?: string;
}

export interface MotionProfileSaveResult {
  status: string;
  id: string;
  version: number;
  profile_status: string;
}

export interface ActivityDetail extends ActivitySummary {
  avg_cadence: number | null;
  avg_power: number | null;
  avg_speed_kmh: number | null;
  calories: number | null;
  loss_m: number | null;
  min_alt: number | null;
  max_alt: number | null;
  bbox: [number, number, number, number] | null;
  hr_zones: ActivityHrZone[] | null;
  weather: Record<string, unknown> | null;
  laps: ActivityLap[];
  stride_length_m?: number | null;
  elevation_per_stride_m?: number | null;
  vertical_oscillation_cm?: number | null;
  ground_contact_ms?: number | null;
  temperature_avg_c?: number | null;
  sweat_loss_ml?: number | null;
}

export interface ActivityStreams {
  activity_id: string;
  count: number;
  t_s: number[];
  dist_m: number[];
  ele: (number | null)[];
  speed_ms: (number | null)[];
  hr: (number | null)[];
  pace_sec_km: (number | null)[];
  cadence?: (number | null)[];
  power?: (number | null)[];
  temp?: (number | null)[];
  vert_osc?: (number | null)[];
  ground_contact?: (number | null)[];
  stride?: (number | null)[];
  respiration?: (number | null)[];
  sweat?: (number | null)[];
}

export interface ActivitySplit {
  km: number;
  duration_s: number;
  pace: string | null;
  hr_avg: number | null;
  gain_m: number;
}

export interface ActivitySplitsResponse {
  activity_id: string;
  splits: ActivitySplit[];
}

export interface ActivityTrack {
  activity_id: string;
  point_count: number;
  distance_m: number;
  gain_m: number;
  loss_m: number;
  bbox: [number, number, number, number] | null;
  points: {
    lat: number[];
    lon: number[];
    ele?: (number | null)[];
    hr?: (number | null)[];
  };
}

export interface PlannedRoute {
  id: string;
  name: string;
  sport: string;
  distance_m: number;
  gain_m: number | null;
  points: number;
  created_at: string;
}

export interface RoutePoint {
  lat: number;
  lon: number;
  ele?: number | null;
}

export interface RouteSplit {
  km: number;
  distance_m: number;
  gain_m: number;
  pace: string | null;
  speed_kmh: number;
  duration_s: number;
}

export interface RouteDetail extends PlannedRoute {
  lat: number[];
  lon: number[];
  ele: (number | null)[];
  splits?: RouteSplit[];
  checkpoints?: RoutePoint[];
  effort?: string;
  loss_m?: number;
  estimated_duration_s?: number;
}

export interface LeaderboardEntry {
  athlete: { id: string; username: string; display_name: string | null };
  weekly_tss: number;
  activity_count: number;
  ctl: number;
  tsb: number;
  readiness_score: number | null;
  readiness_status: string | null;
}

export interface LeaderboardResponse {
  period_days: number;
  order_by: string;
  ranking: LeaderboardEntry[];
  note: string;
}

export interface PerformanceSummary {
  sport: string;
  days: number;
  current: {
    sessions: number;
    hours: number;
    km: number;
    tss: number;
    gain_m: number;
    avg_hr: number | null;
  };
  previous: {
    sessions: number;
    hours: number;
    km: number;
    tss: number;
    gain_m: number;
    avg_hr: number | null;
  };
  best_effort: { value: number; activity_id: string } | null;
}

export interface ZonesResponse {
  sport: string;
  days: number;
  total_secs: number;
  zones: { zone: number; secs: number; pct: number }[];
}

export interface PersonalRecord {
  sport?: string;
  label: string;
  value: number;
  unit: string;
  display: string;
  activity_id?: string;
  achieved_at?: string;
}

export interface CalendarActivity {
  id: string;
  name: string;
  type: string;
  start: string;
  duration_min: number;
  tss: number | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  start: string;
  duration_min: number | null;
  weekday: number | null;
  template_id: string | null;
  is_immovable: boolean;
  notes: string | null;
  recurring?: boolean;
  recurrence_until?: string | null;
}

export interface CalendarDay {
  date: string;
  events: CalendarEvent[];
  activities: CalendarActivity[];
  readiness: { score: number | null; status: string | null } | null;
}

export interface CalendarResponse {
  from: string;
  to: string;
  days: CalendarDay[];
}

// --- Paginación -------------------------------------------------------------

export interface Paginated<T> {
  total: number;
  items: T[];
}
