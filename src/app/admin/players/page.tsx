"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Position = "GK" | "DEF" | "MID" | "FWD" | "COACH";

interface Player {
  id: number;
  name: string;
  slug: string;
  position: Position;
  team: string;
  price: string;
  avatarUrl: string | null;
  isActive: boolean;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD", "COACH"];
const POSITION_LABELS: Record<Position, string> = {
  GK: "Вратарь",
  DEF: "Защитник",
  MID: "Полузащитник",
  FWD: "Нападающий",
  COACH: "Тренер",
};
const POSITION_COLORS: Record<Position, string> = {
  GK: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  DEF: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  MID: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  FWD: "bg-red-500/10 text-red-400 border-red-500/20",
  COACH: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export default function AdminPlayersPage() {
  const router = useRouter();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    position: "FWD" as Position,
    team: "1 группа",
    price: "5.0",
    avatarUrl: "/players/player1.jpg",
  });

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/players");
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      setPlayers(data.players || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_а-яё]/gi, "")
      .replace(/[а-яё]/g, (c) => {
        const map: Record<string, string> = {
          а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
          ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
          н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
          ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
          ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
        };
        return map[c] || c;
      });
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => {
      const newSlug = editPlayer ? prev.slug : generateSlug(name);
      return {
        ...prev,
        name,
        slug: newSlug,
        avatarUrl: `/players/${newSlug}.jpg`,
      };
    });
  };

  const openAddForm = () => {
    setEditPlayer(null);
    setFormData({ name: "", slug: "", position: "FWD", team: "1 группа", price: "5.0", avatarUrl: "/players/player1.jpg" });
    setShowForm(true);
  };

  const openEditForm = (player: Player) => {
    setEditPlayer(player);
    setFormData({
      name: player.name,
      slug: player.slug,
      position: player.position,
      team: player.team,
      price: player.price,
      avatarUrl: player.avatarUrl || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let res: Response;

      if (editPlayer) {
        res = await fetch(`/api/admin/players/${editPlayer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        res = await fetch("/api/admin/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(editPlayer ? "Игрок обновлён!" : "Игрок создан!");
      setShowForm(false);
      fetchPlayers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (player: Player) => {
    try {
      const res = await fetch(`/api/admin/players/${player.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !player.isActive }),
      });
      if (!res.ok) throw new Error("Ошибка обновления");
      toast.success(player.isActive ? "Игрок деактивирован" : "Игрок активирован");
      fetchPlayers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filteredPlayers = players
    .filter((p) => {
      if (filter === "active") return p.isActive;
      if (filter === "inactive") return !p.isActive;
      return true;
    })
    .filter((p) =>
      searchQuery
        ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.slug.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    );

  const group1 = filteredPlayers.filter((p) => p.team === "1 группа");
  const group2 = filteredPlayers.filter((p) => p.team === "2 группа");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin")}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              ← Назад
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Игроки <span className="text-emerald-500">L Clásico</span>
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Всего игроков: {players.length}, активных: {players.filter((p) => p.isActive).length}
              </p>
            </div>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <span>+</span> Добавить игрока
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex rounded-xl overflow-hidden border border-slate-800">
            {(["active", "inactive", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                {f === "active" ? "Активные" : f === "inactive" ? "Неактивные" : "Все"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Поиск по имени или slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Modal Form */}
        {showForm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">
                {editPlayer ? `Редактировать: ${editPlayer.name}` : "Новый игрок"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Полное имя *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Мансур Ш."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white transition-colors"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Slug (ID в URL) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => {
                        const newSlug = e.target.value.toLowerCase();
                        setFormData((p) => ({ 
                          ...p, 
                          slug: newSlug,
                          avatarUrl: `/players/${newSlug}.jpg`
                        }));
                      }}
                      placeholder="mansur_sh"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white transition-colors font-mono text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Позиция *
                    </label>
                    <select
                      value={formData.position}
                      onChange={(e) => {
                        const newPos = e.target.value as Position;
                        setFormData((p) => ({ 
                          ...p, 
                          position: newPos,
                          price: newPos === 'COACH' ? "0.0" : p.price 
                        }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white transition-colors"
                    >
                      {POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {pos} — {POSITION_LABELS[pos]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Группа *
                    </label>
                    <select
                      value={formData.team}
                      onChange={(e) => setFormData((p) => ({ ...p, team: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white transition-colors"
                    >
                      <option value="1 группа">1 группа</option>
                      <option value="2 группа">2 группа</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Стоимость в Fantasy (M)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="20"
                      value={formData.price}
                      disabled={formData.position === "COACH"}
                      onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white font-mono transition-colors disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                      Ссылка на фото (Необязательно)
                    </label>
                    <div className="flex gap-4 items-center">
                      {formData.avatarUrl ? (
                        <img 
                          src={formData.avatarUrl} 
                          alt="preview" 
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border border-dashed border-slate-700 flex items-center justify-center flex-shrink-0 bg-slate-900/50">
                          👤
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="/players/player1.jpg"
                        value={formData.avatarUrl}
                        onChange={(e) => setFormData((p) => ({ ...p, avatarUrl: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none text-white transition-colors text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Вставьте ссылку (https://) ИЛИ путь к локальному фото (например: /players/player1.jpg, если оно лежит в папке public/players проекта)
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all disabled:opacity-60"
                  >
                    {saving ? "Сохранение..." : editPlayer ? "Сохранить" : "Создать игрока"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Players Grid */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[{ label: "1 группа", players: group1 }, { label: "2 группа", players: group2 }].map(({ label, players: groupPlayers }) => (
              <div key={label}>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${label === "1 группа" ? "bg-emerald-500" : "bg-orange-400"}`} />
                  {label}
                  <span className="text-xs text-slate-500 font-normal ml-1">
                    ({groupPlayers.length})
                  </span>
                </h2>

                <div className="space-y-2">
                  {groupPlayers.length === 0 && (
                    <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-600 text-sm">
                      Игроков не найдено
                    </div>
                  )}
                  {groupPlayers.map((player) => (
                    <div
                      key={player.id}
                      className={`bg-slate-900 border rounded-xl p-4 flex items-center justify-between gap-4 transition-all ${
                        player.isActive ? "border-slate-800 hover:border-slate-700" : "border-slate-800/50 opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {player.avatarUrl ? (
                          <img 
                            src={player.avatarUrl} 
                            alt={player.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border font-bold text-xs ${POSITION_COLORS[player.position]}`}>
                            {player.position}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{player.name}</p>
                          <div className="flex gap-2 items-center">
                            {!player.avatarUrl && (
                              <span className={`text-[9px] font-bold px-1 rounded flex-shrink-0 ${POSITION_COLORS[player.position]}`}>
                                {player.position}
                              </span>
                            )}
                            <p className="text-[10px] text-slate-500 font-mono truncate">/{player.slug}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-mono font-bold text-emerald-400">
                          {Number(player.price).toFixed(1)}M
                        </span>
                        <button
                          onClick={() => openEditForm(player)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleToggleActive(player)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            player.isActive
                              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                              : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                          }`}
                        >
                          {player.isActive ? "Откл." : "Вкл."}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
