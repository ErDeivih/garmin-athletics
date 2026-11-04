import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, MapPin, Maximize2, Minimize2, Plus, Redo2, Repeat, Route as RouteIcon, Shuffle, Shield, Trash2, Undo2, Upload, X } from "lucide-react";
import { CircleMarker, MapContainer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import { Card, CardContent, CardHeader, CardTitle, cn } from "../components/ui/Card";
import { Button, EmptyState, Notice, fmtKm } from "../components/ui/primitives";
import { BaseLayers, numberedIcon } from "../components/maps";
import { api } from "../services/auth";

interface SavedRoute {
  id: string;
  name: string;
  sport: string;
  distance_m: number | null;
  gain_m: number | null;
  points: number | null;
}

const OSRM = "https://router.project-osrm.org/route/v1";

function ClickCapture({ onAdd }: { onAdd: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onAdd(e.latlng.lat, e.latlng.lng) });
  return null;
}

function FitAll({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length > 1) map.fitBounds(pts as any, { padding: [24, 24] });
    else if (pts.length === 1) map.setView(pts[0], 13);
  }, [map, pts]);
  return null;
}

function AddZoneHere({ onAdd }: { onAdd: (lat: number, lon: number) => void }) {
  const map = useMap();
  return (
    <button
      onClick={() => {
        const c = map.getCenter();
        onAdd(+c.lat.toFixed(6), +c.lng.toFixed(6));
      }}
      title="Crear zona de privacidad en el centro del mapa"
      className="absolute z-[500] bottom-4 left-4 px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/70 border border-cardborder hover:bg-black/90 flex items-center gap-1.5"
    >
      <Shield className="w-3.5 h-3.5 text-emerald-300" /> Zona privada aquí
    </button>
  );
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const r = 6371;
  const dLa = ((b[0] - a[0]) * Math.PI) / 180;
  const dLo = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export default function Routes() {
  const [waypoints, setWaypoints] = useState<[number, number][]>([]);
  const [line, setLine] = useState<[number, number][]>([]);
  const [distM, setDistM] = useState(0);
  const [sport, setSport] = useState<"cycling" | "running" | "hiking">("cycling");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [viewing, setViewing] = useState<{ id: string; name: string; lat: number[]; lon: number[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [routing, setRouting] = useState(false);
  const [avoidMotorway, setAvoidMotorway] = useState(true);
  const [avoidToll, setAvoidToll] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [zoneLabel, setZoneLabel] = useState("Casa");
  const timer = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const excludeParam = () => {
    const ex = [];
    if (avoidMotorway) ex.push("motorway");
    if (avoidToll) ex.push("toll");
    return ex.length ? `&exclude=${ex.join(",")}` : "";
  };

  const loadSaved = useCallback(() => {
    api.get("/routes/").then((r) => setSaved(r.data)).catch(() => setSaved([]));
  }, []);
  const loadZones = useCallback(() => {
    api.get("/privacy-zones/").then((r) => setZones(r.data)).catch(() => setZones([]));
  }, []);
  useEffect(loadSaved, [loadSaved]);
  useEffect(loadZones, [loadZones]);

  const route = useCallback(async (wps: [number, number][], sp: string) => {
    if (wps.length < 2) {
      setLine(wps);
      setDistM(wps.length === 2 ? haversineKm(wps[0], wps[1]) * 1000 : 0);
      return;
    }
    setRouting(true);
    try {
      const profile = sp === "cycling" ? "bike" : "foot";
      const coords = wps.map(([la, lo]) => `${lo},${la}`).join(";");
      const r = await fetch(`${OSRM}/${profile}/${coords}?overview=full&geometries=geojson${excludeParam()}`);
      if (!r.ok) throw new Error("osrm");
      const j = await r.json();
      const route0 = j.routes?.[0];
      if (!route0) throw new Error("osrm");
      setLine(route0.geometry.coordinates.map(([lo, la]: number[]) => [la, lo]));
      setDistM(route0.distance);
      setMsg(null);
    } catch {
      // Fallback: une los puntos en línea recta para no bloquear
      setLine(wps);
      let d = 0;
      for (let i = 1; i < wps.length; i++) d += haversineKm(wps[i - 1], wps[i]);
      setDistM(d * 1000);
      setMsg("Sin conexión al calculador de carreteras: trazo en línea recta.");
    } finally {
      setRouting(false);
    }
  }, [avoidMotorway, avoidToll]);

  const optimizeLoop = async () => {
    if (waypoints.length < 3) return;
    setRouting(true);
    try {
      const profile = sport === "cycling" ? "bike" : "foot";
      const coords = waypoints.map(([la, lo]) => `${lo},${la}`).join(";");
      const r = await fetch(`${OSRM}/trip/v1/${profile}/${coords}?roundtrip=true&source=first&destination=last&overview=false&geometries=geojson${excludeParam()}`);
      if (!r.ok) throw new Error("trip");
      const j = await r.json();
      const order: number[] = (j.waypoints ?? []).sort((a: any, b: any) => a.waypoint_index - b.waypoint_index).map((w: any) => w.waypoint_index);
      if (order.length !== waypoints.length) throw new Error("trip");
      // Cierra el bucle volviendo al inicio por otro camino (el orden óptimo ya lo evita en lo posible)
      const ordered = order.map((i) => waypoints[i]);
      setWaypoints([...ordered, ordered[0]]);
      setMsg("Orden óptimo calculado (bucle cerrado). Revisa y guarda.");
    } catch {
      setMsg("No se pudo optimizar. Prueba con menos puntos o revisa tu conexión.");
    } finally {
      setRouting(false);
    }
  };

  const outAndBack = () => {
    if (waypoints.length < 2) return;
    setWaypoints((w) => [...w, ...[...w].reverse().slice(1)]);
  };

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => route(waypoints, sport), 600);
    return () => clearTimeout(timer.current);
  }, [waypoints, sport, route]);

  const addPoint = (lat: number, lon: number) => {
    setViewing(null);
    setWaypoints((w) => [...w, [+lat.toFixed(6), +lon.toFixed(6)]]);
  };

  const save = async () => {
    if (!name.trim() || line.length < 2) return;
    try {
      await api.post("/routes/", {
        name: name.trim(),
        sport,
        lat: line.map((p) => p[0]),
        lon: line.map((p) => p[1]),
      });
      setMsg(`Ruta "${name.trim()}" guardada ✓`);
      setName("");
      setWaypoints([]);
      setLine([]);
      loadSaved();
    } catch {
      setMsg("Error guardando la ruta.");
    }
  };

  const view = async (id: string) => {
    try {
      const r = await api.get(`/routes/${id}`);
      setViewing({ id, name: r.data.name, lat: r.data.lat, lon: r.data.lon });
      setWaypoints([]);
      setLine([]);
    } catch {
      setMsg("No se pudo abrir la ruta.");
    }
  };

  const downloadGpx = async (id: string, filename: string) => {
    try {
      const r = await api.get(`/routes/${id}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.gpx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Error descargando el GPX.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Borrar esta ruta?")) return;
    await api.delete(`/routes/${id}`).catch(() => null);
    loadSaved();
  };

  const importGpx = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.post(`/routes/import?sport=${sport}&name=${encodeURIComponent(f.name.replace(/\.gpx$/i, ""))}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMsg(`GPX importado: ${r.data.points} puntos, ${(r.data.distance_m / 1000).toFixed(1)} km ✓`);
      loadSaved();
    } catch {
      setMsg("No se pudo importar el GPX (¿formato válido, <5 MB?).");
    }
  };

  const addZone = async (lat: number, lon: number) => {
    try {
      await api.post("/privacy-zones/", { label: zoneLabel || "Casa", center_lat: lat, center_lon: lon, radius_m: 200 });
      setMsg("Zona de privacidad creada: inicio/fin dentro de 200 m se recortan en mapas y exports.");
      loadZones();
    } catch {
      setMsg("Error creando la zona.");
    }
  };

  const removeZone = async (id: string) => {
    await api.delete(`/privacy-zones/${id}`).catch(() => null);
    loadZones();
  };

  const shown: [number, number][] = viewing
    ? viewing.lat.map((la, i) => [la, viewing.lon[i]])
    : line;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 fade-in">
      <Card className={fullscreen ? "fixed inset-2 z-[1000] overflow-y-auto flex flex-col" : "lg:col-span-2 overflow-hidden"}>
        <div className={fullscreen ? "flex-1 min-h-0 w-full [&_.leaflet-container]:bg-[#0e1424] relative" : "h-[70vh] min-h-[480px] w-full [&_.leaflet-container]:bg-[#0e1424] relative"}>
          <button onClick={() => setFullscreen((v) => !v)} title={fullscreen ? "Salir de pantalla completa" : "Mapa grande"}
            className="absolute z-[600] top-16 right-2 p-2 rounded-lg bg-black/70 border border-cardborder hover:bg-black/90">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <MapContainer style={{ height: "100%", width: "100%" }} zoom={13} center={[40.97, -5.66]} scrollWheelZoom>
            <BaseLayers />
            <ClickCapture onAdd={addPoint} />
            <AddZoneHere onAdd={addZone} />
            <FitAll pts={shown} />
            {shown.length > 1 && <Polyline positions={shown} pathOptions={{ color: "#34d399", weight: 4 }} />}
            {waypoints.map((p, i) => (
              <Marker key={`${i}-${p[0]}-${p[1]}`} position={p} draggable
                icon={numberedIcon(i + 1, i === 0 ? "#10b981" : "#60a5fa")}
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target.getLatLng();
                    setViewing(null);
                    setWaypoints((w) => w.map((q, j) => (j === i ? [+m.lat.toFixed(6), +m.lng.toFixed(6)] : q)));
                  },
                }}
              />
            ))}
            {viewing && shown.length > 0 && (
              <CircleMarker center={shown[0]} radius={7} pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 1 }} />
            )}
            {zones.map((z) => (
              <CircleMarker key={z.id} center={[z.center_lat, z.center_lon]} radius={10}
                pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.35 }} />
            ))}
          </MapContainer>
        </div>
        <CardContent className="pt-3 flex flex-wrap items-center gap-2 text-sm">
          {viewing ? (
            <>
              <span className="font-bold">Viendo: {viewing.name}</span>
              <button onClick={() => downloadGpx(viewing.id, viewing.name)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/40 text-blue-200 hover:bg-blue-500/25 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> GPX
              </button>
              <button onClick={() => setViewing(null)} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Cerrar
              </button>
            </>
          ) : (
            <span className="text-gray-400 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Clica para añadir · arrastra los números para mover</span>
          )}
          {waypoints.length > 0 && (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="tnum font-bold">{waypoints.length} puntos · {fmtKm(distM)}{routing ? " (calculando...)" : ""}</span>
                <span className="flex gap-1.5 ml-auto flex-wrap">
                  <button onClick={() => setWaypoints((w) => w.slice(0, -1))} title="Quitar último punto"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-cardborder hover:bg-white/10 flex items-center gap-1">
                    <Undo2 className="w-3.5 h-3.5" /> Deshacer
                  </button>
                  <button onClick={() => setWaypoints((w) => [...w].reverse())} title="Invertir sentido"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-cardborder hover:bg-white/10 flex items-center gap-1">
                    <Redo2 className="w-3.5 h-3.5" /> Invertir
                  </button>
                  <button onClick={outAndBack} title="Volver por el mismo camino"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-cardborder hover:bg-white/10 flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5" /> Ida y vuelta
                  </button>
                  <button onClick={optimizeLoop} title="Ordena los puntos y cierra el bucle"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-cardborder hover:bg-white/10 flex items-center gap-1">
                    <Shuffle className="w-3.5 h-3.5" /> Bucle óptimo
                  </button>
                  <button onClick={() => { setWaypoints([]); setLine([]); }} className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-400 flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Limpiar
                  </button>
                </span>
              </div>
              <ol className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {waypoints.map((p, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs bg-white/5 rounded-lg px-2 py-1">
                    <span className="font-black text-blue-300 w-5">{i + 1}</span>
                    <span className="tnum text-gray-400 flex-1">{p[0].toFixed(5)}, {p[1].toFixed(5)}</span>
                    <button onClick={() => setWaypoints((w) => { if (i === 0) return w; const c = [...w]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}
                      disabled={i === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-30" title="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setWaypoints((w) => { if (i === w.length - 1) return w; const c = [...w]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; })}
                      disabled={i === waypoints.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-30" title="Bajar"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setViewing(null); setWaypoints((w) => w.filter((_, j) => j !== i)); }}
                      className="p-1 text-gray-500 hover:text-red-400" title="Quitar punto"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-400" /> Nueva ruta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-1.5">
              {[["cycling", "Bici"], ["running", "Correr"], ["hiking", "Senderismo"]].map(([v, l]) => (
                <button key={v} onClick={() => setSport(v as any)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                    sport === v ? "border-emerald-500/60 text-white bg-emerald-500/20" : "border-cardborder text-gray-500 hover:text-white")}>
                  {l}
                </button>
              ))}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej. Vuelta a la Armuña)" className="field font-semibold" />
            <div className="text-sm text-gray-400 tnum">Distancia estimada: <strong className="text-white">{fmtKm(distM)}</strong></div>
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2 text-gray-300">
                <input type="checkbox" checked={avoidMotorway} onChange={(e) => setAvoidMotorway(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                Evitar autovías y autopistas
              </label>
              <label className="flex items-center gap-2 text-gray-300">
                <input type="checkbox" checked={avoidToll} onChange={(e) => setAvoidToll(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                Evitar peajes
              </label>
              <p className="text-[11px] text-gray-600">
                En bici las autovías ya se evitan solas. Si corres por caminos que no salen en el mapa,
                cambia a la capa «Senderos» o «Satélite» (arriba a la derecha): los caminos los dibujan
                voluntarios en OpenStreetMap.
              </p>
            </div>
            <Button variant="primary" onClick={save} disabled={!name.trim() || line.length < 2} className="w-full">
              Guardar ruta
            </Button>
            <input ref={fileRef} type="file" accept=".gpx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importGpx(f); e.target.value = ""; }} />
            <Button onClick={() => fileRef.current?.click()} className="w-full">
              <Upload className="w-4 h-4" /> Importar GPX
            </Button>
            {msg && <Notice tone="info">{msg}</Notice>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><RouteIcon className="w-5 h-5 text-blue-400" /> Mis rutas ({saved.length})</CardTitle></CardHeader>
          <CardContent>
            {!saved.length ? (
              <EmptyState title="Sin rutas" hint="Planifica arriba y guárdala. Luego descárgala en GPX para el reloj." />
            ) : (
              <ul className="space-y-2">
                {saved.map((r) => (
                  <li key={r.id} className="rounded-lg bg-white/5 border border-cardborder px-3 py-2.5">
                    <button onClick={() => view(r.id)} className="w-full text-left">
                      <div className="font-semibold text-sm">{r.name}</div>
                      <div className="text-xs text-gray-500 tnum">{r.sport} · {fmtKm(r.distance_m)}{r.gain_m ? ` · +${r.gain_m.toFixed(0)} m` : ""}</div>
                    </button>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => downloadGpx(r.id, r.name)} className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/40 text-blue-200 hover:bg-blue-500/25 flex items-center justify-center gap-1">
                        <Download className="w-3.5 h-3.5" /> GPX
                      </button>
                      <button onClick={() => remove(r.id)} className="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:text-red-400 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-gray-600 mt-3">El GPX se importa en Garmin Connect web → se envía al reloj. Trazado por carretera con OSRM (gratis, sin claves).</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-400" /> Zonas privadas ({zones.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-gray-500">El inicio y fin de tus tracks dentro de 200 m de una zona se recortan en mapas y exports.</p>
            <div className="flex gap-2">
              <input value={zoneLabel} onChange={(e) => setZoneLabel(e.target.value)} placeholder="Nombre (Casa, curro…)" className="field" />
            </div>
            {!zones.length ? <p className="text-xs text-gray-600">Sin zonas. Pulsa «Zona privada aquí» sobre el mapa.</p> : (
              <ul className="space-y-1.5">
                {zones.map((z) => (
                  <li key={z.id} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-1.5">
                    <span>{z.label} <span className="text-xs text-gray-500">· {z.radius_m} m</span></span>
                    <button onClick={() => removeZone(z.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
