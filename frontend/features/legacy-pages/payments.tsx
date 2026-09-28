import { useEffect, useState, useCallback } from "react";
import { supabase, type Contract, type Payment, type Customer, type PaymentTerms, type PaymentTerm } from "@/lib/supabase";
import { formatVND, formatDate, genId } from "@/lib/format";
import { loadSettings } from "@/lib/supabase";
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

const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "Thẻ tín dụng", "Khác"];

export function PaymentsPage() {
  const { params } = useNav();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterContract, setFilterContract] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [c, cu, p] = await Promise.all([
      supabase.from("contracts").select("*").order("date", { ascending: false }),
      supabase.from("customers").select("*").order("name"),
      supabase.from("payments").select("*").order("date", { ascending: false }),
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

  const handleAddPayment = async (contractId: string, amount: number, date: string, method: string, note: string) => {
    const s = await loadSettings();
    const contract = contracts.find((c) => c.id === contractId);
    const custId = contract?.customer_id ?? "";
    const id = genId(s.payment_prefix, s.id_format, 0, custId);
    const { error } = await supabase.from("payments").insert({
      id, contract_id: contractId, date, amount, method, note,
    });
    if (error) { toast.error("Lỗi ghi thanh toán"); return; }
    toast.success("Đã ghi nhận thanh toán");
    setShowAdd(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
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
                <TableHead>Mã HĐ / Đợt</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Ngày đến hạn</TableHead>
                <TableHead className="text-right">Phải thu</TableHead>
                <TableHead className="text-right">Đã thu</TableHead>
                <TableHead className="text-right">Còn nợ</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              )}
              {!loading && contracts.filter((c) => ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status)).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có hợp đồng</TableCell></TableRow>
              )}
              {contracts.filter((c) => ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status)).map((c) => (
                <ContractDebtRow key={c.id} contract={c} customerName={customerName(c.customer_id)} paid={contractPaid(c.id)} />
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
                <TableHead>Mã</TableHead>
                <TableHead>Hợp đồng</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Phương thức</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments
                .filter((p) => !filterContractId || p.contract_id === filterContractId)
                .map((p) => {
                  const contract = contracts.find((c) => c.id === p.contract_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell className="font-mono text-xs">{p.contract_id}</TableCell>
                      <TableCell>{customerName(contract?.customer_id ?? null)}</TableCell>
                      <TableCell>{formatDate(p.date)}</TableCell>
                      <TableCell className="text-right font-medium text-chart-2">{formatVND(p.amount)}</TableCell>
                      <TableCell><Badge variant="secondary">{p.method}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.note || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {payments.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Chưa có thanh toán</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
      const { data: c } = await supabase.from("contracts").select("payment_terms, quote_id").eq("id", contract.id).maybeSingle();
      const contractTerms = (c as Pick<Contract, "payment_terms" | "quote_id"> | null)?.payment_terms ?? null;
      if (contractTerms) {
        setTerms(contractTerms);
      } else {
        const quoteId = (c as Pick<Contract, "payment_terms" | "quote_id"> | null)?.quote_id;
        const { data: quote } = quoteId
          ? await supabase.from("quotes").select("payment_terms").eq("id", quoteId).maybeSingle()
          : { data: null };
        setTerms((quote as { payment_terms: PaymentTerms | null } | null)?.payment_terms ?? null);
      }
      const { data: its } = await supabase.from("contract_items").select("qty, price").eq("contract_id", contract.id);
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
    supabase.from("contract_items").select("qty, price").eq("contract_id", contractId).then(({ data }: any) => {
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
