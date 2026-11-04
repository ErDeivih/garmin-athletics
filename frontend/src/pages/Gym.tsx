import { useEffect, useState } from "react";
import { Bot, Dumbbell, History, Save, Send, Timer, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button, EmptyState, LoadingBlock, Notice, Stepper, fmtDate } from "../components/ui/primitives";
import { api } from "../services/auth";

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  target_rir?: number;
  notes?: string | null;
  weight_kg?: number;
}

interface Routine {
  routine_name: string;
  target_focus: string;
  readiness_context: string;
  estimated_duration_min: number;
  estimated_tss: number;
  calendar_warning?: string | null;
  exercises: Exercise[];
}

interface Row extends Exercise {
  weight_kg: number;
}

const FOCUS = ["Push", "Pull", "Legs", "Full Body"];

const EXERCISE_OPTIONS: Record<string, string[]> = {
  Push: ["Press de Banca con Barra", "Press Inclinado con Mancuernas", "Press Militar con Mancuernas", "FONDOS en Paralelas", "Press con Mancuernas", "Elevaciones Laterales", "Tríceps Polea", "Flexiones", "Press Militar", "Aperturas"],
  Pull: ["Remo con Barra", "Jalón al Pecho", "Remo en Polea", "Curl de Bíceps", "Dominadas", "Face Pull", "Remo con Mancuerna", "Curl Martillo", "Encogimientos"],
  Legs: ["Sentadilla", "Peso Muerto", "Zancadas", "Prensa", "Puente de Glúteo", "Gemelos de Pie", "Curl Femoral", "Sentadilla Búlgara", "Hip Thrust"],
  "Full Body": ["Press de Banca", "Remo con Barra", "Sentadilla", "Press Militar", "Peso Muerto", "Plancha", "Dominadas", "FONDOS en Paralelas"],
};

