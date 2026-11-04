/** Formas reales de la API (INVESTIGACION.md §4.2/§4.4), recortadas a lo que pinta el frontend. */

export const me = {
  id: 'u-1',
  email: 'atleta@example.com',
  username: 'atleta',
  display_name: 'David M.',
  created_at: '2026-09-01T10:00:00',
};

export const token = {
  access_token: 'test-token',
  token_type: 'bearer',
  user_id: 'u-1',
  username: 'atleta',
};

export const readiness = {
  score: 74,
  status: 'VERDE',
  message: 'Excelente disposición para entrenar.',
  components: { sleep_contribution: 28.7, hrv_contribution: 26.4, tsb_contribution: 18.8 },
};

export const daily = {
  date: '2026-11-04',
  biometrics_available: true,
  sleep: {
    score: 82,
    seconds: 26700,
    hours: 7.4,
    avg_7d: 7.1,
    deep_seconds: 5400,
    light_seconds: 17700,
    rem_seconds: 3600,
    awake_seconds: 900,
    time_in_bed_seconds: 27900,
    efficiency: 91,
    bedtime: '2026-11-03T23:12:00',
    wakeup: '2026-11-04T06:41:00',
  },
  hrv: { overnight: 61, weekly_avg: 58, status: 'normal', avg_7d: 59 },
  resting_hr: 46,
  resting_hr_7d: 47,
  body_battery: { max: 88, min: 22, wake: 71, curve: [[1, 30], [2, 44]] },
  stress_avg: 31,
  tsb: -4,
  atl: 42,
  ctl: 46,
  readiness,
};

export const dailyEmpty = {
  ...daily,
  biometrics_available: false,
  sleep: { ...daily.sleep, score: null, seconds: null, hours: null, efficiency: null },
  hrv: { overnight: null, weekly_avg: null, status: 'unknown', avg_7d: null },
  resting_hr: null,
  resting_hr_7d: null,
  body_battery: { max: null, min: null, wake: null, curve: null },
  stress_avg: null,
  readiness,
};

export const lastMarks = {
  marks: {
    'e-1': { date: '2026-10-30', weight_kg: 82.5, reps: 6, set_number: 1, rest_seconds: 150 },
  },
};

export const sessionDetail = {
  id: 's-new',
  name: 'Empuje A',
  template_id: 't-1',
  date: '2026-11-04',
  started_at: '2026-11-04T18:00:00',
  finished_at: '2026-11-04T19:00:00',
  duration_min: 60,
  status: 'done',
  notes: null,
  total_tonnage_kg: 660,
  computed_tss: 13,
  activity_id: 'a-new',
  sets_count: 1,
  exercises_count: 1,
  exercises: [
    {
      exercise: { id: 'e-1', name: 'Press de banca', slug: 'press-de-banca', muscle_group: 'pecho', equipment: 'barra', is_timed: false, is_unilateral: false },
      position: 0,
      tonnage_kg: 660,
      sets: [
        {
          id: 'set-new-1',
          exercise_id: 'e-1',
          set_number: 1,
          weight_kg: 82.5,
          reps: 8,
          rir: null,
          rpe: 8,
          is_warmup: false,
          set_type: 'normal',
          rest_seconds: 150,
          completed_at: '2026-11-04T18:05:00',
        },
      ],
    },
  ],
};

export const load = {
  start_date: '2026-10-06',
  end_date: '2026-11-04',
  total_days: 30,
  series: [
    { date: '2026-10-26', atl: 30, ctl: 40, tsb: -10, tss: 0 },
    { date: '2026-10-27', atl: 32, ctl: 41, tsb: -9, tss: 45 },
    { date: '2026-10-28', atl: 34, ctl: 42, tsb: -8, tss: 30 },
    { date: '2026-10-29', atl: 35, ctl: 42.5, tsb: -7.5, tss: 0 },
    { date: '2026-10-30', atl: 36, ctl: 43, tsb: -7, tss: 50 },
    { date: '2026-10-31', atl: 38, ctl: 44, tsb: -6, tss: 20 },
    { date: '2026-11-01', atl: 40, ctl: 45, tsb: -5, tss: 35 },
    { date: '2026-11-02', atl: 41, ctl: 45.5, tsb: -4.5, tss: 0 },
    { date: '2026-11-03', atl: 43, ctl: 46, tsb: -4, tss: 50 },
    { date: '2026-11-04', atl: 42, ctl: 46, tsb: -4, tss: 0 },
  ],
};

