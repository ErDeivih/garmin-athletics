import {
  Activity,
  CalendarDays,
  Dumbbell,
  Gauge,
  Map as MapIcon,
  Settings,
  Sun,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** `extended`: solo aparece con la bandera encendida. `null`: siempre. */
  flag: 'extended' | null;
  /** Texto de la pantalla de inicio de la sección. */
  description: string;
}

/**
 * Registro único de secciones: añadir una pantalla es añadir una entrada y su
 * ruta, no tocar el layout (DECISIONES.md D-08).
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'today', label: 'Hoy', path: '/', icon: Sun, flag: null, description: 'Tu disposición de hoy.' },
  { id: 'gym', label: 'Gimnasio', path: '/gimnasio', icon: Dumbbell, flag: null, description: 'Entrenamiento de fuerza.' },
  { id: 'settings', label: 'Ajustes', path: '/ajustes', icon: Settings, flag: null, description: 'Cuenta, Garmin y preferencias.' },
  { id: 'activities', label: 'Actividades', path: '/actividades', icon: Activity, flag: 'extended', description: 'Lo que has hecho, con sus datos.' },
  { id: 'calendar', label: 'Calendario', path: '/calendario', icon: CalendarDays, flag: 'extended', description: 'La semana de entrenamiento.' },
  { id: 'trends', label: 'Tendencias', path: '/tendencias', icon: TrendingUp, flag: 'extended', description: 'Cómo evolucionan tus métricas.' },
  { id: 'performance', label: 'Rendimiento', path: '/rendimiento', icon: Gauge, flag: 'extended', description: 'Zonas, marcas y comparativas.' },
  { id: 'routes', label: 'Rutas', path: '/rutas', icon: MapIcon, flag: 'extended', description: 'Rutas planificadas y GPX.' },
  { id: 'social', label: 'Social', path: '/social', icon: Users, flag: 'extended', description: 'Amigos y esfuerzo compartido.' },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.flag === null);
export const EXTENDED_NAV = NAV_ITEMS.filter((item) => item.flag === 'extended');

export function visibleNav(extended: boolean): NavItem[] {
  return extended ? NAV_ITEMS : PRIMARY_NAV;
}
