import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, buttonClass } from "@/components/AppShell";
import { gourdes } from "@/lib/pret";

export const Route = createFileRoute("/_authenticated/resi/$paymentId")({
  head: () => ({
    meta: [
      { title: "Resi peman — RAMA Multi-services" },
      { name: "description", content: "Resi ofisyèl pou yon peman sou prè a." },
      { property: "og:title", content: "Resi peman — RAMA Multi-services" },
      { property: "og:description", content: "Telechaje oswa enprime resi peman ou." },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { paymentId } = Route.useParams();

  const { data } = useQuery({
    queryKey: ["receipt", paymentId],
    queryFn: async () => {
      const { data: payment, error } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();
      if (error) throw error;
      if (!payment) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, id_card")
        .eq("id", payment.client_id)
        .maybeSingle();
      const { data: loan } = await supabase
        .from("loans")
        .select("*")
        .eq("id", payment.loan_id)
        .maybeSingle();
      const { data: allPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("loan_id", payment.loan_id)
        .lte("created_at", payment.created_at);
      const cumulative = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
      return { payment, profile, loan, cumulative };
    },
  });

  if (!data) {
    return (
      <AppShell title="Resi">
        <Card>Chajman...</Card>
      </AppShell>
    );
  }

  const { payment, profile, loan, cumulative } = data;
  const rest = Number(loan?.total_due ?? 0) - cumulative;

  return (
    <AppShell title="Resi peman">
      <Card className="space-y-4 print:border-0">
        <div className="text-center">
          <h2 className="text-xl font-bold">RAMA Multi-services</h2>
          <p className="text-sm text-muted-foreground">Resi peman</p>
          <p className="text-xs text-muted-foreground">Nimewo resi: #{payment.receipt_no}</p>
        </div>
        <div className="space-y-1 text-sm">
          <Row label="Kliyan" value={profile?.full_name ?? "-"} />
          <Row label="Telefòn" value={profile?.phone ?? "-"} />
          <Row label="Kat idantite" value={profile?.id_card ?? "-"} />
          <Row label="Dat peman" value={payment.paid_on} />
          <Row label="Mwayen" value={payment.method} />
        </div>
        <div className="rounded-lg bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">Kantite peye</p>
          <p className="text-3xl font-bold">{gourdes(payment.amount)} G</p>
        </div>
        <div className="space-y-1 text-sm">
          <Row label="Total prè a" value={`${gourdes(loan?.total_due)} G`} />
          <Row label="Total peye jiska kounye a" value={`${gourdes(cumulative)} G`} />
          <Row label="Rès pou peye" value={`${gourdes(rest)} G`} />
        </div>
        {payment.note && <p className="text-sm text-muted-foreground">Nòt: {payment.note}</p>}
      </Card>
      <button onClick={() => window.print()} className={`${buttonClass} mt-4 print:hidden`}>
        <Printer className="size-4" /> Enprime / Telechaje
      </button>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
