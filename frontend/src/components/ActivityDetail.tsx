import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookmarkPlus, CloudSun, Heart, MapPin, Mountain, RefreshCw, Timer } from "lucide-react";
import { CircleMarker, MapContainer, useMap } from "react-leaflet";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, cn } from "./ui/Card";
import { Button, EmptyState, LoadingBlock, Notice, fmtDate, fmtDuration, fmtKm, fmtPace } from "./ui/primitives";
import { BaseLayers, ColoredRoute } from "./maps";
import { api } from "../services/auth";

function FitBounds({ bbox }: { bbox: [number, number, number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: [24, 24] });
  }, [map, bbox]);
  return null;
}

export default function ActivityDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [track, setTrack] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"map" | "laps" | "zones" | "streams">("map");
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedRoute, setSavedRoute] = useState<string | null>(null);
  const [streams, setStreams] = useState<any>(null);
  const [colorBy, setColorBy] = useState<"speed" | "hr" | "ele">("speed");

  const saveAsRoute = async () => {
    try {
      await api.post(`/routes/from-activity/${id}`);
      setSavedRoute("Guardada en Rutas ✓");
    } catch {
      setSavedRoute("No se pudo guardar (¿sin GPS?)");
    }
    setTimeout(() => setSavedRoute(null), 3500);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/activities/${id}`)
      .then((r) => {
        setDetail(r.data);
        if (r.data.has_track) {
          api.get(`/activities/${id}/track`).then((t) => setTrack(t.data)).catch(() => setTrack(null));
          api.get(`/activities/${id}/streams?max_points=500`).then((s) => setStreams(s.data)).catch(() => setStreams(null));
        } else {
          setTrack(null);
          setStreams(null);
        }
      })
      .catch(() => setError("No se pudo cargar la actividad."))
      .finally(() => setLoading(false));
  }, [id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.post(`/activities/${id}/refresh`);
      const r = await api.get(`/activities/${id}`);
      setDetail(r.data);
      if (r.data.has_track) {
        const t = await api.get(`/activities/${id}/track`).catch(() => null);
        setTrack(t?.data ?? null);
      }
    } catch {
      setError("Garmin no respondió. Prueba más tarde (límite de peticiones).");
    } finally {
      setRefreshing(false);
    }
  };

  const elevData = useMemo(() => {
    if (!track?.points?.ele) return [];
    const ele: (number | null)[] = track.points.ele;
    const dist = track.distance_m && ele.length ? track.distance_m / 1000 / ele.length : 0;
    return ele.map((e, i) => ({ km: +(i * dist).toFixed(2), ele: e }));
  }, [track]);

  if (loading) {
    return <Card><CardContent className="pt-6"><LoadingBlock lines={5} /></CardContent></Card>;
  }
  if (error || !detail) {
    return <Card><EmptyState title="Error cargando" hint={error ?? undefined} action={<Button onClick={onBack}>Volver</Button>} /></Card>;
  }

  const pts: [number, number][] = track ? track.points.lat.map((la: number, i: number) => [la, track.points.lon[i]]) : [];
  const bbox: [number, number, number, number] | null = track?.bbox ?? detail.bbox;
  const hoverPos: [number, number] | null = hover != null && track ? [track.points.lat[hover], track.points.lon[hover]] : null;
  const colorVals: (number | null)[] = track
    ? colorBy === "hr" ? track.points.hr : colorBy === "ele" ? track.points.ele : track.points.speed
    : [];
  const hasColorData = colorVals.some((v) => v != null);
  const colorLabel = colorBy === "hr" ? "lyfta" : colorBy === "ele" ? "altitud" : "velocidad";
  const hasEle = !!track?.points?.ele?.some((e: number | null) => e != null);
  const totalZoneSecs = (detail.hr_zones ?? []).reduce((s: number, z: any) => s + (z.secs || 0), 0);
  const w = detail.weather;

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center gap-3">
        <Button onClick={onBack}><ArrowLeft className="w-4 h-4" /> Actividades</Button>
        <div className="min-w-0">
          <h2 className="font-black text-lg truncate">{detail.name || detail.type}</h2>
          <p className="text-xs text-gray-500">{fmtDate(detail.start_time)} · {fmtDuration(detail.duration_min)} · {detail.tss} TSS</p>
        </div>
        <button onClick={refresh} disabled={refreshing} title="Re-descargar de Garmin"
          className="ml-auto p-2 rounded-lg bg-white/5 border border-cardborder hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        {detail.has_track && (
          <button onClick={saveAsRoute} title="Guardar como ruta"
            className="p-2 rounded-lg bg-white/5 border border-cardborder hover:bg-white/10 flex items-center gap-1.5 text-xs font-semibold text-gray-300">
            <BookmarkPlus className="w-4 h-4" /> <span className="hidden sm:inline">Ruta</span>
          </button>
        )}
      </div>
      {savedRoute && <Notice tone="ok">{savedRoute}</Notice>}

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {[
          { icon: MapPin, label: "Distancia", value: fmtKm(detail.distance_m) },
          { icon: Timer, label: "Ritmo medio", value: fmtPace(detail.distance_m, detail.duration_min * 60) },
          { icon: Heart, label: "FC med/máx", value: detail.avg_hr ? `${detail.avg_hr} / ${detail.max_hr ?? "—"} bpm` : "—" },
          { icon: Mountain, label: "Desnivel +", value: detail.gain_m != null ? `+${detail.gain_m.toFixed(0)} m` : "—" },
          { label: "Calorías", value: detail.calories ? `${detail.calories.toFixed(0)} kcal` : "—" },
          { label: "Velocidad", value: detail.avg_speed_kmh ? `${detail.avg_speed_kmh.toFixed(1)} km/h` : "—" },
          { label: "Cadencia", value: detail.avg_cadence ? `${detail.avg_cadence} ppm` : "—" },
          { label: "Potencia", value: detail.avg_power ? `${detail.avg_power} W` : "—" },
        ].map((s, i) => (
          <Card key={i}><CardContent className="pt-3 pb-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-1">{s.icon && <s.icon className="w-3 h-3" />}{s.label}</div>
            <div className="tnum font-black mt-0.5">{s.value}</div>
          </CardContent></Card>
        ))}
      </div>

      {w && (
        <Card><CardContent className="pt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5 text-gray-400"><CloudSun className="w-4 h-4 text-amber-300" /> Meteo</span>
          <span className="tnum font-bold">{w.temp_c}°C</span>
          <span className="text-gray-500">sensación {w.feels_c}°C</span>
          <span className="text-gray-500">humedad {w.humidity}%</span>
          {w.wind_kph != null && <span className="text-gray-500">viento {w.wind_kph} km/h {w.wind_dir ?? ""}</span>}
          {w.desc && <span className="text-gray-400">{w.desc} · {w.station}</span>}
        </CardContent></Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {[["map", "Mapa"], ["streams", "Ritmo y lyfta"], ["laps", `Vueltas (${detail.laps?.length ?? 0})`], ["zones", "Zonas FC"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={cn("px-3.5 py-2 rounded-xl text-sm font-semibold border transition",
              tab === k ? "bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/50 text-white" : "border-cardborder text-gray-400 hover:text-white")}>
            {l}
          </button>
        ))}
      </div>

      {tab === "map" && (
        !pts.length ? (
          <Card><EmptyState title="Sin track GPS" hint="Esta actividad no tiene ruta (fútbol manual, piscina o Garmin no la envió). Las vueltas y zonas siguen disponibles." /></Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Colorear por:</span>
              {[["speed", "Velocidad"], ["hr", "Lyfta"], ["ele", "Altitud"]].map(([v, l]) => (
                <button key={v} onClick={() => setColorBy(v as any)}
                  className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition",
                    colorBy === v ? "border-blue-500/60 text-white bg-blue-500/20" : "border-cardborder text-gray-500 hover:text-white")}>
                  {l}
                </button>
              ))}
              <span className="text-[11px] text-gray-600 ml-auto hidden sm:flex items-center gap-1">
                <span className="inline-block w-8 h-1.5 rounded" style={{ background: "linear-gradient(90deg,#34d399,#fbbf24,#ef4444)" }} />
                bajo → alto ({hasColorData ? colorLabel : "sin datos de " + colorLabel})
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3 overflow-hidden">
              <div className="h-[60vh] min-h-[380px] w-full [&_.leaflet-container]:bg-[#0e1424]">
                <MapContainer style={{ height: "100%", width: "100%" }} zoom={13} center={pts[Math.floor(pts.length / 2)]} scrollWheelZoom>
                  <BaseLayers />
                  {bbox && <FitBounds bbox={bbox} />}
                  <ColoredRoute positions={pts} values={colorVals} />
                  <CircleMarker center={pts[0]} radius={7} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 1 }} />
                  <CircleMarker center={pts[pts.length - 1]} radius={7} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }} />
                  {hoverPos && <CircleMarker center={hoverPos} radius={6} pathOptions={{ color: "#fff", fillColor: "#fff", fillOpacity: 1 }} />}
                </MapContainer>
              </div>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Perfil de elevación <span className="font-normal text-gray-500">· pasa el cursor para localizar</span></CardTitle></CardHeader>
              <CardContent>
                {!hasEle ? (
                  <EmptyState title="Sin datos de altitud" hint="El GPS no registró elevación en esta actividad." />
                ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={elevData} margin={{ top: 4, bottom: 0, left: -18, right: 4 }}
                      onMouseMove={(s: any) => setHover(s?.activeTooltipIndex ?? null)} onMouseLeave={() => setHover(null)}>
                      <XAxis dataKey="km" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v: number) => `${v.toFixed(0)}k`} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} width={44} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        formatter={(v: any) => [`${Number(v).toFixed(0)} m`, "Altitud"]} labelFormatter={(v: any) => `${Number(v).toFixed(1)} km`} />
                      <Area type="monotone" dataKey="ele" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} strokeWidth={2} dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                )}
                <p className="text-xs text-gray-500 mt-2 tnum">
                  {track.distance_m ? `${(track.distance_m / 1000).toFixed(2)} km` : ""} · +{track.gain_m?.toFixed(0)} m / −{track.loss_m?.toFixed(0)} m
                  {detail.min_alt != null && <> · {detail.min_alt.toFixed(0)}–{detail.max_alt.toFixed(0)} m</>} · {track.point_count} puntos GPS
                </p>
              </CardContent>
            </Card>
            </div>
          </div>
        )
      )}

      {tab === "streams" && (
        !streams?.count ? (
          <Card><EmptyState title="Sin series" hint="Esta actividad no trae datos segundo a segundo." /></Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Lyfta (bpm)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={streams.t_s.map((t: number, i: number) => ({ t, hr: streams.hr[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} width={40} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="hr" stroke="#fb7185" fill="#fb7185" fillOpacity={0.25} strokeWidth={1.5} dot={false} connectNulls name="FC" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Ritmo (seg/km)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={streams.t_s.map((t: number, i: number) => ({ t, pace: streams.pace_sec_km[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} width={44} domain={["auto", "auto"]} reversed />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                      <Area type="monotone" dataKey="pace" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.25} strokeWidth={1.5} dot={false} connectNulls name="Ritmo" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      )}

      {tab === "laps" && (
        <Card><CardContent className="pt-4">
          {!detail.laps?.length ? <EmptyState title="Sin vueltas" hint="Garmin no devolvió parciales para esta actividad." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-cardborder">
                  <th className="pb-2 pr-3">#</th><th className="pb-2 pr-3 text-right">Dist</th>
                  <th className="pb-2 pr-3 text-right">Tiempo</th><th className="pb-2 pr-3 text-right">Ritmo</th>
                  <th className="pb-2 pr-3 text-right">FC med</th><th className="pb-2 pr-3 text-right">FC máx</th>
                  <th className="pb-2 text-right">Desnivel</th>
                </tr></thead>
                <tbody>
                  {detail.laps.map((l: any) => (
                    <tr key={l.n} className="border-b border-cardborder/50 last:border-0 tnum">
                      <td className="py-2 pr-3 font-bold">{l.n}</td>
                      <td className="py-2 pr-3 text-right">{fmtKm(l.distance_m)}</td>
                      <td className="py-2 pr-3 text-right">{fmtDuration(l.duration_s / 60)}</td>
                      <td className="py-2 pr-3 text-right">{l.pace ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{l.avg_hr ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{l.max_hr ?? "—"}</td>
                      <td className="py-2 text-right text-gray-400">+{l.gain_m?.toFixed(0) ?? 0} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>
      )}

      {tab === "zones" && (
        <Card><CardContent className="pt-4 space-y-2">
          {!(detail.hr_zones?.length) ? <EmptyState title="Sin zonas" hint="No hay datos de carga por zonas." /> :
            detail.hr_zones.map((z: any) => {
              const pct = totalZoneSecs ? (z.secs / totalZoneSecs) * 100 : 0;
              const colors = ["", "#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#ef4444"];
              return (
                <div key={z.zone}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">Z{z.zone} <span className="text-gray-500 font-normal">desde {z.low} bpm</span></span>
                    <span className="tnum text-gray-400">{fmtDuration(z.secs / 60)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[z.zone] ?? "#888" }} />
                  </div>
                </div>
              );
            })}
        </CardContent></Card>
      )}

      {!detail.has_track && detail.source === "garmin" && (
        <Notice tone="info">El detalle completo (mapa, vueltas, zonas) se descarga de Garmin al abrir. Si algo falta, pulsa ⟳.</Notice>
      )}
    </div>
  );
}
