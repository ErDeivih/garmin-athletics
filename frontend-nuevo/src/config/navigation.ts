import type { ComponentType } from 'react';
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
import { ActivitiesPage } from '../pages/extended/ActivitiesPage';
import { CalendarPage } from '../pages/extended/CalendarPage';
import { PerformancePage } from '../pages/extended/PerformancePage';
import { RoutesPage } from '../pages/extended/RoutesPage';
import { SocialPage } from '../pages/extended/SocialPage';
import { TrendsPage } from '../pages/extended/TrendsPage';
import { GymPage } from '../pages/GymPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TodayPage } from '../pages/TodayPage';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** `extended`: solo aparece con la bandera encendida. `null`: siempre. */
  flag: 'extended' | null;
  /** La pantalla. El router se genera desde este registro: no hay rutas a mano. */
  element: ComponentType;
}

/**
 * Registro único de pantallas (DECISIONES.md D-08): añadir una pantalla es
 * añadir esta entrada. El router (`App.tsx`) y la navegación (`AppShell`) se
 * generan de aquí, y la bandera decide si la entrada está encendida.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'today', label: 'Hoy', path: '/', icon: Sun, flag: null, element: TodayPage },
  { id: 'gym', label: 'Gimnasio', path: '/gimnasio', icon: Dumbbell, flag: null, element: GymPage },
  { id: 'settings', label: 'Ajustes', path: '/ajustes', icon: Settings, flag: null, element: SettingsPage },
  { id: 'activities', label: 'Actividades', path: '/actividades', icon: Activity, flag: 'extended', element: ActivitiesPage },
  { id: 'calendar', label: 'Calendario', path: '/calendario', icon: CalendarDays, flag: 'extended', element: CalendarPage },
  { id: 'trends', label: 'Tendencias', path: '/tendencias', icon: TrendingUp, flag: 'extended', element: TrendsPage },
  { id: 'performance', label: 'Rendimiento', path: '/rendimiento', icon: Gauge, flag: 'extended', element: PerformancePage },
  { id: 'routes', label: 'Rutas', path: '/rutas', icon: MapIcon, flag: 'extended', element: RoutesPage },
  { id: 'social', label: 'Social', path: '/social', icon: Users, flag: 'extended', element: SocialPage },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.flag === null);
export const EXTENDED_NAV = NAV_ITEMS.filter((item) => item.flag === 'extended');

export function visibleNav(extended: boolean): NavItem[] {
  return extended ? NAV_ITEMS : PRIMARY_NAV;
}
