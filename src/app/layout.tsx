import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Navigation } from "@/components/layout/Navigation";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "L Clásico — Футбольное Дерби",
    template: "%s | L Clásico",
  },
  description: "Официальная платформа футбольного дерби L Clásico. Турнирная таблица, статистика игроков и Fantasy лига.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="bg-slate-950 text-slate-50 antialiased min-h-screen font-sans">
        <AuthProvider>
          <Navigation />
          {children}
          <Toaster theme="dark" position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
