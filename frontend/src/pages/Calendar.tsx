import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "../components/ui/Card";
import { Button, EmptyState, LoadingBlock } from "../components/ui/primitives";
import { api } from "../services/auth";

interface Day {
  date: string;
  events: any[];
  activities: any[];
  readiness: { score: number; status: string } | null;
}

const TYPES = [["soccer", "Fútbol"], ["planned_workout", "Entreno"], ["race", "Carrera"], ["strength", "Fuerza"], ["rest", "Descanso"]] as const;
const WD = ["L", "M", "X", "J", "V", "S", "D"];

function monthRange(y: number, m: number): [string, string] {
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return [iso(start), iso(end)];
}

export default function Calendar() {
  const now = new Date();
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()]);
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", event_type: "soccer", date: "", time: "20:00", weekday: "", immovable: true });

  const load = useCallback(() => {
    setLoading(true);
    const [from, to] = monthRange(ym[0], ym[1]);
    api.get(`/calendar/?from=${from}&to=${to}`)
      .then((r) => setDays(r.data.days ?? []))
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [ym]);
  useEffect(load, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/calendar/events", {
      title: form.title,
      event_type: form.event_type,
      start_local: `${form.date}T${form.time}:00`,
      duration_min: 90,
      weekday: form.weekday === "" ? null : +form.weekday,
      is_immovable: form.immovable,
    });
    setShowForm(false);
    setForm({ title: "", event_type: "soccer", date: "", time: "20:00", weekday: "", immovable: true });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Borrar evento?")) return;
    await api.delete(`/calendar/events/${id}`).catch(() => null);
    load();
  };

  const monthName = new Date(ym[0], ym[1], 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const move = (d: number) => {
    const dt = new Date(ym[0], ym[1] + d, 1);
    setYm([dt.getFullYear(), dt.getMonth()]);
  };
  const dot = (s?: string | null) => s === "VERDE" ? "bg-emerald-400" : s === "AMARILLO" ? "bg-amber-400" : s === "ROJO" ? "bg-red-400" : "bg-white/10";

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center gap-2">
        <button onClick={() => move(-1)} className="p-2 rounded-lg bg-white/5 border border-cardborder hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></button>
        <h2 className="font-black text-lg capitalize flex items-center gap-2"><CalendarDays className="w-5 h-5 text-blue-400" /> {monthName}</h2>
        <button onClick={() => move(1)} className="p-2 rounded-lg bg-white/5 border border-cardborder hover:bg-white/10"><ChevronRight className="w-4 h-4" /></button>
        <Button onClick={() => setShowForm((v) => !v)} className="ml-auto"><Plus className="w-4 h-4" /> Evento</Button>
      </div>

      {showForm && (
        <Card><CardContent className="pt-4">
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2}
              placeholder="Título (ej. Partido fútbol 7)" className="field sm:col-span-2 font-semibold" />
            <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="field">
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })} className="field">
              <option value="">Solo una vez… o cada semana:</option>
              {[["0", "Cada lunes"], ["1", "Cada martes"], ["2", "Cada miércoles"], ["3", "Cada jueves"], ["4", "Cada viernes"], ["5", "Cada sábado"], ["6", "Cada domingo"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="field" />
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className="field" />
            <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
              <input type="checkbox" checked={form.immovable} onChange={(e) => setForm({ ...form, immovable: e.target.checked })} className="w-4 h-4 accent-blue-500" />
              Inamovible (la IA evita pierna pesada 48h alrededor)
            </label>
            <Button variant="primary" type="submit" className="sm:col-span-2">Guardar</Button>
          </form>
        </CardContent></Card>
      )}

      {loading ? <Card><CardContent className="pt-6"><LoadingBlock lines={6} /></CardContent></Card> : (
        <Card><CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500 mb-1">
            {WD.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = d.date.slice(0, 7) === `${ym[0]}-${String(ym[1] + 1).padStart(2, "0")}`;
              return (
                <div key={d.date} className={cn("min-h-[76px] rounded-lg border p-1 text-left overflow-hidden",
                  inMonth ? "border-cardborder bg-white/[0.02]" : "border-transparent opacity-40")}>
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-bold text-gray-400">{+d.date.slice(8)}</span>
                    <span className={cn("w-1.5 h-1.5 rounded-full", dot(d.readiness?.status))} title={d.readiness ? `Readiness ${d.readiness.score}` : "sin datos"} />
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {d.events.slice(0, 2).map((e) => (
                      <div key={e.id + e.start} className="group flex items-center gap-0.5 text-[10px] leading-tight rounded px-1 py-0.5 bg-purple-500/15 text-purple-200 truncate">
                        <span className="truncate flex-1">{e.title}</span>
                        <button onClick={() => remove(e.id)} className="hidden group-hover:inline text-gray-500 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                      </div>
                    ))}
                    {d.activities.slice(0, 2).map((a) => (
                      <div key={a.id} className="text-[10px] leading-tight rounded px-1 py-0.5 bg-blue-500/10 text-blue-200 truncate" title={`${a.name} · ${a.tss} TSS`}>
                        {a.name || a.type}
                      </div>
                    ))}
                    {(d.events.length + d.activities.length) > 4 && (
                      <div className="text-[10px] text-gray-600 px-1">+{(d.events.length + d.activities.length) - 4} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!days.length && <EmptyState title="Sin datos" hint="No se pudo cargar el mes." />}
        </CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Avisos de entrenamiento</CardTitle></CardHeader>
        <AlertsBlock />
      </Card>
    </div>
  );
}

function AlertsBlock() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/alerts/").then((r) => setAlerts(r.data.alerts ?? [])).catch(() => setAlerts([])).finally(() => setLoading(false));
  }, []);
  const tone = (s: string) => s === "high" ? "border-red-500/40 bg-red-500/10 text-red-200" : s === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-blue-500/40 bg-blue-500/10 text-blue-200";
  return (
    <CardContent className="pt-0">
      {loading ? <LoadingBlock lines={2} /> : !alerts.length ? (
        <p className="text-sm text-gray-500">Todo en orden. Sin avisos. ✅</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i} className={cn("text-sm rounded-lg border px-3 py-2", tone(a.severity))}>{a.message}</li>
          ))}
        </ul>
      )}
    </CardContent>
  );
}
