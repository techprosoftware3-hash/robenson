import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Trash2, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { deleteClientAccount, resetClientPassword } from "@/lib/admin.functions";
import { computeEndDate, elapsedPaymentDays, formatDate, gourdes, sanitizeFileName } from "@/lib/pret";
import {
  AppShell,
  Card,
  Field,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin/$clientId")({
  head: () => ({
    meta: [
      { title: "Eta kont kliyan — RAMA Multi-services" },
      { name: "description", content: "Eta konplè kont yon kliyan: prè, peman ak resi." },
      { property: "og:title", content: "Eta kont kliyan — RAMA Multi-services" },
      { property: "og:description", content: "Rapò ak jesyon peman chak jou pou yon kliyan." },
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
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const removeClient = useServerFn(deleteClientAccount);
  const resetPassword = useServerFn(resetClientPassword);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const [{ data: profile }, { data: loans }, { data: payments }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", clientId).maybeSingle(),
        supabase
          .from("loans")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("*")
          .eq("client_id", clientId)
          .order("paid_on", { ascending: false }),
      ]);
      return { profile, loans: loans ?? [], payments: payments ?? [] };
    },
  });

  useEffect(() => {
    // Primero verificar si hay una URL externa
    const externalUrl = data?.profile?.photo_url;
    if (externalUrl) {
      setPhotoUrl(externalUrl);
      return;
    }
    
    // Si no hay URL externa, intentar usar Supabase Storage
    const path = data?.profile?.photo_path;
    if (!path) return;
    supabase.storage
      .from("foto-kliyan")
      .createSignedUrl(path, 3600)
      .then(({ data: signed }) => setPhotoUrl(signed?.signedUrl ?? null))
      .catch(() => setPhotoUrl(null));
  }, [data?.profile?.photo_path, data?.profile?.photo_url]);

  const refresh = () => queryClient.invalidateQueries();
  const profile = data?.profile;
  const totalPaid = (data?.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = (data?.loans ?? []).reduce((s, l) => s + Number(l.total_due), 0);

  async function onDelete() {
    if (!confirm("Efase kliyan sa a nèt?")) return;
    try {
      await removeClient({ data: { clientId } });
      toast.success("Kliyan an efase.");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  async function onResetPassword() {
    const pwd = prompt("Nouvo kòd sekrè:");
    if (!pwd) return;
    try {
      await resetPassword({ data: { clientId, password: pwd } });
      toast.success("Kòd sekrè a chanje.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    }
  }

  return (
    <AppShell title={profile?.full_name ?? "Kliyan"}>
      <div className="space-y-5">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-lg border-2 border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-all"
        >
          <ArrowLeft className="size-4" /> Retounen
        </Link>
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Foto kliyan"
                onError={() => setPhotoUrl(null)}
                className="size-16 rounded-full object-cover border-2 border-green-200"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl font-bold border-2 border-green-200">
                {profile?.full_name?.[0]?.toUpperCase() ?? profile?.username?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <p className="font-semibold">{profile?.full_name}</p>
              <p className="text-sm text-muted-foreground">{profile?.phone}</p>
              <p className="text-xs text-muted-foreground">Kat: {profile?.id_card ?? "-"}</p>
              <p className="text-xs text-muted-foreground">{profile?.address}</p>
            </div>
          </div>
          <EditProfile profile={profile} onSaved={refresh} />
          <div className="flex gap-2 flex-wrap">
            <button className={secondaryButtonClass} onClick={onResetPassword}>
              Chanje kòd sekrè
            </button>
            <button className={secondaryButtonClass} onClick={onDelete}>
              <Trash2 className="size-4" /> Efase
            </button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card px-3 py-3">
            <p className="text-xs text-muted-foreground">Total li bay</p>
            <p className="text-lg font-bold">{gourdes(totalPaid)} G</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-3">
            <p className="text-xs text-muted-foreground">Rès pou li peye</p>
            <p className="text-lg font-bold">{gourdes(totalDue - totalPaid)} G</p>
          </div>
        </div>

        <NewLoanForm clientId={clientId} onSaved={refresh} />

        {(data?.loans ?? []).map((loan) => {
          const loanPayments = (data?.payments ?? []).filter((p) => p.loan_id === loan.id);
          const paid = loanPayments.reduce((s, p) => s + Number(p.amount), 0);
          const dueToDate =
            elapsedPaymentDays(loan.start_date, loan.end_date) * Number(loan.daily_amount);
          return (
            <Card key={loan.id} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-semibold">Prè: {gourdes(loan.principal)} G</p>
                  <p className="text-xs text-muted-foreground">
                    {loan.start_date} → {loan.end_date} · {gourdes(loan.daily_amount)} G/jou
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">{loan.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Mini label="Total" value={`${gourdes(loan.total_due)} G`} />
                <Mini label="Peye" value={`${gourdes(paid)} G`} />
                <Mini label="Rès" value={`${gourdes(Number(loan.total_due) - paid)} G`} />
              </div>
              {dueToDate - paid > 0 && (
                <p className="text-sm text-destructive">Reta: {gourdes(dueToDate - paid)} G</p>
              )}
              <PaymentForm loan={loan} clientId={clientId} onSaved={refresh} />
              <div className="space-y-1">
                {loanPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-2 text-sm shadow-md hover:shadow-lg transition-all"
                  >
                    <span className="font-semibold text-green-800">
                      ✓ {p.paid_on} — {gourdes(p.amount)} G
                    </span>
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
    </AppShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function EditProfile({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    id_card: profile?.id_card ?? "",
    address: profile?.address ?? "",
    photo_url: profile?.photo_url ?? "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      id_card: profile?.id_card ?? "",
      address: profile?.address ?? "",
      photo_url: profile?.photo_url ?? "",
    });
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let photo_path = profile?.photo_path ?? null;
    let photo_url = form.photo_url || null;
    
    // Si se proporciona una URL de foto, usarla
    if (form.photo_url) {
      photo_url = form.photo_url;
      photo_path = null; // Limpiar photo_path si se usa URL externa
    }
    // Si se sube un archivo, intentar subirlo
    else if (file) {
      const cleanName = sanitizeFileName(file.name);
      const path = `${profile.id}/${Date.now()}-${cleanName}`;
      console.log("Intentando subir foto a:", path);
      console.log("Tamaño del archivo:", file.size, "bytes");
      
      const { error: upErr } = await supabase.storage
        .from("foto-kliyan")
        .upload(path, file, { upsert: true, cacheControl: "no-cache" });
      
      if (upErr) {
        console.error("Error al subir foto:", upErr);
        // No bloquear la actualización del perfil si falla la foto
        toast.warning(`No se pudo subir la foto: ${upErr.message}. El perfil se actualizará sin foto.`);
        // Mantener la foto existente o null
        photo_path = profile?.photo_path ?? null;
      } else {
        photo_path = path;
        photo_url = null;
      }
    }
    
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, photo_path, photo_url, updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Enfòmasyon aktyalize.");
    setOpen(false);
    onSaved();
  }

  if (!open)
    return (
      <button className={secondaryButtonClass} onClick={() => setOpen(true)}>
        Edite enfòmasyon
      </button>
    );

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Non konplè">
        <input
          className={inputClass}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
      </Field>
      <Field label="Telefòn">
        <input
          className={inputClass}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </Field>
      <Field label="Nimewo kat idantite">
        <input
          className={inputClass}
          value={form.id_card}
          onChange={(e) => setForm({ ...form, id_card: e.target.value })}
        />
      </Field>
      <Field label="Adrès">
        <input
          className={inputClass}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </Field>
      <Field label="Link de la foto (opcional)">
        <input
          className={inputClass}
          type="url"
          placeholder="https://ejemplo.com/foto.jpg"
          value={form.photo_url}
          onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
        />
      </Field>
      <Field label="Subir foto (opcional)">
        <input
          className={inputClass}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <button className={buttonClass}>Anrejistre</button>
    </form>
  );
}

function NewLoanForm({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("20");
  const [days, setDays] = useState("30");
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [busy, setBusy] = useState(false);

  const total = Number(principal || 0) * (1 + Number(interest || 0) / 100);
  const daily = Number(days) > 0 ? total / Number(days) : 0;
  const endDate = principal ? computeEndDate(startDate, Number(days || 0)) : "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("loans").insert({
      client_id: clientId,
      principal: Number(principal),
      total_due: Number(total.toFixed(2)),
      daily_amount: Number(daily.toFixed(2)),
      start_date: startDate,
      end_date: endDate,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Prè a kreye.");
    setPrincipal("");
    setOpen(false);
    onSaved();
  }

  if (!open)
    return (
      <button className={buttonClass} onClick={() => setOpen(true)}>
        Nouvo prè
      </button>
    );

  return (
    <Card>
      <form onSubmit={save} className="space-y-3">
        <Field label="Kantite lajan li prete">
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
            onChange={(e) => setInterest(e.target.value)}
          />
        </Field>
        <Field label="Konbyen jou peman (san dimanch)">
          <input
            className={inputClass}
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            required
          />
        </Field>
        <Field label="Dat kòmanse">
          <input
            className={inputClass}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
        <p className="text-sm text-muted-foreground">
          Total: {gourdes(total)} G · {gourdes(daily)} G chak jou · fini {endDate || "-"}
        </p>
        <button className={buttonClass} disabled={busy}>
          {busy ? "Tann..." : "Kreye prè a"}
        </button>
      </form>
    </Card>
  );
}

function PaymentForm({
  loan,
  clientId,
  onSaved,
}: {
  loan: any;
  clientId: string;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(loan.daily_amount));
  const [paidOn, setPaidOn] = useState(formatDate(new Date()));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      loan_id: loan.id,
      client_id: clientId,
      amount: Number(amount),
      paid_on: paidOn,
      created_by: u.user!.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Peman an make.");
    onSaved();
  }

  return (
    <form onSubmit={save} className="flex flex-wrap gap-2">
      <input
        className={`${inputClass} flex-1`}
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <input
        className={`${inputClass} flex-1`}
        type="date"
        value={paidOn}
        onChange={(e) => setPaidOn(e.target.value)}
        required
      />
      <button className={secondaryButtonClass} disabled={busy}>
        Make peman
      </button>
    </form>
  );
}
