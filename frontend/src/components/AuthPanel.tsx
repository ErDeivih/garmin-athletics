import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { login, register } from "../services/auth";

interface Props {
  onAuthenticated: (user: { username: string; display_name: string }) => void;
}

export default function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const user = await login(email, password);
        onAuthenticated(user);
      } else {
        const user = await register(email, username, displayName || username, password);
        onAuthenticated(user);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error de conexión con el backend.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 bg-white/5 border border-cardborder rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400";

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">
            {mode === "login" ? "Iniciar Sesión" : "Crear Cuenta de Atleta"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            {mode === "register" && (
              <>
                <input
                  type="text"
                  required
                  minLength={3}
                  placeholder="Nombre de usuario (ej. corredor_pro)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="text"
                  placeholder="Nombre a mostrar (opcional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={inputCls}
                />
              </>
            )}
            <input
              type="password"
              required
              minLength={8}
              placeholder="Contraseña (mín. 8 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mode === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {busy ? "Procesando..." : mode === "login" ? "Entrar" : "Registrarme"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="w-full text-sm text-gray-400 hover:text-white transition"
            >
              {mode === "login"
                ? "¿No tienes cuenta? Regístrate"
                : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
