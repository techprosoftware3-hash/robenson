import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Receipt, DollarSign } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell, Card, Field, buttonClass, inputClass } from "@/components/AppShell";
import { elapsedPaymentDays, gourdes, sanitizeFileName } from "@/lib/pret";

export const Route = createFileRoute("/_authenticated/kliyan")({
  head: () => ({
    meta: [
      { title: "Prè mwen — RAMA Multi-services" },
      { name: "description", content: "Wè prè ou, sa ou peye chak jou ak resi ou yo." },
      { property: "og:title", content: "Prè mwen — RAMA Multi-services" },
      { property: "og:description", content: "Swiv prè ou ak peman chak jou yo." },
    ],
  }),
  component: ClientPage,
});

function ClientPage() {
  const queryClient = useQueryClient();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    // Primero verificar si hay una URL externa
    const externalUrl = me?.photo_url;
    if (externalUrl) {
      setPhotoUrl(externalUrl);
      return;
    }
    
    // Si no hay URL externa, intentar usar Supabase Storage
    const path = me?.photo_path;
    if (!path) {
      setPhotoUrl(null);
      return;
    }
    supabase.storage
      .from("foto-kliyan")
      .createSignedUrl(path, 3600)
      .then(({ data: signed }) => setPhotoUrl(signed?.signedUrl ?? null))
      .catch(() => setPhotoUrl(null));
  }, [me?.photo_path, me?.photo_url]);

  const { data: loans } = useQuery({
    queryKey: ["my-loans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["my-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: loanRequests } = useQuery({
    queryKey: ["my-loan-requests"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("loan_requests")
        .select("*")
        .eq("client_id", u.user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const incomplete = !me?.full_name || !me?.phone || !me?.id_card || !me?.address;

  return (
    <AppShell title="Prè mwen">
      {incomplete && <ProfileForm me={me} onDone={() => queryClient.invalidateQueries()} />}

      {!incomplete && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Foto ou"
                  onError={() => setPhotoUrl(null)}
                  className="size-16 rounded-full object-cover border-2 border-green-200"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl font-bold border-2 border-green-200">
                  {me?.full_name?.[0]?.toUpperCase() ?? me?.username?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Bonjou</p>
                <p className="text-lg font-semibold">{me?.full_name}</p>
                <p className="text-sm text-muted-foreground">{me?.phone}</p>
              </div>
            </div>
          </Card>

          {(loans ?? []).length === 0 && (
            <Card>
              <p className="text-sm text-muted-foreground">Ou poko gen prè anrejistre.</p>
            </Card>
          )}

          <LoanRequestForm onDone={() => queryClient.invalidateQueries()} />

          {(loanRequests ?? []).length > 0 && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">Demann prè ou yo ({loanRequests.length})</h3>
              <div className="space-y-2">
                {(loanRequests ?? []).map((request) => {
                  const total = Number(request.principal) * (1 + Number(request.interest_rate) / 100);
                  return (
                    <div key={request.id} className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-blue-800">{gourdes(request.principal)} G</p>
                          <p className="text-xs text-blue-600">Total: {gourdes(total)} G · {request.days} jou</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          request.status === "pending"
                            ? "bg-orange-500 text-white"
                            : request.status === "approved"
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}>
                          {request.status === "pending" ? "An atann" : request.status === "approved" ? "Apwouve" : "Refize"}
                        </span>
                      </div>
                      {request.purpose && <p className="text-xs text-blue-700">Rezon: {request.purpose}</p>}
                      <p className="text-xs text-gray-500 mt-1">
                        Demann: {new Date(request.created_at).toLocaleDateString('fr-CA')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {(loans ?? []).map((loan) => {
            const loanPayments = (payments ?? []).filter((p) => p.loan_id === loan.id);
            const paid = loanPayments.reduce((s, p) => s + Number(p.amount), 0);
            const rest = Number(loan.total_due) - paid;
            const due = elapsedPaymentDays(loan.start_date, loan.end_date) * Number(loan.daily_amount);
            const late = Math.max(0, due - paid);
            return (
              <Card key={loan.id} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Lajan mwen prete</span>
                  <span className="text-xl font-bold">{gourdes(loan.principal)} G</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Total pou m peye" value={`${gourdes(loan.total_due)} G`} />
                  <Stat label="Chak jou" value={`${gourdes(loan.daily_amount)} G`} />
                  <Stat label="Sa m peye deja" value={`${gourdes(paid)} G`} />
                  <Stat label="Rès la" value={`${gourdes(rest)} G`} />
                  <Stat label="Dat kòmanse" value={loan.start_date} />
                  <Stat label="Dat fini" value={loan.end_date} />
                </div>
                {late > 0 && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Ou an reta: {gourdes(late)} G
                  </p>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Peman yo</p>
                  {loanPayments.length === 0 && (
                    <p className="text-sm text-muted-foreground">Poko gen peman.</p>
                  )}
                  {loanPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-2 text-sm shadow-md hover:shadow-lg transition-all"
                    >
                      <div>
                        <p className="font-semibold text-green-800">✓ {gourdes(p.amount)} G</p>
                        <p className="text-xs text-green-600">{p.paid_on}</p>
                      </div>
                      <Link
                        to="/resi/$paymentId"
                        params={{ paymentId: p.id }}
                        className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-orange-600 hover:shadow-lg transition-all"
                      >
                        <Receipt className="size-4" /> Resi
                      </Link>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ProfileForm({ me, onDone }: { me: any; onDone: () => void }) {
  const [fullName, setFullName] = useState(me?.full_name ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [idCard, setIdCard] = useState(me?.id_card ?? "");
  const [address, setAddress] = useState(me?.address ?? "");
  const [photoUrl, setPhotoUrl] = useState(me?.photo_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let photoPath = me?.photo_path ?? null;
      let photoUrlValue = photoUrl || null;
      
      // Si se proporciona una URL de foto, usarla
      if (photoUrl) {
        photoUrlValue = photoUrl;
        photoPath = null; // Limpiar photo_path si se usa URL externa
      }
      // Si se sube un archivo, intentar subirlo
      else if (file) {
        const cleanName = sanitizeFileName(file.name);
        const path = `${u.user!.id}/${Date.now()}-${cleanName}`;
        const { error: upErr } = await supabase.storage
          .from("foto-kliyan")
          .upload(path, file, { upsert: true, cacheControl: "no-cache" });
        if (upErr) {
          toast.warning(`No se pudo subir la foto: ${upErr.message}. El perfil se actualizará sin foto.`);
          photoPath = me?.photo_path ?? null;
        } else {
          photoPath = path;
          photoUrlValue = null;
        }
      }
      
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone,
          id_card: idCard,
          address,
          photo_path: photoPath,
          photo_url: photoUrlValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.user!.id);
      if (error) throw error;
      toast.success("Enfòmasyon ou anrejistre.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Enfòmasyon ou</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Ranpli enfòmasyon sa yo pou ou ka kontinye.
      </p>
      <form onSubmit={save} className="space-y-3">
        <Field label="Non konplè">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="Telefòn">
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <Field label="Nimewo kat idantite">
          <input className={inputClass} value={idCard} onChange={(e) => setIdCard(e.target.value)} required />
        </Field>
        <Field label="Adrès">
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required />
        </Field>
        <Field label="Link de la foto (opcional)">
          <input
            className={inputClass}
            type="url"
            placeholder="https://ejemplo.com/foto.jpg"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
        </Field>
        <Field label="Subir foto (opcional)">
          <input
            className={inputClass}
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        <button className={buttonClass} disabled={busy}>
          {busy ? "Anrejistre..." : "Anrejistre"}
        </button>
      </form>
    </Card>
  );
}

function LoanRequestForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("20");
  const [days, setDays] = useState("30");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);

  const total = Number(principal || 0) * (1 + Number(interest || 0) / 100);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("loan_requests").insert({
        client_id: u.user!.id,
        principal: Number(principal),
        interest_rate: Number(interest),
        days: Number(days),
        purpose,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Demann prè ou voye.");
      setPrincipal("");
      setPurpose("");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="size-6 text-orange-600" />
            <div>
              <p className="font-semibold text-orange-800">mande yon prè</p>
              <p className="text-xs text-orange-600">Voye yon demann a administrate a</p>
            </div>
          </div>
          <button className={buttonClass} onClick={() => setOpen(true)}>
            mande
          </button>
        </div>
      </Card>
    );

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-orange-800">mande yon prè</h2>
      <form onSubmit={save} className="space-y-3">
        <Field label="Kantite lajan ou vle prete">
          <input
            className={inputClass}
            type="number"
            step="0.01"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            required
          />
        </Field>
        <Field label="Enterè (%)">
          <input
            className={inputClass}
            type="number"
            step="0.01"
            value={interest}
            disabled
            title="Enterè se konfigire pa administratè a"
          />
        </Field>
        <Field label="Konbyen jou peman">
          <input
            className={inputClass}
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
          />
        </Field>
        <Field label="Rezon pou prè a (opsyonèl)">
          <input
            className={inputClass}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </Field>
        <p className="text-sm text-orange-700">
          Total pou peye: {gourdes(total)} G
        </p>
        <div className="flex gap-2">
          <button className={buttonClass} disabled={busy}>
            {busy ? "Tann..." : "Voye demann"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Anile
          </button>
        </div>
      </form>
    </Card>
  );
}
