import { db, loadSettings, getCachedSettings, type Product, type Customer } from "@/lib/db";
import { genId, calcQuoteTotals, formatVND } from "@/lib/format";

export type AIResult = {
  action: string;
  summary: string;
  details: string[];
  quoteId?: string;
};

type ParsedCommand = {
  intent: "create_quote" | "create_customer" | "check_stock" | "check_debt" | "help" | "unknown";
  customerName?: string | null;
  productNames: string[];
  quantities: number[];
};

function normalize(s: string): string {
  return s.toLowerCase().trim()
    .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
    .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
    .replace(/ì|í|ị|ỉ|ĩ/g, "i")
    .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
    .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
    .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
    .replace(/đ/g, "d");
}

function fuzzyMatch(input: string, target: string): number {
  const a = normalize(input);
  const b = normalize(target);
  if (a === b) return 1;
  if (b.includes(a)) return 0.9;
  if (a.includes(b)) return 0.85;
  let matches = 0;
  for (const word of a.split(/\s+/)) {
    if (word.length >= 2 && b.includes(word)) matches++;
  }
  const words = a.split(/\s+/).filter((w) => w.length >= 2);
  return words.length > 0 ? matches / words.length * 0.7 : 0;
}

function findBestMatch<T>(input: string, items: T[], getName: (item: T) => string): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = fuzzyMatch(input, getName(item));
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 0.3 ? best : null;
}

function extractQuantities(text: string): { names: string[]; quantities: number[] } {
  const names: string[] = [];
  const quantities: number[] = [];

  const patterns = [
    /(\d+)\s*(?:x|\*|sản phẩm|mặt hàng)?\s*([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)(?=(?:\d+\s*(?:x|\*)|,|và|&|và\s|$))/gi,
    /([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)\s*(\d+)\s*(?:cái|chiếc|đôi|cuốn|hộp|thùng|kg|gram|met|m|lít|lit|l)/gi,
    /([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)\s*x\s*(\d+)/gi,
    /(\d+)\s*x\s*([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)(?=(?:\d+\s*x|,|và|&|$))/gi,
  ];

  const used = new Set<string>();

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      let name: string;
      let qty: number;

      if (pattern.source.includes("(\\d+)\\s*(?:x") || pattern.source.includes("(\\d+)\\s*x\\s*")) {
        if (m[1] && m[2]) {
          if (/^\d+$/.test(m[1])) {
            qty = parseInt(m[1]);
            name = m[2];
          } else {
            name = m[1];
            qty = parseInt(m[2]);
          }
        } else continue;
      } else if (m[1] && m[2]) {
        name = m[1];
        qty = parseInt(m[2]);
      } else continue;

      name = name.trim().replace(/[,;&]+$/g, "").trim();
      if (name.length < 2) continue;
      const key = name + qty;
      if (used.has(key)) continue;
      used.add(key);
      names.push(name);
      quantities.push(qty);
    }
  }

  if (names.length === 0) {
    const productListMatch = text.match(/sản phẩm\s*:?\s*(.+?)(?:$|khách|cho|gửi)/i);
    if (productListMatch) {
      const parts = productListMatch[1].split(/[,;]+|\s+và\s+|\s*&\s*/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length >= 2) {
          names.push(trimmed);
          quantities.push(1);
        }
      }
    }
  }

  return { names, quantities };
}

function extractCustomerName(text: string): string | null {
  const patterns = [
    /khách\s*(?:hàng)?\s*:?\s*([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)(?=(?:sản phẩm|,|;|$))/i,
    /cho\s+khách\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)(?=(?:sản phẩm|,|;|$))/i,
    /khách\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)(?=(?:sản phẩm|,|;|$))/i,
    /gửi\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-\d]*?)(?=(?:sản phẩm|,|;|$))/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const name = m[1].trim().replace(/[,;&]+$/g, "").trim();
      if (name.length >= 2) return name;
    }
  }
  return null;
}

