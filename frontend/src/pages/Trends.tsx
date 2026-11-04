import { useEffect, useState } from "react";
import { Download, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState, LoadingBlock, fmtDate } from "../components/ui/primitives";
import { api } from "../services/auth";

const METRICS = [
  ["sleep_score", "Sueño (score)"],
  ["sleep_hours", "Sueño (horas)"],
  ["hrv", "HRV (ms)"],
  ["resting_hr", "FC reposo (bpm)"],
  ["body_battery", "Body Battery"],
  ["readiness", "Readiness"],
  ["stress", "Estrés"],
  ["steps", "Pasos"],
] as const;

function movingAvg(series: { date: string; value: number | null }[]): (number | null)[] {
  return series.map((_, i) => {
    const win = series.slice(Math.max(0, i - 6), i + 1).map((d) => d.value).filter((v) => v != null) as number[];
    return win.length ? +(win.reduce((a, b) => a + b, 0) / win.length).toFixed(1) : null;
  });
}

export default function Trends() {
  const [metric, setMetric] = useState<string>("hrv");
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState<{ date: string; value: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const req = metric === "steps"
      ? api.get(`/metrics/stats?days=${days}`).then((r) => ({
          data: { series: (r.data.series ?? []).map((d: any) => ({ date: d.date, value: d.steps })) },
        }))
      : api.get(`/metrics/trends?metric=${metric}&days=${days}`);
    req.then((r) => setSeries(r.data.series ?? []))
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  }, [metric, days]);

  const data = series.map((d, i) => ({ ...d, ma: movingAvg(series)[i] }));
  const vals = series.map((d) => d.value).filter((v) => v != null) as number[];
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";

  const downloadCsv = () => {
    const csv = "date,value\n" + series.map((d) => `${d.date},${d.value ?? ""}`).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trend_${metric}_${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map(([v, l]) => (
            <button key={v} onClick={() => setMetric(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${metric === v ? "bg-gradient-to-r from-blue-500/25 to-purple-500/25 border-blue-500/50 text-white" : "bg-white/5 border-cardborder text-gray-400 hover:text-white"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto items-center">
          {[30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${days === d ? "border-blue-500/60 text-white bg-blue-500/20" : "border-cardborder text-gray-500 hover:text-white"}`}>
              {d}d
            </button>
          ))}
          <button onClick={downloadCsv} title="Descargar CSV"
            className="p-2 rounded-lg bg-white/5 border border-cardborder hover:bg-white/10">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            {METRICS.find(([v]) => v === metric)?.[1]} <span className="text-xs font-normal text-gray-500">· media móvil 7d en verde</span>
          </CardTitle>
          <span className="tnum text-sm text-gray-400">media: <strong className="text-white">{avg}</strong></span>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingBlock lines={4} /> : !vals.length ? (
            <EmptyState title="Sin datos en este periodo" hint="Sincroniza varios días seguidos para ver tendencias." />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={28} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} width={44} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelFormatter={(d) => fmtDate(String(d ?? ""))} />
                  <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls name="Valor" />
                  <Line type="monotone" dataKey="ma" stroke="#34d399" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls name="Media 7d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
