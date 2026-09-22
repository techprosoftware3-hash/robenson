import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Edit, Trash2, Calendar, DollarSign, RotateCw, Search, Eye, EyeOff, CheckCircle, XCircle, ChevronDown, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { gourdes } from "@/lib/pret";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/sol")({
  head: () => ({
    meta: [
      { title: "SòL — RAMA Multi-services" },
      {
        name: "description",
        content: "Sistèm préstamo rotativo entre miembros del equipo.",
      },
      { property: "og:title", content: "SòL — RAMA Multi-services" },
      { property: "og:description", content: "Préstamos rotativos (tandas)." },
    ],
  }),
  component: SolSystem,
});

function SolSystem() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [showMonths, setShowMonths] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalGroup, setModalGroup] = useState<any>(null);

  const { data: me } = useQuery({
    queryKey: ["me-sol"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["sol-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sol_groups" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 30000,
  });

  const { data: members } = useQuery({
    queryKey: ["sol-members", (selectedGroup as any)?.id],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const { data, error } = await supabase
        .from("sol_members" as any)
        .select("*")
        .eq("group_id", (selectedGroup as any).id)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGroup,
    staleTime: 30000,
  });

  const { data: payments } = useQuery({
    queryKey: ["sol-payments", (selectedGroup as any)?.id],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const { data, error } = await supabase
        .from("sol_payments" as any)
        .select("*")
        .eq("group_id", (selectedGroup as any).id)
        .order("month_number");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedGroup,
    staleTime: 30000,
  });

  const { data: modalPayments } = useQuery({
    queryKey: ["sol-payments-modal", (modalGroup as any)?.id],
    queryFn: async () => {
      if (!modalGroup) return [];
      const { data, error } = await supabase
        .from("sol_payments" as any)
        .select("*")
        .eq("group_id", (modalGroup as any).id)
        .order("month_number");
      if (error) throw error;
      return data;
    },
    enabled: !!modalGroup,
    staleTime: 30000,
  });

  const { data: modalMembers } = useQuery({
    queryKey: ["sol-members-modal", (modalGroup as any)?.id],
    queryFn: async () => {
      if (!modalGroup) return [];
      const { data, error } = await supabase
        .from("sol_members" as any)
        .select("*")
        .eq("group_id", (modalGroup as any).id)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!modalGroup,
    staleTime: 30000,
  });

  const myMemberIdsInSelectedGroup = (members ?? [])
    .filter((m: any) => {
      if (!me) return false;
      const nameMatch = me.full_name && (m as any).name && (m as any).name.toLowerCase().includes(me.full_name.toLowerCase());
      const phoneMatch = me.phone && (m as any).phone && me.phone.replace(/\D/g, "") === (m as any).phone.replace(/\D/g, "");
      return nameMatch || phoneMatch;
    })
    .map((m: any) => (m as any).id);

  const visibleGroups = groups ?? [];

  const visibleMembersForSelected = isAdmin
    ? (members ?? []).filter((m: any) => !m.hidden)
    : (members ?? []).filter((m: any) => myMemberIdsInSelectedGroup.includes((m as any).id));

  async function handleDeleteGroup(groupId: string) {
    if (!confirm("Ou sèten ou vle efase gwoup sa a? Sa a pral efase tout manm ak peyman yo.")) return;
    try {
      const { error } = await supabase.from("sol_groups" as any).delete().eq("id", groupId);
      if (error) throw error;
      toast.success("Gwoup efase.");
      setSelectedGroup(null);
      queryClient.invalidateQueries({ queryKey: ["sol-groups"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  async function handleCompleteMonth(groupId: string, monthNumber: number, members: any[]) {
    try {
      const payments = members.map((member) => ({
        group_id: groupId,
        member_id: (member as any).id,
        month_number: monthNumber,
        amount: 0,
        paid: true,
      }));

      const { error } = await supabase.from("sol_payments" as any).insert(payments as any);
      if (error) throw error;
      toast.success(`Mwa ${monthNumber} komplè.`);
      queryClient.invalidateQueries({ queryKey: ["sol-payments"] });
      queryClient.invalidateQueries({ queryKey: ["sol-payments-modal"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  async function handlePayment(groupId: string, memberId: string, monthNumber: number, monthlyAmount: number) {
    try {
      const { data: existingPayment } = await supabase
        .from("sol_payments" as any)
        .select("*")
        .eq("group_id", groupId)
        .eq("member_id", memberId)
        .eq("month_number", monthNumber)
        .maybeSingle();

      let error;
      if (existingPayment) {
        const result = await supabase
          .from("sol_payments" as any)
          .update({
            amount: monthlyAmount,
            paid: true,
            paid_at: new Date().toISOString(),
          })
          .eq("id", (existingPayment as any).id);
        error = result.error;
      } else {
        const result = await supabase
          .from("sol_payments" as any)
          .insert({
            group_id: groupId,
            member_id: memberId,
            month_number: monthNumber,
            amount: monthlyAmount,
            paid: true,
            paid_at: new Date().toISOString(),
          });
        error = result.error;
      }

      if (error) throw error;
      toast.success(`Peyman mwa ${monthNumber} anrejistre.`);
      queryClient.invalidateQueries({ queryKey: ["sol-payments-modal"] });
      queryClient.invalidateQueries({ queryKey: ["sol-payments"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  async function handleUnpay(groupId: string, memberId: string, monthNumber: number) {
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
      queryClient.invalidateQueries({ queryKey: ["sol-payments-modal"] });
      queryClient.invalidateQueries({ queryKey: ["sol-payments"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  return (
    <AppShell title="SòL — Préstamo Rotativo">
      <div className="space-y-5">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-lg border-2 border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-all"
        >
          <ArrowLeft className="size-4" /> Retounen
        </Link>
        {isAdmin ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-green-800">Grupos ({groups?.length || 0})</h2>
              <button className={buttonClass} onClick={() => setShowCreateForm(true)}>
                <Plus className="size-4" /> Nouvo gwoup
              </button>
            </div>

            {showCreateForm && (
              <CreateGroupForm
                onDone={() => {
                  setShowCreateForm(false);
                  queryClient.invalidateQueries({ queryKey: ["sol-groups"] });
                }}
              />
            )}
          </>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-green-800">Gwoup SòL mwen yo</h2>
            <p className="text-sm text-green-600">Non: {me?.full_name ?? me?.username}</p>
          </div>
        )}

        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <Card
              key={(group as any).id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                (selectedGroup as any)?.id === (group as any).id ? "border-green-500 bg-green-50" : ""
              }`}
              onClick={() => {
                setModalGroup(group);
                setShowPaymentModal(true);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-green-800">{(group as any).name}</p>
                  <p className="text-sm text-green-600">
                    {(group as any).months} mwa · {gourdes((group as any).monthly_amount)} G/mwa
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGroup(group);
                      }}
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
                    >
                      <Users className="size-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup((group as any).id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                      title="Efase gwoup"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {visibleGroups.length === 0 && (
            <Card>
              <p className="text-sm text-green-700">
                {isAdmin ? "Poko gen gwoup." : "Ou poko nan okenn gwoup SòL."}
              </p>
            </Card>
          )}
        </div>

        {selectedGroup && (
          <div className="space-y-4 mt-6">
            {isAdmin ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-green-800">
                    Membres: {(selectedGroup as any).name}
                  </h3>
                  <button className={secondaryButtonClass} onClick={() => setShowMemberForm(true)}>
                    <Plus className="size-4" /> Ajoute manm
                  </button>
                </div>

                {showMemberForm && (
                  <AddMemberForm
                    groupId={(selectedGroup as any).id}
                    totalMembers={members?.length || 0}
                    onDone={() => {
                      setShowMemberForm(false);
                      queryClient.invalidateQueries({ queryKey: ["sol-members"] });
                    }}
                  />
                )}

                <div className="space-y-2">
                  <Card>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-green-700">
                        Chwazi yon manm pou wè detay yo
                      </label>
                      <select
                        className="w-full rounded-lg border-2 border-green-300 bg-white py-2.5 px-3 text-green-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                        onChange={(e) => {
                          const selectedMemberId = e.target.value;
                          if (selectedMemberId) {
                            const selectedMember = members?.find((m: any) => (m as any).id === selectedMemberId);
                            if (selectedMember) {
                              toast.success(`Manm seleksiyone: ${(selectedMember as any).name}`);
                            }
                          }
                        }}
                      >
                        <option value="">-- Chwazi yon manm --</option>
                        {members?.filter((m: any) => !m.hidden).map((member: any, index) => (
                          <option key={(member as any).id} value={(member as any).id}>
                            {(member as any).name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </Card>
                  {members?.filter((m: any) => !m.hidden).length === 0 && (
                    <Card>
                      <p className="text-sm text-green-700">Poko gen manm nan gwoup sa.</p>
                    </Card>
                  )}
                </div>
              </>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">{(selectedGroup as any).name}</h3>
                {visibleMembersForSelected.length === 0 && (
                  <Card>
                    <p className="text-sm text-green-700">
                      Ou pa nan gwoup sa a.
                    </p>
                  </Card>
                )}
              </div>
            )}

            {(isAdmin || visibleMembersForSelected.length > 0) && (
              <div className="mt-6">
                {isAdmin && (
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-green-800">
                      Sik peyman ({(selectedGroup as any).months} mwa)
                    </h3>
                    <button
                      onClick={() => setShowMonths(!showMonths)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-green-300 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-all"
                    >
                      {showMonths ? (
                        <>
                          <EyeOff className="size-4" />
                          Kache mwa yo
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-4" />
                          Montre mwa yo
                        </>
                      )}
                    </button>
                  </div>
                )}
                {(isAdmin ? showMonths : true) && (
                  <div className="grid grid-cols-1 gap-2">
                    {isAdmin ? (
                      Array.from({ length: (selectedGroup as any).months }).map((_, monthIndex) => {
                        const monthPayments = (payments as any)?.filter((p: any) => p.month_number === monthIndex + 1);
                        const visibleMembers = (members ?? []).filter((m: any) => !m.hidden);
                        const isCompleted = monthPayments && monthPayments.length === visibleMembers.length;
                        const recipient = visibleMembers[monthIndex % visibleMembers.length];

                        return (
                          <Card
                            key={monthIndex}
                            className={`flex items-center justify-between ${
                              isCompleted ? "bg-green-100 border-green-500" : "bg-orange-50 border-orange-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex size-8 items-center justify-center rounded-full ${
                                isCompleted ? "bg-green-500 text-white" : "bg-orange-400 text-white"
                              } font-bold`}>
                                {monthIndex + 1}
                              </div>
                              <div>
                                <p className="font-semibold text-green-800">
                                  Mwa {monthIndex + 1}
                                </p>
                                <p className="text-xs text-green-600">
                                  {recipient ? `Resevan: ${(recipient as any).name}` : "Pa gen resevan"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="size-4 text-green-600" />
                              <span className="font-bold text-green-800">
                                {gourdes((selectedGroup as any).monthly_amount)} G
                              </span>
                              {isCompleted ? (
                                <span className="text-green-600 text-sm">✓ Komplè</span>
                              ) : (
                                <button
                                  onClick={() => handleCompleteMonth((selectedGroup as any).id, monthIndex + 1, visibleMembers)}
                                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                                >
                                  Komplè
                                </button>
                              )}
                            </div>
                          </Card>
                        );
                      })
                    ) : (
                      visibleMembersForSelected.map((member: any) => (
                        <Card key={(member as any).id} className="p-4">
                          <div className="mb-3">
                            <p className="font-semibold text-green-800">{(member as any).name}</p>
                            <p className="text-xs text-green-600">{(member as any).phone || "Pa gen telefòn"}</p>
                          </div>
                          <div className="grid grid-cols-6 gap-1">
                            {Array.from({ length: (selectedGroup as any).months }).map((_, monthIndex) => {
                              const payment = (payments as any)?.find(
                                (p: any) => p.member_id === (member as any).id && p.month_number === monthIndex + 1
                              );
                              return (
                                <div
                                  key={monthIndex}
                                  className={`flex flex-col items-center p-2 rounded-lg text-center border ${
                                    (payment as any)?.paid
                                      ? "bg-green-100 border-green-300"
                                      : "bg-gray-50 border-gray-200"
                                  }`}
                                >
                                  <span className="text-xs font-semibold">{monthIndex + 1}</span>
                                  {(payment as any)?.paid && <CheckCircle className="size-3 text-green-600" />}
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex justify-between text-sm text-green-700">
                            <span>
                              Peye: {(payments as any ?? []).filter((p: any) => p.member_id === (member as any).id && (p as any).paid).length}/{(selectedGroup as any).months}
                            </span>
                            <span>
                              Montan: {gourdes((selectedGroup as any).monthly_amount)} G/mwa
                            </span>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                )}

                {isAdmin && showMonths && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-3">
                      Peyman pa manm
                    </h3>
                    <div className="space-y-3">
                      {members?.filter((m: any) => !m.hidden).map((member: any) => (
                        <Card key={(member as any).id} className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-semibold text-green-800">{(member as any).name}</p>
                              <p className="text-xs text-green-600">{(member as any).phone || "Pa gen telefòn"}</p>
                            </div>
                            <Link
                              to="/sol-member/$groupId/$memberId"
                              params={{ groupId: (selectedGroup as any).id, memberId: (member as any).id }}
                              className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                            >
                              Gere peyman
                            </Link>
                          </div>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                            {Array.from({ length: (selectedGroup as any).months }).map((_, monthIndex) => {
                              const payment = (payments as any)?.find(
                                (p: any) => p.member_id === (member as any).id && p.month_number === monthIndex + 1
                              );
                              const visibleMembers = (members ?? []).filter((m: any) => !m.hidden);
                              const isRecipient = visibleMembers[monthIndex % visibleMembers.length]?.id === (member as any).id;
                              const monthNumber = monthIndex + 1;

                              return (
                                <button
                                  key={monthIndex}
                                  onClick={() => {
                                    if ((payment as any)?.paid) {
                                      handleUnpay((selectedGroup as any).id, (member as any).id, monthNumber);
                                    } else {
                                      handlePayment((selectedGroup as any).id, (member as any).id, monthNumber, (selectedGroup as any).monthly_amount);
                                    }
                                  }}
                                  className={`flex flex-col items-center p-2 rounded-lg text-center border transition-all hover:shadow-md ${
                                    (payment as any)?.paid
                                      ? "bg-green-100 border-green-300 hover:bg-green-200"
                                      : isRecipient
                                      ? "bg-orange-100 border-orange-300 hover:bg-orange-200"
                                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                                  }`}
                                >
                                  <span className="text-xs font-semibold">{monthNumber}</span>
                                  {(payment as any)?.paid && <CheckCircle className="size-3 text-green-600" />}
                                  {isRecipient && !(payment as any)?.paid && <DollarSign className="size-3 text-orange-600" />}
                                </button>
                              );
                            })}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-green-800">
                {(modalGroup as any)?.name} - Mwa peye yo
              </DialogTitle>
              <DialogDescription className="text-green-600">
                {(modalGroup as any)?.months} mwa · {gourdes((modalGroup as any)?.monthly_amount)} G/mwa
              </DialogDescription>
            </DialogHeader>
            
            {modalGroup && modalMembers && (
              <div className="space-y-4 mt-4">
                {modalMembers.filter((m: any) => !m.hidden).map((member: any) => (
                  <div key={(member as any).id} className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="mb-3">
                      <p className="font-semibold text-green-800">{(member as any).name}</p>
                      <p className="text-xs text-green-600">{(member as any).phone || "Pa gen telefòn"}</p>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                      {Array.from({ length: (modalGroup as any).months }).map((_, monthIndex) => {
                        const payment = (modalPayments as any)?.find(
                          (p: any) => p.member_id === (member as any).id && p.month_number === monthIndex + 1
                        );
                        const monthNumber = monthIndex + 1;
                        return (
                          <button
                            key={monthIndex}
                            onClick={() => {
                              if ((payment as any)?.paid) {
                                handleUnpay((modalGroup as any).id, (member as any).id, monthNumber);
                              } else {
                                handlePayment((modalGroup as any).id, (member as any).id, monthNumber, (modalGroup as any).monthly_amount);
                              }
                            }}
                            className={`flex flex-col items-center p-2 rounded-lg text-center border transition-all hover:shadow-md ${
                              (payment as any)?.paid
                                ? "bg-green-100 border-green-300 hover:bg-green-200"
                                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            <span className="text-xs font-semibold">{monthNumber}</span>
                            {(payment as any)?.paid && <CheckCircle className="size-3 text-green-600" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex justify-between text-sm text-green-700">
                      <span>
                        Peye: {(modalPayments as any ?? []).filter((p: any) => p.member_id === (member as any).id && (p as any).paid).length}/{(modalGroup as any).months}
                      </span>
                      <span>
                        Montan: {gourdes((modalGroup as any).monthly_amount)} G/mwa
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function CreateGroupForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [months, setMonths] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("sol_groups" as any).insert({
        name,
        months: Number(months),
        monthly_amount: Number(monthlyAmount),
      } as any);
      if (error) throw error;
      toast.success("Gwoup kreye.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Non gwoup">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Kantite mwa">
          <input
            className={inputClass}
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            required
          />
        </Field>
        <Field label="Montan chak mwa (G)">
          <input
            className={inputClass}
            type="number"
            step="0.01"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            required
          />
        </Field>
        <button className={buttonClass} disabled={busy}>
          {busy ? "Tann..." : "Kreye gwoup"}
        </button>
      </form>
    </Card>
  );
}

function AddMemberForm({ groupId, totalMembers, onDone }: { groupId: string; totalMembers: number; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"client" | "admin">("client");
  const [busy, setBusy] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);

  const { data: existingClients } = useQuery({
    queryKey: ["existing-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setClientSearchResults([]);
      return;
    }
    const results = (existingClients || []).filter(
      (client) =>
        client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm)
    );
    setClientSearchResults(results);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("sol_members" as any).insert({
        group_id: groupId,
        name,
        phone,
        order_index: totalMembers,
      } as any);
      if (error) throw error;
      toast.success("Manm ajoute.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  async function addExistingClient(client: any) {
    setBusy(true);
    try {
      const { error } = await supabase.from("sol_members" as any).insert({
        group_id: groupId,
        name: client.full_name || client.username,
        phone: client.phone || "",
        order_index: totalMembers,
      } as any);
      if (error) throw error;
      toast.success("Manm ajoute soti nan baz kliyan.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSearchMode(false)}
          className={`flex-1 py-2 rounded-lg transition-all ${
            !searchMode
              ? "bg-green-500 text-white"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          Ajoute manual
        </button>
        <button
          onClick={() => setSearchMode(true)}
          className={`flex-1 py-2 rounded-lg transition-all ${
            searchMode
              ? "bg-green-500 text-white"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          Chache nan baz kliyan
        </button>
      </div>

      {!searchMode ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Non manm">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Telefòn">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Ròl">
            <select
              className={inputClass}
              value={role}
              onChange={(e) => setRole(e.target.value as "client" | "admin")}
              required
            >
              <option value="client">Kliyan</option>
              <option value="admin">Administratè</option>
            </select>
          </Field>
          <button className={buttonClass} disabled={busy}>
            {busy ? "Tann..." : "Ajoute manm"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Chache pa non oswa telefòn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className={secondaryButtonClass} disabled={busy}>
              Chache
            </button>
          </form>

          {clientSearchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <p className="text-sm text-green-700">Rezilta chache ({clientSearchResults.length}):</p>
              {clientSearchResults.map((client: any) => (
                <button
                  key={client.id}
                  onClick={() => addExistingClient(client)}
                  className="w-full flex items-center justify-between rounded-lg border-2 border-green-300 bg-green-50 p-3 text-left hover:bg-green-100 transition-all"
                  disabled={busy}
                >
                  <div>
                    <p className="font-semibold text-green-800">{client.full_name || client.username}</p>
                    <p className="text-xs text-green-600">{client.phone || "Pa gen telefòn"}</p>
                  </div>
                  <Plus className="size-5 text-green-600" />
                </button>
              ))}
            </div>
          )}

          {searchTerm && clientSearchResults.length === 0 && (
            <p className="text-sm text-green-700">Pa gen rezilta pou "{searchTerm}"</p>
          )}
        </div>
      )}
    </Card>
  );
}


