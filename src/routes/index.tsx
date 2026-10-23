import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { adminExists, bootstrapAdmin } from "@/lib/admin.functions";
import { usernameToEmail } from "@/lib/pret";
import { Field, buttonClass, inputClass } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RAMA Multi-services — Jesyon prè chak jou" },
      {
        name: "description",
        content:
          "Antre ak non itilizatè ou ak kòd sekrè ou pou wè prè ou, peman chak jou yo ak resi yo.",
      },
      { property: "og:title", content: "RAMA Multi-services — Jesyon prè chak jou" },
      {
        property: "og:description", content: "Jesyon prè, peman chak jou, resi ak rapò pou kliyan ak administratè." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(adminExists);
  const createAdmin = useServerFn(bootstrapAdmin);

  const [needsSetup, setNeedsSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: r } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        navigate({ to: r?.role === "admin" ? "/admin" : "/kliyan", replace: true });
        return;
      }
      const res = await checkAdmin({});
      setNeedsSetup(!res.exists);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (needsSetup) {
        await createAdmin({ data: { username, password, fullName } });
        toast.success("Kont administratè a kreye. W ap antre kounye a.");
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      if (error) throw new Error("Non itilizatè oswa kòd sekrè pa bon.");
      const { data: u } = await supabase.auth.getUser();
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user!.id)
        .maybeSingle();
      navigate({ to: r?.role === "admin" ? "/admin" : "/kliyan", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gen yon pwoblèm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 relative overflow-hidden">
      {/* Background image with overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(https://plus.unsplash.com/premium_photo-1686359754750-05cb4b55f0e7?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8Zm9uZG8lMjB2ZXJkZXxlbnwwfHwwfHx8MA%3D%3D)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <div 
        className="absolute inset-0 z-0 bg-black/20"
      />
      <div 
        className="absolute inset-0 z-0 bg-green-50/20"
        style={{
          backdropFilter: 'blur(1px)'
        }}
      />
      
      <div className="w-full max-w-sm relative z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-green-200">
          <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl">
            <Wallet className="size-8" />
          </div>
          <h1 className="text-2xl font-bold text-green-800">RAMA Multi-services</h1>
          <p className="mt-1 text-sm text-green-600 font-semibold">Fond Emeroude</p>
          <p className="mt-1 text-sm text-green-700">
            {needsSetup
              ? "Kreye premye kont administratè a"
              : "Antre ak non itilizatè ou ak kòd sekrè ou"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {needsSetup && (
            <Field label="Non konplè">
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </Field>
          )}
          <Field label="Non itilizatè">
            <input
              className={inputClass}
              value={username}
              autoCapitalize="none"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="Kòd sekrè">
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <button className={buttonClass} disabled={busy}>
            {busy ? "Tann..." : needsSetup ? "Kreye kont lan" : "Antre"}
          </button>
        </form>

        {!needsSetup && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Se administratè a ki bay kont kliyan yo.
          </p>
        )}
        <p className="mt-4 text-center text-xs text-green-700">
          Tel: (509) 31059832/4290398 0ZDS
        </p>
        </div>
      </div>
    </div>
  );
}
