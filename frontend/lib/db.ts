const getApiBase = () => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").trim().replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
};
const API_BASE = getApiBase();

const ENDPOINT_MAP: Record<string, string> = {
  products: "/products",
  customers: "/customers",
  quotes: "/quotations",
  quote_items: "/quotations/items",
  contracts: "/contracts",
  contract_items: "/contracts/items",
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
    role?: string;
    companyId?: string;
    company_id?: string;
    company?: {
      id: string;
      name: string;
    };
    user_metadata?: {
      name?: string;
    };
  };
};

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("sellflow_session");
      if (raw) {
        const sess = JSON.parse(raw);
        if (sess.access_token) {
          headers["Authorization"] = `Bearer ${sess.access_token}`;
        }
        const cid = sess.user?.companyId || sess.user?.company_id || sess.user?.company?.id;
        if (cid) {
          headers["x-company-id"] = cid;
        }
      }
    } catch {}
  }
  return headers;
}

export function getCurrentCompanyId(): string {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("sellflow_session");
      if (raw) {
        const sess = JSON.parse(raw);
        return sess.user?.companyId || sess.user?.company_id || sess.user?.company?.id || "default";
      }
    } catch {}
  }
  return "default";
}

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
          const companyId = getCurrentCompanyId();
          if (table === "app_settings") {
            const item = items[0];
            try {
              await fetch(`${API_BASE}/auth/settings`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(item),
              });
            } catch {}
            if (typeof window !== "undefined") {
              const key = `sellflow_app_settings_${companyId}`;
              const raw = localStorage.getItem(key);
              const current = raw ? JSON.parse(raw) : getCachedSettings();
              const merged = { ...current, ...item };
              localStorage.setItem(key, JSON.stringify(merged));
              clearSettingsCache();
            }
            return { data: isArray ? items : items[0], error: null };
          }
          if (table === "email_settings") {
            if (typeof window !== "undefined") {
              const key = `sellflow_email_settings_${companyId}`;
              const raw = localStorage.getItem(key);
              const current = raw ? JSON.parse(raw) : {};
              const merged = { ...current, ...items[0] };
              localStorage.setItem(key, JSON.stringify(merged));
            }
            return { data: isArray ? items : items[0], error: null };
          }
          if (table === "email_logs") {
            if (typeof window !== "undefined") {
              const key = `sellflow_email_logs_${companyId}`;
              const raw = localStorage.getItem(key);
              const logs = raw ? JSON.parse(raw) : [];
              const updated = [...items, ...logs];
              localStorage.setItem(key, JSON.stringify(updated.slice(0, 100)));
            }
            return { data: isArray ? items : items[0], error: null };
          }
          if (!endpoint) return { data: payload, error: null };
          
          if (table === "quote_items" || table === "contract_items") {
            const res = await fetch(`${API_BASE}${endpoint}`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(isArray ? items : items[0]),
            });
            const data = await res.json();
            return { data, error: null };
          }

          const results = [];
          for (const item of items) {
            const res = await fetch(`${API_BASE}${endpoint}`, {
              method: "POST",
              headers: getAuthHeaders(),
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
        const companyId = getCurrentCompanyId();
        if (table === "app_settings" || table === "email_settings") {
          const key = table === "app_settings" ? `sellflow_app_settings_${companyId}` : `sellflow_email_settings_${companyId}`;
          if (builder._isUpdate && builder._updatePayload) {
            if (table === "app_settings") {
              try {
                await fetch(`${API_BASE}/auth/settings`, {
                  method: "POST",
                  headers: getAuthHeaders(),
                  body: JSON.stringify(builder._updatePayload),
                });
              } catch {}
            }
            const current = table === "app_settings" ? getCachedSettings() : {};
            const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
            const parsed = raw ? JSON.parse(raw) : current;
            const merged = { ...parsed, ...builder._updatePayload };
            if (typeof window !== "undefined") {
              localStorage.setItem(key, JSON.stringify(merged));
              if (table === "app_settings") clearSettingsCache();
            }
            return { data: merged, error: null, count: 1 };
          }
          if (table === "app_settings") {
            const s = await loadSettings();
            return { data: [s], error: null, count: 1 };
          }
          const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
          const s = raw ? JSON.parse(raw) : null;
          return { data: s ? [s] : [], error: null, count: s ? 1 : 0 };
        }

        if (table === "email_logs") {
          const key = `sellflow_email_logs_${companyId}`;
          const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
          const logs = raw ? JSON.parse(raw) : [];
          return { data: logs, error: null, count: logs.length };
        }

        if (!endpoint) return { data: [], error: null, count: 0 };
        try {
          if (builder._isDelete) {
            const idVal = builder._eq.id || builder._eq.quote_id || builder._eq.contract_id || builder._eq.quoteId || builder._eq.contractId;
            if (idVal) {
              const res = await fetch(`${API_BASE}${endpoint}/${idVal}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
              });
              const data = await res.json();
              return { data, error: null, count: 1 };
            }
          }

          if (builder._isUpdate && builder._updatePayload) {
            const idVal = builder._eq.id || builder._eq.quote_id || builder._eq.contract_id || builder._updatePayload.id;
            const payloadWithId = idVal ? { ...builder._updatePayload, id: idVal } : builder._updatePayload;
            const res = await fetch(`${API_BASE}${endpoint}${idVal ? `/${idVal}` : ""}`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(payloadWithId),
            });
            const data = await res.json();
            return { data: data.product || data.customer || data.quote || data.contract || data.payment || data, error: null, count: 1 };
          }

          const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: getAuthHeaders(),
          });
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
              quote_id: item.quoteId ?? item.quote_id,
              vat_pct: Number(item.vatPct ?? item.vat_pct ?? 0),
              discount: Number(item.discount ?? 0),
              shipping: Number(item.shipping ?? 0),
              template_id: item.templateId ?? item.template_id,
              valid_until: item.validUntil ? (typeof item.validUntil === 'string' ? item.validUntil.split('T')[0] : new Date(item.validUntil).toISOString().split('T')[0]) : (item.valid_until ?? null),
              payment_terms: item.paymentTerms ?? item.payment_terms ?? null,
              stock_applied: Boolean(item.stockApplied ?? item.stock_applied ?? false),
              created_at: item.createdAt || item.created_at || new Date().toISOString(),
            }));
          } else if (table === "quote_items" || table === "contract_items") {
            list = list.map((item: any) => ({
              ...item,
              quote_id: item.quoteId ?? item.quote_id,
              contract_id: item.contractId ?? item.contract_id,
              product_id: item.productId ?? item.product_id,
              product_name: item.productName ?? item.product_name ?? "",
              qty: Number(item.qty || 1),
              price: Number(item.price || 0),
              discount: Number(item.discount || 0),
              created_at: item.createdAt || item.created_at || new Date().toISOString(),
            }));
          } else if (table === "payments") {
            list = list.map((item: any) => ({
              ...item,
              contract_id: item.contractId ?? item.contract_id,
              amount: Number(item.amount || 0),
              date: item.date ? (typeof item.date === 'string' ? item.date.split('T')[0] : new Date(item.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
              created_at: item.createdAt || item.created_at || new Date().toISOString(),
            }));
          } else if (table === "templates") {
            list = list.map((item: any) => ({
              ...item,
              is_default: Boolean(item.isDefault ?? item.is_default ?? false),
              isDefault: Boolean(item.isDefault ?? item.is_default ?? false),
              locked: Boolean(item.locked ?? false),
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

export const db: any = {
  from: (table: string) => createLocalQueryBuilder(table),
  storage: {
    from(bucket: string) {
      const companyId = getCurrentCompanyId();
      return {
        async upload(path: string, file: File, _options?: any) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = (e.target?.result as string) || "";
              try {
                if (typeof window !== "undefined") {
                  localStorage.setItem(`storage_${companyId}_${bucket}_${path}`, dataUrl);
                  localStorage.setItem(`storage_${companyId}_${bucket}_latest`, dataUrl);
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
            url = localStorage.getItem(`storage_${companyId}_${bucket}_${path}`) || localStorage.getItem(`storage_${companyId}_${bucket}_latest`) || "";
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
      if (!email || !password) {
        return { data: null, error: { message: "Vui lòng nhập email và mật khẩu" } };
      }
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.user) {
          const session: Session = {
            access_token: data.token || "token-" + Date.now(),
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              role: data.user.role,
              companyId: data.user.companyId,
              company_id: data.user.companyId,
              company: data.user.company,
              user_metadata: { name: data.user.name },
            },
          };
          if (typeof window !== "undefined") {
            localStorage.setItem("sellflow_session", JSON.stringify(session));
            localStorage.setItem("sellflow_logged_in", "true");
          }
          clearSettingsCache();
          return { data: { session }, error: null };
        }
        return { data: null, error: { message: data.message || "Tài khoản hoặc mật khẩu không chính xác" } };
      } catch (err) {
        return { data: null, error: { message: "Không thể kết nối máy chủ" } };
      }
    },
    async signOut() {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sellflow_session");
        localStorage.removeItem("sellflow_logged_in");
        clearSettingsCache();
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
  id: number | string;
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
  id: number | string;
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
  const companyId = getCurrentCompanyId();

  // Try fetching latest settings from backend API
  const authHeaders = getAuthHeaders();
  if (authHeaders["Authorization"]) {
    try {
      const res = await fetch(`${API_BASE}/auth/settings`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.companyName || data.company_name || data.id)) {
          const mapped: AppSettings = {
            id: data.id || 1,
            company_name: data.companyName ?? data.company_name ?? "SellFlow Workspace",
            company_address: data.companyAddress ?? data.company_address ?? "",
            company_phone: data.companyPhone ?? data.company_phone ?? "",
            company_email: data.companyEmail ?? data.company_email ?? "",
            company_tax: data.companyTax ?? data.company_tax ?? "",
            logo_url: data.logoUrl ?? data.logo_url ?? "",
            quote_prefix: data.quotePrefix ?? data.quote_prefix ?? "BG",
            contract_prefix: data.contractPrefix ?? data.contract_prefix ?? "HD",
            payment_prefix: data.paymentPrefix ?? data.payment_prefix ?? "TT",
            customer_prefix: data.customerPrefix ?? data.customer_prefix ?? "KH",
            product_prefix: data.productPrefix ?? data.product_prefix ?? "SP",
            inventory_prefix: data.inventoryPrefix ?? data.inventory_prefix ?? "NK",
            email_prefix: data.emailPrefix ?? data.email_prefix ?? "EM",
            id_format: data.idFormat ?? data.id_format ?? "{PREFIX}-{YEAR}-{SEQ}",
            currency: data.currency ?? "VND",
            vat_default: Number(data.vatDefault ?? data.vat_default ?? 10),
            quote_valid_days: Number(data.quoteValidDays ?? data.quote_valid_days ?? 15),
            low_stock_alert: Boolean(data.lowStockAlert ?? data.low_stock_alert ?? true),
            created_at: data.createdAt ?? data.created_at ?? "",
          };
          cachedSettings = mapped;
          if (typeof window !== "undefined") {
            localStorage.setItem(`sellflow_app_settings_${companyId}`, JSON.stringify(mapped));
          }
          return cachedSettings;
        }
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`sellflow_app_settings_${companyId}`);
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
