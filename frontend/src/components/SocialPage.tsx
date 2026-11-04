import { useCallback, useEffect, useState } from "react";
import { Trophy, UserPlus, Users, Check, X, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { api } from "../services/auth";

interface Athlete {
  id: string;
  username: string;
  display_name: string;
}

interface LeaderboardEntry {
  athlete: Athlete;
  weekly_tss: number;
  activity_count: number;
  ctl: number;
  tsb: number;
  readiness_score: number;
  readiness_status: string;
}

interface FriendsData {
  friends: Athlete[];
  incoming_requests: { friendship_id: string; from: Athlete }[];
  outgoing_requests: { friendship_id: string; to: Athlete }[];
}

const statusColor = (status: string) =>
  status === "VERDE"
    ? "text-emerald-400"
    : status === "AMARILLO"
      ? "text-amber-400"
      : "text-red-400";

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

export default function SocialPage() {
  const [friends, setFriends] = useState<FriendsData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [newFriend, setNewFriend] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [acceptCode, setAcceptCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, lbRes] = await Promise.all([
        api.get("/friends/"),
        api.get("/social/leaderboard?days=7&order_by=weekly_tss").catch(() => ({ data: { ranking: [] } })),
      ]);
      setFriends(fRes.data);
      setLeaderboard(lbRes.data.ranking ?? []);
    } catch {
      setMessage("Error cargando datos sociales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriend.trim()) return;
    setMessage(null);
    try {
      await api.post("/friends/requests", { username: newFriend.trim() });
      setMessage(`Solicitud enviada a ${newFriend.trim()} ✓`);
      setNewFriend("");
      loadAll();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail ?? "No se pudo enviar la solicitud.");
    }
  };

  const respond = async (friendshipId: string, action: "accept" | "reject") => {
    await api.post(`/friends/requests/${friendshipId}/respond`, { action });
    loadAll();
  };

  const createInvite = async () => {
    setMessage(null);
    try {
      const res = await api.post("/friends/invite");
      setInviteCode(res.data.code);
      setMessage(`Código creado: ${res.data.code} (caduca en 7 días). Compártelo por WhatsApp.`);
    } catch {
      setMessage("No se pudo crear la invitación.");
    }
  };

  const acceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptCode.trim()) return;
    setMessage(null);
    try {
      const res = await api.post("/friends/accept-invite", { code: acceptCode.trim() });
      setMessage(`¡Ya sois amigos con ${res.data.friend.display_name}! ✓`);
      setAcceptCode("");
      loadAll();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail ?? "Código no válido.");
    }
  };

  const removeFriend = async (userId: string) => {
    if (!confirm("¿Eliminar esta amistad?")) return;
    await api.delete(`/friends/${userId}`);
    loadAll();
  };

  const inputCls =
    "flex-1 px-3 py-2 bg-white/5 border border-cardborder rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400";

  return (
    <div className="space-y-6">
      {/* LEADERBOARD */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Leaderboard Semanal — Esfuerzo (TSS)
          </CardTitle>
          <span className="text-xs text-gray-500">Últimos 7 días</span>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500 text-sm">Cargando ranking...</p>
          ) : leaderboard.length <= 1 && !friends?.friends.length ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Aún no tienes amigos. Añade a alguien para empezar a comparar esfuerzos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-cardborder">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Atleta</th>
                    <th className="pb-2 pr-2 text-right">TSS semanal</th>
                    <th className="pb-2 pr-2 text-right">Sesiones</th>
                    <th className="pb-2 pr-2 text-right">Forma (CTL)</th>
                    <th className="pb-2 pr-2 text-right">Frescura (TSB)</th>
                    <th className="pb-2 text-right">Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.athlete.id} className="border-b border-cardborder/50 last:border-0">
                      <td className="py-3 pr-2 font-bold">{medal(i)}</td>
                      <td className="py-3 pr-2">
                        <span className="font-semibold">{entry.athlete.display_name}</span>
                        <span className="block text-xs text-gray-500">@{entry.athlete.username}</span>
                      </td>
                      <td className="py-3 pr-2 text-right font-bold text-blue-400">{entry.weekly_tss}</td>
                      <td className="py-3 pr-2 text-right text-gray-400">{entry.activity_count}</td>
                      <td className="py-3 pr-2 text-right">{entry.ctl}</td>
                      <td className={`py-3 pr-2 text-right ${entry.tsb >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {entry.tsb > 0 ? `+${entry.tsb}` : entry.tsb}
                      </td>
                      <td className={`py-3 text-right font-semibold ${statusColor(entry.readiness_status)}`}>
                        {entry.readiness_score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* INVITAR POR CÓDIGO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            Invitar con Código
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-400">
            Más fácil que buscar el usuario: crea un código y pásalo por WhatsApp. Quien lo meta, amigo directo.
          </p>
          <div className="flex gap-2 flex-col sm:flex-row">
            <button
              onClick={createInvite}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold transition whitespace-nowrap"
            >
              Crear código de invitación
            </button>
            {inviteCode && (
              <span className="px-4 py-2 bg-white/5 border border-dashed border-emerald-500/50 rounded-lg text-lg font-black tracking-[0.3em] text-emerald-300 text-center">
                {inviteCode}
              </span>
            )}
          </div>
          <form onSubmit={acceptInvite} className="flex gap-2 flex-col sm:flex-row">
            <input
              type="text"
              value={acceptCode}
              onChange={(e) => setAcceptCode(e.target.value.toUpperCase())}
              placeholder="Tengo un código (ej. K7Q2XA)"
              className={inputCls}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition whitespace-nowrap"
            >
              Aceptar invitación
            </button>
          </form>
          {message && <p className="mt-3 text-sm text-gray-300">{message}</p>}
        </CardContent>
      </Card>

      {/* AÑADIR AMIGO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" />
            Añadir Amigo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendRequest} className="flex gap-2 flex-col sm:flex-row">
            <input
              type="text"
              value={newFriend}
              onChange={(e) => setNewFriend(e.target.value)}
              placeholder="Nombre de usuario de tu amigo (ej. ana_cyclist)"
              className={inputCls}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition whitespace-nowrap"
            >
              Enviar solicitud
            </button>
          </form>
          {message && <p className="mt-3 text-sm text-gray-300">{message}</p>}
        </CardContent>
      </Card>

      {/* SOLICITUDES PENDIENTES */}
      {friends?.incoming_requests.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes Recibidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {friends.incoming_requests.map((req) => (
              <div key={req.friendship_id} className="flex justify-between items-center bg-white/5 rounded-lg px-4 py-2">
                <span>
                  <strong>{req.from.display_name}</strong> <span className="text-gray-500 text-sm">@{req.from.username}</span>
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => respond(req.friendship_id, "accept")}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-md text-xs font-semibold flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Aceptar
                  </button>
                  <button
                    onClick={() => respond(req.friendship_id, "reject")}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-xs font-semibold flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Rechazar
                  </button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* LISTA DE AMIGOS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Tus Amigos ({friends?.friends.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!friends || friends.friends.length === 0 ? (
            <p className="text-gray-500 text-sm">Todavía no tienes amigos aceptados.</p>
          ) : (
            <ul className="space-y-2">
              {friends.friends.map((f) => (
                <li key={f.id} className="flex justify-between items-center bg-white/5 rounded-lg px-4 py-2">
                  <span>
                    <strong>{f.display_name}</strong>{" "}
                    <span className="text-gray-500 text-sm">@{f.username}</span>
                  </span>
                  <button
                    onClick={() => removeFriend(f.id)}
                    title="Eliminar amistad"
                    className="p-1.5 text-gray-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
