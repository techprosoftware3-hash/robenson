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

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Tablo administratè — RAMA Multi-services" },
      {
        name: "description",
        content: "Jere kliyan, prè, peman ak kès la: sa ki envesti, sa ki antre ak benefis la.",
      },
      { property: "og:title", content: "Tablo administratè — RAMA Multi-services" },
      { property: "og:description", content: "Jesyon konplè prè chak jou yo." },
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
  component: AdminHome,
});

function AdminHome() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [{ data: profiles }, { data: loans }, { data: payments }, { data: capital }, { data: roles }] =
        await Promise.all([
          supabase.from("profiles").select("*").order("full_name"),
          supabase.from("loans").select("*"),
          supabase.from("payments").select("*"),
          supabase.from("capital_entries").select("*").order("entry_date", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
        ]);
      return {
        profiles: profiles ?? [],
        loans: loans ?? [],
        payments: payments ?? [],
        capital: capital ?? [],
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
  const invested = (data?.capital ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const lentOut = (data?.loans ?? []).reduce((s, l) => s + Number(l.principal), 0);
  const collected = (data?.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = (data?.loans ?? []).reduce((s, l) => s + Number(l.total_due), 0);
  const outside = totalDue - collected;
  const profit = totalDue - lentOut;

  return (
    <AppShell title="Administratè">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Lajan envesti" value={`${gourdes(invested)} G`} color="from-blue-500 to-blue-600" />
          <Stat label="Bay nan prè" value={`${gourdes(lentOut)} G`} color="from-purple-500 to-purple-600" />
          <Stat label="Lajan antre" value={`${gourdes(collected)} G`} color="from-green-500 to-green-600" />
          <Stat label="Rete deyò" value={`${gourdes(outside)} G`} color="from-red-500 to-red-600" />
          <Stat label="Benefis estime" value={`${gourdes(profit)} G`} color="from-yellow-500 to-yellow-600" />
          <Stat label="Kès disponib" value={`${gourdes(invested - lentOut + collected)} G`} color="from-pink-500 to-pink-600" />
        </div>

        <CapitalBox
          entries={data?.capital ?? []}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-overview"] })}
        />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Itilizatè yo ({users.length})</h2>
          <div className="flex gap-2">
            <Link
              to="/solicitudes-pre"
              className={secondaryButtonClass}
            >
              demand prè
            </Link>
            <button className={secondaryButtonClass} onClick={() => setShowForm((v) => !v)}>
              <Plus className="size-4" /> Nouvo itilizatè
            </button>
          </div>
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
              queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
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
                className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 shadow-sm transition-all hover:shadow-md ${
                  isAdmin
                    ? "border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50"
                    : "border-border bg-card"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{c.full_name ?? c.username}</p>
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
                  <p className="text-xs text-muted-foreground">
                    {isAdmin
                      ? `Telefòn: ${c.phone ?? "Pa gen"}`
                      : `Peye: ${gourdes(paid)} G / ${gourdes(due)} G`}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            );
          })}
          {users.length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">Poko gen itilizatè.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`rounded-xl border-2 px-3 py-3 shadow-md bg-gradient-to-br ${color || "from-green-400 to-green-500"} text-white`}>
      <p className="text-xs font-medium opacity-90">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function CapitalBox({ entries, onSaved }: { entries: any[]; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("capital_entries")
      .insert({ amount: Number(amount), note });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount("");
    setNote("");
    toast.success("Lajan envesti ajoute.");
    onSaved();
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Lajan mwen mete nan prè</h2>
      <form onSubmit={add} className="flex gap-2">
        <input
          className={inputClass}
          type="number"
          step="0.01"
          placeholder="Kantite"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <input
          className={inputClass}
          placeholder="Nòt"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className={secondaryButtonClass} disabled={busy}>
          Ajoute
        </button>
      </form>
      {entries.slice(0, 3).map((c) => (
        <p key={c.id} className="text-xs text-muted-foreground">
          {c.entry_date} — {gourdes(c.amount)} G {c.note ? `(${c.note})` : ""}
        </p>
      ))}
    </Card>
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
