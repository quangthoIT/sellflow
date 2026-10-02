"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { db, type Product, type Customer, type Quote, type QuoteItem, type Template, type PaymentTerms, type PaymentTerm, loadSettings, getCachedSettings } from "@/lib/db";
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
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, FileText, Eye, FileSignature, Pencil, X, Download, FileType, User, Package, CreditCard, Calculator, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { downloadPdf, downloadWord } from "@/lib/download";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";
import { fetchReservedStockMap } from "@/lib/inventory";
import { ActionTooltip } from "@/components/action-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

const QUOTE_STATUSES = ["Nháp", "Đã gửi", "Khách đồng ý", "Khách từ chối", "Hết hạn"];

export function QuotesPage() {
  const { params, navigate } = useNav();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<QuoteItem[]>([]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [q, c, p, t, qi] = await Promise.all([
      db.from("quotes").select("*").order("date", { ascending: false }),
      db.from("customers").select("*").order("name"),
      db.from("products").select("*").order("name"),
      db.from("templates").select("*").eq("type", "quote").order("name"),
      db.from("quote_items").select("*"),
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
    const q = quotes.find((x) => x.id === id);
    const items = allItems.filter((i) => i.quote_id === id);
    return calcQuoteTotals(items, q?.discount || 0, q?.vat_pct || 0, q?.shipping || 0).total;
  };

  const rows = quotes
    .map((q) => ({
      quote: q,
      customer: customerName(q.customer_id),
      total: quoteTotal(q.id),
    }))
    .filter((r) =>
      !search ||
      r.quote.id.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      r.quote.date.includes(search) ||
      r.quote.status.toLowerCase().includes(search.toLowerCase())
    );

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
    await db.from("quote_items").delete().eq("quote_id", id);
    const { error } = await db.from("quotes").delete().eq("id", id);
    if (error) { toast.error("Lỗi xóa báo giá"); return; }
    toast.success("Đã xóa báo giá");
    load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await db.from("quotes").update({ status }).eq("id", id);
    if (error) { toast.error("Lỗi cập nhật"); return; }
    toast.success("Đã cập nhật trạng thái");
    load();
  };

  const convertToContract = async (quoteId: string) => {
    const s = await loadSettings();
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const { data: items } = await db.from("quote_items").select("*").eq("quote_id", quoteId);
    const contractId = genId(s.contract_prefix, s.id_format, 0, quote.customer_id ?? "");
    const contractTemplate = templates.find((t) => t.type === "contract" && t.is_default);

    const { error: cErr } = await db.from("contracts").insert({
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
      await db.from("contract_items").insert(cItems);
    }

    toast.success(`Đã tạo hợp đồng ${contractId}`);
    navigate("contracts", { id: contractId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Tìm báo giá theo mã, khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
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
              {loading && <TableSkeleton rows={5} columns={6} />}
              {!loading && sortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="Chưa có báo giá"
                      description="Tạo báo giá đầu tiên để gửi cho khách hàng của bạn."
                    />
                  </TableCell>
                </TableRow>
              )}
              {sortedRows.map(({ quote, customer, total }) => (
                <QuoteRow
                  key={quote.id}
                  quote={quote}
                  customerName={customer}
                  total={total}
                  onEdit={() => setEditingId(quote.id)}
                  onPreview={() => setPreviewId(quote.id)}
                  onDelete={() => setDeleteId(quote.id)}
                  onStatusChange={(s) => handleStatusChange(quote.id, s)}
                  onConvert={() => convertToContract(quote.id)}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Xác nhận xóa báo giá"
        description="Bạn có chắc chắn muốn xóa báo giá này? Tất cả dữ liệu sản phẩm trong báo giá sẽ bị xóa."
        confirmText="Xóa báo giá"
        onConfirm={async () => {
          if (deleteId) {
            await handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
      />

      {/* Editor */}
      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="sm:max-w-6xl max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="sm:max-w-5xl max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Xem trước báo giá</DialogTitle>
          </DialogHeader>
          {previewId && <QuotePreview quoteId={previewId} customers={customers} templates={templates} products={products} />}
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
          <ActionTooltip label="Xem trước báo giá">
            <Button size="sm" variant="ghost" onClick={onPreview}><Eye className="size-3.5" /></Button>
          </ActionTooltip>
          <ActionTooltip label="Chỉnh sửa báo giá">
            <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-3.5" /></Button>
          </ActionTooltip>
          <ActionTooltip label="Chuyển thành hợp đồng">
            <Button size="sm" variant="ghost" onClick={onConvert}><FileSignature className="size-3.5" /></Button>
          </ActionTooltip>
          <ActionTooltip label="Xóa báo giá">
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
          </ActionTooltip>
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
  const [reservedStockMap, setReservedStockMap] = useState<Record<string, number>>({});
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [status, setStatus] = useState("Nháp");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const rMap = await fetchReservedStockMap(quoteId ?? undefined);
      setReservedStockMap(rMap);

      if (quoteId) {
        const { data: q } = await db.from("quotes").select("*").eq("id", quoteId).maybeSingle();
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
        const { data: its } = await db.from("quote_items").select("*").eq("quote_id", quoteId);
        setItems((its ?? []) as QuoteItem[]);
      } else {
        const s = await loadSettings();
        const defaultTpl = templates.find((t) => t.is_default);
        setTemplateId(defaultTpl?.id ?? "");
        setVatPct(s.vat_default);
        setValidUntil(new Date(Date.now() + s.quote_valid_days * 86400000).toISOString().split("T")[0]);
        setPaymentTerms({ method: "transfer", installments: [{ label: "Đợt 1", date: new Date().toISOString().split("T")[0], percent: 100, amount: 0, note: "" }] });
      }
      setLoading(false);
    })();
  }, [quoteId]);

  const totals = calcQuoteTotals(items, discount, vatPct, shipping);

  const addProduct = (productId: string) => {
    if (!productId) return;
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;

    const quotedOther = reservedStockMap[p.id] || 0;
    const itemInForm = items.find((i) => i.product_id === p.id);
    const qtyInForm = itemInForm ? itemInForm.qty : 0;
    const maxAvailable = Math.max(0, p.stock - quotedOther);
    const avail = maxAvailable - qtyInForm;

    if (avail <= 0) {
      toast.error(
        `Sản phẩm ${p.name} không đủ số lượng khả dụng. Tồn kho: ${p.stock}, đang báo giá: ${quotedOther}, chỉ còn ${maxAvailable} sản phẩm có thể báo giá.`
      );
      return;
    }

    if (itemInForm) {
      setItems(items.map((it) => (it.product_id === p.id ? { ...it, qty: it.qty + 1 } : it)));
    } else {
      setItems([
        ...items,
        {
          id: crypto.randomUUID(),
          quote_id: quoteId ?? "",
          product_id: p.id,
          product_name: p.name,
          qty: 1,
          price: p.price,
          discount: 0,
          created_at: "",
        },
      ]);
    }
  };

  const updateItem = (idx: number, field: keyof QuoteItem, value: string | number) => {
    if (field === "qty") {
      const targetItem = items[idx];
      if (targetItem && targetItem.product_id) {
        const p = products.find((pr) => pr.id === targetItem.product_id);
        if (p) {
          const quotedOther = reservedStockMap[p.id] || 0;
          const maxAvailable = Math.max(0, p.stock - quotedOther);
          const requestedQty = Math.max(1, Number(value));

          if (requestedQty > maxAvailable) {
            toast.error(
              `Sản phẩm ${p.name} không đủ số lượng khả dụng. Tồn kho: ${p.stock}, đang báo giá: ${quotedOther}, chỉ còn ${maxAvailable} sản phẩm có thể báo giá.`
            );
            const safeQty = Math.max(1, maxAvailable);
            setItems(items.map((it, i) => (i === idx ? { ...it, qty: safeQty } : it)));
            return;
          }
        }
      }
    }
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    for (const it of items) {
      if (!it.product_id) continue;
      const p = products.find((pr) => pr.id === it.product_id);
      if (p) {
        const quotedOther = reservedStockMap[p.id] || 0;
        const maxAvailable = Math.max(0, p.stock - quotedOther);
        if (it.qty > maxAvailable) {
          toast.error(
            `Sản phẩm ${p.name} không đủ số lượng khả dụng. Tồn kho: ${p.stock}, đang báo giá: ${quotedOther}, chỉ còn ${maxAvailable} sản phẩm có thể báo giá.`
          );
          return;
        }
      }
    }

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
      await db.from("quotes").update(qData).eq("id", id);
    } else {
      await db.from("quotes").insert(qData);
    }

    await db.from("quote_items").delete().eq("quote_id", id);
    if (items.length > 0) {
      await db.from("quote_items").insert(
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
    <div className="space-y-4 pt-1">
      {/* 1. TOP CARD: THÔNG TIN BÁO GIÁ */}
      <Card className="p-4 shadow-2xs">
        <div className="grid grid-cols-12 gap-3.5 items-start">
          {/* Hàng 1: Khách hàng (75%) + Trạng thái (25%) */}
          <div className="col-span-12 md:col-span-9 space-y-1.5">
            <Label className="text-xs font-medium">
              Khách hàng <span className="text-destructive">*</span>
            </Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Chọn khách hàng" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-12 md:col-span-3 space-y-1.5">
            <Label className="text-xs font-medium">
              Trạng thái <span className="text-destructive">*</span>
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUOTE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Hàng 2: Mẫu báo giá (25%) + Hiệu lực đến (25%) + Ghi chú (50%) */}
          <div className="col-span-12 sm:col-span-6 md:col-span-3 space-y-1.5">
            <Label className="text-xs font-medium">
              Mẫu báo giá <span className="text-destructive">*</span>
            </Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full h-9 text-xs"><SelectValue placeholder="Chọn mẫu" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-12 sm:col-span-6 md:col-span-3 space-y-1.5">
            <Label className="text-xs font-medium">
              Hiệu lực đến <span className="text-destructive">*</span>
            </Label>
            <Input type="date" className="h-9 text-xs" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>

          <div className="col-span-12 md:col-span-6 space-y-1.5">
            <Label className="text-xs font-medium">Ghi chú</Label>
            <Textarea
              placeholder="Nhập ghi chú (nếu có)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>
      </Card>

      {/* 2. MIDDLE ROW: DANH SÁCH SẢN PHẨM */}
      <Card className="p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:bg-blue-500/20">
              <Package className="size-4" />
            </div>
            <span>Danh sách sản phẩm</span>
          </div>

          <Select onValueChange={addProduct}>
            <SelectTrigger className="h-8 w-44 gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 text-xs font-medium dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900">
              <Plus className="size-3.5" />
              <span>Thêm sản phẩm</span>
            </SelectTrigger>
            <SelectContent align="end">
              {products.filter((p) => p.status === "Đang bán").map((p) => {
                const quotedOther = reservedStockMap[p.id] || 0;
                const itemInForm = items.find((i) => i.product_id === p.id);
                const qtyInForm = itemInForm ? itemInForm.qty : 0;
                const maxAvailable = Math.max(0, p.stock - quotedOther);
                const avail = maxAvailable - qtyInForm;
                return (
                  <SelectItem key={p.id} value={p.id} disabled={avail <= 0}>
                    <div className="flex items-center justify-between w-full gap-2 text-xs">
                      <span className="font-medium">{p.name} — {formatVND(p.price)}</span>
                      <span className={cn("font-mono shrink-0", avail <= 0 ? "text-destructive" : "text-muted-foreground")}>
                        (Tồn: {p.stock} | Báo: {quotedOther} | Khả dụng: {avail})
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Sản phẩm</TableHead>
                <TableHead className="w-20 text-center text-xs">ĐVT</TableHead>
                <TableHead className="w-20 text-right text-xs">SL</TableHead>
                <TableHead className="w-32 text-right text-xs">Đơn giá (đ)</TableHead>
                <TableHead className="w-28 text-right text-xs">Giảm giá (đ)</TableHead>
                <TableHead className="w-36 text-right text-xs">Thành tiền (đ)</TableHead>
                <TableHead className="w-16 text-center text-xs">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="size-11 rounded-full bg-muted/60 flex items-center justify-center mb-2">
                        <Package className="size-5.5 text-muted-foreground/60" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Chưa có sản phẩm</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Thêm sản phẩm để bắt đầu tạo báo giá.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it, idx) => {
                  const prod = products.find((p) => p.id === it.product_id);
                  const unit = prod?.unit || "cái";
                  return (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-xs">{it.product_name}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground font-medium">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-muted text-[11px]">
                          {unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" className="h-8 w-16 text-right text-xs ml-auto" value={it.qty}
                          onChange={(e) => updateItem(idx, "qty", Math.max(1, +e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" className="h-8 w-28 text-right text-xs ml-auto" value={it.price}
                          onChange={(e) => updateItem(idx, "price", +e.target.value)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" className="h-8 w-24 text-right text-xs ml-auto" value={it.discount}
                          onChange={(e) => updateItem(idx, "discount", +e.target.value)} />
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatVND(it.qty * it.price - (it.discount || 0))}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeItem(idx)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 3. BOTTOM ROW: 2 CARDS (70% / 30%) */}
      <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-start">
        {/* Card 1: Điều khoản thanh toán (70%) */}
        <Card className="col-span-1 md:col-span-7 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:bg-blue-500/20">
              <CreditCard className="size-4" />
            </div>
            <span>Điều khoản thanh toán</span>
          </div>

          <PaymentTermsEditor terms={paymentTerms} total={totals.total} onChange={setPaymentTerms} />
        </Card>

        {/* Card 2: Tạm tính & tổng cộng (30%) */}
        <Card className="col-span-1 md:col-span-3 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <div className="flex size-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:bg-blue-500/20">
              <Calculator className="size-4" />
            </div>
            <span>Tạm tính & tổng cộng</span>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tạm tính</span>
              <span className="font-semibold text-foreground">{formatVND(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Chiết khấu (đ)</span>
              <Input type="number" className="h-8 w-28 text-right text-xs" value={discount}
                onChange={(e) => setDiscount(+e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">VAT (%)</span>
              <Input type="number" className="h-8 w-28 text-right text-xs" value={vatPct}
                onChange={(e) => setVatPct(+e.target.value)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Phí vận chuyển (đ)</span>
              <Input type="number" className="h-8 w-28 text-right text-xs" value={shipping}
                onChange={(e) => setShipping(+e.target.value)} />
            </div>

            <Separator className="my-2" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-bold text-foreground">Tổng cộng</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatVND(totals.total)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 4. FOOTER ACTION BAR */}
      <div className="flex items-center justify-between pt-3 border-t">
        <Button variant="outline" className="h-9 px-4 text-xs font-medium" onClick={onCancel}>
          Hủy
        </Button>
        <Button className="h-9 px-5 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave}>
          <FileText className="size-4" />
          <span>{quoteId ? "Cập nhật báo giá" : "Tạo báo giá"}</span>
        </Button>
      </div>
    </div>
  );
}

function QuotePreview({ quoteId, customers, templates, products = [] }: {
  quoteId: string;
  customers: Customer[];
  templates: Template[];
  products?: Product[];
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const { data: q } = await db.from("quotes").select("*").eq("id", quoteId).maybeSingle();
      const { data: its } = await db.from("quote_items").select("*").eq("quote_id", quoteId);
      setQuote(q as Quote);
      setItems((its ?? []) as QuoteItem[]);
      setLoading(false);
    })();
  }, [quoteId]);

  if (loading || !quote) return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;

  const customer = customers.find((c) => c.id === quote.customer_id);
  const template = templates.find((t) => t.id === quote.template_id)
    || templates.find((t) => t.type === "quote" && t.is_default)
    || templates.find((t) => t.type === "quote")
    || templates[0];
  const totals = calcQuoteTotals(items, quote.discount, quote.vat_pct, quote.shipping);

  const productTable = `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000000;">
    <thead><tr style="background:#f1f5f9;font-weight:bold;">
      <th style="border:1px solid #000000;padding:6px;text-align:left;font-size:12pt;color:#000000;">STT</th>
      <th style="border:1px solid #000000;padding:6px;text-align:left;font-size:12pt;color:#000000;">Sản phẩm / Dịch vụ</th>
      <th style="border:1px solid #000000;padding:6px;text-align:center;font-size:12pt;color:#000000;">ĐVT</th>
      <th style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">Số lượng</th>
      <th style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">Đơn giá (đ)</th>
      <th style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">Thành tiền (đ)</th>
    </tr></thead>
    <tbody>
      ${items.map((it, i) => {
        const prod = products.find((p) => p.id === it.product_id);
        const unit = prod?.unit || "cái";
        return `<tr>
        <td style="border:1px solid #000000;padding:6px;text-align:center;font-size:12pt;color:#000000;">${i + 1}</td>
        <td style="border:1px solid #000000;padding:6px;font-size:12pt;color:#000000;">${it.product_name}</td>
        <td style="border:1px solid #000000;padding:6px;text-align:center;font-size:12pt;color:#000000;">${unit}</td>
        <td style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">${it.qty}</td>
        <td style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">${formatVND(it.price)}</td>
        <td style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">${formatVND(it.qty * it.price - (it.discount || 0))}</td>
      </tr>`;
      }).join("")}
    </tbody>
    <tfoot>
      <tr style="font-weight:bold;">
        <td colspan="5" style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">Tổng tiền hàng:</td>
        <td style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">${formatVND(totals.subtotal)}</td>
      </tr>
      ${totals.vat > 0 ? `
      <tr style="font-weight:bold;">
        <td colspan="5" style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">Thuế GTGT (${quote.vat_pct}%):</td>
        <td style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">${formatVND(totals.vat)}</td>
      </tr>` : ""}
      <tr style="font-weight:bold;background:#f1f5f9;">
        <td colspan="5" style="border:1px solid #000000;padding:7px;text-align:right;font-size:12pt;color:#000000;">TỔNG CỘNG THANH TOÁN:</td>
        <td style="border:1px solid #000000;padding:7px;text-align:right;font-size:12pt;color:#000000;">${formatVND(totals.total)}</td>
      </tr>
    </tfoot>
  </table>`;

  const paymentTermsHtml = quote.payment_terms && quote.payment_terms.installments.length > 0
    ? `<div style="margin-top:10px;font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000000;">
        <p style="font-size:12pt;margin-bottom:6px;color:#000000;">Phương thức: <strong>${quote.payment_terms.method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:12pt;color:#000000;">
          <thead><tr style="background:#f1f5f9;font-weight:bold;">
            <th style="border:1px solid #000000;padding:6px;text-align:left;font-size:12pt;color:#000000;">Đợt</th>
            <th style="border:1px solid #000000;padding:6px;text-align:left;font-size:12pt;color:#000000;">Ngày</th>
            <th style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">Tỷ lệ (%)</th>
            <th style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">Số tiền</th>
            <th style="border:1px solid #000000;padding:6px;text-align:left;font-size:12pt;color:#000000;">Ghi chú</th>
          </tr></thead>
          <tbody>
            ${quote.payment_terms.installments.map((it, idx) => `<tr>
              <td style="border:1px solid #000000;padding:6px;font-size:12pt;color:#000000;">${it.label === "Thanh toán 1 lần" ? "Đợt 1" : (it.label || `Đợt ${idx + 1}`)}</td>
              <td style="border:1px solid #000000;padding:6px;font-size:12pt;color:#000000;">${formatDate(it.date)}</td>
              <td style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">${it.percent || 0}%</td>
              <td style="border:1px solid #000000;padding:6px;text-align:right;font-size:12pt;color:#000000;">${formatVND(it.amount)}</td>
              <td style="border:1px solid #000000;padding:6px;font-size:12pt;color:#000000;">${it.note || ""}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`
    : "Thanh toán khi xác nhận đơn hàng";

  let html = template?.content ?? "<p>Chưa chọn mẫu</p>";
  const replacements: Record<string, string> = {
    SO_TAI_LIEU: quote.id,
    SO_BAO_GIA: quote.id,
    NGAY: formatDate(quote.date),
    TEN_CONG_TY: settings?.company_name || "CÔNG TY BÁN HÀNG",
    DIA_CHI_CONG_TY: settings?.company_address || "",
    SDT_CONG_TY: settings?.company_phone || "",
    EMAIL_CONG_TY: settings?.company_email || "",
    MST_CONG_TY: settings?.company_tax || "",
    LOGO_CONG_TY: settings?.logo_url ? `<img src="${settings.logo_url}" alt="Logo" style="height:48px;max-width:150px;object-fit:contain;" />` : "",
    TEN_KHACH_HANG: customer?.name ?? "",
    DIA_CHI_KHACH_HANG: customer?.address ?? "",
    MST_KHACH_HANG: customer?.tax ?? "",
    SDT_KHACH_HANG: customer?.phone ?? "",
    EMAIL_KHACH_HANG: customer?.email ?? "",
    BANG_SAN_PHAM: productTable,
    TAM_TINH: formatVND(totals.subtotal),
    VAT: formatVND(totals.vat),
    TONG_TIEN: formatVND(totals.total),
    DA_THANH_TOAN: formatVND(0),
    CON_PHAI_THU: formatVND(totals.total),
    DIEU_KHOAN_THANH_TOAN: paymentTermsHtml,
    GHI_CHU: quote.notes || "",
    PAGE: "1",
    TOTAL_PAGES: "1",
    CHU_KY_BEN_BAN: `<div style="text-align:center; padding:12px; margin-top:20px; font-family:'Times New Roman',Times,serif; font-size:12pt; color:#000000;"><strong>ĐẠI DIỆN BÊN BÁN</strong><br/><em style="font-size:12pt;color:#000000;">(Ký, ghi rõ họ tên & đóng dấu)</em><br/><br/><br/><br/><strong style="font-size:12pt;">${settings?.company_name || "CÔNG TY BÁN HÀNG"}</strong></div>`,
    CHU_KY_KHAC_HANG: `<div style="text-align:center; padding:12px; margin-top:20px; font-family:'Times New Roman',Times,serif; font-size:12pt; color:#000000;"><strong>ĐẠI DIỆN KHÁCH HÀNG</strong><br/><em style="font-size:12pt;color:#000000;">(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><strong style="font-size:12pt;">${customer?.name || "KHÁCH HÀNG"}</strong></div>`,
    CHU_KY_KHACH_HANG: `<div style="text-align:center; padding:12px; margin-top:20px; font-family:'Times New Roman',Times,serif; font-size:12pt; color:#000000;"><strong>ĐẠI DIỆN KHÁCH HÀNG</strong><br/><em style="font-size:12pt;color:#000000;">(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><strong style="font-size:12pt;">${customer?.name || "KHÁCH HÀNG"}</strong></div>`,
    CHU_KY_BEN_MUA: `<div style="text-align:center; padding:12px; margin-top:20px; font-family:'Times New Roman',Times,serif; font-size:12pt; color:#000000;"><strong>ĐẠI DIỆN BÊN MUA</strong><br/><em style="font-size:12pt;color:#000000;">(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><strong style="font-size:12pt;">${customer?.name || "KHÁCH HÀNG"}</strong></div>`,
    CON_DAU: `<div style="display:inline-block; border:2px dashed #000000; border-radius:50%; padding:10px 16px; color:#000000; font-weight:bold; font-size:12pt; transform:rotate(-12deg);">ĐÃ XÁC NHẬN</div>`,
  };
  for (const [k, v] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v);
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

  const totalPercent = Math.round(terms.installments.reduce((s, it) => s + (Number(it.percent) || 0), 0) * 100) / 100;
  const totalAmount = terms.installments.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const isPercentComplete = Math.abs(totalPercent - 100) < 0.01;
  const isAmountComplete = totalAmount === total && total > 0;

  const prevTotalRef = useRef<number>(total);

  // Tự động đồng bộ số tiền theo % khi tổng cộng đơn hàng thay đổi
  useEffect(() => {
    if (!terms) return;
    const prevTotal = prevTotalRef.current;
    prevTotalRef.current = total;

    // Kiểm tra xem có cần cập nhật amount không (ví dụ: amount === 0 khi total > 0, hoặc total thay đổi)
    const hasZeroAmount = terms.installments.some((it) => it.percent > 0 && it.amount === 0 && total > 0);
    const isSingleAndMismatched = terms.installments.length === 1 && terms.installments[0].percent === 100 && terms.installments[0].amount !== total;
    const isTotalChanged = prevTotal !== total && total > 0;

    if (hasZeroAmount || isSingleAndMismatched || isTotalChanged) {
      let remainingMoney = total;
      const count = terms.installments.length;
      const updated = terms.installments.map((it, i) => {
        const isLast = i === count - 1;
        if (count === 1 && it.percent === 100) {
          return { ...it, amount: total };
        }
        const amt = isLast && isPercentComplete ? remainingMoney : Math.round((total * it.percent) / 100);
        remainingMoney -= amt;
        return {
          ...it,
          amount: Math.max(0, amt),
        };
      });
      onChange({ ...terms, installments: updated });
    }
  }, [total]);

  const setMethod = (method: string) => {
    onChange({ ...terms, method });
  };

  const setInstallmentCount = (n: number) => {
    const current = terms.installments;
    if (n === current.length) return;
    
    const basePct = Math.floor((100 / n) * 100) / 100;
    const remainderPct = Math.round((100 - basePct * n) * 100) / 100;

    let remainingMoney = total;
    const newInstallments: PaymentTerm[] = [];
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const pct = isLast ? Math.round((basePct + remainderPct) * 100) / 100 : basePct;
      const amt = isLast ? remainingMoney : Math.round((total * pct) / 100);
      remainingMoney -= amt;

      const old = current[i];
      const oldLabel = old?.label;
      const label = (!oldLabel || oldLabel === "Thanh toán 1 lần") ? `Đợt ${i + 1}` : oldLabel;
      newInstallments.push({
        label,
        date: old?.date || new Date().toISOString().split("T")[0],
        percent: pct,
        amount: Math.max(0, amt),
        note: old?.note || "",
      });
    }
    onChange({ ...terms, installments: newInstallments });
  };

  const splitEqually = () => {
    const count = terms.installments.length;
    if (count === 0) return;
    const basePct = Math.floor((100 / count) * 100) / 100;
    const remainderPct = Math.round((100 - basePct * count) * 100) / 100;

    let remainingMoney = total;
    const updated = terms.installments.map((it, i) => {
      const isLast = i === count - 1;
      const pct = isLast ? Math.round((basePct + remainderPct) * 100) / 100 : basePct;
      const amt = isLast ? remainingMoney : Math.round((total * pct) / 100);
      remainingMoney -= amt;
      return {
        ...it,
        percent: pct,
        amount: Math.max(0, amt),
      };
    });
    onChange({ ...terms, installments: updated });
  };

  const updateInstallment = (idx: number, field: keyof PaymentTerm, value: string | number) => {
    onChange({
      ...terms,
      installments: terms.installments.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    });
  };

  const updatePercent = (idx: number, percent: number) => {
    const amount = Math.round((total * percent) / 100);
    onChange({
      ...terms,
      installments: terms.installments.map((it, i) => (i === idx ? { ...it, percent, amount } : it)),
    });
  };

  const updateAmount = (idx: number, amount: number) => {
    const percent = total > 0 ? Math.round((amount / total) * 100 * 100) / 100 : 0;
    onChange({
      ...terms,
      installments: terms.installments.map((it, i) => (i === idx ? { ...it, amount, percent } : it)),
    });
  };

  const removeInstallment = (idx: number) => {
    if (terms.installments.length <= 1) return;
    onChange({ ...terms, installments: terms.installments.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Phương thức thanh toán</Label>
          <Select value={terms.method} onValueChange={setMethod}>
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transfer">Chuyển khoản</SelectItem>
              <SelectItem value="cash">Tiền mặt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Số đợt thanh toán</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-blue-600 dark:text-blue-400 p-0 hover:bg-transparent"
              onClick={splitEqually}
            >
              Chia đều %
            </Button>
          </div>
          <Select value={String(terms.installments.length)} onValueChange={(v) => setInstallmentCount(+v)}>
            <SelectTrigger className="w-full h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} đợt
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2.5">
        {terms.installments.map((it, idx) => (
          <div
            key={idx}
            className="rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 space-y-2"
          >
            <span className="text-xs font-semibold text-foreground block">Đợt {idx + 1}</span>
            <div className="flex items-end gap-2.5">
              <div className="w-[24%] space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Ngày thanh toán</Label>
                <Input
                  type="date"
                  className="h-9 text-xs bg-white dark:bg-slate-950"
                  value={it.date}
                  onChange={(e) => updateInstallment(idx, "date", e.target.value)}
                />
              </div>
              <div className="w-[18%] space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Phần trăm (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-9 text-xs text-right bg-white dark:bg-slate-950 font-semibold"
                  value={it.percent}
                  onChange={(e) => updatePercent(idx, +e.target.value)}
                />
              </div>
              <div className="w-[26%] space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Số tiền (đ)</Label>
                <Input
                  type="number"
                  className="h-9 text-xs text-right bg-white dark:bg-slate-950 font-semibold"
                  value={it.amount}
                  onChange={(e) => updateAmount(idx, +e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Ghi chú</Label>
                <Input
                  className="h-9 text-xs bg-white dark:bg-slate-950"
                  placeholder="Nhập ghi chú..."
                  value={it.note || ""}
                  onChange={(e) => updateInstallment(idx, "note", e.target.value)}
                />
              </div>
              {terms.installments.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeInstallment(idx)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary Allocation Bar */}
      <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Tổng phân bổ:</span>
          <span className="font-bold text-foreground">{formatVND(totalAmount)}</span>
          <span className="text-muted-foreground">({totalPercent}%)</span>
        </div>
        <div>
          {isPercentComplete && isAmountComplete ? (
            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] gap-1">
              ✓ Khớp 100% tổng tiền
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-amber-700 dark:text-amber-400 bg-amber-500/10 text-[11px]">
              Chênh lệch: {formatVND(total - totalAmount)} ({Math.round((100 - totalPercent) * 100) / 100}%)
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
