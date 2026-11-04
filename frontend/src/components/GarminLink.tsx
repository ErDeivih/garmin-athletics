import { useCallback, useEffect, useState } from "react";
import { KeyRound, Link2, RefreshCw, Unlink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button, Notice } from "./ui/primitives";
import { api } from "../services/auth";

interface Props {
  onSynced?: () => void;
}

export default function GarminLink({ onSynced }: Props) {
  const [linked, setLinked] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [garminEmail, setGarminEmail] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaTicket, setMfaTicket] = useState<any>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [relinking, setRelinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get("/auth/garmin-status");
      setLinked(res.data.linked);
      setGarminEmail(res.data.garmin_email ?? null);
      setLastSync(res.data.last_sync_at ?? null);
      setNeedsReauth(res.data.needs_reauth ?? false);
      if (res.data.linked && !res.data.needs_reauth) setRelinking(false);
    } catch {
      /* backend no disponible */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const startRelink = () => {
    setEmail(garminEmail ?? "");
    setPassword("");
    setMfaTicket(null);
    setMfaCode("");
    setMessage(null);
    setRelinking(true);
  };

  const linkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setMfaTicket(null);
    setMfaCode("");
    try {
      const res = await api.put("/auth/garmin-credentials", {
        garmin_email: email,
        garmin_password: password,
      });
      if (res.data.status === "need_mfa") {
        setMfaTicket(res.data.ticket);
        setMessage("Garmin pide verificación en dos pasos: introduce el código que te ha llegado.");
      } else {
        setMessage("Cuenta de Garmin vinculada ✓ (tu contraseña no se ha guardado)");
        setPassword("");
        setRelinking(false);
        await loadStatus();
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.detail ?? "Error vinculando la cuenta. Si acabas de intentarlo, espera unos minutos (Garmin limita los intentos).");
    } finally {
      setBusy(false);
    }
  };

  const completeMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/auth/garmin-mfa", {
        garmin_email: email,
        garmin_password: password,
        ticket: mfaTicket,
        code: mfaCode,
      });
      setMessage("Cuenta de Garmin vinculada ✓ (tu contraseña no se ha guardado)");
      setPassword("");
      setMfaCode("");
      setMfaTicket(null);
      setRelinking(false);
      await loadStatus();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail ?? "Código incorrecto o caducado. Repite la vinculación desde el principio.");
    } finally {
      setBusy(false);
    }
  };

  const unlinkAccount = async () => {
    if (!confirm("¿Desvincular tu cuenta de Garmin? Se borrarán los tokens de sesión.")) return;
    setBusy(true);
    try {
      await api.delete("/auth/garmin-credentials");
      setLinked(false);
      setGarminEmail(null);
      setLastSync(null);
      setNeedsReauth(false);
      setMfaTicket(null);
      setMfaCode("");
      setRelinking(false);
      setMessage("Cuenta desvinculada.");
    } catch {
      setMessage("No se pudo desvincular.");
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/sync/garmin");
      setMessage("Sincronización completada ✓");
      await loadStatus();
      onSynced?.();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail ?? "Error sincronizando con Garmin.");
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-400" />
          Conexión Garmin
        </CardTitle>
        {linked && !relinking && (
          <button
            onClick={unlinkAccount}
            className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition"
          >
            <Unlink className="w-3 h-3" /> Desvincular
          </button>
        )}
      </CardHeader>
      <CardContent>
        {linked && !relinking ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Vinculado a <strong>{garminEmail}</strong>
              {lastSync && (
                <span className="block text-xs text-gray-500 mt-1">
                  Última sync: {new Date(lastSync).toLocaleString()}
                </span>
              )}
            </p>
            {needsReauth && (
              <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3">
                <p className="text-sm text-amber-200">
                  Tu sesión de Garmin caducó (a veces Garmin pide el código 2FA de nuevo). Vuelve a vincular con tu contraseña y el código.
                </p>
                <Button variant="primary" onClick={startRelink} className="w-full">
                  <KeyRound className="w-4 h-4" /> Volver a vincular
                </Button>
              </div>
            )}
            <button
              onClick={syncNow}
              disabled={busy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
              {busy ? "Sincronizando..." : "Sincronizar ahora"}
            </button>
          </div>
        ) : mfaTicket ? (
          <form onSubmit={completeMfa} className="space-y-3">
            <Notice tone="info">
              Introduce el código de verificación de Garmin para <strong>{email}</strong>. Caduca en pocos minutos: si falla, repite desde «{relinking ? "Volver a vincular" : "Vincular cuenta"}».
            </Notice>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Código 2FA"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="field"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary flex-1"
              >
                {busy ? "Verificando..." : "Confirmar código"}
              </button>
              {relinking && (
                <button type="button" onClick={() => { setRelinking(false); setMfaTicket(null); }}
                  className="btn-ghost">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={linkAccount} className="space-y-3">
            {relinking && (
              <Notice tone="warn">
                Re-vinculando <strong>{garminEmail}</strong>. Mete la contraseña y, si Garmin lo pide, el código 2FA.
              </Notice>
            )}
            {!relinking && (
              <>
                <p className="text-sm text-gray-400">
                  Vincula tu cuenta de Garmin Connect para sincronizar automáticamente tus métricas y actividades.
                </p>
                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                  🔒 Privado: tu contraseña se usa una sola vez para abrir sesión y no se guarda en ningún sitio. Solo quedan tokens revocables.
                </p>
              </>
            )}
            <input
              type="email"
              required
              placeholder="Email de Garmin Connect"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
            <input
              type="password"
              required
              placeholder="Contraseña de Garmin (la de la app Garmin Connect del móvil)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="btn-primary flex-1"
              >
                {busy ? "Procesando..." : relinking ? "Vincular de nuevo" : "Vincular cuenta"}
              </button>
              {relinking && (
                <button type="button" onClick={() => setRelinking(false)} className="btn-ghost">
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}
        {message && <p className="mt-3 text-sm text-gray-300">{message}</p>}
      </CardContent>
    </Card>
  );
}
