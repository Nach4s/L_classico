"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ManagerNameForm({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  if (currentName) {
    return null;
  }

  const handleSave = async () => {
    if (!name.trim() || name.trim() === currentName) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerName: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Имя менеджера обновлено!");
      setIsEditing(false);
      // Refreshing server component to show new name
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setName(currentName);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={30}
          autoFocus
          className="bg-slate-800 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-500 w-44 transition-colors"
          placeholder="Ваш никнейм..."
        />
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all disabled:opacity-50"
        >
          {saving ? "..." : "✓"}
        </button>
        <button
          onClick={() => { setName(currentName); setIsEditing(false); }}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors group"
    >
      <span>✏️</span>
      <span className="group-hover:underline">
        {currentName ? "Изменить имя менеджера" : "Задать имя менеджера"}
      </span>
    </button>
  );
}
