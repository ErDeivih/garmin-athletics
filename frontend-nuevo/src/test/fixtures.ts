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

export const load = {
  start_date: '2026-10-06',
  end_date: '2026-11-04',
  total_days: 30,
  series: [
    { date: '2026-10-31', atl: 38, ctl: 44, tsb: -6, tss: 20 },
    { date: '2026-11-01', atl: 40, ctl: 45, tsb: -5, tss: 35 },
    { date: '2026-11-02', atl: 41, ctl: 45.5, tsb: -4.5, tss: 0 },
    { date: '2026-11-03', atl: 43, ctl: 46, tsb: -4, tss: 50 },
    { date: '2026-11-04', atl: 42, ctl: 46, tsb: -4, tss: 0 },
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
