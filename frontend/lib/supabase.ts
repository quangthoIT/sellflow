const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const ENDPOINT_MAP: Record<string, string> = {
  products: "/products",
  customers: "/customers",
  quotes: "/quotations",
  contracts: "/contracts",
  payments: "/payments",
  inventory_transactions: "/inventory",
  templates: "/templates",
};

export type Session = {
  access_token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    user_metadata?: {
      name?: string;
    };
  };
};

function createLocalQueryBuilder(table: string) {
  const endpoint = ENDPOINT_MAP[table];
  
  const builder: any = {
    _select: "*",
    _eq: {} as Record<string, any>,
    _in: {} as Record<string, any[]>,
    _order: null as { col: string; asc: boolean } | null,
    _isUpdate: false,
    _updatePayload: null as any,
    _isDelete: false,
    
    select(fields?: string) {
      builder._select = fields || "*";
      return builder;
    },
    order(col: string, options?: { ascending?: boolean }) {
      builder._order = { col, asc: options?.ascending !== false };
      return builder;
    },
    eq(col: string, val: any) {
      builder._eq[col] = val;
      return builder;
    },
    in(col: string, vals: any[]) {
      builder._in[col] = vals;
      return builder;
    },
    maybeSingle(): Promise<{ data: any; error: any }> {
      return builder.then((res: any) => ({
        data: Array.isArray(res.data) ? res.data[0] || null : res.data,
        error: res.error,
      }));
    },
    single(): Promise<{ data: any; error: any }> {
      return builder.then((res: any) => ({
        data: Array.isArray(res.data) ? res.data[0] || null : res.data,
        error: res.error,
      }));
    },
    insert(payload: any) {
      const isArray = Array.isArray(payload);
      const items = isArray ? payload : [payload];
      return (async () => {
        try {
          if (table === "app_settings") {
            if (typeof window !== "undefined") {
              const current = getCachedSettings();
              const merged = { ...current, ...items[0] };
              localStorage.setItem("sellflow_app_settings", JSON.stringify(merged));
              clearSettingsCache();
            }
            return { data: isArray ? items : items[0], error: null };
          }
          if (!endpoint) return { data: payload, error: null };
          const results = [];
          for (const item of items) {
            const res = await fetch(`${API_BASE}${endpoint}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            });
            const data = await res.json();
            results.push(data.product || data.customer || data.quote || data.contract || data.payment || data);
          }
          return { data: isArray ? results : results[0], error: null };
        } catch (err: any) {
          return { data: null, error: err };
        }
      })();
    },
    upsert(payload: any) {
      return builder.insert(payload);
    },
    update(payload: any) {
      builder._isUpdate = true;
      builder._updatePayload = payload;
      return builder;
    },
    delete() {
      builder._isDelete = true;
      return builder;
    },
    then<TResult1 = any>(resolve?: ((value: { data: any; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null, reject?: any): Promise<TResult1> {
      const resPromise = (async () => {
        if (table === "app_settings") {
          if (builder._isUpdate && builder._updatePayload) {
            const current = getCachedSettings();
            const merged = { ...current, ...builder._updatePayload };
            if (typeof window !== "undefined") {
              localStorage.setItem("sellflow_app_settings", JSON.stringify(merged));
              clearSettingsCache();
            }
            return { data: merged, error: null, count: 1 };
          }
          const s = await loadSettings();
          return { data: [s], error: null, count: 1 };
        }

        if (!endpoint) return { data: [], error: null, count: 0 };
        try {
          if (builder._isDelete) {
            const idVal = builder._eq.id || builder._eq.quote_id || builder._eq.contract_id;
            if (idVal) {
              const res = await fetch(`${API_BASE}${endpoint}/${idVal}`, { method: "DELETE" });
              const data = await res.json();
              return { data, error: null, count: 1 };
            }
          }

          if (builder._isUpdate && builder._updatePayload) {
            const idVal = builder._eq.id || builder._eq.quote_id || builder._eq.contract_id || builder._updatePayload.id;
            const payloadWithId = idVal ? { ...builder._updatePayload, id: idVal } : builder._updatePayload;
            const res = await fetch(`${API_BASE}${endpoint}${idVal ? `/${idVal}` : ""}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payloadWithId),
            });
            const data = await res.json();
            return { data: data.product || data.customer || data.quote || data.contract || data.payment || data, error: null, count: 1 };
          }

          const res = await fetch(`${API_BASE}${endpoint}`);
          const data = await res.json();
          let list = Array.isArray(data) ? data : [];
          if (table === "products") {
            list = list.map((p: any) => ({
              ...p,
              cost: Number(p.cost || 0),
              price: Number(p.price || 0),
              min_stock: p.minStock ?? p.min_stock ?? 0,
              created_at: p.createdAt || p.created_at || new Date().toISOString(),
            }));
          } else if (table === "customers") {
            list = list.map((c: any) => ({
              ...c,
              created_at: c.createdAt || c.created_at || new Date().toISOString(),
            }));
          } else if (table === "quotes" || table === "contracts") {
            list = list.map((item: any) => ({
              ...item,
              customer_id: item.customerId ?? item.customer_id,
              vat_pct: item.vatPct ?? item.vat_pct ?? 0,
              valid_until: item.validUntil ?? item.valid_until,
              created_at: item.createdAt || item.created_at || new Date().toISOString(),
            }));
          }
          Object.keys(builder._eq).forEach(key => {
            const val = builder._eq[key];
            list = list.filter((item: any) => item[key] == val || item[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] == val);
          });
          Object.keys(builder._in).forEach(key => {
            const vals = builder._in[key];
            list = list.filter((item: any) => {
              const itemVal = item[key] ?? item[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
              return vals.includes(itemVal);
            });
          });
          return { data: list, error: null, count: list.length };
        } catch (err) {
          return { data: [], error: err, count: 0 };
        }
      })();
      return resPromise.then(resolve as any, reject);
    }
  };

  return builder;
}

