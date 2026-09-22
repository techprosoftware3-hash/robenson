import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, DollarSign, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card } from "@/components/AppShell";
import { gourdes } from "@/lib/pret";

export const Route = createFileRoute("/_authenticated/pre-list")({
  head: () => ({
    meta: [
      { title: "Prè yo — RAMA Multi-services" },
      {
        name: "description",
        content: "Lis tout prè yo ak eta yo.",
      },
      { property: "og:title", content: "Prè yo — RAMA Multi-services" },
      { property: "og:description", content: "Jesyon prè yo." },
    ],
  }),
  component: LoansList,
});

function LoansList() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data } = useQuery({
    queryKey: ["all-loans"],
    queryFn: async () => {
      const [{ data: loans }, { data: profiles }, { data: payments }] = await Promise.all([
        supabase.from("loans").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
        supabase.from("payments").select("*"),
      ]);
      return {
        loans: loans ?? [],
        profiles: profiles ?? [],
        payments: payments ?? [],
      };
    },
  });

  const filteredLoans = (data?.loans ?? []).filter((loan) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const client = (data?.profiles ?? []).find((p) => p.id === loan.client_id);
    return (
      client?.full_name?.toLowerCase().includes(searchLower) ||
      client?.username?.toLowerCase().includes(searchLower) ||
      String(loan.principal).includes(searchTerm)
    );
  });

  const totalLent = filteredLoans.reduce((s, l) => s + Number(l.principal), 0);
  const totalDue = filteredLoans.reduce((s, l) => s + Number(l.total_due), 0);
  const totalCollected = (data?.payments ?? [])
    .filter((p) => filteredLoans.some((l) => l.id === p.loan_id))
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <AppShell title="Prè yo">
      <div className="space-y-5">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-lg border-2 border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-all"
        >
          <ArrowLeft className="size-4" /> Retounen
        </Link>
        {/* Resumen de préstamos */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-5" />
              <p className="text-xs font-medium opacity-90">Total preste</p>
            </div>
            <p className="text-2xl font-bold">{gourdes(totalLent)} G</p>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-5" />
              <p className="text-xs font-medium opacity-90">Total pou peye</p>
            </div>
            <p className="text-2xl font-bold">{gourdes(totalDue)} G</p>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-5" />
              <p className="text-xs font-medium opacity-90">Total kolekte</p>
            </div>
            <p className="text-2xl font-bold">{gourdes(totalCollected)} G</p>
          </Card>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-green-600" />
          <input
            type="text"
            placeholder="Rechèch pa non kliyan oswa kantite..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border-2 border-green-300 bg-white py-2.5 pl-10 pr-4 text-green-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
          />
        </div>

        {/* Lista de préstamos */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-green-800">Prè yo ({filteredLoans.length})</h3>
          {filteredLoans.map((loan) => {
            const client = (data?.profiles ?? []).find((p) => p.id === loan.client_id);
            const loanPayments = (data?.payments ?? []).filter((p) => p.loan_id === loan.id);
            const paid = loanPayments.reduce((s, p) => s + Number(p.amount), 0);
            const rest = Number(loan.total_due) - paid;

            return (
              <Link
                key={loan.id}
                to="/admin/$clientId"
                params={{ clientId: loan.client_id }}
                className="block rounded-xl border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-md hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-green-800">{client?.full_name || "Client"}</p>
                    <p className="text-xs text-green-600">{loan.start_date} → {loan.end_date}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    loan.status === "active" 
                      ? "bg-green-500 text-white" 
                      : loan.status === "completed"
                      ? "bg-blue-500 text-white"
                      : "bg-red-500 text-white"
                  }`}>
                    {loan.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-white rounded-lg p-2 border border-green-200">
                    <p className="text-xs text-green-600">Lajan preste</p>
                    <p className="font-bold text-green-800">{gourdes(loan.principal)} G</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-200">
                    <p className="text-xs text-green-600">Peye</p>
                    <p className="font-bold text-green-800">{gourdes(paid)} G</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-200">
                    <p className="text-xs text-green-600">Rès</p>
                    <p className="font-bold text-green-800">{gourdes(rest)} G</p>
                  </div>
                </div>
              </Link>
            );
          })}
          {filteredLoans.length === 0 && (
            <Card>
              <p className="text-sm text-green-700">Poko gen prè.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}