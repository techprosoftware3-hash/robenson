import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DollarSign, Plus, Trash2, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, Field, buttonClass, inputClass, secondaryButtonClass } from "@/components/AppShell";
import { gourdes } from "@/lib/pret";

export const Route = createFileRoute("/_authenticated/capital")({
  head: () => ({
    meta: [
      { title: "Lajan mwen mete nan prè — RAMA Multi-services" },
      {
        name: "description",
        content: "Jere envestisman nan kès la.",
      },
      { property: "og:title", content: "Lajan mwen mete nan prè — RAMA Multi-services" },
      { property: "og:description", content: "Inversiones en préstamos." },
    ],
  }),
  component: CapitalPage,
});

function CapitalPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["capital-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capital_entries")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalInvested = (entries ?? []).reduce((sum, entry) => sum + Number(entry.amount), 0);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase
        .from("capital_entries")
        .insert({ amount: Number(amount), note });
      if (error) throw error;
      toast.success("Lajan envesti ajoute.");
      setAmount("");
      setNote("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["capital-entries"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Ou sèten ou vle efase sa a?")) return;
    try {
      const { error } = await supabase
        .from("capital_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Antre efase.");
      queryClient.invalidateQueries({ queryKey: ["capital-entries"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  return (
    <AppShell title="Lajan mwen mete nan prè">
      <div className="space-y-5">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-lg border-2 border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-all"
        >
          <ArrowLeft className="size-4" /> Retounen
        </Link>
        {/* Total invested card */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-2">
          <div className="flex items-center gap-3">
            <DollarSign className="size-8" />
            <div>
              <p className="text-sm font-medium opacity-90">Total envesti</p>
              <p className="text-3xl font-bold">{gourdes(totalInvested)} G</p>
            </div>
          </div>
        </Card>

        {/* Add entry form */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-green-800">Antre envestisman</h2>
          <button className={buttonClass} onClick={() => setShowForm(!showForm)}>
            <Plus className="size-4" /> {showForm ? "Kache fòm la" : "Ajoute envestisman"}
          </button>
        </div>

        {showForm && (
          <Card>
            <form onSubmit={addEntry} className="space-y-3">
              <Field label="Kantite (G)">
                <input
                  className={inputClass}
                  type="number"
                  step="0.01"
                  placeholder="Kantite"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </Field>
              <Field label="Nòt">
                <input
                  className={inputClass}
                  placeholder="Nòt (opsyonèl)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <button className={buttonClass} disabled={busy}>
                {busy ? "Tann..." : "Ajoute"}
              </button>
            </form>
          </Card>
        )}

        {/* Entries list */}
        <div>
          <h2 className="text-lg font-semibold text-green-800 mb-3">
            List antre yo ({entries?.length || 0})
          </h2>
          {isLoading ? (
            <Card>
              <p className="text-sm text-green-700">Chajman...</p>
            </Card>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map((entry) => (
                <Card key={entry.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-800">{gourdes(entry.amount)} G</p>
                    <p className="text-xs text-green-600">
                      {entry.entry_date} {entry.note ? `— ${entry.note}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                    title="Efase"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <p className="text-sm text-green-700">Poko gen antre envestisman.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}