export const supabase: any = {
  from: (table: string) => createLocalQueryBuilder(table),
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File, _options?: any) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = (e.target?.result as string) || "";
              try {
                if (typeof window !== "undefined") {
                  localStorage.setItem(`storage_${bucket}_${path}`, dataUrl);
                  localStorage.setItem(`storage_${bucket}_latest`, dataUrl);
                }
              } catch (err) {
                // localstorage size exceeded fallback
              }
              resolve({ data: { path }, error: null });
            };
            reader.onerror = () => {
              resolve({ data: null, error: { message: "Không thể đọc tệp hình ảnh" } });
            };
            reader.readAsDataURL(file);
          });
        },
        getPublicUrl(path: string) {
          let url = "";
          if (typeof window !== "undefined") {
            url = localStorage.getItem(`storage_${bucket}_${path}`) || localStorage.getItem(`storage_${bucket}_latest`) || "";
          }
          return { data: { publicUrl: url } };
        }
      };
    }
  },
  auth: {
    async getSession() {
      const sess = typeof window !== "undefined" ? localStorage.getItem("sellflow_session") : null;
      if (sess) {
        try {
          return { data: { session: JSON.parse(sess) }, error: null };
        } catch {
          // ignore
        }
      }
      return { data: { session: null }, error: null };
    },
    onAuthStateChange(_callback: (event: string, session: Session | null) => void) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    async signInWithPassword({ email, password }: { email?: string; password?: string }) {
      if ((email === "admin@sellflow.com" || email) && password) {
        const session: Session = {
          access_token: "token-" + Date.now(),
          user: { id: "u1", email: email || "admin@sellflow.com", name: "System Admin" },
        };
        if (typeof window !== "undefined") {
          localStorage.setItem("sellflow_session", JSON.stringify(session));
        }
        return { data: { session }, error: null };
      }
      return { data: null, error: { message: "Invalid credentials" } };
    },
    async signOut() {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sellflow_session");
        localStorage.removeItem("sellflow_logged_in");
      }
      return { error: null };
    },
    async updateUser(_data: any) {
      return { data: {}, error: null };
    }
  }
};

