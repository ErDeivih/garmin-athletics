import { useEffect, useState } from "react";
import { Gauge, Medal, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState, LoadingBlock } from "../components/ui/primitives";
import { api } from "../services/auth";
import { cn } from "../components/ui/Card";

const SPORTS = [["running", "Carrera"], ["cycling", "Ciclismo"], ["swimming", "Natación"]] as const;

export default function Performance() {
  const [sport, setSport] = useState<string>("running");
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<any>(null);
  const [zones, setZones] = useState<any>(null);
  const [prs, setPrs] = useState<any[]>([]);
  const [gstatus, setGstatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/performance/summary?sport=${sport}&days=${days}`).then((r) => r.data).catch(() => null),
      api.get(`/performance/zones?sport=${sport}&days=${days}`).then((r) => r.data).catch(() => null),
      api.get(`/performance/prs?sport=${sport}`).then((r) => r.data).catch(() => []),
      api.get("/metrics/training-status").then((r) => r.data).catch(() => null),
    ]).then(([s, z, p, g]) => {
      setSummary(s);
      setZones(z);
      setPrs(p);
      setGstatus(g);
    }).finally(() => setLoading(false));
  }, [sport, days]);

  const fmtRace = (s?: number | null) => {
    if (!s) return "—";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  if (loading) {
    return <Card><CardContent className="pt-6"><LoadingBlock lines={5} /></CardContent></Card>;
  }

  const cur = summary?.current ?? {};
  const prev = summary?.previous ?? {};
  const delta = (k: string, suffix = "") => {
    if (cur[k] == null || prev[k] == null) return null;
    const d = +(cur[k] - prev[k]).toFixed(1);
    if (d === 0) return <span className="text-xs text-gray-500">= anterior</span>;
    return <span className={`text-xs font-semibold ${d > 0 ? "text-emerald-400" : "text-red-400"}`}>{d > 0 ? "+" : ""}{d}{suffix} vs prev</span>;
  };
  const zoneColors = ["", "#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#ef4444"];

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {SPORTS.map(([v, l]) => (
            <button key={v} onClick={() => setSport(v)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                sport === v ? "bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/50 text-white" : "bg-white/5 border-cardborder text-gray-400 hover:text-white")}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto">
          {[30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                days === d ? "border-blue-500/60 text-white bg-blue-500/20" : "border-cardborder text-gray-500 hover:text-white")}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {[
          ["Sesiones", cur.sessions, null],
          ["Horas", cur.hours, "h"],
          ["Km", cur.km, ""],
          ["TSS", cur.tss, ""],
          ["Desnivel", cur.gain_m != null ? `+${cur.gain_m}` : null, " m"],
          ["FC media", cur.avg_hr, " bpm"],
        ].map(([label, value, suffix], i) => (
          <Card key={i}><CardContent className="pt-3 pb-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
            <div className="tnum text-xl font-black mt-0.5">{value ?? "—"}{value != null && suffix}</div>
          </CardContent></Card>
        ))}
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        vs {days}d anteriores: TSS {delta("tss")} · km {delta("km")}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Timer className="w-5 h-5 text-amber-400" /> Tiempo en zonas FC</CardTitle></CardHeader>          <CardContent className="space-y-2">
            {!zones?.total_secs ? <EmptyState title="Sin zonas" hint="Faltan actividades con lyfta en el periodo." /> :
              zones.zones.map((z: any) => (
                <div key={z.zone}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">Z{z.zone}</span>
                    <span className="tnum text-gray-400">{Math.round(z.secs / 60)} min · {z.pct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${z.pct}%`, background: zoneColors[z.zone] }} />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Medal className="w-5 h-5 text-yellow-300" /> Marcas personales</CardTitle></CardHeader>
          <CardContent>
            {!prs.length ? (
              <EmptyState icon={<Gauge className="w-8 h-8" />} title="Sin marcas aún"
                hint="Se detectan solas al sincronizar: mejor ritmo corriendo, más rápido en bici, tirada más larga." />
            ) : (
              <ul className="space-y-2">
                {prs.map((p, i) => (
                  <li key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2.5 text-sm">
                    <div>
                      <div className="font-semibold">{p.label.replaceAll("_", " ")}</div>
                      <div className="text-xs text-gray-500">{p.achieved_at ? new Date(p.achieved_at).toLocaleDateString("es-ES") : ""}</div>
                    </div>
                    <span className="tnum font-black text-blue-300">{p.display ?? p.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {gstatus?.available && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="w-5 h-5 text-purple-400" /> Lo que predice Garmin</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
              <div className="rounded-lg bg-white/5 py-3">
                <div className="tnum text-2xl font-black">{gstatus.vo2max ?? "—"}</div>
                <div className="text-xs text-gray-500">VO2max</div>
              </div>
              {[
                ["5K", gstatus.race?.p5k], ["10K", gstatus.race?.p10k],
                ["Media", gstatus.race?.hm], ["Maratón", gstatus.race?.mar],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-lg bg-white/5 py-3">
                  <div className="tnum text-2xl font-black">{fmtRace(v as number | null)}</div>
                  <div className="text-xs text-gray-500">{l}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-600 mt-2">Estimaciones oficiales de tu {gstatus.device ?? "reloj"} según tu historial.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