export const loadSummary = {
  days: 30,
  end_date: '2026-11-04',
  series: load.series,
  weeks: [
    { week_start: '2026-10-12', week_end: '2026-10-18', tss: 180, days_with_load: 4, complete: true, monotony: 1.8, strain: 324, note: null },
    { week_start: '2026-10-19', week_end: '2026-10-25', tss: 240, days_with_load: 5, complete: true, monotony: 2.1, strain: 504, note: null },
    { week_start: '2026-10-26', week_end: '2026-11-01', tss: 150, days_with_load: 3, complete: true, monotony: 1.4, strain: 210, note: null },
    { week_start: '2026-11-02', week_end: '2026-11-08', tss: 50, days_with_load: 1, complete: false, monotony: null, strain: null, note: 'semana en curso: sin monotonía ni tensión' },
  ],
  latest: { date: '2026-11-04', atl: 42, ctl: 46, tsb: -4, acwr: 0.91 },
  method: 'Monotonía = media(TSS 7 d)/SD(TSS 7 d); tensión = TSS semanal × monotonía (Foster, 1998).',
};

export const gymStats = {
  from: '2026-10-06',
  to: '2026-11-04',
  days: 30,
  totals: { sessions: 4, sets: 42, working_sets: 36, tonnage_kg: 18450, reps: 380, duration_min: 240 },
  by_muscle: [
    { muscle_group: 'pecho', label: 'Pecho', sets: 12, working_sets: 10, tonnage_kg: 6200, exercises: 2 },
    { muscle_group: 'espalda', label: 'Espalda', sets: 14, working_sets: 12, tonnage_kg: 7100, exercises: 3 },
    { muscle_group: 'biceps', label: 'Bíceps', sets: 8, working_sets: 8, tonnage_kg: 2150, exercises: 1 },
    { muscle_group: 'cuadriceps', label: 'Cuádriceps', sets: 8, working_sets: 6, tonnage_kg: 3000, exercises: 1 },
  ],
  by_week: [
    { week_start: '2026-10-19', sessions: 2, sets: 20, working_sets: 17, tonnage_kg: 9000 },
    { week_start: '2026-10-26', sessions: 2, sets: 22, working_sets: 19, tonnage_kg: 9450 },
  ],
  by_exercise: [
    { exercise_id: 'e-1', name: 'Press de banca', muscle_group: 'pecho', sets: 8, working_sets: 6, tonnage_kg: 4000, max_weight_kg: 85, estimated_1rm_kg: 102.0 },
    { exercise_id: 'e-2', name: 'Remo con barra', muscle_group: 'espalda', sets: 10, working_sets: 8, tonnage_kg: 5000, max_weight_kg: 70, estimated_1rm_kg: 88.0 },
  ],
  sets_sample: [
    { date: '2026-10-30', exercise: 'Press de banca', muscle_group: 'pecho', weight_kg: 80, reps: 8 },
    { date: '2026-10-30', exercise: 'Press de banca', muscle_group: 'pecho', weight_kg: 82.5, reps: 6 },
    { date: '2026-11-01', exercise: 'Remo con barra', muscle_group: 'espalda', weight_kg: 60, reps: 12 },
    { date: '2026-11-01', exercise: 'Remo con barra', muscle_group: 'espalda', weight_kg: 70, reps: 8 },
    { date: '2026-11-03', exercise: 'Curl de bíceps', muscle_group: 'biceps', weight_kg: 30, reps: 12 },
  ],
  previous: {
    from: '2026-09-06',
    to: '2026-10-05',
    sessions: 3,
    tonnage_kg: 15000,
    working_sets: 30,
  },
  push_pull: {
    push_tonnage_kg: 6200,
    pull_tonnage_kg: 9250,
    ratio: 0.67,
    classified_tonnage_kg: 15450,
    unclassified_tonnage_kg: 3000,
    note: 'Estimado por grupo muscular principal (pecho/hombro/tríceps frente a espalda/bíceps); piernas y core no entran en el ratio.',
  },
  e1rm_note: '1RM estimado con Epley sobre series de 1 a 12 repeticiones; no es una medición.',
};

