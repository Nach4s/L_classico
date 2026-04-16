"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [managerName, setManagerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // 1. Register via our API
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          managerName: managerName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Surface the exact server error (e.g. "email уже занят")
        setError(data.error ?? "Ошибка регистрации");
        toast.error(data.error ?? "Ошибка регистрации");
        return;
      }

      // 2. Auto sign-in after successful registration
      const signInResult = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Registration succeeded but auto-login failed — send to login page
        toast.success("Регистрация успешна! Войдите в аккаунт.");
        router.push("/auth/login?registered=true");
        return;
      }

      // 3. Redirect to home
      toast.success("Регистрация успешна! Добро пожаловать.");
      router.push("/");
      router.refresh();
    } catch {
      setError("Произошла ошибка. Попробуйте снова.");
      toast.error("Произошла ошибка. Попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            L Clásico
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Создайте аккаунт менеджера
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Manager Name */}
            <div className="space-y-2">
              <label
                htmlFor="managerName"
                className="block text-sm font-medium text-slate-300"
              >
                Имя менеджера
              </label>
              <input
                id="managerName"
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="Как вас будут знать в лиге"
                required
                autoComplete="nickname"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
                           transition-all duration-200"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
                           transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300"
              >
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                required
                autoComplete="new-password"
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500
                           focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
                           transition-all duration-200"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm
                         bg-emerald-500 hover:bg-emerald-400 text-slate-950
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200 active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Создание аккаунта...
                </span>
              ) : (
                "Зарегистрироваться"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-sm text-slate-500">
              Уже есть аккаунт?{" "}
              <Link
                href="/auth/login"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Войти
              </Link>
            </p>
          </div>
        </div>

        {/* Fine print */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Регистрируясь, вы соглашаетесь участвовать в Fantasy лиге L Clásico.
        </p>
      </div>
    </div>
  );
}