function parseCommand(input: string): ParsedCommand {
  const text = input.trim();
  const lower = normalize(text);

  if (lower.includes("giup") || lower.includes("huong dan") || lower.includes("help") || lower.includes("tro giup")) {
    return { intent: "help", productNames: [], quantities: [] };
  }

  if (lower.includes("con no") || lower.includes("cong no") || lower.includes("no") && lower.includes("khach")) {
    return { intent: "check_debt", productNames: [], quantities: [] };
  }

  if (lower.includes("ton kho") || lower.includes("kho") && lower.includes("con") || lower.includes("het hang") || lower.includes("ton")) {
    return { intent: "check_stock", productNames: [], quantities: [] };
  }

  if (lower.includes("bao gia") || lower.includes("quote") || lower.includes("tao bao gia") || lower.includes("lap bao gia")) {
    const customerName = extractCustomerName(text);
    const { names, quantities } = extractQuantities(text);
    return { intent: "create_quote", customerName, productNames: names, quantities };
  }

  if (lower.includes("khach hang") && (lower.includes("them") || lower.includes("tao") || lower.includes("moi"))) {
    const customerName = extractCustomerName(text);
    return { intent: "create_customer", customerName, productNames: [], quantities: [] };
  }

  return { intent: "unknown", productNames: [], quantities: [] };
}

