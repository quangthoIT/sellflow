"use client";
import { useEffect, useState, useCallback } from "react";
import { db, type Contract, type Payment, type Customer, type PaymentTerms, type PaymentTerm, loadSettings } from "@/lib/db";
import { formatVND, formatDate, genId } from "@/lib/format";
import { useNav } from "@/lib/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";
import { ActionTooltip } from "@/components/action-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";

const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "Thẻ tín dụng", "Khác"];

export function PaymentsPage() {
  const { params } = useNav();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterContract, setFilterContract] = useState<string>("all");

  const [debtSortKey, setDebtSortKey] = useState<string | null>(null);
  const [debtSortDir, setDebtSortDir] = useState<SortDir>(null);
  const [debtFilters, setDebtFilters] = useState<Record<string, string>>({});

  const [paySortKey, setPaySortKey] = useState<string | null>(null);
  const [paySortDir, setPaySortDir] = useState<SortDir>(null);
  const [payFilters, setPayFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [c, cu, p] = await Promise.all([
      db.from("contracts").select("*").order("date", { ascending: false }),
      db.from("customers").select("*").order("name"),
      db.from("payments").select("*").order("date", { ascending: false }),
    ]);
    setContracts((c.data ?? []) as Contract[]);
    setCustomers((cu.data ?? []) as Customer[]);
    setPayments((p.data ?? []) as Payment[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (params.contract) {
      setFilterContract(params.contract);
      setShowAdd(true);
    }
  }, [params.contract]);

  const filterContractId = filterContract === "all" ? "" : filterContract;

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";

  const contractPaid = (contractId: string) =>
    payments.filter((p) => p.contract_id === contractId).reduce((s, p) => s + p.amount, 0);

  // Debt Table logic
  const debtRows = contracts
    .filter((c) => ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status))
    .map((c) => ({
      contract: c,
      customer: customerName(c.customer_id),
      paid: contractPaid(c.id),
    }));

  const colDebtFilters = [
    { key: (r: typeof debtRows[0]) => r.contract.id, value: debtFilters.id ?? "" },
    { key: (r: typeof debtRows[0]) => r.customer, value: debtFilters.customer ?? "" },
    { key: (r: typeof debtRows[0]) => r.contract.status, value: debtFilters.status ?? "" },
  ];

  const filteredDebtRows = filterData(debtRows, colDebtFilters as any);

  const sortedDebtRows = (() => {
    if (!debtSortKey || !debtSortDir) return filteredDebtRows;
    const accessor: Record<string, (r: typeof debtRows[0]) => string | number> = {
      id: (r) => r.contract.id,
      customer: (r) => r.customer,
      paid: (r) => r.paid,
      status: (r) => r.contract.status,
    };
    return sortData(filteredDebtRows, accessor[debtSortKey] ?? ((r) => r.contract.id), debtSortDir);
  })();

  // Payment History Table logic
  const payRows = payments
    .filter((p) => !filterContractId || p.contract_id === filterContractId)
    .map((p) => {
      const contract = contracts.find((c) => c.id === p.contract_id);
      return {
        payment: p,
        customer: customerName(contract?.customer_id ?? null),
      };
    });

  const colPayFilters = [
    { key: (r: typeof payRows[0]) => r.payment.id, value: payFilters.id ?? "" },
    { key: (r: typeof payRows[0]) => r.payment.contract_id, value: payFilters.contract_id ?? "" },
    { key: (r: typeof payRows[0]) => r.customer, value: payFilters.customer ?? "" },
    { key: (r: typeof payRows[0]) => r.payment.date, value: payFilters.date ?? "" },
    { key: (r: typeof payRows[0]) => String(r.payment.amount), value: payFilters.amount ?? "" },
    { key: (r: typeof payRows[0]) => r.payment.method, value: payFilters.method ?? "" },
    { key: (r: typeof payRows[0]) => r.payment.note || "", value: payFilters.note ?? "" },
  ];

  const filteredPayRows = filterData(payRows, colPayFilters as any);

  const sortedPayRows = (() => {
    if (!paySortKey || !paySortDir) return filteredPayRows;
    const accessor: Record<string, (r: typeof payRows[0]) => string | number> = {
      id: (r) => r.payment.id,
      contract_id: (r) => r.payment.contract_id,
      customer: (r) => r.customer,
      date: (r) => r.payment.date,
      amount: (r) => r.payment.amount,
      method: (r) => r.payment.method,
      note: (r) => r.payment.note || "",
    };
    return sortData(filteredPayRows, accessor[paySortKey] ?? ((r) => r.payment.id), paySortDir);
  })();

  const handleAddPayment = async (contractId: string, amount: number, date: string, method: string, note: string) => {
    const s = await loadSettings();
    const contract = contracts.find((c) => c.id === contractId);
    const custId = contract?.customer_id ?? "";
    const id = genId(s.payment_prefix, s.id_format, 0, custId);
    const { error } = await db.from("payments").insert({
      id, contract_id: contractId, date, amount, method, note,
    });
    if (error) { toast.error("Lỗi ghi thanh toán"); return; }
    toast.success("Đã ghi nhận thanh toán");
    setShowAdd(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await db.from("payments").delete().eq("id", id);
    if (error) { toast.error("Lỗi xóa"); return; }
    toast.success("Đã xóa thanh toán");
    load();
  };

  // Summary
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng đã thu</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{formatVND(totalCollected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Số giao dịch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hợp đồng có công nợ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts.filter((c) => ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status)).length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Select value={filterContract} onValueChange={setFilterContract}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Tất cả hợp đồng" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả hợp đồng</SelectItem>
            {contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.id} — {customerName(c.customer_id)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="size-4" /> Ghi thanh toán
        </Button>
      </div>

      {/* Contract debt summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Công nợ theo hợp đồng</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mã HĐ / Đợt" sortDir={debtSortKey === "id" ? debtSortDir : null} onSort={(d) => { setDebtSortKey("id"); setDebtSortDir(d); }} filter={{ type: "text", value: debtFilters.id ?? "", placeholder: "Lọc mã..." }} onFilterChange={(v) => setDebtFilters((f) => ({ ...f, id: v }))} />
                <SortableHead label="Khách hàng" sortDir={debtSortKey === "customer" ? debtSortDir : null} onSort={(d) => { setDebtSortKey("customer"); setDebtSortDir(d); }} filter={{ type: "text", value: debtFilters.customer ?? "", placeholder: "Lọc khách hàng..." }} onFilterChange={(v) => setDebtFilters((f) => ({ ...f, customer: v }))} />
                <TableHead>Ngày đến hạn</TableHead>
                <TableHead className="text-right">Phải thu</TableHead>
                <SortableHead label="Đã thu" align="right" sortDir={debtSortKey === "paid" ? debtSortDir : null} onSort={(d) => { setDebtSortKey("paid"); setDebtSortDir(d); }} />
                <TableHead className="text-right">Còn nợ</TableHead>
                <SortableHead label="Trạng thái" sortDir={debtSortKey === "status" ? debtSortDir : null} onSort={(d) => { setDebtSortKey("status"); setDebtSortDir(d); }} filter={{ type: "select", value: debtFilters.status ?? "", options: [{ label: "Đã ký", value: "Đã ký" }, { label: "Đang thực hiện", value: "Đang thực hiện" }, { label: "Hoàn thành", value: "Hoàn thành" }] }} onFilterChange={(v) => setDebtFilters((f) => ({ ...f, status: v }))} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton rows={5} columns={7} />}
              {!loading && sortedDebtRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      title="Chưa có hợp đồng công nợ"
                      description="Các hợp đồng đã ký hoặc đang thực hiện sẽ hiển thị công nợ tại đây."
                    />
                  </TableCell>
                </TableRow>
              )}
              {sortedDebtRows.map(({ contract: c, customer, paid }) => (
                <ContractDebtRow key={c.id} contract={c} customerName={customer} paid={paid} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử thanh toán</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mã" sortDir={paySortKey === "id" ? paySortDir : null} onSort={(d) => { setPaySortKey("id"); setPaySortDir(d); }} filter={{ type: "text", value: payFilters.id ?? "", placeholder: "Lọc mã..." }} onFilterChange={(v) => setPayFilters((f) => ({ ...f, id: v }))} />
                <SortableHead label="Hợp đồng" sortDir={paySortKey === "contract_id" ? paySortDir : null} onSort={(d) => { setPaySortKey("contract_id"); setPaySortDir(d); }} filter={{ type: "text", value: payFilters.contract_id ?? "", placeholder: "Lọc HĐ..." }} onFilterChange={(v) => setPayFilters((f) => ({ ...f, contract_id: v }))} />
                <SortableHead label="Khách hàng" sortDir={paySortKey === "customer" ? paySortDir : null} onSort={(d) => { setPaySortKey("customer"); setPaySortDir(d); }} filter={{ type: "text", value: payFilters.customer ?? "", placeholder: "Lọc khách hàng..." }} onFilterChange={(v) => setPayFilters((f) => ({ ...f, customer: v }))} />
                <SortableHead label="Ngày" sortDir={paySortKey === "date" ? paySortDir : null} onSort={(d) => { setPaySortKey("date"); setPaySortDir(d); }} filter={{ type: "text", value: payFilters.date ?? "", placeholder: "Lọc ngày..." }} onFilterChange={(v) => setPayFilters((f) => ({ ...f, date: v }))} />
                <SortableHead label="Số tiền" align="right" sortDir={paySortKey === "amount" ? paySortDir : null} onSort={(d) => { setPaySortKey("amount"); setPaySortDir(d); }} filter={{ type: "text", value: payFilters.amount ?? "", placeholder: "Lọc số tiền..." }} onFilterChange={(v) => setPayFilters((f) => ({ ...f, amount: v }))} />
                <SortableHead label="Phương thức" sortDir={paySortKey === "method" ? paySortDir : null} onSort={(d) => { setPaySortKey("method"); setPaySortDir(d); }} filter={{ type: "select", value: payFilters.method ?? "", options: PAYMENT_METHODS.map((m) => ({ label: m, value: m })) }} onFilterChange={(v) => setPayFilters((f) => ({ ...f, method: v }))} />
                <SortableHead label="Ghi chú" sortDir={paySortKey === "note" ? paySortDir : null} onSort={(d) => { setPaySortKey("note"); setPaySortDir(d); }} filter={{ type: "text", value: payFilters.note ?? "", placeholder: "Lọc ghi chú..." }} onFilterChange={(v) => setPayFilters((f) => ({ ...f, note: v }))} />
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton rows={5} columns={8} />}
              {!loading && sortedPayRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      title="Chưa có lịch sử thanh toán"
                      description="Ghi nhận thanh toán mới cho hợp đồng để theo dõi dòng tiền."
                    />
                  </TableCell>
                </TableRow>
              )}
              {sortedPayRows.map(({ payment: p, customer }) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-mono text-xs">{p.contract_id}</TableCell>
                  <TableCell>{customer}</TableCell>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell className="text-right font-medium text-chart-2">{formatVND(p.amount)}</TableCell>
                  <TableCell><Badge variant="secondary">{p.method}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{p.note || "—"}</TableCell>
                  <TableCell className="text-right">
                    <ActionTooltip label="Xóa lịch sử thanh toán">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </ActionTooltip>
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
        title="Xác nhận xóa phiếu thanh toán"
        description="Bạn có chắc chắn muốn xóa phiếu thanh toán này? Số tiền đã thanh toán của hợp đồng sẽ bị trừ lại."
        confirmText="Xóa thanh toán"
        onConfirm={async () => {
          if (deleteId) {
            await handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
      />

      {/* Add payment dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) setFilterContract("all"); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ghi nhận thanh toán</DialogTitle>
          </DialogHeader>
          <PaymentForm
            contracts={contracts}
            customers={customers}
            payments={payments}
            defaultContract={filterContract === "all" ? "" : filterContract}
            onSubmit={handleAddPayment}
            onCancel={() => setShowAdd(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContractDebtRow({ contract, customerName, paid }: {
  contract: Contract;
  customerName: string;
  paid: number;
}) {
  const [total, setTotal] = useState(0);
  const [terms, setTerms] = useState<PaymentTerms | null>(null);

  useEffect(() => {
    (async () => {
      const { data: c } = await db.from("contracts").select("payment_terms, quote_id").eq("id", contract.id).maybeSingle();
      const contractTerms = (c as Pick<Contract, "payment_terms" | "quote_id"> | null)?.payment_terms ?? null;
      if (contractTerms) {
        setTerms(contractTerms);
      } else {
        const quoteId = (c as Pick<Contract, "payment_terms" | "quote_id"> | null)?.quote_id;
        const { data: quote } = quoteId
          ? await db.from("quotes").select("payment_terms").eq("id", quoteId).maybeSingle()
          : { data: null };
        setTerms((quote as { payment_terms: PaymentTerms | null } | null)?.payment_terms ?? null);
      }
      const { data: its } = await db.from("contract_items").select("qty, price").eq("contract_id", contract.id);
      setTotal((its ?? []).reduce((s: number, it: any) => s + it.qty * it.price, 0));
    })();
  }, [contract.id]);

  // No installments → single lump-sum row
  if (!terms || !terms.installments || terms.installments.length === 0) {
    return (
      <TableRow>
        <TableCell className="font-mono text-xs">{contract.id}</TableCell>
        <TableCell className="font-medium">{customerName}</TableCell>
        <TableCell className="text-muted-foreground">—</TableCell>
        <TableCell className="text-right">{formatVND(total)}</TableCell>
        <TableCell className="text-right text-chart-2">{formatVND(paid)}</TableCell>
        <TableCell className="text-right font-bold text-destructive">{formatVND(Math.max(0, total - paid))}</TableCell>
        <TableCell><Badge variant="secondary">{contract.status}</Badge></TableCell>
      </TableRow>
    );
  }

  // Has installments → one row per installment, plus a summary row
  const installments = terms.installments;
  const totalDue = installments.reduce((s, it) => s + (it.amount || 0), 0);
  // Allocate payments sequentially across installments (FIFO)
  let remaining = paid;
  const allocated = installments.map((it) => {
    const due = it.amount || 0;
    const got = Math.min(due, remaining);
    remaining -= got;
    return { ...it, paid: got, remaining: Math.max(0, due - got) };
  });
  const totalRemaining = Math.max(0, totalDue - paid);
  const overdue = (date: string) => new Date(date) < new Date(new Date().toISOString().split("T")[0]);

  return (
    <>
      {/* Summary row for the contract */}
      <TableRow className="bg-muted/40">
        <TableCell className="font-mono text-xs font-semibold">{contract.id}</TableCell>
        <TableCell className="font-medium">{customerName}</TableCell>
        <TableCell className="text-muted-foreground text-xs">{installments.length} đợt</TableCell>
        <TableCell className="text-right font-semibold">{formatVND(totalDue)}</TableCell>
        <TableCell className="text-right text-chart-2 font-semibold">{formatVND(paid)}</TableCell>
        <TableCell className="text-right font-bold text-destructive">{formatVND(totalRemaining)}</TableCell>
        <TableCell><Badge variant="secondary">{contract.status}</Badge></TableCell>
      </TableRow>
      {/* One row per installment */}
      {allocated.map((it: PaymentTerm & { paid: number; remaining: number }, idx: number) => (
        <TableRow key={`${contract.id}-${idx}`} className="text-sm">
          <TableCell className="pl-6 text-xs text-muted-foreground">↳ {it.label || `Đợt ${idx + 1}`}</TableCell>
          <TableCell className="text-muted-foreground">{idx === 0 ? customerName : ""}</TableCell>
          <TableCell className={overdue(it.date) && it.remaining > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
            {formatDate(it.date)}{overdue(it.date) && it.remaining > 0 ? " (quá hạn)" : ""}
          </TableCell>
          <TableCell className="text-right">{formatVND(it.amount)}</TableCell>
          <TableCell className="text-right text-chart-2">{formatVND(it.paid)}</TableCell>
          <TableCell className="text-right font-medium text-destructive">{formatVND(it.remaining)}</TableCell>
          <TableCell>
            {it.remaining === 0 ? (
              <Badge variant="default" className="text-xs">Đã đủ</Badge>
            ) : it.paid > 0 ? (
              <Badge variant="secondary" className="text-xs">Một phần</Badge>
            ) : overdue(it.date) ? (
              <Badge variant="destructive" className="text-xs">Quá hạn</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Chưa thu</Badge>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function PaymentForm({ contracts, customers, payments, defaultContract, onSubmit, onCancel }: {
  contracts: Contract[];
  customers: Customer[];
  payments: Payment[];
  defaultContract: string;
  onSubmit: (contractId: string, amount: number, date: string, method: string, note: string) => void;
  onCancel: () => void;
}) {
  const [contractId, setContractId] = useState(defaultContract);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Chuyển khoản");
  const [note, setNote] = useState("");
  const [contractTotal, setContractTotal] = useState(0);

  useEffect(() => {
    if (!contractId) return;
    db.from("contract_items").select("qty, price").eq("contract_id", contractId).then(({ data }: any) => {
      setContractTotal((data ?? []).reduce((s: number, it: any) => s + it.qty * it.price, 0));
    });
  }, [contractId]);

  const paid = payments.filter((p) => p.contract_id === contractId).reduce((s, p) => s + p.amount, 0);
  const remaining = contractTotal - paid;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Hợp đồng</Label>
        <Select value={contractId} onValueChange={setContractId}>
          <SelectTrigger><SelectValue placeholder="Chọn hợp đồng" /></SelectTrigger>
          <SelectContent>
            {contracts.filter((c) => ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status)).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.id} — {customers.find((cu) => cu.id === c.customer_id)?.name ?? "?"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {contractId && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-sm">
          <div><span className="text-muted-foreground">Tổng HĐ:</span> <strong>{formatVND(contractTotal)}</strong></div>
          <div><span className="text-muted-foreground">Đã thu:</span> <strong className="text-chart-2">{formatVND(paid)}</strong></div>
          <div><span className="text-muted-foreground">Còn nợ:</span> <strong className="text-destructive">{formatVND(remaining)}</strong></div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Số tiền (đ)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Ngày</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Phương thức</Label>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Ghi chú</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button onClick={() => onSubmit(contractId, amount, date, method, note)} disabled={!contractId || amount <= 0}>
          Ghi thanh toán
        </Button>
      </DialogFooter>
    </div>
  );
}
