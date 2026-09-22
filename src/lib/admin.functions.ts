import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const usernameSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Sèlman lèt, chif, . _ -");

function toEmail(username: string) {
  return `${username.trim().toLowerCase()}@manodor.app`;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ou pa administratè.");
}

/** Kreye premye kont admin nan — sèlman si pa gen okenn admin ki egziste. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; password: string; fullName: string }) =>
    z
      .object({
        username: usernameSchema,
        password: z.string().min(6),
        fullName: z.string().min(2),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("Gen yon administratè deja.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: toEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username.toLowerCase(), full_name: data.fullName },
    });
    if (error) throw new Error(error.message);

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user!.id, role: "admin" });
    if (rErr) throw new Error(rErr.message);
    return { ok: true as const };
  });

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

/** Admin kreye yon nouvo kont kliyan oswa administratè. */
export const createClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      username: string;
      password: string;
      fullName: string;
      phone?: string;
      idCard?: string;
      address?: string;
      role?: "client" | "admin";
    }) =>
      z
        .object({
          username: usernameSchema,
          password: z.string().min(4),
          fullName: z.string().min(2),
          phone: z.string().optional(),
          idCard: z.string().optional(),
          address: z.string().optional(),
          role: z.enum(["client", "admin"]).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const selectedRole = data.role ?? "client";

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: toEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username.toLowerCase(),
        full_name: data.fullName,
        phone: data.phone ?? "",
        id_card: data.idCard ?? "",
        address: data.address ?? "",
      },
    });
    if (error) throw new Error(error.message);

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user!.id, role: selectedRole });
    if (rErr) throw new Error(rErr.message);

    return { id: created.user!.id };
  });

/** Admin chanje kòd sekrè yon kliyan. */
export const resetClientPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; password: string }) =>
    z.object({ clientId: z.string().uuid(), password: z.string().min(4) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.clientId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin efase yon kliyan nèt. */
export const deleteClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
