import { useCallback, useEffect, useState } from "react";
import { Activity, Flame, Footprints, Gauge, Heart, Moon, RefreshCw, Waves, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState, LoadingBlock, Notice, ScoreRing, StatusBadge, fmtDate, fmtDuration, fmtHours, fmtKm } from "../components/ui/primitives";
import GarminLink from "../components/GarminLink";
import { api } from "../services/auth";

interface DailyData {
  date: string;
  biometrics_available: boolean;
  sleep: { score: number | null; seconds: number | null; hours: number | null; avg_7d: number | null;
           deep_seconds: number | null; light_seconds: number | null; rem_seconds: number | null;
           awake_seconds: number | null; efficiency: number | null; bedtime: string | null; wakeup: string | null };
  hrv: { overnight: number | null; weekly_avg: number | null; status: string; avg_7d: number | null };
  resting_hr: number | null;
  resting_hr_7d: number | null;
  body_battery: { max: number | null; min: number | null; wake: number | null; curve: [number, number][] | null };
  stress_avg: number | null;
  tsb: number;
  atl: number;
  ctl: number;
  readiness: { score: number; status: string; message: string };
}

interface StatusData {
  linked: boolean;
  garmin_email: string | null;
  needs_reauth: boolean;
  last_sync_at: string | null;
  activities_7d: number;
  tss_7d: number;
  scheduler_running: boolean;
}

function Spark({ data, color, height = 44 }: { data: { value: number | null }[]; color: string; height?: number }) {
  const clean = data.map((d, i) => ({ i, value: d.value }));
  if (clean.every((d) => d.value == null)) return <div style={{ height }} className="flex items-center text-xs text-gray-600">sin datos</div>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={clean} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.18} dot={false} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Delta({ value, avg, suffix = "", invert = false }: { value: number | null; avg: number | null; suffix?: string; invert?: boolean }) {
  if (value == null || avg == null) return null;
  const diff = value - avg;
  if (Math.abs(diff) < 0.05) return <span className="text-xs text-gray-500">≈ media 7d</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`text-xs font-semibold ${good ? "text-emerald-400" : "text-red-400"}`}>
      {diff > 0 ? "+" : ""}{diff.toFixed(1)}{suffix} vs 7d
    </span>
  );
}

