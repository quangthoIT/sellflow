"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, type Contract, type ContractItem, type Customer, type Template, type Product, type EmailSettings, type PaymentTerms, loadSettings, getCachedSettings } from "@/lib/supabase";
import { formatVND, formatDate, genId } from "@/lib/format";
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
import { Eye, FileSignature, Pencil, Trash2, X, Wallet, Mail, Download, FileType } from "lucide-react";
import { toast } from "sonner";
import { downloadPdf, downloadWord } from "@/lib/download";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";
import { ActionTooltip } from "@/components/action-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";

const CONTRACT_STATUSES = ["Nháp", "Chờ ký", "Đã ký", "Đang thực hiện", "Hoàn thành", "Hủy"];

export function ContractsPage() {
  const { params, navigate } = useNav();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<ContractItem[]>([]);
  const [allPayments, setAllPayments] = useState<{ contract_id: string; amount: number }[]>([]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [c, cu, t, ci, pa] = await Promise.all([
      supabase.from("contracts").select("*").order("date", { ascending: false }),
      supabase.from("customers").select("*").order("name"),
      supabase.from("templates").select("*").eq("type", "contract").order("name"),
      supabase.from("contract_items").select("*"),
      supabase.from("payments").select("contract_id, amount"),
    ]);
    setContracts((c.data ?? []) as Contract[]);
    setCustomers((cu.data ?? []) as Customer[]);
    setTemplates((t.data ?? []) as Template[]);
    setAllItems((ci.data ?? []) as ContractItem[]);
    setAllPayments((pa.data ?? []) as { contract_id: string; amount: number }[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (params.id) setEditingId(params.id);
  }, [params.id]);

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";

  const contractTotal = (id: string) => allItems.filter((i) => i.contract_id === id).reduce((s, i) => s + i.qty * i.price, 0);
  const contractPaid = (id: string) => allPayments.filter((p) => p.contract_id === id).reduce((s, p) => s + p.amount, 0);

  const rows = contracts
    .map((c) => ({
      contract: c,
      customer: customerName(c.customer_id),
      total: contractTotal(c.id),
      paid: contractPaid(c.id),
      remaining: Math.max(0, contractTotal(c.id) - contractPaid(c.id)),
    }))
    .filter((r) =>
      !search ||
      r.contract.id.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      r.contract.date.includes(search) ||
      r.contract.status.toLowerCase().includes(search.toLowerCase())
    );

  const colFilters = [
    { key: (r: typeof rows[0]) => r.contract.id, value: filters.id ?? "" },
    { key: (r: typeof rows[0]) => r.customer, value: filters.customer ?? "" },
    { key: (r: typeof rows[0]) => r.contract.date, value: filters.date ?? "" },
    { key: (r: typeof rows[0]) => String(r.total), value: filters.total ?? "" },
    { key: (r: typeof rows[0]) => String(r.paid), value: filters.paid ?? "" },
    { key: (r: typeof rows[0]) => String(r.remaining), value: filters.remaining ?? "" },
    { key: (r: typeof rows[0]) => r.contract.status, value: filters.status ?? "" },
    { key: (r: typeof rows[0]) => (r.contract.stock_applied ? "Đã trừ" : "Chưa"), value: filters.stock ?? "" },
  ];

  const filteredRows = filterData(rows, colFilters as any);

  const sortedRows = (() => {
    if (!sortKey || !sortDir) return filteredRows;
    const accessor: Record<string, (r: typeof rows[0]) => string | number> = {
      id: (r) => r.contract.id,
      customer: (r) => r.customer,
      date: (r) => r.contract.date,
      total: (r) => r.total,
      paid: (r) => r.paid,
      remaining: (r) => r.remaining,
      status: (r) => r.contract.status,
      stock: (r) => r.contract.stock_applied ? 1 : 0,
    };
    return sortData(filteredRows, accessor[sortKey] ?? ((r) => r.contract.id), sortDir);
  })();

  const handleStatusChange = async (contract: Contract, newStatus: string) => {
    if (newStatus === "Đã ký" && !contract.stock_applied) {
      await applyStock(contract);
    }
    if (newStatus === "Hủy" && contract.stock_applied) {
      await returnStock(contract);
    }
    const { error } = await supabase.from("contracts").update({ status: newStatus }).eq("id", contract.id);
    if (error) { toast.error("Lỗi cập nhật"); return; }
    toast.success("Đã cập nhật trạng thái");
    load();
  };

  const applyStock = async (contract: Contract) => {
    const s = await loadSettings();
    const { data: items } = await supabase.from("contract_items").select("*").eq("contract_id", contract.id);
    const cItems = (items ?? []) as ContractItem[];
    for (const it of cItems) {
      if (!it.product_id) continue;
      const { data: prod } = await supabase.from("products").select("*").eq("id", it.product_id).maybeSingle();
      if (!prod) continue;
      const newStock = (prod as Product).stock - it.qty;
      await supabase.from("products").update({ stock: newStock }).eq("id", it.product_id);
      const txId = genId(`${s.inventory_prefix}-XK`, s.id_format);
      await supabase.from("inventory_transactions").insert({
        id: txId, product_id: it.product_id, type: "Hợp đồng", qty: -it.qty, ref: contract.id, note: `Xuất kho theo ${contract.id}`,
      });
    }
    await supabase.from("contracts").update({ stock_applied: true }).eq("id", contract.id);
    toast.success("Đã trừ kho theo hợp đồng");
  };

  const returnStock = async (contract: Contract) => {
    const s = await loadSettings();
    const { data: items } = await supabase.from("contract_items").select("*").eq("contract_id", contract.id);
    const cItems = (items ?? []) as ContractItem[];
    for (const it of cItems) {
      if (!it.product_id) continue;
      const { data: prod } = await supabase.from("products").select("*").eq("id", it.product_id).maybeSingle();
      if (!prod) continue;
      const newStock = (prod as Product).stock + it.qty;
      await supabase.from("products").update({ stock: newStock }).eq("id", it.product_id);
      const txId = genId(`${s.inventory_prefix}-HK`, s.id_format);
      await supabase.from("inventory_transactions").insert({
        id: txId, product_id: it.product_id, type: "Hoàn kho", qty: it.qty, ref: contract.id, note: `Hoàn kho do hủy ${contract.id}`,
      });
    }
    await supabase.from("contracts").update({ stock_applied: false }).eq("id", contract.id);
    toast.success("Đã hoàn kho");
  };

  const handleDelete = async (id: string) => {
    const contract = contracts.find((c) => c.id === id);
    if (contract?.stock_applied) {
      toast.error("Hợp đồng đã trừ kho, không thể xóa. Hãy hủy hợp đồng để hoàn kho trước.");
      return;
    }
    await supabase.from("contract_items").delete().eq("contract_id", id);
    await supabase.from("payments").delete().eq("contract_id", id);
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) { toast.error("Lỗi xóa"); return; }
    toast.success("Đã xóa hợp đồng");
    load();
  };

  const sendEmail = async (contract: Contract) => {
    const { data: settings } = await supabase.from("email_settings").select("*").eq("id", 1).maybeSingle();
    const s = settings as EmailSettings | null;
    if (!s) { toast.error("Chưa cấu hình email"); return; }

    const customer = customers.find((c) => c.id === contract.customer_id);
    if (!customer?.email) { toast.error("Khách hàng chưa có email"); return; }

    const { data: items } = await supabase.from("contract_items").select("*").eq("contract_id", contract.id);
    const cItems = (items ?? []) as ContractItem[];
    const total = cItems.reduce((sum, it) => sum + it.qty * it.price, 0);
    const { data: pays } = await supabase.from("payments").select("amount").eq("contract_id", contract.id);
    const paid = (pays ?? []).reduce((s: number, p: any) => s + p.amount, 0);
    const remaining = total - paid;

    let subject = s.subject;
    let body = s.body;
    const replacements: Record<string, string> = {
      SO_HOP_DONG: contract.id,
      TEN_KHACH_HANG: customer.name,
      TONG_TIEN: formatVND(total),
      DA_THANH_TOAN: formatVND(paid),
      CON_PHAI_THU: formatVND(remaining),
    };
    for (const [k, v] of Object.entries(replacements)) {
      subject = subject.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
      body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
    }

    const appCfg = getCachedSettings();
    const logId = genId(appCfg.email_prefix, appCfg.id_format);
    await supabase.from("email_logs").insert({
      id: logId,
      contract_id: contract.id,
      customer_id: customer.id,
      customer_name: customer.name,
      recipient: customer.email,
      sender: `${s.sender_name} <${s.sender_email}>`,
      subject,
      body,
      attach_pdf: s.attach_pdf,
      automatic: false,
      status: "Đã gửi",
    });

    toast.success(`Đã ghi log gửi email đến ${customer.email}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Tìm hợp đồng theo mã, khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => navigate("quotes")}>
          <FileSignature className="size-4" /> Tạo từ báo giá
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
                <SortableHead label="Tổng giá trị" align="right" sortDir={sortKey === "total" ? sortDir : null} onSort={(d) => { setSortKey("total"); setSortDir(d); }} filter={{ type: "text", value: filters.total ?? "", placeholder: "Lọc tổng..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, total: v }))} />
                <SortableHead label="Đã thu" align="right" sortDir={sortKey === "paid" ? sortDir : null} onSort={(d) => { setSortKey("paid"); setSortDir(d); }} filter={{ type: "text", value: filters.paid ?? "", placeholder: "Lọc đã thu..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, paid: v }))} />
                <SortableHead label="Còn nợ" align="right" sortDir={sortKey === "remaining" ? sortDir : null} onSort={(d) => { setSortKey("remaining"); setSortDir(d); }} filter={{ type: "text", value: filters.remaining ?? "", placeholder: "Lọc còn nợ..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, remaining: v }))} />
                <SortableHead label="Trạng thái" sortDir={sortKey === "status" ? sortDir : null} onSort={(d) => { setSortKey("status"); setSortDir(d); }} filter={{ type: "select", value: filters.status ?? "", options: CONTRACT_STATUSES.map((s) => ({ label: s, value: s })) }} onFilterChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
                <SortableHead label="Kho" sortDir={sortKey === "stock" ? sortDir : null} onSort={(d) => { setSortKey("stock"); setSortDir(d); }} filter={{ type: "select", value: filters.stock ?? "", options: [{ label: "Đã trừ", value: "Đã trừ" }, { label: "Chưa", value: "Chưa" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, stock: v }))} />
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton rows={5} columns={9} />}
              {!loading && sortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <EmptyState
                      title="Chưa có hợp đồng"
                      description="Chuyển từ báo giá để tạo hợp đồng đầu tiên."
                    />
                  </TableCell>
                </TableRow>
              )}
              {sortedRows.map(({ contract, customer, total, paid }) => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  customerName={customer}
                  total={total}
                  paid={paid}
                  onStatusChange={(s) => handleStatusChange(contract, s)}
                  onPreview={() => setPreviewId(contract.id)}
                  onEdit={() => setEditingId(contract.id)}
                  onDelete={() => setDeleteId(contract.id)}
                  onPayment={() => navigate("payments", { contract: contract.id })}
                  onSendEmail={() => sendEmail(contract)}
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
        title="Xác nhận xóa hợp đồng"
        description="Bạn có chắc chắn muốn xóa hợp đồng này? Tất cả các dữ liệu thanh toán và sản phẩm thuộc hợp đồng sẽ bị xóa."
        confirmText="Xóa hợp đồng"
        onConfirm={async () => {
          if (deleteId) {
            await handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
      />

      {/* Preview */}
      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="sm:max-w-6xl max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Xem trước hợp đồng</span>
              <Button variant="ghost" size="icon" onClick={() => setPreviewId(null)}><X className="size-4" /></Button>
            </DialogTitle>
          </DialogHeader>
          {previewId && <ContractPreview contractId={previewId} customers={customers} templates={templates} />}
        </DialogContent>
      </Dialog>

      {/* Edit (notes + template) */}
      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="sm:max-w-4xl max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa hợp đồng {editingId}</DialogTitle>
          </DialogHeader>
          {editingId && <ContractEditForm contractId={editingId} templates={templates} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContractRow({ contract, customerName, total, paid, onStatusChange, onPreview, onEdit, onDelete, onPayment, onSendEmail }: {
  contract: Contract;
  customerName: string;
  total: number;
  paid: number;
  onStatusChange: (s: string) => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPayment: () => void;
  onSendEmail: () => void;
}) {
  const [terms, setTerms] = useState<PaymentTerms | null>(null);

  useEffect(() => {
    supabase.from("contracts").select("payment_terms").eq("id", contract.id).maybeSingle().then(({ data }: any) => {
      setTerms((data as Contract | null)?.payment_terms ?? null);
    });
  }, [contract.id]);

  const installments = terms?.installments ?? [];
  const hasInstallments = installments.length > 0;
  const totalDue = hasInstallments ? installments.reduce((s, it) => s + (it.amount || 0), 0) : total;
  const remaining = Math.max(0, totalDue - paid);

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">{contract.id}</TableCell>
        <TableCell className="font-medium">{customerName}</TableCell>
        <TableCell>{formatDate(contract.date)}</TableCell>
        <TableCell className="text-right font-medium">{formatVND(totalDue)}</TableCell>
        <TableCell className="text-right text-chart-2">{formatVND(paid)}</TableCell>
        <TableCell className="text-right text-destructive">{formatVND(remaining)}</TableCell>
        <TableCell>
          <Select value={contract.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTRACT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          {contract.stock_applied ? (
            <Badge variant="default" className="text-xs">Đã trừ</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Chưa</Badge>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <ActionTooltip label="Xem trước hợp đồng">
              <Button size="sm" variant="ghost" onClick={onPreview}><Eye className="size-3.5" /></Button>
            </ActionTooltip>
            <ActionTooltip label="Ghi nhận thanh toán">
              <Button size="sm" variant="ghost" onClick={onPayment}><Wallet className="size-3.5" /></Button>
            </ActionTooltip>
            <ActionTooltip label="Gửi email hợp đồng">
              <Button size="sm" variant="ghost" onClick={onSendEmail}><Mail className="size-3.5" /></Button>
            </ActionTooltip>
            <ActionTooltip label="Chỉnh sửa hợp đồng">
              <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-3.5" /></Button>
            </ActionTooltip>
            <ActionTooltip label="Xóa hợp đồng">
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
            </ActionTooltip>
          </div>
        </TableCell>
      </TableRow>
      {hasInstallments && installments.map((it, idx) => {
        let remainingPaid = paid;
        for (let i = 0; i < idx; i++) remainingPaid -= Math.max(0, installments[i].amount || 0);
        const due = it.amount || 0;
        const got = Math.min(due, Math.max(0, remainingPaid));
        const rem = Math.max(0, due - got);
        const isOverdue = new Date(it.date) < new Date(new Date().toISOString().split("T")[0]) && rem > 0;
        return (
          <TableRow key={`${contract.id}-inst-${idx}`} className="text-xs text-muted-foreground">
            <TableCell className="pl-6">↳ {it.label || `Đợt ${idx + 1}`}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(it.date)}{isOverdue ? " · quá hạn" : ""}</TableCell>
            <TableCell className="text-right" colSpan={2}>{formatVND(due)}</TableCell>
            <TableCell className="text-right text-chart-2">{formatVND(got)}</TableCell>
            <TableCell className="text-right text-destructive">{formatVND(rem)}</TableCell>
            <TableCell>
              {rem === 0 ? <Badge variant="default" className="text-xs">Đã đủ</Badge> : got > 0 ? <Badge variant="secondary" className="text-xs">Một phần</Badge> : isOverdue ? <Badge variant="destructive" className="text-xs">Quá hạn</Badge> : <Badge variant="outline" className="text-xs">Chưa thu</Badge>}
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        );
      })}
    </>
  );
}

function ContractEditForm({ contractId, templates, onSaved, onCancel }: {
  contractId: string;
  templates: Template[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [templateId, setTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("contracts").select("*").eq("id", contractId).maybeSingle().then(({ data }: any) => {
      if (data) {
        setTemplateId((data as Contract).template_id ?? "");
        setNotes((data as Contract).notes);
      }
      setLoading(false);
    });
  }, [contractId]);

  const handleSave = async () => {
    await supabase.from("contracts").update({
      template_id: templateId || null,
      notes,
    }).eq("id", contractId);
    toast.success("Đã cập nhật hợp đồng");
    onSaved();
  };

  if (loading) return <div className="py-4 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Mẫu hợp đồng</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger><SelectValue placeholder="Chọn mẫu" /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.locked ? " (Đã khóa)" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Ghi chú</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button onClick={handleSave}>Lưu</Button>
      </DialogFooter>
    </div>
  );
}

function ContractPreview({ contractId, customers, templates }: {
  contractId: string;
  customers: Customer[];
  templates: Template[];
}) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("contracts").select("*").eq("id", contractId).maybeSingle();
      const { data: its } = await supabase.from("contract_items").select("*").eq("contract_id", contractId);
      setContract(c as Contract);
      setItems((its ?? []) as ContractItem[]);
      setLoading(false);
    })();
  }, [contractId]);

  if (loading || !contract) return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;

  const customer = customers.find((cu) => cu.id === contract.customer_id);
  const template = templates.find((t) => t.id === contract.template_id);
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);

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
        <td style="border:1px solid #ddd;padding:6px;text-align:right">${formatVND(it.qty * it.price)}</td>
      </tr>`).join("")}
    </tbody>
  </table>`;

  const settings = getCachedSettings();
  let html = template?.content ?? "<p>Chưa chọn mẫu</p>";
  const replacements: Record<string, string> = {
    SO_TAI_LIEU: contract.id,
    NGAY: formatDate(contract.date),
    TEN_CONG_TY: settings?.company_name || "",
    DIA_CHI_CONG_TY: settings?.company_address || "",
    SDT_CONG_TY: settings?.company_phone || "",
    EMAIL_CONG_TY: settings?.company_email || "",
    MST_CONG_TY: settings?.company_tax || "",
    LOGO_CONG_TY: settings?.logo_url ? `<img src="${settings.logo_url}" alt="Logo" style="height:48px;max-width:150px;object-fit:contain;" />` : "",
    TEN_KHACH_HANG: customer?.name ?? "",
    DIA_CHI_KHACH_HANG: customer?.address ?? "",
    MST_KHACH_HANG: customer?.tax ?? "",
    BANG_SAN_PHAM: productTable,
    TONG_TIEN: formatVND(total),
    CHU_KY_BEN_BAN: `<div style="text-align:center; padding:12px; margin-top:20px;"><strong>ĐẠI DIỆN BÊN BÁN</strong><br/><em style="font-size:12px;color:#666;">(Ký, ghi rõ họ tên & đóng dấu)</em><br/><br/><br/><br/><strong>${settings?.company_name || "CÔNG TY BÁN HÀNG"}</strong></div>`,
    CHU_KY_KHAC_HANG: `<div style="text-align:center; padding:12px; margin-top:20px;"><strong>ĐẠI DIỆN KHÁCH HÀNG</strong><br/><em style="font-size:12px;color:#666;">(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><strong>${customer?.name || "KHÁCH HÀNG"}</strong></div>`,
    CON_DAU: `<div style="display:inline-block; border:2px dashed #ef4444; border-radius:50%; padding:10px 16px; color:#ef4444; font-weight:bold; font-size:12px; transform:rotate(-12deg);">ĐÃ XÁC NHẬN</div>`,
  };
  for (const [k, v] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{contract.status}</Badge>
          <span className="text-sm text-muted-foreground">{template?.name ?? "Mặc định"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadPdf(`Hop-dong-${contract.id}`, html)}>
            <Download className="size-3.5" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadWord(`Hop-dong-${contract.id}`, html)}>
            <FileType className="size-3.5" /> Word
          </Button>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-8 text-black" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
