import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "./Card";

/* ---------- Botones ---------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ variant = "ghost", className, ...props }: BtnProps) {
  return (
    <button
      className={cn(
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" &&
          "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 transition disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

/* ---------- Insignias de estado ---------- */

export function StatusDot({ status }: { status?: string }) {
  const color =
    status === "VERDE"
      ? "bg-emerald-400"
      : status === "AMARILLO"
        ? "bg-amber-400"
        : status === "ROJO"
          ? "bg-red-400"
          : "bg-gray-500";
  return <span className={cn("inline-block w-2 h-2 rounded-full", color)} />;
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "chip",
        status === "VERDE" && "text-emerald-300 bg-emerald-500/10 border-emerald-500/40",
        status === "AMARILLO" && "text-amber-300 bg-amber-500/10 border-amber-500/40",
        status === "ROJO" && "text-red-300 bg-red-500/10 border-red-500/40"
      )}
    >
      <StatusDot status={status} />
      {status}
    </span>
  );
}

/* ---------- Lyfta ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-label="Cargando">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/* ---------- Estado vacío ---------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {icon && <div className="text-gray-600 mb-3">{icon}</div>}
      <p className="font-semibold text-gray-200">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Aviso ---------- */

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error" | "ok";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2.5 text-sm border",
        tone === "info" && "text-blue-200 bg-blue-500/10 border-blue-500/30",
        tone === "warn" && "text-amber-200 bg-amber-500/10 border-amber-500/30",
        tone === "error" && "text-red-200 bg-red-500/10 border-red-500/30",
        tone === "ok" && "text-emerald-200 bg-emerald-500/10 border-emerald-500/30"
      )}
    >
      {children}
    </div>
  );
}

/* ---------- Anillo de progreso (readiness) ---------- */

export function ScoreRing({
  score,
  status,
  size = 112,
}: {
  score: number;
  status?: string;
  size?: number;
}) {
  const color =
    status === "VERDE" ? "#10b981" : status === "AMARILLO" ? "#f59e0b" : "#ef4444";
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.max(0, Math.min(100, score)) / 100) * c}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-3xl font-black leading-none">{score}</span>
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">readiness</span>
      </div>
    </div>
  );
}

/* ---------- Stepper táctil ---------- */

export function Stepper({ value, onChange, min = 0, max = 999, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))} className="p-2 rounded-lg bg-white/5 border border-cardborder hover:bg-white/10 active:scale-95" aria-label="Menos">
        <Minus className="w-4 h-4" />
      </button>
      <span className="tnum w-12 text-center font-bold">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))} className="p-2 rounded-lg bg-white/5 border border-cardborder hover:bg-white/10 active:scale-95" aria-label="Más">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ---------- Formato ---------- */
export function fmtHours(seconds?: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function fmtDuration(min?: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtKm(m?: number | null): string {
  if (!m) return "—";
  return `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km`;
}

export function fmtPace(distanceM?: number | null, durationS?: number | null): string {
  if (!distanceM || !durationS || distanceM <= 0) return "—";
  const secPerKm = durationS / (distanceM / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}
