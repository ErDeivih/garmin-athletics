import * as L from "leaflet";
import { LayersControl, Polyline, TileLayer } from "react-leaflet";

const { BaseLayer } = LayersControl;

/** Capas gratuitas sin API key. OSM para ciudad, Topo para caminos/senderos, satélite para orientarse. */
export function BaseLayers() {
  return (
    <LayersControl position="topright">
      <BaseLayer checked name="Calles (OSM)">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
      </BaseLayer>
      <BaseLayer name="Senderos (Topo)">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
        />
      </BaseLayer>
      <BaseLayer name="Satélite">
        <TileLayer
          attribution="&copy; Esri World Imagery"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
      </BaseLayer>
    </LayersControl>
  );
}

/** Marcador numerado sin imágenes externas (los iconos PNG de Leaflet fallan con Vite). */
export function numberedIcon(n: number | string, color = "#60a5fa"): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;font-weight:800;font-size:11px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)">${n}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Verde→amarillo→rojo según valor normalizado 0..1. */
export function heatColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const r = Math.round(lerp(52, 239, x));
  const g = Math.round(x <= 0.5 ? lerp(211, 251, x * 2) : lerp(251, 68, (x - 0.5) * 2));
  const b = Math.round(x <= 0.5 ? lerp(153, 191, x * 2) : lerp(191, 68, (x - 0.5) * 2));
  return `rgb(${r},${g},${b})`;
}

/** Ruta coloreada por métrica (velocidad/pulso/altitud). Dibuja por tramos. */
export function ColoredRoute({
  positions,
  values,
}: {
  positions: [number, number][];
  values: (number | null)[];
}) {
  const nums = values.filter((v): v is number => v != null);
  if (positions.length < 2 || nums.length < 2) {
    return <Polyline positions={positions} pathOptions={{ color: "#60a5fa", weight: 4, opacity: 0.9 }} />;
  }
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  // Agrupar tramos consecutivos para no crear miles de polilíneas
  const segs: { pts: [number, number][]; c: string }[] = [];
  for (let i = 1; i < positions.length; i++) {
    const v = values[i] ?? values[i - 1];
    const c = v == null ? "#60a5fa" : heatColor((v - lo) / span);
    const last = segs[segs.length - 1];
    if (last && last.c === c) {
      last.pts.push(positions[i]);
    } else {
      segs.push({ pts: [positions[i - 1], positions[i]], c });
    }
  }
  // Recortar: demasiados segmentos ralentizan; unir si >400
  const step = segs.length > 400 ? Math.ceil(segs.length / 400) : 1;
  const shown = segs.filter((_, i) => i % step === 0);
  return (
    <>
      {shown.map((s, i) => (
        <Polyline key={i} positions={s.pts} pathOptions={{ color: s.c, weight: 4, opacity: 0.9 }} />
      ))}
    </>
  );
}
