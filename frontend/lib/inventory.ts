import { supabase } from "@/lib/supabase";

export interface QuotedStockInfo {
  quotedQtyMap: Record<string, number>;
}

/**
 * Pure function to calculate reserved (Đang báo giá) quantities per product.
 *
 * Rules:
 * - Quote status must be active (not "Khách từ chối" and not "Hết hạn")
 * - Quote valid_until must be >= today (or null/empty)
 * - Quote must not be converted into a contract (quote_id not in contracts)
 * - Excludes excludeQuoteId if provided (when editing a quote)
 */
export function calculateReservedStockMap(
  quotes: { id: string; status: string; valid_until: string | null }[],
  quoteItems: { quote_id: string; product_id: string | null; qty: number }[],
  contracts: { quote_id: string | null }[],
  excludeQuoteId?: string
): Record<string, number> {
  const todayStr = new Date().toISOString().split("T")[0];

  const convertedQuoteIds = new Set(
    contracts
      .map((c) => c.quote_id)
      .filter((id): id is string => Boolean(id))
  );

  const validQuoteIds = new Set<string>();
  for (const q of quotes) {
    if (excludeQuoteId && q.id === excludeQuoteId) continue;
    if (["Khách từ chối", "Hết hạn"].includes(q.status)) continue;
    if (convertedQuoteIds.has(q.id)) continue;
    if (q.valid_until && q.valid_until < todayStr) continue;

    validQuoteIds.add(q.id);
  }

  const quotedQtyMap: Record<string, number> = {};
  for (const item of quoteItems) {
    if (item.product_id && validQuoteIds.has(item.quote_id)) {
      quotedQtyMap[item.product_id] = (quotedQtyMap[item.product_id] || 0) + (item.qty || 0);
    }
  }

  return quotedQtyMap;
}

/**
 * Async helper to fetch all necessary data and calculate reserved stock map.
 */
export async function fetchReservedStockMap(excludeQuoteId?: string): Promise<Record<string, number>> {
  const [quotesRes, itemsRes, contractsRes] = await Promise.all([
    supabase.from("quotes").select("id, status, valid_until"),
    supabase.from("quote_items").select("quote_id, product_id, qty"),
    supabase.from("contracts").select("quote_id"),
  ]);

  return calculateReservedStockMap(
    quotesRes.data ?? [],
    itemsRes.data ?? [],
    contractsRes.data ?? [],
    excludeQuoteId
  );
}
