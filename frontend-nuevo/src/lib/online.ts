import { useEffect, useState } from 'react';

/**
 * Estado de conexión del navegador. En el gimnasio suele no haber cobertura:
 * la sesión se guarda en el móvil y esto se lo dice al usuario sin bloquearlo.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, []);

  return online;
}
