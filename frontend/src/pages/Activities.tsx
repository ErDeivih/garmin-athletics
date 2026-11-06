import { useEffect, useMemo, useState } from "react";
import { Bike, Dumbbell, Footprints, MapPin, Search, Trophy, Waves, HelpCircle } from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { EmptyState, LoadingBlock, fmtDate, fmtDuration, fmtKm, fmtPace } from "../components/ui/primitives";
import ActivityDetail from "../components/ActivityDetail";
import { api } from "../services/auth";
import { cn } from "../components/ui/Card";

interface Act {
  id: string;
  source: string;
  type: string;
  name: string | null;
  start_time: string;
  duration_min: number;
  tss: number;
  rpe: number | null;
  distance_m?: number;
  avg_hr?: number | null;
  has_track?: boolean;
}

const SPORTS = [
  { key: "all", label: "Todo" },
  { key: "running", label: "Carrera" },
  { key: "cycling", label: "Bici" },
  { key: "swimming", label: "Natación" },
  { key: "soccer", label: "Fútbol" },
  { key: "strength", label: "Fuerza" },
];

function sportMeta(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("run") || t.includes("trail") || t.includes("treadmill"))
    return { label: "Carrera", icon: Footprints, cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
  if (t.includes("cycl") || t.includes("bik") || t.includes("mtb"))
    return { label: "Ciclismo", icon: Bike, cls: "text-sky-300 bg-sky-500/10 border-sky-500/30" };
  if (t.includes("swim"))
    return { label: "Natación", icon: Waves, cls: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30" };
  if (t.includes("soccer") || t.includes("futbol") || t.includes("fútbol"))
    return { label: "Fútbol", icon: Trophy, cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
  if (t.includes("strength") || t.includes("gym"))
    return { label: "Fuerza", icon: Dumbbell, cls: "text-purple-300 bg-purple-500/10 border-purple-500/30" };
  return { label: type || "Otro", icon: HelpCircle, cls: "text-gray-300 bg-white/5 border-cardborder" };
}

export default function Activities() {
  const [acts, setActs] = useState<Act[]>([]);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState("all");
  const [q, setQ] = useState("");
  const [debQ, setDebQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showGpsOnly, setShowGpsOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(0); }, [sport, debQ, from, to]);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
    if (sport !== "all") p.set("sport", sport);
    if (debQ) p.set("q", debQ);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    api.get(`/activities/?${p.toString()}`)
      .then((r) => {
        let items = r.data;
        if (showGpsOnly && Array.isArray(items)) items = items.filter((a: Act) => a.has_track);
        setActs(items);
        setTotal(+r.headers["x-total-count"] || items.length);
      })
      .catch(() => { setActs([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [sport, debQ, from, to, page, showGpsOnly]);

  const filtered = useMemo(() => acts, [acts]);

  if (loading) {
    return <Card><CardContent className="pt-6"><LoadingBlock lines={6} /></CardContent></Card>;
  }

  if (selected) {
    return <ActivityDetail id={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSport(s.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                sport === s.key
                  ? "bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/50 text-white"
                  : "bg-white/5 border-cardborder text-gray-400 hover:text-white"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar sesión..." className="field pl-9" />
        </div>
        <button onClick={() => setShowGpsOnly((v) => !v)} title="Solo con mapa GPS"
          className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1.5",
            showGpsOnly ? "border-emerald-500/60 text-emerald-200 bg-emerald-500/15" : "border-cardborder text-gray-500 hover:text-white")}>
          <MapPin className="w-3.5 h-3.5" /> GPS
        </button>
        <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} title="Desde"
          className="field !w-auto text-xs" />
        <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} title="Hasta"
          className="field !w-auto text-xs" />
      </div>

      {!filtered.length ? (
        <Card>
          <EmptyState
            icon={<Trophy className="w-8 h-8" />}
            title={acts.length ? "Sin resultados" : "Aún no hay actividades"}
            hint={acts.length ? "Prueba con otro filtro o búsqueda." : "Sincroniza con Garmin o registra tu primer partido manual."}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((a) => {
            const meta = sportMeta(a.type);
            const Icon = meta.icon;
            return (
              <button key={a.id} onClick={() => setSelected(a.id)} className="text-left">
              <Card className="hover:border-blue-500/40 hover:bg-white/[0.04] transition cursor-pointer h-full">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <span className={cn("p-2.5 rounded-xl border shrink-0", meta.cls)}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold truncate">{a.name || meta.label}</h3>
                        <span className="tnum text-sm font-black text-blue-300 shrink-0">{a.tss} TSS</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {meta.label} · {fmtDate(a.start_time)}
                        {a.source === "manual" && " · manual"}
                        {a.rpe ? ` · RPE ${a.rpe}` : ""}
                        {a.has_track && <span className="text-emerald-400 font-semibold"> · GPS</span>}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                        <span className="tnum"><span className="text-gray-500">⏱ </span>{fmtDuration(a.duration_min)}</span>
                        {!!a.distance_m && <span className="tnum"><span className="text-gray-500">📏 </span>{fmtKm(a.distance_m)}</span>}
                        {!!a.distance_m && <span className="tnum"><span className="text-gray-500">⚡ </span>{fmtPace(a.distance_m, a.duration_min * 60)}</span>}
                        {!!a.avg_hr && <span className="tnum"><span className="text-gray-500">❤ </span>{a.avg_hr} bpm</span>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span className="tnum">{total} sesión(es)</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-cardborder disabled:opacity-40 hover:bg-white/10">← Nuevas</button>
          <button disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-cardborder disabled:opacity-40 hover:bg-white/10">Antiguas →</button>
        </div>
      </div>
      <p className="text-xs text-gray-600">Toca una actividad para ver su mapa, perfil de elevación, vueltas, zonas de carga y meteo.</p>
    </div>
  );
}
