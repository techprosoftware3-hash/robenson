// Zouti kalkil pou prè yo (peman chak jou sof dimanch)

export function isSunday(d: Date) {
  return d.getUTCDay() === 0;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dat fen an: konte `days` jou peman apati start_date, san dimanch. */
export function computeEndDate(startDate: string, days: number): string {
  let d = parseDate(startDate);
  let counted = 0;
  // premye jou a konte si li pa dimanch
  while (counted < days) {
    if (!isSunday(d)) counted++;
    if (counted < days) d = new Date(d.getTime() + 86400000);
  }
  return formatDate(d);
}

/** Konbyen jou peman ki pase depi kòmansman jiska jodi a (san dimanch). */
export function elapsedPaymentDays(startDate: string, endDate: string): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const today = parseDate(formatDate(new Date()));
  const last = today < end ? today : end;
  if (last < start) return 0;
  let count = 0;
  for (let d = new Date(start); d <= last; d = new Date(d.getTime() + 86400000)) {
    if (!isSunday(d)) count++;
  }
  return count;
}

export function gourdes(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("fr-HT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@manodor.app`;
}

/**
 * Sanitize yon non fichye pou li pase nan Supabase Storage san 400:
 * - Retire tout karaktè ki pa alfanimerik, tire, souliye, pwen, oswa espas (ki vin tire)
 * - Remplace plizyè tire pa yon sèl
 * - Retire tire nan kòmansman ak fen
 * - Retaire tout kòmanse ak pwen (dosye kache / dotfiles)
 */
export function sanitizeFileName(name: string): string {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.slice(0, name.length - ext.length);
  const sanitized = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}._-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 80);
  const cleanExt = ext.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
  if (!sanitized) return `fichye-${Date.now()}${cleanExt}`;
  return `${sanitized}${cleanExt}`;
}