export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  min_stock: number;
  description: string;
  status: string;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  tax: string;
  address: string;
  representative: string;
  note: string;
  created_at: string;
};

export type PaymentTerm = {
  label: string;
  date: string;
  percent: number;
  amount: number;
  note: string;
};

export type PaymentTerms = {
  method: string;
  installments: PaymentTerm[];
};

export type Quote = {
  id: string;
  customer_id: string | null;
  date: string;
  status: string;
  discount: number;
  vat_pct: number;
  shipping: number;
  template_id: string | null;
  notes: string;
  valid_until: string | null;
  payment_terms: PaymentTerms | null;
  created_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  price: number;
  discount: number;
  created_at: string;
};

export type Contract = {
  id: string;
  quote_id: string | null;
  customer_id: string | null;
  date: string;
  status: string;
  template_id: string | null;
  stock_applied: boolean;
  notes: string;
  payment_terms: PaymentTerms | null;
  created_at: string;
};

export type ContractItem = {
  id: string;
  contract_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  price: number;
  created_at: string;
};

export type InventoryTx = {
  id: string;
  date: string;
  product_id: string;
  type: string;
  qty: number;
  ref: string;
  note: string;
  created_at: string;
};

export type Payment = {
  id: string;
  contract_id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
  created_at: string;
};

export type Template = {
  id: string;
  type: string;
  name: string;
  is_default: boolean;
  paper: string;
  locked: boolean;
  content: string;
  created_at: string;
};

export type EmailSettings = {
  id: number;
  sender_name: string;
  sender_email: string;
  reply_to: string;
  auto_send_signed: boolean;
  attach_pdf: boolean;
  subject: string;
  body: string;
  created_at?: string;
};

export type EmailLog = {
  id: string;
  contract_id: string | null;
  customer_id: string | null;
  customer_name: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  attach_pdf: boolean;
  automatic: boolean;
  status: string;
  sent_at: string;
};

export type AppSettings = {
  id: number;
  quote_prefix: string;
  contract_prefix: string;
  payment_prefix: string;
  customer_prefix: string;
  product_prefix: string;
  inventory_prefix: string;
  email_prefix: string;
  id_format: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_tax: string;
  logo_url: string;
  currency: string;
  vat_default: number;
  quote_valid_days: number;
  low_stock_alert: boolean;
  created_at: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  quote_prefix: "BG",
  contract_prefix: "HD",
  payment_prefix: "TT",
  customer_prefix: "KH",
  product_prefix: "SP",
  inventory_prefix: "NK",
  email_prefix: "EM",
  id_format: "{PREFIX}-{YEAR}-{SEQ}",
  company_name: "Hộ Kinh Doanh Demo",
  company_address: "",
  company_phone: "",
  company_email: "",
  company_tax: "",
  logo_url: "",
  currency: "VND",
  vat_default: 10,
  quote_valid_days: 15,
  low_stock_alert: true,
  created_at: "",
};

let cachedSettings: AppSettings | null = null;
let settingsPromise: Promise<AppSettings> | null = null;

export async function loadSettings(): Promise<AppSettings> {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("sellflow_app_settings");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
        return cachedSettings as AppSettings;
      } catch {
        // fallback
      }
    }
  }
  if (cachedSettings) return cachedSettings;
  cachedSettings = DEFAULT_SETTINGS;
  return cachedSettings as AppSettings;
}

export function getCachedSettings(): AppSettings {
  return cachedSettings ?? DEFAULT_SETTINGS;
}

export function clearSettingsCache(): void {
  cachedSettings = null;
  settingsPromise = null;
}
