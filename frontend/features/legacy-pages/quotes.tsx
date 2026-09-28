import { useEffect, useState, useCallback } from "react";
import { supabase, type Product, type Customer, type Quote, type QuoteItem, type Template, type PaymentTerms, type PaymentTerm, loadSettings, getCachedSettings } from "@/lib/supabase";
import { formatVND, formatDate, genId, calcQuoteTotals } from "@/lib/format";
import { useNav } from "@/lib/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, FileText, Eye, FileSignature, Pencil, X, Download, FileType } from "lucide-react";
import { toast } from "sonner";
import { downloadPdf, downloadWord } from "@/lib/download";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";

const QUOTE_STATUSES = ["Nháp", "Đã gửi", "Khách đồng ý", "Khách từ chối", "Hết hạn"];

export function QuotesPage() {
  const { params, navigate } = useNav();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<QuoteItem[]>([]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [q, c, p, t, qi] = await Promise.all([
      supabase.from("quotes").select("*").order("date", { ascending: false }),
      supabase.from("customers").select("*").order("name"),
      supabase.from("products").select("*").order("name"),
      supabase.from("templates").select("*").eq("type", "quote").order("name"),
      supabase.from("quote_items").select("*"),
    ]);
    setQuotes((q.data ?? []) as Quote[]);
    setCustomers((c.data ?? []) as Customer[]);
    setProducts((p.data ?? []) as Product[]);
    setTemplates((t.data ?? []) as Template[]);
    setAllItems((qi.data ?? []) as QuoteItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (params.id) {
      setEditingId(params.id);
    }
  }, [params.id]);

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";

  const quoteTotal = (id: string) => {
    const items = allItems.filter((i) => i.quote_id === id);
    return calcQuoteTotals(items, 0, 0, 0).total;
  };

  const rows = quotes.map((q) => ({
    quote: q,
    customer: customerName(q.customer_id),
    total: quoteTotal(q.id),
  }));

  const colFilters = [
    { key: (r: typeof rows[0]) => r.quote.id, value: filters.id ?? "" },
    { key: (r: typeof rows[0]) => r.customer, value: filters.customer ?? "" },
    { key: (r: typeof rows[0]) => r.quote.date, value: filters.date ?? "" },
    { key: (r: typeof rows[0]) => String(r.total), value: filters.total ?? "" },
    { key: (r: typeof rows[0]) => r.quote.status, value: filters.status ?? "" },
  ];

  const filteredRows = filterData(rows, colFilters as any);

  const sortedRows = (() => {
    if (!sortKey || !sortDir) return filteredRows;
    const accessor: Record<string, (r: typeof rows[0]) => string | number> = {
      id: (r) => r.quote.id,
      customer: (r) => r.customer,
      date: (r) => r.quote.date,
      total: (r) => r.total,
      status: (r) => r.quote.status,
    };
    return sortData(filteredRows, accessor[sortKey] ?? ((r) => r.quote.id), sortDir);
  })();

  const handleDelete = async (id: string) => {
    await supabase.from("quote_items").delete().eq("quote_id", id);
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) { toast.error("Lỗi xóa báo giá"); return; }
    toast.success("Đã xóa báo giá");
    load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
    if (error) { toast.error("Lỗi cập nhật"); return; }
    toast.success("Đã cập nhật trạng thái");
    load();
  };

  const convertToContract = async (quoteId: string) => {
    const s = await loadSettings();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", quoteId);
    const contractId = genId(s.contract_prefix, s.id_format, 0, quote.customer_id ?? "");
    const contractTemplate = templates.find((t) => t.type === "contract" && t.is_default);

    const { error: cErr } = await supabase.from("contracts").insert({
      id: contractId,
      quote_id: quoteId,
      customer_id: quote.customer_id,
      date: new Date().toISOString().split("T")[0],
      status: "Nháp",
      template_id: contractTemplate?.id ?? null,
      notes: quote.notes,
      payment_terms: quote.payment_terms ?? null,
    });
    if (cErr) { toast.error("Lỗi tạo hợp đồng"); return; }

    const cItems = (items ?? []).map((it: QuoteItem) => ({
      contract_id: contractId,
      product_id: it.product_id,
      product_name: it.product_name,
      qty: it.qty,
      price: it.price,
    }));
    if (cItems.length > 0) {
      await supabase.from("contract_items").insert(cItems);
    }

    toast.success(`Đã tạo hợp đồng ${contractId}`);
    navigate("contracts", { id: contractId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{quotes.length} báo giá</p>
        <Button onClick={() => setEditingId("__new__")}>
          <Plus className="size-4" /> Tạo báo giá
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mã" sortDir={sortKey === "id" ? sortDir : null} onSort={(d) => { setSortKey("id"); setSortDir(d); }} filter={{ type: "text", value: filters.id ?? "", placeholder: "Lọc mã..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, id: v }))} />
                <SortableHead label="Khách hàng" sortDir={sortKey === "customer" ? sortDir : null} onSort={(d) => { setSortKey("customer"); setSortDir(d); }} filter={{ type: "text", value: filters.customer ?? "", placeholder: "Lọc khách hàng..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, customer: v }))} />
                <SortableHead label="Ngày" sortDir={sortKey === "date" ? sortDir : null} onSort={(d) => { setSortKey("date"); setSortDir(d); }} filter={{ type: "text", value: filters.date ?? "", placeholder: "Lọc ngày..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, date: v }))} />
                <SortableHead label="Tổng tiền" align="right" sortDir={sortKey === "total" ? sortDir : null} onSort={(d) => { setSortKey("total"); setSortDir(d); }} filter={{ type: "text", value: filters.total ?? "", placeholder: "Lọc tổng tiền..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, total: v }))} />
                <SortableHead label="Trạng thái" sortDir={sortKey === "status" ? sortDir : null} onSort={(d) => { setSortKey("status"); setSortDir(d); }} filter={{ type: "select", value: filters.status ?? "", options: QUOTE_STATUSES.map((s) => ({ label: s, value: s })) }} onFilterChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              )}
              {!loading && sortedRows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có báo giá</TableCell></TableRow>
              )}
              {sortedRows.map(({ quote, customer, total }) => (
                <QuoteRow
                  key={quote.id}
                  quote={quote}
                  customerName={customer}
                  total={total}
                  onEdit={() => setEditingId(quote.id)}
                  onPreview={() => setPreviewId(quote.id)}
                  onDelete={() => handleDelete(quote.id)}
                  onStatusChange={(s) => handleStatusChange(quote.id, s)}
                  onConvert={() => convertToContract(quote.id)}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId === "__new__" ? "Tạo báo giá mới" : `Sửa báo giá ${editingId}`}</DialogTitle>
          </DialogHeader>
          {editingId && (
            <QuoteEditor
              quoteId={editingId === "__new__" ? null : editingId}
              customers={customers}
              products={products}
              templates={templates}
              onSaved={() => { setEditingId(null); load(); }}
              onCancel={() => setEditingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Xem trước báo giá</span>
              <Button variant="ghost" size="icon" onClick={() => setPreviewId(null)}><X className="size-4" /></Button>
            </DialogTitle>
          </DialogHeader>
          {previewId && <QuotePreview quoteId={previewId} customers={customers} templates={templates} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuoteRow({ quote, customerName, total, onEdit, onPreview, onDelete, onStatusChange, onConvert }: {
  quote: Quote;
  customerName: string;
  total: number;
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
  onStatusChange: (s: string) => void;
  onConvert: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{quote.id}</TableCell>
      <TableCell className="font-medium">{customerName}</TableCell>
      <TableCell>{formatDate(quote.date)}</TableCell>
      <TableCell className="text-right font-medium">{formatVND(total)}</TableCell>
      <TableCell>
        <Select value={quote.status} onValueChange={onStatusChange}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {QUOTE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onPreview} title="Xem trước"><Eye className="size-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onEdit} title="Sửa"><Pencil className="size-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onConvert} title="Chuyển hợp đồng"><FileSignature className="size-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Xóa"><Trash2 className="size-3.5 text-destructive" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuoteEditor({ quoteId, customers, products, templates, onSaved, onCancel }: {
  quoteId: string | null;
  customers: Customer[];
  products: Product[];
  templates: Template[];
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [vatPct, setVatPct] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [status, setStatus] = useState("Nháp");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (quoteId) {
        const { data: q } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
        if (q) {
          setQuote(q as Quote);
          setCustomerId((q as Quote).customer_id ?? "");
          setDiscount((q as Quote).discount);
          setVatPct(Number((q as Quote).vat_pct));
          setShipping((q as Quote).shipping);
          setNotes((q as Quote).notes);
          setValidUntil((q as Quote).valid_until ?? "");
          setTemplateId((q as Quote).template_id ?? "");
          setStatus((q as Quote).status);
          setPaymentTerms((q as Quote).payment_terms ?? null);
        }
        const { data: its } = await supabase.from("quote_items").select("*").eq("quote_id", quoteId);
        setItems((its ?? []) as QuoteItem[]);
      } else {
        const s = await loadSettings();
        const defaultTpl = templates.find((t) => t.is_default);
        setTemplateId(defaultTpl?.id ?? "");
        setVatPct(s.vat_default);
        setValidUntil(new Date(Date.now() + s.quote_valid_days * 86400000).toISOString().split("T")[0]);
        setPaymentTerms({ method: "transfer", installments: [{ label: "Thanh toán 1 lần", date: new Date().toISOString().split("T")[0], percent: 100, amount: 0, note: "" }] });
      }
      setLoading(false);
    })();
  }, [quoteId]);

  const totals = calcQuoteTotals(items, discount, vatPct, shipping);

  const addProduct = (productId: string) => {
    if (!productId) return;
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setItems([...items, {
      id: crypto.randomUUID(), quote_id: quoteId ?? "",
      product_id: p.id, product_name: p.name, qty: 1, price: p.price, discount: 0, created_at: "",
    }]);
  };

  const updateItem = (idx: number, field: keyof QuoteItem, value: string | number) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const cs = getCachedSettings();
    const id = quote?.id ?? genId(cs.quote_prefix, cs.id_format, 0, customerId);
    const qData = {
      id,
      customer_id: customerId || null,
      date: quote?.date ?? new Date().toISOString().split("T")[0],
      status,
      discount,
      vat_pct: vatPct,
      shipping,
      template_id: templateId || null,
      notes,
      valid_until: validUntil || null,
      payment_terms: paymentTerms,
    };

    if (quote) {
      await supabase.from("quotes").update(qData).eq("id", id);
    } else {
      await supabase.from("quotes").insert(qData);
    }

    await supabase.from("quote_items").delete().eq("quote_id", id);
    if (items.length > 0) {
      await supabase.from("quote_items").insert(
        items.map((it) => ({
          quote_id: id,
          product_id: it.product_id,
          product_name: it.product_name,
          qty: it.qty,
          price: it.price,
          discount: it.discount,
        }))
      );
    }

    toast.success("Đã lưu báo giá");
    onSaved(id);
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Khách hàng</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Chọn khách hàng" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mẫu báo giá</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Chọn mẫu" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Hiệu lực đến</Label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>

      {/* Items */}
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-medium">Sản phẩm</span>
          <Select onValueChange={addProduct}>
            <SelectTrigger className="w-56 h-8"><SelectValue placeholder="+ Thêm sản phẩm" /></SelectTrigger>
            <SelectContent>
              {products.filter((p) => p.status === "Đang bán").map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} — {formatVND(p.price)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sản phẩm</TableHead>
              <TableHead className="w-20 text-right">SL</TableHead>
              <TableHead className="w-32 text-right">Đơn giá</TableHead>
              <TableHead className="w-28 text-right">Giảm giá</TableHead>
              <TableHead className="w-32 text-right">Thành tiền</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Chưa có sản phẩm. Thêm sản phẩm để bắt đầu.</TableCell></TableRow>
            )}
            {items.map((it, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{it.product_name}</TableCell>
                <TableCell className="text-right">
                  <Input type="number" className="h-8 w-16 text-right" value={it.qty}
                    onChange={(e) => updateItem(idx, "qty", Math.max(1, +e.target.value))} />
                </TableCell>
                <TableCell className="text-right">
                  <Input type="number" className="h-8 w-28 text-right" value={it.price}
                    onChange={(e) => updateItem(idx, "price", +e.target.value)} />
                </TableCell>
                <TableCell className="text-right">
                  <Input type="number" className="h-8 w-24 text-right" value={it.discount}
                    onChange={(e) => updateItem(idx, "discount", +e.target.value)} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatVND(it.qty * it.price - (it.discount || 0))}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Trạng thái</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUOTE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tạm tính</span>
            <span className="font-medium">{formatVND(totals.subtotal)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 items-center">
            <Label className="text-sm text-muted-foreground">Chiết khấu (đ)</Label>
            <Input type="number" className="h-8 text-right" value={discount}
              onChange={(e) => setDiscount(+e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 items-center">
            <Label className="text-sm text-muted-foreground">VAT (%)</Label>
            <Input type="number" className="h-8 text-right" value={vatPct}
              onChange={(e) => setVatPct(+e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2 items-center">
            <Label className="text-sm text-muted-foreground">Phí vận chuyển (đ)</Label>
            <Input type="number" className="h-8 text-right" value={shipping}
              onChange={(e) => setShipping(+e.target.value)} />
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Tổng cộng</span>
            <span className="text-primary">{formatVND(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment terms */}
      <PaymentTermsEditor terms={paymentTerms} total={totals.total} onChange={setPaymentTerms} />

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button onClick={handleSave}><FileText className="size-4" /> Lưu báo giá</Button>
      </DialogFooter>
    </div>
  );
}

function QuotePreview({ quoteId, customers, templates }: {
  quoteId: string;
  customers: Customer[];
  templates: Template[];
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: q } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
      const { data: its } = await supabase.from("quote_items").select("*").eq("quote_id", quoteId);
      setQuote(q as Quote);
      setItems((its ?? []) as QuoteItem[]);
      setLoading(false);
    })();
  }, [quoteId]);

  if (loading || !quote) return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;

  const customer = customers.find((c) => c.id === quote.customer_id);
  const template = templates.find((t) => t.id === quote.template_id);
  const totals = calcQuoteTotals(items, quote.discount, quote.vat_pct, quote.shipping);

  const productTable = `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#f5f5f5">
      <th style="border:1px solid #ddd;padding:6px;text-align:left">STT</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:left">Sản phẩm</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:right">SL</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:right">Đơn giá</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:right">Thành tiền</th>
    </tr></thead>
    <tbody>
      ${items.map((it, i) => `<tr>
        <td style="border:1px solid #ddd;padding:6px">${i + 1}</td>
        <td style="border:1px solid #ddd;padding:6px">${it.product_name}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right">${it.qty}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right">${formatVND(it.price)}</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right">${formatVND(it.qty * it.price - (it.discount || 0))}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;

  const paymentTermsHtml = quote.payment_terms && quote.payment_terms.installments.length > 0
    ? `<div style="margin-top:16px"><h4 style="font-size:14px;font-weight:bold;margin-bottom:6px">Điều khoản thanh toán</h4>
       <p style="font-size:13px;margin-bottom:6px">Phương thức: <strong>${quote.payment_terms.method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</strong></p>
       <table style="width:100%;border-collapse:collapse">
         <thead><tr style="background:#f5f5f5">
           <th style="border:1px solid #ddd;padding:6px;text-align:left">Đợt</th>
           <th style="border:1px solid #ddd;padding:6px;text-align:left">Ngày</th>
           <th style="border:1px solid #ddd;padding:6px;text-align:right">Tỷ lệ (%)</th>
           <th style="border:1px solid #ddd;padding:6px;text-align:right">Số tiền</th>
           <th style="border:1px solid #ddd;padding:6px;text-align:left">Ghi chú</th>
         </tr></thead>
         <tbody>
           ${quote.payment_terms.installments.map((it) => `<tr>
             <td style="border:1px solid #ddd;padding:6px">${it.label}</td>
             <td style="border:1px solid #ddd;padding:6px">${formatDate(it.date)}</td>
             <td style="border:1px solid #ddd;padding:6px;text-align:right">${it.percent || 0}%</td>
             <td style="border:1px solid #ddd;padding:6px;text-align:right">${formatVND(it.amount)}</td>
             <td style="border:1px solid #ddd;padding:6px">${it.note || ""}</td>
           </tr>`).join("")}
         </tbody>
       </table></div>`
    : "";

  let html = template?.content ?? "<p>Chưa chọn mẫu</p>";
  const replacements: Record<string, string> = {
    SO_TAI_LIEU: quote.id,
    NGAY: formatDate(quote.date),
    TEN_KHACH_HANG: customer?.name ?? "",
    DIA_CHI_KHACH_HANG: customer?.address ?? "",
    MST_KHACH_HANG: customer?.tax ?? "",
    BANG_SAN_PHAM: productTable,
    TAM_TINH: formatVND(totals.subtotal),
    VAT: formatVND(totals.vat),
    TONG_TIEN: formatVND(totals.total),
    DIEU_KHOAN_THANH_TOAN: paymentTermsHtml,
  };
  for (const [k, v] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{quote.status}</Badge>
          <span className="text-sm text-muted-foreground">{template?.name ?? "Mặc định"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadPdf(`Bao-gia-${quote.id}`, html)}>
            <Download className="size-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadWord(`Bao-gia-${quote.id}`, html)}>
            <FileType className="size-3.5" /> Word
          </Button>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-8 text-black" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function PaymentTermsEditor({ terms, total, onChange }: {
  terms: PaymentTerms | null;
  total: number;
  onChange: (terms: PaymentTerms | null) => void;
}) {
  if (!terms) return null;

  const setMethod = (method: string) => {
    onChange({ ...terms, method });
  };

  const setInstallmentCount = (n: number) => {
    const current = terms.installments;
    if (n === current.length) return;
    if (n < current.length) {
      onChange({ ...terms, installments: current.slice(0, n) });
    } else {
      const newOnes: PaymentTerm[] = [];
      for (let i = current.length; i < n; i++) {
        newOnes.push({
          label: `Thanh toán đợt ${i + 1}`,
          date: new Date().toISOString().split("T")[0],
          percent: 0,
          amount: 0,
          note: "",
        });
      }
      onChange({ ...terms, installments: [...current, ...newOnes] });
    }
  };

  const updateInstallment = (idx: number, field: keyof PaymentTerm, value: string | number) => {
    onChange({
      ...terms,
      installments: terms.installments.map((it, i) => i === idx ? { ...it, [field]: value } : it),
    });
  };

  const updatePercent = (idx: number, percent: number) => {
    const amount = Math.round((total * percent) / 100);
    onChange({
      ...terms,
      installments: terms.installments.map((it, i) => i === idx ? { ...it, percent, amount } : it),
    });
  };

  const updateAmount = (idx: number, amount: number) => {
    const percent = total > 0 ? Math.round((amount / total) * 100 * 100) / 100 : 0;
    onChange({
      ...terms,
      installments: terms.installments.map((it, i) => i === idx ? { ...it, amount, percent } : it),
    });
  };

  const removeInstallment = (idx: number) => {
    if (terms.installments.length <= 1) return;
    onChange({ ...terms, installments: terms.installments.filter((_, i) => i !== idx) });
  };

  const autoSplit = () => {
    const n = terms.installments.length;
    const perPct = Math.floor(100 / n);
    const remainderPct = 100 - perPct * n;
    onChange({
      ...terms,
      installments: terms.installments.map((it, i) => {
        const pct = i === 0 ? perPct + remainderPct : perPct;
        return { ...it, percent: pct, amount: Math.round((total * pct) / 100) };
      }),
    });
  };

  const totalPaid = terms.installments.reduce((s, it) => s + (it.amount || 0), 0);
  const totalPct = terms.installments.reduce((s, it) => s + (it.percent || 0), 0);
  const diff = total - totalPaid;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Điều khoản thanh toán</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Số đợt:</span>
          <Select value={String(terms.installments.length)} onValueChange={(v) => setInstallmentCount(+v)}>
            <SelectTrigger className="h-7 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={autoSplit}>
            Chia đều
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Phương thức thanh toán</Label>
          <Select value={terms.method} onValueChange={setMethod}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="transfer">Chuyển khoản</SelectItem>
              <SelectItem value="cash">Tiền mặt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end justify-end">
          <div className="text-xs text-muted-foreground">Tổng báo giá: <strong className="text-foreground">{formatVND(total)}</strong></div>
        </div>
      </div>

      <div className="space-y-2">
        {terms.installments.map((it, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Đợt {idx + 1}</Label>
              <Input className="h-8" value={it.label} onChange={(e) => updateInstallment(idx, "label", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Ngày</Label>
              <Input type="date" className="h-8" value={it.date} onChange={(e) => updateInstallment(idx, "date", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Phần trăm (%)</Label>
              <Input type="number" className="h-8 text-right" value={it.percent} onChange={(e) => updatePercent(idx, +e.target.value)} />
            </div>
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Số tiền (đ)</Label>
              <Input type="number" className="h-8 text-right" value={it.amount} onChange={(e) => updateAmount(idx, +e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Ghi chú</Label>
              <Input className="h-8" value={it.note} onChange={(e) => updateInstallment(idx, "note", e.target.value)} />
            </div>
            <div className="col-span-1 flex justify-end">
              {terms.installments.length > 1 && (
                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => removeInstallment(idx)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">
          Tổng: <strong className={diff === 0 ? "text-chart-2" : "text-destructive"}>{formatVND(totalPaid)}</strong>
          <span className="ml-1">({totalPct}%)</span>
          {diff !== 0 && <span className="ml-2 text-destructive">({diff > 0 ? "thiếu " : "thừa "}{formatVND(Math.abs(diff))})</span>}
        </span>
        <span className="text-muted-foreground">Tổng báo giá: <strong>{formatVND(total)}</strong></span>
      </div>
    </div>
  );
}
