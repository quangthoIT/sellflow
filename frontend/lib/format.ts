export function formatVND(n: number): string {
  if (n == null || isNaN(n)) return "0đ";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

export function formatVNDShort(n: number): string {
  if (n == null || isNaN(n)) return "0đ";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " tỷ";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(0) + " triệu";
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n + "đ";
}

export function formatDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function genId(
  prefix: string,
  pattern: string = "{PREFIX}-{YEAR}-{SEQ}",
  seqNum: number = 0,
  customerId: string = "",
): string {
  const seq = Math.random().toString(36).substring(2, 7).toUpperCase();
  const now = new Date();
  const year = String(now.getFullYear());
  const date = `${year}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const num = seqNum > 0 ? String(seqNum).padStart(3, "0") : "001";

  return pattern
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YEAR\}/g, year)
    .replace(/\{DATE\}/g, date)
    .replace(/\{SEQ\}/g, seq)
    .replace(/\{NUM\}/g, num)
    .replace(/\{MKH\}/g, customerId);
}

export async function genIdAsync(getPrefix: () => Promise<string>): Promise<string> {
  const prefix = await getPrefix();
  return genId(prefix);
}

export function lineTotal(qty: number, price: number, discount: number): number {
  return Math.max(0, qty * price - (discount || 0));
}

export function calcQuoteTotals(
  items: { qty: number; price: number; discount: number }[],
  discount: number,
  vatPct: number,
  shipping: number,
) {
  const subtotal = items.reduce((s, it) => s + lineTotal(it.qty, it.price, it.discount), 0);
  const afterDiscount = Math.max(0, subtotal - (discount || 0));
  const vat = Math.round((afterDiscount * (vatPct || 0)) / 100);
  const total = afterDiscount + vat + (shipping || 0);
  return { subtotal, afterDiscount, vat, total };
}
