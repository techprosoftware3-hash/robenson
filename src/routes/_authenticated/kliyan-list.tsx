import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Plus, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { createClientAccount } from "@/lib/admin.functions";
import { gourdes } from "@/lib/pret";
import {
  AppShell,
  Card,
  Field,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/kliyan-list")({
  head: () => ({
    meta: [
      { title: "Lis kliyan yo — RAMA Multi-services" },
      {
        name: "description",
        content: "Lis konplè tout kliyan yo ak enfòmasyon yo.",
      },
      { property: "og:title", content: "Lis kliyan yo — RAMA Multi-services" },
      { property: "og:description", content: "Jesyon kliyan yo." },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const user = (context as any).user;
    if (!user) return;
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!roleData || roleData.role !== "admin") {
      throw redirect({ to: "/kliyan" });
    }
  },
  component: ClientList,
});

function ClientList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data } = useQuery({
    queryKey: ["all-clients"],
    queryFn: async () => {
      const [{ data: profiles }, { data: loans }, { data: payments }, { data: roles }] =
        await Promise.all([
          supabase.from("profiles").select("*").order("full_name"),
          supabase.from("loans").select("*"),
          supabase.from("payments").select("*"),
          supabase.from("user_roles").select("user_id, role"),
        ]);
      return {
        profiles: profiles ?? [],
        loans: loans ?? [],
        payments: payments ?? [],
        roles: roles ?? [],
      };
    },
  });

  const users = (data?.profiles ?? [])
    .filter((p) =>
      (data?.roles ?? []).some((r) => r.user_id === p.id),
    )
    .filter((c) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        c.full_name?.toLowerCase().includes(searchLower) ||
        c.username?.toLowerCase().includes(searchLower) ||
        c.phone?.includes(searchTerm)
      );
    });

  const getUserRole = (userId: string) => {
    const roleEntry = (data?.roles ?? []).find((r) => r.user_id === userId);
    return roleEntry?.role ?? "client";
  };

  return (
    <AppShell title="Lis kliyan yo">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Itilizatè yo ({users.length})</h2>
          <button className={secondaryButtonClass} onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" /> Nouvo itilizatè
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-green-600" />
          <input
            type="text"
            placeholder="Rechèch pa non oswa telefòn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border-2 border-green-300 bg-white py-2.5 pl-10 pr-4 text-green-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>

        {showForm && (
          <NewClientForm
            onDone={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ["all-clients"] });
            }}
          />
        )}

        <div className="space-y-2">
          {users.map((c) => {
            const role = getUserRole(c.id);
            const loans = (data?.loans ?? []).filter((l) => l.client_id === c.id);
            const paid = (data?.payments ?? [])
              .filter((p) => p.client_id === c.id)
              .reduce((s, p) => s + Number(p.amount), 0);
            const due = loans.reduce((s, l) => s + Number(l.total_due), 0);
            const isAdmin = role === "admin";
            return (
              <Link
                key={c.id}
                to="/admin/$clientId"
                params={{ clientId: c.id }}
                className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 shadow-md hover:shadow-lg transition-all ${
                  isAdmin
                    ? "border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50"
                    : "border-green-400 bg-gradient-to-r from-green-50 to-emerald-50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-green-800">{c.full_name ?? c.username}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isAdmin
                          ? "bg-purple-200 text-purple-800"
                          : "bg-green-200 text-green-800"
                      }`}
                    >
                      {isAdmin ? "Administratè" : "Kliyan"}
                    </span>
                  </div>
                  <p className="text-xs text-green-600">
                    {isAdmin
                      ? `Telefòn: ${c.phone ?? "Pa gen"}`
                      : `Peye: ${gourdes(paid)} G / ${gourdes(due)} G`}
                  </p>
                </div>
                <ChevronRight className="size-5 text-green-600" />
              </Link>
            );
          })}
          {users.length === 0 && (
            <Card>
              <p className="text-sm text-green-700">Poko gen itilizatè.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function NewClientForm({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createClientAccount);
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    phone: "",
    idCard: "",
    address: "",
    role: "client" as "client" | "admin",
  });
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: form });
      toast.success(form.role === "admin" ? "Administratè a kreye." : "Kliyan an kreye.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Non itilizatè">
          <input className={inputClass} value={form.username} onChange={set("username")} required />
        </Field>
        <Field label="Kòd sekrè">
          <input className={inputClass} value={form.password} onChange={set("password")} required />
        </Field>
        <Field label="Non konplè">
          <input className={inputClass} value={form.fullName} onChange={set("fullName")} required />
        </Field>
        <Field label="Telefòn">
          <input className={inputClass} value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Nimewo kat idantite">
          <input className={inputClass} value={form.idCard} onChange={set("idCard")} />
        </Field>
        <Field label="Adrès">
          <input className={inputClass} value={form.address} onChange={set("address")} />
        </Field>
        <Field label="Wòl">
          <select
            className={inputClass}
            value={form.role}
            onChange={set("role")}
            required
          >
            <option value="client">Kliyan</option>
            <option value="admin">Administratè</option>
          </select>
        </Field>
        <button className={buttonClass} disabled={busy}>
          {busy ? "Tann..." : form.role === "admin" ? "Kreye administratè a" : "Kreye kliyan an"}
        </button>
      </form>
    </Card>
  );
}