export default function Dashboard({ onSync }: { onSync: () => void }) {
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [load, setLoad] = useState<any[]>([]);
  const [hrvTrend, setHrvTrend] = useState<{ value: number | null }[]>([]);
  const [sleepTrend, setSleepTrend] = useState<{ value: number | null }[]>([]);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [weekActs, setWeekActs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [stepsToday, setStepsToday] = useState<any>(null);
  const [gstatus, setGstatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l, h, s, st, acts, al, mv, gs] = await Promise.all([
        api.get("/metrics/daily").then((r) => r.data).catch(() => null),
        api.get("/metrics/load?days=30").then((r) => r.data.series ?? []).catch(() => []),
        api.get("/metrics/trends?metric=hrv&days=30").then((r) => r.data.series ?? []).catch(() => []),
        api.get("/metrics/trends?metric=sleep_score&days=30").then((r) => r.data.series ?? []).catch(() => []),
        api.get("/sync/status").then((r) => r.data).catch(() => null),
        api.get("/activities/?limit=60").then((r) => r.data).catch(() => []),
        api.get("/alerts/").then((r) => r.data.alerts ?? []).catch(() => []),
        api.get("/metrics/stats?days=1").then((r) => (r.data.series ?? []).slice(-1)[0] ?? null).catch(() => null),
        api.get("/metrics/training-status").then((r) => r.data).catch(() => null),
      ]);
      setDaily(d);
      setLoad(l);
      setHrvTrend(h);
      setSleepTrend(s);
      setStatus(st);
      setAlerts(al);
      setStepsToday(mv);
      setGstatus(gs);
      const weekAgo = Date.now() - 7 * 864e5;
      setWeekActs((acts as any[]).filter((a) => new Date(a.start_time).getTime() >= weekAgo));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const doSync = async () => {
    setSyncing(true);
    try {
      await api.post("/sync/garmin");
      setToast("Sincronización completada ✓");
      await fetchAll();
      onSync();
    } catch (e: any) {
      setToast(e?.response?.data?.detail ?? "Error sincronizando");
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}><CardContent className="pt-6"><LoadingBlock /></CardContent></Card>
        ))}
      </div>
    );
  }

  const weekKm = weekActs.reduce((s, a) => s + (a.distance_m ?? 0), 0);
  const weekMin = weekActs.reduce((s, a) => s + (a.duration_min ?? 0), 0);
  const weekTss = weekActs.reduce((s, a) => s + (a.tss ?? 0), 0);

  return (
    <div className="space-y-5 fade-in">
      {status?.needs_reauth && (
        <Notice tone="warn">
          Tu sesión de Garmin caducó. Desvincula y vuelve a vincular tu cuenta para seguir sincronizando.
        </Notice>
      )}
      {alerts.map((a, i) => (
        <Notice key={i} tone={a.severity === "high" ? "error" : a.severity === "warn" ? "warn" : "info"}>
          {a.message}
        </Notice>
      ))}
      {daily && !daily.biometrics_available && (
        <Notice tone="info">
          Aún no hay biometría para hoy. Pulsa <strong>Sincronizar</strong> para descargar sueño, HRV y Body Battery de Garmin.
        </Notice>
      )}

      {/* HERO readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {daily ? (
                <>
                  <ScoreRing score={daily.readiness.score} status={daily.readiness.status} />
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <StatusBadge status={daily.readiness.status} />
                      <span className="text-xs text-gray-500">{fmtDate(daily.date)}</span>
                    </div>
                    <h2 className="text-xl font-bold">Disposición fisiológica</h2>
                    <p className="text-sm text-gray-400 mt-1">{daily.readiness.message}</p>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-sm">
                      <span className="tnum"><span className="text-gray-500">Forma </span><strong className="text-blue-400">{daily.ctl.toFixed(0)}</strong></span>
                      <span className="tnum"><span className="text-gray-500">Fatiga </span><strong className="text-red-400">{daily.atl.toFixed(0)}</strong></span>
                      <span className="tnum"><span className="text-gray-500">Frescura </span><strong className={daily.tsb >= 0 ? "text-emerald-400" : "text-amber-400"}>{daily.tsb > 0 ? "+" : ""}{daily.tsb.toFixed(1)}</strong></span>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState title="Sin datos de readiness" hint="Sincroniza con Garmin para calcular tu disposición de hoy." />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Semana */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" /> Últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-white/5 py-3">
                <div className="tnum text-2xl font-black">{weekActs.length}</div>
                <div className="text-xs text-gray-500">sesiones</div>
              </div>
              <div className="rounded-lg bg-white/5 py-3">
                <div className="tnum text-2xl font-black">{weekTss.toFixed(0)}</div>
                <div className="text-xs text-gray-500">TSS</div>
              </div>
              <div className="rounded-lg bg-white/5 py-3">
                <div className="tnum text-2xl font-black">{(weekKm / 1000).toFixed(1)}</div>
                <div className="text-xs text-gray-500">km</div>
              </div>
              <div className="rounded-lg bg-white/5 py-3">
                <div className="tnum text-2xl font-black">{fmtDuration(weekMin)}</div>
                <div className="text-xs text-gray-500">tiempo</div>
              </div>
            </div>
            <button onClick={doSync} disabled={syncing} className="btn-primary w-full mt-4">
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar Garmin"}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><Footprints className="w-4 h-4 text-emerald-400" /> Movimiento hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tnum text-3xl font-black">{stepsToday?.steps?.toLocaleString("es-ES") ?? "—"}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {stepsToday?.step_goal ? `objetivo: ${stepsToday.step_goal.toLocaleString("es-ES")}` : "pasos"}
              {stepsToday?.calories_total != null && ` · ${Math.round(stepsToday.calories_total)} kcal`}
              {stepsToday?.intensity_minutes != null && ` · ${stepsToday.intensity_minutes} min int.`}
            </div>
            {stepsToday?.steps != null && stepsToday?.step_goal ? (
              <div className="h-2 rounded-full bg-white/5 overflow-hidden mt-2">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (stepsToday.steps / stepsToday.step_goal) * 100)}%` }} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><Gauge className="w-4 h-4 text-purple-400" /> Garmin dice</CardTitle>
          </CardHeader>
          <CardContent>
            {!gstatus?.available ? (
              <div>
                <div className="tnum text-3xl font-black text-gray-600">—</div>
                <div className="text-xs text-gray-500 mt-0.5">Sincroniza para traer el estado oficial (VO2max, forma, predicciones).</div>
              </div>
            ) : (
              <div>
                <div className="text-xl font-black">{gstatus.status_label ?? "—"}</div>
                <div className="text-xs text-gray-500 mt-0.5 tnum">
                  {gstatus.vo2max ? `VO2max ${gstatus.vo2max}` : ""}
                  {gstatus.device ? ` · ${gstatus.device}` : ""}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {gstatus.balance_label ?? ""}
                </div>
                {(gstatus.race?.p5k || gstatus.race?.p10k) && (
                  <div className="text-xs text-gray-400 mt-1 tnum">
                    Predice: {gstatus.race.p5k ? `5K ${Math.floor(gstatus.race.p5k / 60)}:${String(Math.floor(gstatus.race.p5k % 60)).padStart(2, "0")}` : ""}
                    {gstatus.race.p10k ? ` · 10K ${Math.floor(gstatus.race.p10k / 60)}:${String(Math.floor(gstatus.race.p10k % 60)).padStart(2, "0")}` : ""}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><Moon className="w-4 h-4 text-blue-400" /> Sueño</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tnum text-3xl font-black">{daily?.sleep.score ?? "—"}<span className="text-sm font-medium text-gray-500"> /100</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{daily?.sleep.seconds ? fmtHours(daily.sleep.seconds) + " dormido" : "sin registro"}</div>
            <div className="mt-1"><Delta value={daily?.sleep.score ?? null} avg={daily?.sleep.avg_7d ?? null} /></div>
            {daily?.sleep.deep_seconds != null && (
              <div className="mt-2">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5" title="Profundo / REM / Ligero / Despierto">
                  {[
                    [daily.sleep.deep_seconds, "#6366f1"],
                    [daily.sleep.rem_seconds, "#a78bfa"],
                    [daily.sleep.light_seconds, "#38bdf8"],
                    [daily.sleep.awake_seconds, "#475569"],
                  ].map(([v, c], i) => {
                    const tot = (daily.sleep.deep_seconds ?? 0) + (daily.sleep.rem_seconds ?? 0) + (daily.sleep.light_seconds ?? 0) + (daily.sleep.awake_seconds ?? 0);
                    return <div key={i} style={{ width: `${tot ? ((v as number) / tot) * 100 : 0}%`, background: c as string }} />;
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1 tnum">
                  <span>💤 {fmtHours(daily.sleep.deep_seconds)} profunda</span>
                  <span>REM {fmtHours(daily.sleep.rem_seconds)}</span>
                  {daily.sleep.efficiency != null && <span>{daily.sleep.efficiency}% ef.</span>}
                </div>
                {(daily.sleep.bedtime || daily.sleep.wakeup) && (
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {daily.sleep.bedtime ? new Date(daily.sleep.bedtime).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    {" → "}
                    {daily.sleep.wakeup ? new Date(daily.sleep.wakeup).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                )}
              </div>
            )}
            <div className="mt-2"><Spark data={sleepTrend} color="#60a5fa" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> HRV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tnum text-3xl font-black">{daily?.hrv.overnight ?? "—"}<span className="text-sm font-medium text-gray-500"> ms</span></div>
            <div className="text-xs text-gray-500 mt-0.5">
              {daily?.hrv.weekly_avg ? `media 7d: ${daily.hrv.weekly_avg} ms` : "sin registro"}
              {daily?.hrv.status && daily.hrv.status !== "unknown" && ` · ${daily.hrv.status === "low" ? "bajo" : daily.hrv.status === "high" ? "alto" : "normal"}`}
            </div>
            <div className="mt-1"><Delta value={daily?.hrv.overnight ?? null} avg={daily?.hrv.avg_7d ?? null} suffix=" ms" /></div>
            <div className="mt-2"><Spark data={hrvTrend} color="#34d399" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Body Battery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tnum text-3xl font-black">{daily?.body_battery.max ?? "—"}<span className="text-sm font-medium text-gray-500"> %</span></div>
            <div className="text-xs text-gray-500 mt-0.5">
              {daily?.body_battery.min != null ? `mínimo: ${daily.body_battery.min} %` : "sin registro"}
              {daily?.body_battery.wake != null && ` · al despertar: ${daily.body_battery.wake} %`}
              {daily?.stress_avg != null && ` · estrés ${daily.stress_avg}`}
            </div>
            {daily?.body_battery.curve?.length ? (
              <div className="mt-2 h-[68px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily.body_battery.curve.map(([t, v]) => ({ t, v }))} margin={{ top: 2, bottom: 0, left: -28, right: 0 }}>
                    <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} width={28} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: 8 }}
                      labelFormatter={(t: any) => new Date(+t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} />
                    <Area type="monotone" dataKey="v" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.25} strokeWidth={1.5} dot={false} name="Batería" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-2 h-[68px] flex items-end gap-1" aria-hidden>
                {[daily?.body_battery.min ?? 0, daily?.body_battery.max ?? 0].map((v, i) => (
                  <div key={i} className="flex-1 rounded bg-amber-400/70" style={{ height: `${Math.max(4, v)}%` }} />
                ))}
                <div className="flex-[6]" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2"><Heart className="w-4 h-4 text-red-400" /> FC reposo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="tnum text-3xl font-black">{daily?.resting_hr ?? "—"}<span className="text-sm font-medium text-gray-500"> bpm</span></div>
            <div className="text-xs text-gray-500 mt-0.5">{daily?.resting_hr_7d ? `media 7d: ${daily.resting_hr_7d} bpm` : "sin registro"}</div>
            <div className="mt-1"><Delta value={daily?.resting_hr ?? null} avg={daily?.resting_hr_7d ?? null} suffix=" bpm" invert /></div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <Waves className="w-4 h-4 text-sky-400" />
              {status?.last_sync_at ? `sync: ${new Date(status.last_sync_at).toLocaleString("es-ES")}` : "nunca sincronizado"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lyfta + conexión */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lyfta fisiológica <span className="text-xs font-normal text-gray-500">· modelo Banister 30d</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={load.length ? load : []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} labelFormatter={(d) => fmtDate(String(d ?? ""))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="atl" stroke="#ef4444" name="Fatiga (ATL)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ctl" stroke="#3b82f6" name="Forma (CTL)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tsb" stroke="#10b981" name="Frescura (TSB)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!load.length && <p className="text-xs text-gray-600 mt-2">Sin actividades con lyfta todavía — aparecerán al sincronizar.</p>}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <GarminLink onSynced={fetchAll} />
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas sesiones</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {weekActs.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{a.name ?? a.type}</div>
                    <div className="text-xs text-gray-500">{fmtDate(a.start_time)} · {fmtKm(a.distance_m)} · {fmtDuration(a.duration_min)}</div>
                  </div>
                  <span className="tnum text-xs font-bold text-blue-300 ml-2">{a.tss} TSS</span>
                </div>
              ))}
              {!weekActs.length && <p className="text-sm text-gray-500">Nada esta semana. Toca salir. 🏃</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      {toast && (
        <div className="toast-enter fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-slate-800 border border-cardborder text-sm shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