function ExercisePicker({ value, focus, onChange }: { value: string; focus: string; onChange: (v: string) => void }) {
  const opts = EXERCISE_OPTIONS[focus] ?? EXERCISE_OPTIONS["Full Body"];
  const [custom, setCustom] = useState(!opts.includes(value));
  if (custom) {
    return (
      <div className="flex gap-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value)} className="field !py-1.5 font-semibold" placeholder="Nombre del ejercicio" />
        <button type="button" onClick={() => setCustom(false)} className="px-2 text-xs text-gray-500 hover:text-white underline shrink-0">lista</button>
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      <select value={opts.includes(value) ? value : ""} onChange={(e) => onChange(e.target.value)} className="field !py-1.5 font-semibold">
        {!opts.includes(value) && <option value="">{value || "Elige ejercicio…"}</option>}
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <button type="button" onClick={() => setCustom(true)} title="Escribir otro"
        className="px-2.5 rounded-lg bg-white/5 border border-cardborder text-gray-400 hover:text-white shrink-0">✏️</button>
    </div>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-cardborder bg-white/[0.03] text-xs text-gray-400">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left px-3 py-2 font-semibold text-gray-300">
        📖 Leyenda {open ? "▾" : "▸"}
      </button>
      {open && (
        <dl className="px-3 pb-3 space-y-1.5">
          <div><dt className="inline font-bold text-white">RIR</dt> — <dd className="inline">repeticiones en reserva: cuántas más podrías hacer. RIR 1 = casi al fallo; RIR 3 = suave.</dd></div>
          <div><dt className="inline font-bold text-white">TSS</dt> — <dd className="inline">carga estimada de la sesión para tu fatiga (ATL/CTL). Más TSS = más cansancio mañana.</dd></div>
          <div><dt className="inline font-bold text-white">RPE 1-10</dt> — <dd className="inline">esfuerzo percibido para registrar fútbol sin reloj.</dd></div>
          <div><dt className="inline font-bold text-white">Tonelaje</dt> — <dd className="inline">series × reps × kg sumados. Lo que mueve tu TSS de fuerza.</dd></div>
        </dl>
      )}
    </div>
  );
}

function RestTimer() {
  const [secs, setSecs] = useState(90);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left == null || left <= 0) {
      if (left === 0) {
        try {
          const AC = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AC();
          const o = ctx.createOscillator();
          o.connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.4);
        } catch { /* sin audio */ }
      }
      return;
    }
    const t = setTimeout(() => setLeft((v) => (v != null ? v - 1 : v)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-sm text-gray-400"><Timer className="w-4 h-4" /> Descanso</span>
        {[30, 60, 90, 120].map((s) => (
          <button key={s} onClick={() => { setSecs(s); setLeft(s); }}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${secs === s && left != null ? "border-blue-500/60 text-white bg-blue-500/20" : "border-cardborder text-gray-500 hover:text-white"}`}>
            {s}s
          </button>
        ))}
        <span className={`tnum text-2xl font-black ml-auto ${left === 0 ? "text-emerald-400" : ""}`}>
          {left == null ? `${secs}s` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
        </span>
        {left != null && (
          <button onClick={() => setLeft(null)} className="text-xs text-gray-500 hover:text-white underline">parar</button>
        )}
      </CardContent>
    </Card>
  );
}

export default function Gym() {
  const [focus, setFocus] = useState("Push");
  const [intensity, setIntensity] = useState("auto");
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [editEx, setEditEx] = useState<Exercise[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ name: "Press de Banca", sets: 4, reps: 8, weight_kg: 60 }]);
  const [routineName, setRoutineName] = useState("Rutina de hoy");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [pushPreview, setPushPreview] = useState<any>(null);

  const loadHistory = () => {
    setLoadingHist(true);
    api.get("/strength/history?limit=8").then((r) => setHistory(r.data)).catch(() => setHistory([])).finally(() => setLoadingHist(false));
  };
  useEffect(loadHistory, []);

  const suggest = async () => {
    setSuggesting(true);
    setMsg(null);
    setPushPreview(null);
    try {
      const r = await api.get(`/strength/suggest?focus=${encodeURIComponent(focus)}&intensity=${intensity}`);
      setRoutine(r.data);
      setEditEx(r.data.exercises.map((e: Exercise) => ({ ...e })));
    } catch {
      setMsg("No se pudo generar la rutina. ¿Backend activo?");
    } finally {
      setSuggesting(false);
    }
  };

  const useRoutine = () => {
    if (!routine) return;
    setRows(editEx.map((e) => ({ ...e, weight_kg: 50 })));
    setRoutineName(routine.routine_name);
    setMsg("Rutina cargada en el registro. Ajusta los pesos y guarda.");
  };

  const previewPush = async () => {
    setMsg(null);
    try {
      const r = await api.post("/strength/push-to-garmin", {
        routine_name: routineName,
        dry_run: true,
        exercises: rows.map(({ name, sets, reps, weight_kg }) => ({ name, sets, reps, weight_kg })),
      });
      setPushPreview(r.data);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail ?? "Error generando la vista previa.");
    }
  };

  const save = async () => {
    if (!rows.length) return;
    setSaving(true);
    try {
      const r = await api.post("/strength/log", {
        routine_name: routineName,
        target_focus: focus,
        ai_generated: !!routine,
        exercises: rows.map(({ name, sets, reps, weight_kg }) => ({ name, sets, reps, weight_kg })),
      });
      setMsg(`Sesión guardada ✓ ${r.data.total_tonnage_kg.toFixed(0)} kg · ${r.data.computed_tss} TSS`);
      loadHistory();
    } catch {
      setMsg("Error guardando la sesión.");
    } finally {
      setSaving(false);
    }
  };

  const tonnage = rows.reduce((s, r) => s + r.sets * r.reps * (r.weight_kg || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 fade-in">
      <div className="space-y-4">
        <RestTimer />
        {/* Asistente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5 text-purple-400" /> Asistente</CardTitle>
            <div className="flex gap-1">
              {FOCUS.map((f) => (
                <button key={f} onClick={() => setFocus(f)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${focus === f ? "border-purple-500/60 text-white bg-purple-500/20" : "border-cardborder text-gray-500 hover:text-white"}`}>
                  {f}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="primary" onClick={suggest} disabled={suggesting} className="w-full">
              <Bot className="w-4 h-4" /> {suggesting ? "Pensando..." : `Sugerir rutina de ${focus}`}
            </Button>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Intensidad:</span>
              {[["auto", "Auto"], ["suave", "Suave"], ["intenso", "Intenso"]].map(([v, l]) => (
                <button key={v} onClick={() => setIntensity(v)}
                  className={`px-2.5 py-1 rounded-full font-semibold border transition ${intensity === v ? "border-blue-500/60 text-white bg-blue-500/20" : "border-cardborder hover:text-white"}`}>
                  {l}
                </button>
              ))}
              {routine && (
                <button onClick={suggest} disabled={suggesting} className="ml-auto underline hover:text-white">
                  Regenerar
                </button>
              )}
            </div>
            {routine && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{routine.routine_name}</h3>
                  <span className="text-xs text-gray-400 tnum">~{routine.estimated_duration_min} min · {routine.estimated_tss} TSS</span>
                </div>
                <p className="text-xs text-purple-200/80">{routine.readiness_context}</p>
                {routine.calendar_warning && <Notice tone="warn">{routine.calendar_warning}</Notice>}
                <p className="text-xs text-gray-500">Toca para editar series/reps antes de usarla:</p>
                <ul className="space-y-2">
                  {editEx.map((e, i) => (
                    <li key={i} className="rounded-lg bg-black/20 border border-cardborder p-2 space-y-1.5">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <ExercisePicker value={e.name} focus={focus} onChange={(v) => { const c = [...editEx]; c[i] = { ...c[i], name: v }; setEditEx(c); }} />
                        </div>
                        <button onClick={() => setEditEx(editEx.filter((_, j) => j !== i))} className="p-1.5 text-gray-500 hover:text-red-400" aria-label="Quitar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs text-gray-500">
                        <div><div className="mb-0.5">Series</div><Stepper value={e.sets} min={1} onChange={(v) => { const c = [...editEx]; c[i] = { ...c[i], sets: v }; setEditEx(c); }} /></div>
                        <div><div className="mb-0.5">Reps</div><Stepper value={e.reps} min={1} onChange={(v) => { const c = [...editEx]; c[i] = { ...c[i], reps: v }; setEditEx(c); }} /></div>
                        <div><div className="mb-0.5">RIR</div><Stepper value={e.target_rir ?? 2} max={5} onChange={(v) => { const c = [...editEx]; c[i] = { ...c[i], target_rir: Math.min(5, v) }; setEditEx(c); }} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button onClick={() => setEditEx([...editEx, { name: "Nuevo ejercicio", sets: 3, reps: 10, target_rir: 2 }])} className="flex-1">+ Ejercicio</Button>
                  <Button variant="primary" onClick={useRoutine} className="flex-1">Usar esta rutina</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Dumbbell className="w-5 h-5 text-blue-400" /> Registro de sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input value={routineName} onChange={(e) => setRoutineName(e.target.value)} className="field font-semibold" placeholder="Nombre de la rutina" />
            <Legend />
            {rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-cardborder bg-white/[0.03] p-3 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <ExercisePicker value={r.name} focus={focus} onChange={(v) => { const c = [...rows]; c[i] = { ...c[i], name: v }; setRows(c); }} />
                  </div>
                  <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-2 text-gray-500 hover:text-red-400" aria-label="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div><div className="mb-1">Series</div><Stepper value={r.sets} onChange={(v) => { const c = [...rows]; c[i] = { ...c[i], sets: v }; setRows(c); }} min={1} /></div>
                  <div><div className="mb-1">Reps</div><Stepper value={r.reps} onChange={(v) => { const c = [...rows]; c[i] = { ...c[i], reps: v }; setRows(c); }} min={1} /></div>
                  <div><div className="mb-1">Kg</div><Stepper value={r.weight_kg} step={2.5} onChange={(v) => { const c = [...rows]; c[i] = { ...c[i], weight_kg: v }; setRows(c); }} /></div>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button onClick={() => setRows([...rows, { name: "Nuevo ejercicio", sets: 3, reps: 10, weight_kg: 40 }])} className="flex-1">+ Ejercicio</Button>
              <Button onClick={previewPush} className="flex-1"><Send className="w-4 h-4" /> Ver para reloj</Button>
            </div>
            {pushPreview && (
              <Notice tone={pushPreview.unmapped_exercises?.length ? "warn" : "ok"}>
                Vista previa Garmin: {pushPreview.workout_json.workoutSegments[0].workoutSteps.length} bloques.
                {pushPreview.unmapped_exercises?.length ? ` Sin equivalencia: ${pushPreview.unmapped_exercises.join(", ")}.` : " Todo mapeado ✓"}
              </Notice>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-gray-400 tnum">Total: <strong className="text-white">{tonnage.toFixed(0)} kg</strong> ≈ {(tonnage * 0.02).toFixed(0)} TSS</span>
              <Button variant="primary" onClick={save} disabled={saving || !rows.length}><Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar"}</Button>
            </div>
            {msg && <Notice tone="ok">{msg}</Notice>}
          </CardContent>
        </Card>
      </div>

      {/* Historial */}
      <Card className="h-fit">
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-5 h-5 text-gray-400" /> Historial</CardTitle></CardHeader>
        <CardContent>
          {loadingHist ? <LoadingBlock lines={4} /> : !history.length ? (
            <EmptyState title="Sin sesiones todavía" hint="Guarda tu primera sesión y aparecerá aquí con su tonelaje." />
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2.5 text-sm">
                  <div>
                    <div className="font-semibold">{h.routine_name}</div>
                    <div className="text-xs text-gray-500">{fmtDate(h.date)} · {h.target_focus} · {h.exercises_count} ejercicios</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="tnum font-black">{Number(h.total_tonnage_kg).toFixed(0)} kg</div>
                    <div className="text-xs text-blue-300 tnum">{h.computed_tss} TSS</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
