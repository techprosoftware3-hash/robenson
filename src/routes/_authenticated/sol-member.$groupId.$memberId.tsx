import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, DollarSign, Calendar } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, buttonClass, secondaryButtonClass } from "@/components/AppShell";
import { gourdes } from "@/lib/pret";

export const Route = createFileRoute("/_authenticated/sol-member/$groupId/$memberId")({
  head: () => ({
    meta: [
      { title: "Peyman Manm — RAMA Multi-services" },
      {
        name: "description",
        content: "Gere peyman manm nan gwoup SòL.",
      },
      { property: "og:title", content: "Peyman Manm — RAMA Multi-services" },
      { property: "og:description", content: "Sistèm préstamo rotativo." },
    ],
  }),
  component: SolMemberPage,
});

function SolMemberPage() {
  const { groupId, memberId } = Route.useParams();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const { data: group } = useQuery({
    queryKey: ["sol-group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sol_groups" as any)
        .select("*")
        .eq("id", groupId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && isMounted,
  });

  const { data: member } = useQuery({
    queryKey: ["sol-member", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sol_members" as any)
        .select("*")
        .eq("id", memberId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!memberId && isMounted,
  });

  const { data: allMembers } = useQuery({
    queryKey: ["sol-members", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sol_members" as any)
        .select("*")
        .eq("group_id", groupId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && isMounted,
  });

  const { data: payments } = useQuery({
    queryKey: ["sol-payments", groupId, memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sol_payments" as any)
        .select("*")
        .eq("group_id", groupId)
        .eq("member_id", memberId)
        .order("month_number");
      if (error) throw error;
      return data;
    },
    enabled: !!groupId && !!memberId && isMounted,
  });

  const activeMembers = (allMembers as any)?.filter((m: any) => !m.hidden) || [];
  const totalPaid = (payments as any)?.filter((p: any) => (p as any).paid).reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
  const totalOwed = ((group as any)?.monthly_amount || 0) * ((group as any)?.months || 0);
  const remaining = totalOwed - totalPaid;

  async function handlePayment(monthNumber: number) {
    try {
      // Primero verificar si ya existe un pago
      const { data: existingPayment } = await supabase
        .from("sol_payments" as any)
        .select("*")
        .eq("group_id", groupId)
        .eq("member_id", memberId)
        .eq("month_number", monthNumber)
        .maybeSingle();

      let error;
      if (existingPayment) {
        // Actualizar el pago existente
        const result = await supabase
          .from("sol_payments" as any)
          .update({
            amount: (group as any)?.monthly_amount || 0,
            paid: true,
            paid_at: new Date().toISOString(),
          })
          .eq("id", (existingPayment as any).id);
        error = result.error;
      } else {
        // Crear nuevo pago
        const result = await supabase
          .from("sol_payments" as any)
          .insert({
            group_id: groupId,
            member_id: memberId,
            month_number: monthNumber,
            amount: (group as any)?.monthly_amount || 0,
            paid: true,
            paid_at: new Date().toISOString(),
          });
        error = result.error;
      }

      if (error) throw error;
      toast.success(`Peyman mwa ${monthNumber} anrejistre.`);
      queryClient.invalidateQueries({ queryKey: ["sol-payments"] });
    } catch (err) {
      console.error("Error en handlePayment:", err);
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  async function handleUnpay(monthNumber: number) {
    try {
      const { error } = await supabase
        .from("sol_payments" as any)
        .update({
          paid: false,
          paid_at: null,
          amount: 0,
        })
        .eq("group_id", groupId)
        .eq("member_id", memberId)
        .eq("month_number", monthNumber);

      if (error) throw error;
      toast.success(`Peyman mwa ${monthNumber} anile.`);
      queryClient.invalidateQueries({ queryKey: ["sol-payments"] });
    } catch (err) {
      console.error("Error en handleUnpay:", err);
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  const isRecipient = (monthNumber: number) => {
    return (activeMembers[monthNumber % activeMembers.length] as any)?.id === memberId;
  };

  return (
    <AppShell title={`Peyman: ${(member as any)?.name}`}>
      <div className="space-y-5">
        <Link
          to="/sol"
          className="inline-flex items-center gap-2 rounded-lg border-2 border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-all"
        >
          <ArrowLeft className="size-4" /> Retounen
        </Link>
        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-5" />
              <p className="text-xs font-medium opacity-90">Total peye</p>
            </div>
            <p className="text-2xl font-bold">{gourdes(totalPaid)} G</p>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-5" />
              <p className="text-xs font-medium opacity-90">Total dwe</p>
            </div>
            <p className="text-2xl font-bold">{gourdes(totalOwed)} G</p>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="size-5" />
              <p className="text-xs font-medium opacity-90">Rès</p>
            </div>
            <p className="text-2xl font-bold">{gourdes(remaining)} G</p>
          </Card>
        </div>

        {/* Información del miembro */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-800">{(member as any)?.name}</p>
              <p className="text-sm text-green-600">{(member as any)?.phone || "Pa gen telefòn"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600">Gwoup: {(group as any)?.name}</p>
              <p className="text-sm text-green-600">{(group as any)?.months} mwa · {gourdes((group as any)?.monthly_amount)} G/mwa</p>
            </div>
          </div>
        </Card>

        {/* Calendario de pagos */}
        <div>
          <h3 className="text-lg font-semibold text-green-800 mb-3">
            Kalendriye peyman
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: (group as any)?.months || 0 }).map((_, monthIndex) => {
              const monthNumber = monthIndex + 1;
              const payment = (payments as any)?.find((p: any) => p.month_number === monthNumber);
              const recipient = isRecipient(monthNumber);

              return (
                <Card
                  key={monthNumber}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    (payment as any)?.paid
                      ? "bg-green-100 border-green-500"
                      : recipient
                      ? "bg-orange-100 border-orange-500"
                      : "bg-gray-50 border-gray-300"
                  } border-2`}
                  onClick={() => setSelectedMonth(monthNumber)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`flex size-8 items-center justify-center rounded-full font-bold ${
                        (payment as any)?.paid
                          ? "bg-green-500 text-white"
                          : recipient
                          ? "bg-orange-500 text-white"
                          : "bg-gray-400 text-white"
                      }`}>
                        {monthNumber}
                      </div>
                      <div>
                        <p className="font-semibold text-green-800">Mwa {monthNumber}</p>
                        {recipient && (
                          <p className="text-xs text-orange-600">Resevan</p>
                        )}
                      </div>
                    </div>
                    {(payment as any)?.paid ? (
                      <CheckCircle className="size-5 text-green-600" />
                    ) : (
                      <XCircle className="size-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-green-800">
                      {gourdes((group as any)?.monthly_amount)} G
                    </span>
                    {(payment as any)?.paid ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnpay(monthNumber);
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Anile
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePayment(monthNumber);
                        }}
                        className="text-xs text-green-600 hover:text-green-800"
                      >
                        Peye
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Detalle del mes seleccionado */}
        {selectedMonth && (
          <Card>
            <h4 className="font-semibold text-green-800 mb-3">
              Detay mwa {selectedMonth}
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-green-600">Montan:</span>
                <span className="font-semibold text-green-800">{gourdes((group as any)?.monthly_amount)} G</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Resevan:</span>
                <span className="font-semibold text-green-800">
                  {activeMembers[selectedMonth % activeMembers.length]?.name || "Pa gen"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Eta:</span>
                <span className={`font-semibold ${
                  ((payments as any)?.find((p: any) => p.month_number === selectedMonth) as any)?.paid
                    ? "text-green-600"
                    : "text-orange-600"
                }`}>
                  {((payments as any)?.find((p: any) => p.month_number === selectedMonth) as any)?.paid
                    ? "Peye ✓"
                    : "Pa peye"}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
