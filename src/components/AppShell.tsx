import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Wallet, Menu, X, DollarSign, Users, FileText, LogOut as Logout } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";

export function AppShell({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { role } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = role === "admin";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const allMenuItems = [
    {
      label: "Lajan mwen mete nan prè",
      icon: DollarSign,
      path: "/admin",
      description: "Inversiones en préstamos",
      adminOnly: true,
    },
    {
      label: "Kliyan",
      icon: Users,
      path: "/kliyan-list",
      description: "Gestión de clientes",
      adminOnly: true,
    },
    {
      label: "Prè",
      icon: FileText,
      path: "/pre-list",
      description: "Préstamos activos",
      adminOnly: false,
    },
    {
      label: "SòL",
      icon: Users,
      path: "/sol",
      description: "Sistèm préstamo rotativo",
      adminOnly: false,
    },
    {
      label: "Soti",
      icon: Logout,
      path: "/",
      description: "Cerrar sesión",
      adminOnly: false,
    }
  ];

  const menuItems = allMenuItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-green-50 pb-10">
      <header className="sticky top-0 z-10 border-b border-green-400 bg-gradient-to-r from-green-600 to-emerald-700 text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md p-2 transition-colors hover:bg-green-800"
            aria-label="Menu"
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Wallet className="size-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-base font-semibold">{title}</h1>
            <p className="text-xs text-green-100">RAMA Multi-services - Fond Emeroude</p>
          </div>
          {right}
          <button
            onClick={signOut}
            aria-label="Soti"
            className="rounded-md p-2 transition-colors hover:bg-green-800"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed left-0 top-16 z-20 h-[calc(100vh-4rem)] w-64 transform border-r border-green-200 bg-white shadow-lg transition-transform duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="space-y-1 p-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.label === "Soti") {
                      signOut();
                    } else {
                      navigate({ to: item.path as any });
                    }
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all ${
                    isActive || (item.path !== "/" && location.pathname.includes(item.path))
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md"
                      : "text-green-700 hover:bg-green-100"
                  }`}
                >
                  <Icon className="size-5" />
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-xs opacity-75">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className={`mx-auto max-w-3xl px-4 py-5 transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-0"}`}>
          {children}
        </main>
      </div>

      <footer className="mx-auto max-w-3xl px-4 py-4 text-center text-sm text-green-700">
        <p>Tel: (509) 31059832/4290398 0ZDS</p>
      </footer>
    </div>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`rounded-xl border border-green-200 bg-white p-4 text-green-900 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none ring-ring focus:ring-2";

export const buttonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 disabled:opacity-60 disabled:hover:scale-100";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border-2 border-orange-400 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 shadow-md transition-all hover:bg-orange-100 hover:shadow-lg hover:scale-105";