export async function executeAICommand(input: string): Promise<AIResult> {
  const parsed = parseCommand(input);

  switch (parsed.intent) {
    case "help":
      return {
        action: "help",
        summary: "Tôi có thể giúp bạn:",
        details: [
          "Tạo báo giá: \"Báo giá cho khách Nguyễn Văn A sản phẩm iPhone 15 x 2, Samsung S24 x 1\"",
          "Kiểm tra tồn kho: \"Tồn kho còn bao nhiêu?\"",
          "Kiểm tra công nợ: \"Khách hàng A còn nợ bao nhiêu?\"",
          "Thêm khách hàng: \"Thêm khách hàng Trần Văn B\"",
        ],
      };

    case "check_stock": {
      const { data } = await db.from("products").select("*").order("name");
      const products = (data ?? []) as Product[];
      const lowStock = products.filter((p) => p.stock <= p.min_stock);
      return {
        action: "check_stock",
        summary: `Tổng ${products.length} sản phẩm, ${lowStock.length} sắp hết hàng`,
        details: lowStock.length > 0
          ? lowStock.map((p) => `${p.name}: còn ${p.stock} (tối thiểu ${p.min_stock})`)
          : ["Tất cả sản phẩm đều còn đủ hàng"],
      };
    }

    case "check_debt": {
      const { data: contracts } = await db.from("contracts").select("*").in("status", ["Đã ký", "Đang thực hiện", "Hoàn thành"]);
      const { data: payments } = await db.from("payments").select("*");
      const { data: customers } = await db.from("customers").select("*");
      const customerList = (customers ?? []) as Customer[];
      const contractList = (contracts ?? []) as { id: string; customer_id: string | null }[];
      const paymentList = (payments ?? []) as { contract_id: string; amount: number }[];

      const customerName = parsed.customerName;
      let targetContracts = contractList;
      if (customerName) {
        const customer = findBestMatch(customerName, customerList, (c) => c.name);
        if (customer) {
          targetContracts = contractList.filter((c) => c.customer_id === customer.id);
        }
      }

      const details: string[] = [];
      let totalDebt = 0;
      for (const c of targetContracts) {
        const { data: items } = await db.from("contract_items").select("*").eq("contract_id", c.id);
        const total = (items ?? []).reduce((s: number, it: any) => s + it.qty * it.price, 0);
        const paid = paymentList.filter((p) => p.contract_id === c.id).reduce((s, p) => s + p.amount, 0);
        const debt = Math.max(0, total - paid);
        if (debt > 0) {
          const cust = customerList.find((cu) => cu.id === c.customer_id);
          details.push(`${c.id} — ${cust?.name ?? "N/A"}: còn nợ ${formatVND(debt)}`);
          totalDebt += debt;
        }
      }

      return {
        action: "check_debt",
        summary: targetContracts.length === 0
          ? "Không tìm thấy hợp đồng nào"
          : `Tổng công nợ còn lại: ${formatVND(totalDebt)}`,
        details: details.length > 0 ? details : ["Không còn công nợ"],
      };
    }

    case "create_customer": {
      const name = parsed.customerName;
      if (!name) {
        return { action: "create_customer", summary: "Vui lòng cung cấp tên khách hàng", details: [] };
      }
      const s = getCachedSettings();
      const id = genId(s.customer_prefix, s.id_format);
      const { error } = await db.from("customers").insert({
        id, name, phone: "", email: "", tax: "", address: "", representative: "", note: "",
      });
      if (error) {
        return { action: "create_customer", summary: `Lỗi: ${error.message}`, details: [] };
      }
      return {
        action: "create_customer",
        summary: `Đã tạo khách hàng "${name}"`,
        details: [`Mã khách hàng: ${id}`],
      };
    }

    case "create_quote": {
      if (parsed.productNames.length === 0) {
        return {
          action: "create_quote",
          summary: "Vui lòng liệt kê sản phẩm. Ví dụ: \"Báo giá cho khách A sản phẩm iPhone x 2, Samsung x 1\"",
          details: [],
        };
      }

      const { data: products } = await db.from("products").select("*").order("name");
      const allProducts = (products ?? []) as Product[];
      const { data: customers } = await db.from("customers").select("*").order("name");
      const allCustomers = (customers ?? []) as Customer[];
      const { data: templates } = await db.from("templates").select("*").eq("type", "quote").order("name");

      let customer: Customer | null = null;
      if (parsed.customerName) {
        customer = findBestMatch(parsed.customerName, allCustomers, (c) => c.name);
      }

      const matchedItems: { product: Product; qty: number }[] = [];
      const unmatched: string[] = [];

      for (let i = 0; i < parsed.productNames.length; i++) {
        const name = parsed.productNames[i];
        const qty = parsed.quantities[i] || 1;
        const product = findBestMatch(name, allProducts, (p) => p.name);
        if (product) {
          matchedItems.push({ product, qty });
        } else {
          unmatched.push(name);
        }
      }

      if (matchedItems.length === 0) {
        return {
          action: "create_quote",
          summary: "Không tìm thấy sản phẩm nào khớp",
          details: unmatched.length > 0 ? [`Không khớp: ${unmatched.join(", ")}`] : [],
        };
      }

      const s = await loadSettings();
      const quoteId = genId(s.quote_prefix, s.id_format);
      const defaultTpl = (templates ?? []).find((t: any) => t.is_default);
      const validUntil = new Date(Date.now() + s.quote_valid_days * 86400000).toISOString().split("T")[0];

      const quoteItems = matchedItems.map((mi) => ({
        quote_id: quoteId,
        product_id: mi.product.id,
        product_name: mi.product.name,
        qty: mi.qty,
        price: mi.product.price,
        discount: 0,
      }));

      const totals = calcQuoteTotals(
        quoteItems.map((it) => ({ qty: it.qty, price: it.price, discount: it.discount })),
        0, s.vat_default, 0,
      );

      const { error: qErr } = await db.from("quotes").insert({
        id: quoteId,
        customer_id: customer?.id ?? null,
        date: new Date().toISOString().split("T")[0],
        status: "Nháp",
        discount: 0,
        vat_pct: s.vat_default,
        shipping: 0,
        template_id: defaultTpl?.id ?? null,
        notes: "",
        valid_until: validUntil,
        payment_terms: {
          method: "transfer",
          installments: [{ label: "Thanh toán 1 lần", date: new Date().toISOString().split("T")[0], percent: 100, amount: totals.total, note: "" }],
        },
      });

      if (qErr) {
        return { action: "create_quote", summary: `Lỗi tạo báo giá: ${qErr.message}`, details: [] };
      }

      if (quoteItems.length > 0) {
        await db.from("quote_items").insert(quoteItems);
      }

      const details = [
        `Mã báo giá: ${quoteId}`,
        `Khách hàng: ${customer?.name ?? "Chưa gắn"}`,
        ...matchedItems.map((mi) => `${mi.product.name} x${mi.qty} — ${formatVND(mi.product.price * mi.qty)}`),
        `Tổng cộng: ${formatVND(totals.total)}`,
      ];
      if (unmatched.length > 0) {
        details.push(`Không khớp: ${unmatched.join(", ")}`);
      }

      return {
        action: "create_quote",
        summary: `Đã tạo báo giá ${quoteId} với ${matchedItems.length} sản phẩm`,
        details,
        quoteId: quoteId ?? undefined,
      };
    }

    default:
      return {
        action: "unknown",
        summary: "Tôi không hiểu lệnh này. Thử: \"Báo giá cho khách A sản phẩm X x 2, Y x 1\"",
        details: [],
      };
  }
}

export function getQuickActions(): { label: string; command: string }[] {
  return [
    { label: "Tạo báo giá mẫu", command: "Báo giá cho khách Nguyễn Văn A sản phẩm iPhone 15 x 2, Samsung S24 x 1" },
    { label: "Kiểm tra tồn kho", command: "Tồn kho còn bao nhiêu?" },
    { label: "Kiểm tra công nợ", command: "Khách hàng còn nợ bao nhiêu?" },
    { label: "Hướng dẫn", command: "Giúp đỡ" },
  ];
}
