import { useEffect, useState } from "react";
import { Activity, CalendarDays, Dumbbell, LayoutDashboard, LogOut, Route as RouteIcon, TrendingUp, Users, Zap, Gauge } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Activities from "./pages/Activities";
import Gym from "./pages/Gym";
import Routes from "./pages/Routes";
import Trends from "./pages/Trends";
import Performance from "./pages/Performance";
import Calendar from "./pages/Calendar";
import SocialPage from "./components/SocialPage";
import AuthPanel from "./components/AuthPanel";
import { getMe, getToken, logout, type AuthUser } from "./services/auth";
import { cn } from "./components/ui/Card";

type Tab = "dashboard" | "activities" | "routes" | "gym" | "trends" | "performance" | "calendar" | "social";

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Panel", icon: LayoutDashboard },
  { key: "activities", label: "Actividades", icon: Activity },
  { key: "routes", label: "Rutas", icon: RouteIcon },
  { key: "gym", label: "Gimnasio", icon: Dumbbell },
  { key: "trends", label: "Tendencias", icon: TrendingUp },
  { key: "performance", label: "Rendimiento", icon: Gauge },
  { key: "calendar", label: "Calendario", icon: CalendarDays },
  { key: "social", label: "Social", icon: Users },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (getToken()) {
      getMe().then(setUser).catch(() => logout()).finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    setTab("dashboard");
  };

  if (!authChecked) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Brand />
        <p className="text-gray-500 mt-6 text-sm animate-pulse">Cargando tu espacio...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-10">
        <div className="py-8 text-center">
          <Brand big />
          <p className="text-gray-400 mt-3 text-sm max-w-md mx-auto">
            Tus datos de Garmin, tu carga de entrenamiento y tu gimnasio. En tu servidor, bajo tu control.
          </p>
        </div>
        <AuthPanel onAuthenticated={(u) => setUser(u as unknown as AuthUser)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-cardborder bg-[#0b0f19]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Brand />
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-sm text-gray-400">
                Hola, <strong className="text-gray-200">{user.display_name || user.username}</strong>
              </span>
              <button onClick={handleLogout} title="Cerrar sesión"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-cardborder transition">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Nav */}
          <nav className="flex gap-1.5 pb-3 overflow-x-auto" role="tablist">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition",
                    active
                      ? "bg-gradient-to-r from-blue-500/25 to-purple-500/25 border border-blue-500/40 text-white"
                      : "bg-transparent border border-transparent text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-4 py-5">
        {tab === "dashboard" && <Dashboard key={refreshKey} onSync={() => setRefreshKey((k) => k + 1)} />}
        {tab === "activities" && <Activities />}
        {tab === "routes" && <Routes />}
        {tab === "gym" && <Gym />}
        {tab === "trends" && <Trends />}
        {tab === "performance" && <Performance />}
        {tab === "calendar" && <Calendar />}
        {tab === "social" && <SocialPage />}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-8 text-center text-xs text-gray-600">
        Garmin Athletics · tus datos, tu servidor · ni tus contraseñas ni tus rutas salen de aquí
      </footer>
    </div>
  );
}

function Brand({ big = false }: { big?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid place-items-center w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/25">
        <Zap className="w-4 h-4 text-white" />
      </span>
      <span className={cn(
        "font-black tracking-tight bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent",
        big ? "text-3xl" : "text-lg"
      )}>
        Garmin Athletics
      </span>
    </div>
  );
}
