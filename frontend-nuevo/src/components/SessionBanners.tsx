/** Aviso de sesión sin conexión: no bloquea, solo informa de que se guarda en el móvil. */
export function OfflineBanner({ compact = false }: { compact?: boolean }) {
  return (
    <p
      role="status"
      className={`mb-2 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-ink ${compact ? 'text-caption' : 'text-body'}`}
    >
      <strong>Sin conexión.</strong> La sesión se guarda en el móvil
      {compact ? ' y se enviará al volver.' : '; cuando vuelvas a tener red podrás enviarla al reloj.'}
    </p>
  );
}
