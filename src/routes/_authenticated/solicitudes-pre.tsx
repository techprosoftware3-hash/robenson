import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, DollarSign, Calendar } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, buttonClass, inputClass } from "@/components/AppShell";
import { gourdes, computeEndDate, formatDate } from "@/lib/pret";

export const Route = createFileRoute("/_authenticated/solicitudes-pre")({
  head: () => ({
    meta: [
      { title: "demand prè — RAMA Multi-services" },
      { name: "description", content: "Vey ak apwouve oswa rejte demann prè." },
      { property: "og:title", content: "demand prè — RAMA Multi-services" },
      { property: "og:description", content: "Jesyon demann prè kliyan yo." },
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
  component: LoanRequestsPage,
});

function LoanRequestsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const { data } = useQuery({
    queryKey: ["loan-requests", filter],
    queryFn: async () => {
      const [{ data: requests }, { data: profiles }] = await Promise.all([
        supabase
          .from("loan_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);
      return {
        requests: requests ?? [],
        profiles: profiles ?? [],
      };
    },
  });

  const filteredRequests = (data?.requests ?? []).filter((req) => {
    if (filter === "all") return true;
    return req.status === filter;
  });

  async function handleApprove(requestId: string, requestData: any) {
    try {
      const { data: u } = await supabase.auth.getUser();
      
      // Calcular detalles del préstamo
      const total = Number(requestData.principal) * (1 + Number(requestData.interest_rate) / 100);
      const daily = Number(requestData.days) > 0 ? total / Number(requestData.days) : 0;
      const startDate = formatDate(new Date());
      const endDate = computeEndDate(startDate, Number(requestData.days));

      // Crear el préstamo
      const { error: loanError } = await supabase.from("loans").insert({
        client_id: requestData.client_id,
        principal: Number(requestData.principal),
        total_due: Number(total.toFixed(2)),
        daily_amount: Number(daily.toFixed(2)),
        start_date: startDate,
        end_date: endDate,
        status: "active",
      });

      if (loanError) throw loanError;

      // Actualizar la solicitud
      const { error: updateError } = await supabase
        .from("loan_requests")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", requestId);

      if (updateError) throw updateError;

      toast.success("Demann apwouve.");
      queryClient.invalidateQueries({ queryKey: ["loan-requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  async function handleReject(requestId: string) {
    if (!confirm("Ou sèten ou vle rejte demann sa a?")) return;
    try {
      const { error } = await supabase
        .from("loan_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      toast.success("Demann refize.");
      queryClient.invalidateQueries({ queryKey: ["loan-requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  return (
    <AppShell title="demand prè">
      <div className="space-y-5">
        {/* Filtros */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg border-2 ${
              filter === "all" ? "border-green-500 bg-green-50 text-green-800" : "border-gray-300 text-gray-700"
            }`}
            onClick={() => setFilter("all")}
          >
            Tout
          </button>
          <button
            className={`px-4 py-2 rounded-lg border-2 ${
              filter === "pending" ? "border-orange-500 bg-orange-50 text-orange-800" : "border-gray-300 text-gray-700"
            }`}
            onClick={() => setFilter("pending")}
          >
            An atann ({(data?.requests ?? []).filter(r => r.status === "pending").length})
          </button>
          <button
            className={`px-4 py-2 rounded-lg border-2 ${
              filter === "approved" ? "border-green-500 bg-green-50 text-green-800" : "border-gray-300 text-gray-700"
            }`}
            onClick={() => setFilter("approved")}
          >
            Apwouve
          </button>
          <button
            className={`px-4 py-2 rounded-lg border-2 ${
              filter === "rejected" ? "border-red-500 bg-red-50 text-red-800" : "border-gray-300 text-gray-700"
            }`}
            onClick={() => setFilter("rejected")}
          >
            Rejte
          </button>
        </div>

        {/* Lista de solicitudes */}
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const client = (data?.profiles ?? []).find((p) => p.id === request.client_id);
            const total = Number(request.principal) * (1 + Number(request.interest_rate) / 100);
            const daily = Number(request.days) > 0 ? total / Number(request.days) : 0;

            return (
              <Card key={request.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-800">{client?.full_name || "Client"}</p>
                    <p className="text-xs text-green-600">{client?.phone || "Pa gen telefòn"}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    request.status === "pending"
                      ? "bg-orange-500 text-white"
                      : request.status === "approved"
                      ? "bg-green-500 text-white"
                      : "bg-red-500 text-white"
                  }`}>
                    {request.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-white rounded-lg p-2 border border-green-200">
                    <p className="text-xs text-green-600">Lajan</p>
                    <p className="font-bold text-green-800">{gourdes(request.principal)} G</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-200">
                    <p className="text-xs text-green-600">Enterè</p>
                    <p className="font-bold text-green-800">{request.interest_rate}%</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-green-200">
                    <p className="text-xs text-green-600">Jou</p>
                    <p className="font-bold text-green-800">{request.days}</p>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-green-600 mb-1">Total pou peye: {gourdes(total)} G · {gourdes(daily)} G/jou</p>
                  {request.purpose && <p className="text-xs text-green-700">Rezon: {request.purpose}</p>}
                </div>

                {request.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      onClick={() => handleApprove(request.id, request)}
                    >
                      <CheckCircle className="size-4" /> Apwouve
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      onClick={() => handleReject(request.id)}
                    >
                      <XCircle className="size-4" /> Rejte
                    </button>
                  </div>
                )}

                {request.status === "approved" && (
                  <Link
                    to="/admin/$clientId"
                    params={{ clientId: request.client_id }}
                    className="block text-center text-sm text-green-600 hover:text-green-800"
                  >
                    Wè prè a →
                  </Link>
                )}
              </Card>
            );
          })}

          {filteredRequests.length === 0 && (
            <Card>
              <p className="text-sm text-green-700">Poko gen demann.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