export const gymStatsEmpty = {
  ...gymStats,
  totals: { sessions: 0, sets: 0, working_sets: 0, tonnage_kg: 0, reps: 0, duration_min: 0 },
  by_muscle: [],
  by_week: [],
  by_exercise: [],
  sets_sample: [],
  previous: { ...gymStats.previous, sessions: 0, tonnage_kg: 0, working_sets: 0 },
  push_pull: { ...gymStats.push_pull, push_tonnage_kg: 0, pull_tonnage_kg: 0, ratio: null, classified_tonnage_kg: 0, unclassified_tonnage_kg: 0 },
};

export const sleepPhases = {
  days: 30,
  series: [
    { date: '2026-11-01', deep_hours: 1.5, light_hours: 5.2, rem_hours: 1.1, awake_hours: 0.3, sleep_hours: 7.8, in_bed_hours: 8.1, sleep_score: 82, efficiency: 93 },
    { date: '2026-11-02', deep_hours: 1.2, light_hours: 5.6, rem_hours: 0.9, awake_hours: 0.4, sleep_hours: 7.7, in_bed_hours: 8.1, sleep_score: 78, efficiency: 91 },
    { date: '2026-11-03', deep_hours: 1.8, light_hours: 4.9, rem_hours: 1.3, awake_hours: 0.2, sleep_hours: 8.0, in_bed_hours: 8.2, sleep_score: 85, efficiency: 94 },
  ],
  note: 'Solo se devuelven noches con fases de sueño reales; el resto no se rellena.',
};

export const sleepPhasesEmpty = {
  days: 30,
  series: [],
  note: 'Solo se devuelven noches con fases de sueño reales; el resto no se rellena.',
};

export const loadSummaryEmpty = {
  ...loadSummary,
  weeks: [],
  latest: { date: '2026-11-04', atl: 0, ctl: 0, tsb: 0, acwr: null },
};

export const trendsEmpty = {
  metric: 'hrv',
  days: 30,
  series: [
    { date: '2026-10-29', value: null },
    { date: '2026-10-30', value: null },
  ],
};

export const loadEmpty = {
  start_date: '2026-10-06',
  end_date: '2026-11-04',
  total_days: 30,
  series: [
    { date: '2026-10-30', atl: 0, ctl: 0, tsb: 0, tss: 0 },
    { date: '2026-10-31', atl: 0, ctl: 0, tsb: 0, tss: 0 },
    { date: '2026-11-01', atl: 0, ctl: 0, tsb: 0, tss: 0 },
    { date: '2026-11-02', atl: 0, ctl: 0, tsb: 0, tss: 0 },
    { date: '2026-11-03', atl: 0, ctl: 0, tsb: 0, tss: 0 },
    { date: '2026-11-04', atl: 0, ctl: 0, tsb: 0, tss: 0 },
    { date: '2026-11-05', atl: 0, ctl: 0, tsb: 0, tss: 0 },
  ],
};

export const alerts = {
  date: '2026-11-04',
  count: 1,
  alerts: [
    { type: 'hrv_drop', severity: 'warn', message: 'Tu HRV ha bajado un 18 % respecto a la media de 7 días.' },
  ],
};

