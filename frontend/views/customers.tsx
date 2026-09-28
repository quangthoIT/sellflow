"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, getCachedSettings, loadSettings, type Customer, type Quote, type Contract } from "@/lib/supabase";
import { formatVND, formatDate, genId } from "@/lib/format";
import { useNav } from "@/lib/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";
import { ActionTooltip } from "@/components/action-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";

type QuoteItemRow = { quote_id: string; qty: number; price: number; discount: number };
type ContractItemRow = { contract_id: string; qty: number; price: number };
type PaymentRow = { contract_id: string; amount: number };

export function CustomersPage() {
  const { navigate } = useNav();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Customer | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").order("name");
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase()));

  const colFilters = [
    { key: "id" as keyof Customer, value: filters.id ?? "" },
    { key: "name" as keyof Customer, value: filters.name ?? "" },
    { key: "phone" as keyof Customer, value: filters.phone ?? "" },
    { key: "email" as keyof Customer, value: filters.email ?? "" },
    { key: "tax" as keyof Customer, value: filters.tax ?? "" },
  ];

  const result = sortData(filterData(filtered, colFilters), (sortKey as any) ?? "name", sortDir);

  const handleSave = async (c: Partial<Customer>) => {
    if (editing) {
      const { error } = await supabase.from("customers").update(c).eq("id", editing.id);
      if (error) { toast.error("Lỗi cập nhật"); return; }
      toast.success("Đã cập nhật khách hàng");
    } else {
      let id = c.id;
      if (!id) {
        const s = getCachedSettings();
        const { count } = await supabase.from("customers").select("*", { count: "exact", head: true });
        const pattern = s.id_format.includes("{NUM}") ? s.id_format : "{PREFIX}{NUM}";
        id = genId(s.customer_prefix, pattern, (count ?? 0) + 1);
      }
      const { error } = await supabase.from("customers").insert({ ...c, id });
      if (error) { toast.error("Lỗi tạo khách hàng"); return; }
      toast.success("Đã thêm khách hàng");
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { toast.error("Không thể xóa (đang có báo giá/hợp đồng)"); return; }
    toast.success("Đã xóa khách hàng");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Tìm khách hàng theo tên, SĐT, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4" /> Thêm khách hàng
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
            </DialogHeader>
            <CustomerForm customer={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mã" sortDir={sortKey === "id" ? sortDir : null} onSort={(d) => { setSortKey("id"); setSortDir(d); }} filter={{ type: "text", value: filters.id ?? "", placeholder: "Lọc mã..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, id: v }))} />
                <SortableHead label="Tên khách hàng" sortDir={sortKey === "name" ? sortDir : null} onSort={(d) => { setSortKey("name"); setSortDir(d); }} filter={{ type: "text", value: filters.name ?? "", placeholder: "Lọc tên..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, name: v }))} />
                <SortableHead label="SĐT" sortDir={sortKey === "phone" ? sortDir : null} onSort={(d) => { setSortKey("phone"); setSortDir(d); }} filter={{ type: "text", value: filters.phone ?? "", placeholder: "Lọc SĐT..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, phone: v }))} />
                <SortableHead label="Email" sortDir={sortKey === "email" ? sortDir : null} onSort={(d) => { setSortKey("email"); setSortDir(d); }} filter={{ type: "text", value: filters.email ?? "", placeholder: "Lọc email..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, email: v }))} />
                <SortableHead label="MST" sortDir={sortKey === "tax" ? sortDir : null} onSort={(d) => { setSortKey("tax"); setSortDir(d); }} filter={{ type: "text", value: filters.tax ?? "", placeholder: "Lọc MST..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, tax: v }))} />
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton rows={5} columns={6} />}
              {!loading && result.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="Chưa có khách hàng"
                      description="Thêm hồ sơ khách hàng mới để quản lý thông tin liên hệ và lịch sử giao dịch."
                    />
                  </TableCell>
                </TableRow>
              )}
              {result.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.tax || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionTooltip label="Lịch sử giao dịch">
                        <Button size="sm" variant="ghost" onClick={() => setShowHistory(c)}>
                          <History className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Chỉnh sửa thông tin">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setShowForm(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Xóa khách hàng">
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Xác nhận xóa khách hàng"
        description="Bạn có chắc chắn muốn xóa khách hàng này? Tất cả các thông tin liên quan sẽ bị ảnh hưởng."
        confirmText="Xóa khách hàng"
        onConfirm={async () => {
          if (deleteId) {
            await handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
      />

      {/* History dialog */}
      <Dialog open={!!showHistory} onOpenChange={(o) => !o && setShowHistory(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lịch sử giao dịch — {showHistory?.name}</DialogTitle>
          </DialogHeader>
          {showHistory && <CustomerHistory customer={showHistory} onOpenQuote={(id) => navigate("quotes", { id })} onOpenContract={(id) => navigate("contracts", { id })} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerHistory({ customer, onOpenQuote, onOpenContract }: {
  customer: Customer;
  onOpenQuote: (id: string) => void;
  onOpenContract: (id: string) => void;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItemRow[]>([]);
  const [contractItems, setContractItems] = useState<ContractItemRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [q, c, qi, ci, p] = await Promise.all([
        supabase.from("quotes").select("*").eq("customer_id", customer.id).order("date", { ascending: false }),
        supabase.from("contracts").select("*").eq("customer_id", customer.id).order("date", { ascending: false }),
        supabase.from("quote_items").select("quote_id, qty, price, discount"),
        supabase.from("contract_items").select("contract_id, qty, price"),
        supabase.from("payments").select("contract_id, amount"),
      ]);
      setQuotes((q.data ?? []) as Quote[]);
      setContracts((c.data ?? []) as Contract[]);
      setQuoteItems((qi.data ?? []) as QuoteItemRow[]);
      setContractItems((ci.data ?? []) as ContractItemRow[]);
      setPayments((p.data ?? []) as PaymentRow[]);
      setLoading(false);
    })();
  }, [customer.id]);

  const quoteTotal = (id: string) =>
    quoteItems.filter((i) => i.quote_id === id).reduce((s, i) => s + i.qty * i.price - (i.discount || 0), 0);
  const contractTotal = (id: string) =>
    contractItems.filter((i) => i.contract_id === id).reduce((s, i) => s + i.qty * i.price, 0);
  const contractPaid = (id: string) =>
    payments.filter((p) => p.contract_id === id).reduce((s, p) => s + p.amount, 0);

  const totalQuoteValue = quotes.reduce((s, q) => s + quoteTotal(q.id), 0);
  const totalContractValue = contracts.reduce((s, c) => s + contractTotal(c.id), 0);
  const totalPaid = contracts.reduce((s, c) => s + contractPaid(c.id), 0);
  const totalOutstanding = totalContractValue - totalPaid;

  if (loading) return <div className="py-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Báo giá</div>
          <div className="text-lg font-bold">{quotes.length}</div>
          <div className="text-xs text-muted-foreground">{formatVND(totalQuoteValue)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Hợp đồng</div>
          <div className="text-lg font-bold">{contracts.length}</div>
          <div className="text-xs text-muted-foreground">{formatVND(totalContractValue)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Đã thanh toán</div>
          <div className="text-lg font-bold text-chart-2">{formatVND(totalPaid)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Còn phải thu</div>
          <div className="text-lg font-bold text-destructive">{formatVND(totalOutstanding)}</div>
        </div>
      </div>

      <Tabs defaultValue="quotes">
        <TabsList>
          <TabsTrigger value="quotes">Báo giá ({quotes.length})</TabsTrigger>
          <TabsTrigger value="contracts">Hợp đồng ({contracts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="quotes">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có báo giá</TableCell></TableRow>
              )}
              {quotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.id}</TableCell>
                  <TableCell>{formatDate(q.date)}</TableCell>
                  <TableCell className="text-right font-medium">{formatVND(quoteTotal(q.id))}</TableCell>
                  <TableCell><Badge variant="secondary">{q.status}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => onOpenQuote(q.id)}>Mở</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="contracts">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Tổng giá trị</TableHead>
                <TableHead className="text-right">Đã thu</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có hợp đồng</TableCell></TableRow>
              )}
              {contracts.map((c) => {
                const total = contractTotal(c.id);
                const paid = contractPaid(c.id);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id}</TableCell>
                    <TableCell>{formatDate(c.date)}</TableCell>
                    <TableCell className="text-right font-medium">{formatVND(total)}</TableCell>
                    <TableCell className="text-right text-chart-2">{formatVND(paid)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatVND(total - paid)}</TableCell>
                    <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => onOpenContract(c.id)}>Mở</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomerForm({ customer, onSave, onCancel }: {
  customer: Customer | null;
  onSave: (c: Partial<Customer>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: customer?.id ?? "",
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    tax: customer?.tax ?? "",
    address: customer?.address ?? "",
    representative: customer?.representative ?? "",
    note: customer?.note ?? "",
  });

  const [autoId, setAutoId] = useState<string>("");

  useEffect(() => {
    if (!customer) {
      (async () => {
        const s = await loadSettings();
        const { count } = await supabase.from("customers").select("*", { count: "exact", head: true });
        const generatedId = genId(s.customer_prefix, "{PREFIX}{NUM}", (count ?? 0) + 1);
        setAutoId(generatedId);
        setForm((prev) => prev.id ? prev : { ...prev, id: generatedId });
      })();
    }
  }, [customer]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mã khách hàng</Label>
          {customer ? (
            <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled />
          ) : (
            <div className="space-y-1">
              <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder={autoId || "Tự sinh"} />
              {autoId && !form.id && (
                <p className="text-xs text-muted-foreground">Mặc định: <code className="font-mono">{autoId}</code></p>
              )}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Tên khách hàng / công ty</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Số điện thoại</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Mã số thuế</Label>
          <Input value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Người đại diện</Label>
          <Input value={form.representative} onChange={(e) => setForm({ ...form, representative: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Địa chỉ</Label>
        <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>Ghi chú</Label>
        <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button onClick={() => onSave(form)} disabled={!form.id || !form.name}>
          {customer ? "Cập nhật" : "Thêm khách hàng"}
        </Button>
      </DialogFooter>
    </div>
  );
}