export const syncStatus = {
  linked: true,
  garmin_email: 'atleta@example.com',
  needs_reauth: false,
  last_sync_at: '2026-11-04T08:12:00',
  activities_7d: 3,
  tss_7d: 210,
  scheduler_running: true,
};

export const syncStatusUnlinked = {
  ...syncStatus,
  linked: false,
  garmin_email: null,
  last_sync_at: null,
  activities_7d: 0,
  tss_7d: 0,
};

export const templates = {
  total: 1,
  items: [
    {
      id: 't-1',
      name: 'Empuje A',
      weekday: 0,
      weekday_label: 'Lunes',
      focus: 'push',
      notes: null,
      exercises: [
        {
          id: 'te-1',
          position: 0,
          exercise: { id: 'e-1', name: 'Press de banca', slug: 'press-de-banca', muscle_group: 'pecho', equipment: 'barra', is_timed: false, is_unilateral: false },
          sets: 4,
          reps: 8,
          weight_kg: 80,
          rest_seconds: 150,
          notes: null,
        },
      ],
      total_sets: 4,
      estimated_tonnage_kg: 2560,
      created_at: '2026-10-01T10:00:00',
      updated_at: '2026-10-01T10:00:00',
    },
  ],
};

export const sessions = {
  total: 1,
  limit: 20,
  offset: 0,
  items: [
    {
      id: 's-1',
      name: 'Empuje A',
      template_id: 't-1',
      date: '2026-11-02',
      started_at: '2026-11-02T18:00:00',
      finished_at: '2026-11-02T19:07:00',
      duration_min: 67,
      total_tonnage_kg: 5120,
      computed_tss: 46,
      sets_count: 12,
      exercises_count: 3,
      notes: null,
    },
  ],
};

export const exercises = {
  total: 1,
  items: [
    {
      id: 'e-1',
      name: 'Press de banca',
      slug: 'press-de-banca',
      muscle_group: 'pecho',
      equipment: 'barra',
      is_timed: false,
      is_unilateral: false,
      secondary_muscles: ['triceps'],
      muscle_group_label: 'Pecho',
      equipment_label: 'Barra',
      notes: 'Codos a 45 grados.',
      source: 'seed',
      garmin_enum: 'bench_press',
      is_custom: false,
    },
  ],
  muscle_groups: [{ value: 'pecho', label: 'Pecho' }],
  equipment: [{ value: 'barra', label: 'Barra' }],
};

export const activities = [
  {
    id: 'a-1',
    source: 'garmin',
    type: 'running',
    name: 'Rodaje suave',
    start_time: '2026-11-03T07:30:00',
    duration_min: 42,
    distance_m: 8000,
    avg_hr: 142,
    max_hr: 158,
    gain_m: 60,
    has_track: true,
    tss: 55,
    rpe: 6,
  },
];

export const routes = [
  { id: 'r-1', name: 'Vuelta al pantano', sport: 'running', distance_m: 12400, gain_m: 180, points: 120, created_at: '2026-10-20T09:00:00' },
];

export const leaderboard = {
  period_days: 7,
  order_by: 'tss',
  ranking: [
    { athlete: { id: 'u-1', username: 'atleta', display_name: 'David M.' }, weekly_tss: 210, activity_count: 3, ctl: 46, tsb: -4, readiness_score: 74, readiness_status: 'VERDE' },
  ],
  note: 'Solo se comparten agregados.',
};

export const trends = {
  metric: 'hrv',
  days: 7,
  series: [
    { date: '2026-10-29', value: 58 },
    { date: '2026-10-30', value: 60 },
    { date: '2026-10-31', value: 57 },
    { date: '2026-11-01', value: 62 },
    { date: '2026-11-02', value: 59 },
    { date: '2026-11-03', value: 60 },
    { date: '2026-11-04', value: 61 },
  ],
};
