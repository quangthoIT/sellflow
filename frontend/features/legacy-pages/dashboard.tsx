import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatVND, formatVNDShort, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Wallet, FileText, FileSignature, AlertTriangle, ArrowDownRight } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useNav } from "@/lib/nav";

type QuoteRow = { id: string; date: string; status: string; customer_id: string; valid_until: string | null };
type ContractRow = { id: string; date: string; status: string; customer_id: string };
type ProductRow = { id: string; name: string; stock: number; min_stock: number; price: number; cost: number };

type QuoteItemRow = { quote_id: string; qty: number; price: number; discount: number };
type ContractItemRow = { contract_id: string; product_id: string | null; qty: number; price: number };
type PaymentRow = { contract_id: string; amount: number; date: string };

export function DashboardPage() {
  const { navigate } = useNav();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    quotePending: 0,
    contractSigned: 0,
    collected: 0,
    outstanding: 0,
    expectedProfit: 0,
    pendingCount: 0,
    activeContracts: 0,
    lowStockCount: 0,
  });
  const [monthlyData, setMonthlyData] = useState<{ month: string; signed: number; collected: number }[]>([]);
  const [expiringQuotes, setExpiringQuotes] = useState<QuoteRow[]>([]);
  const [lowStock, setLowStock] = useState<ProductRow[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [quotes, contracts, products, quoteItems, contractItems, payments] = await Promise.all([
        supabase.from("quotes").select("*").order("date", { ascending: false }),
        supabase.from("contracts").select("*").order("date", { ascending: false }),
        supabase.from("products").select("*").order("name"),
        supabase.from("quote_items").select("quote_id, qty, price, discount"),
        supabase.from("contract_items").select("contract_id, product_id, qty, price"),
        supabase.from("payments").select("contract_id, amount, date"),
      ]);

      const qItems = (quoteItems.data ?? []) as QuoteItemRow[];
      const cItems = (contractItems.data ?? []) as ContractItemRow[];
      const payRows = (payments.data ?? []) as PaymentRow[];
      const productRows = (products.data ?? []) as ProductRow[];

      const quoteTotal = (id: string) =>
        qItems.filter((i) => i.quote_id === id).reduce((s, i) => s + i.qty * i.price - (i.discount || 0), 0);
      const contractTotal = (id: string) =>
        cItems.filter((i) => i.contract_id === id).reduce((s, i) => s + i.qty * i.price, 0);

      // Quote pending (Nháp, Đã gửi)
      const pendingQ = (quotes.data ?? []).filter((q: QuoteRow) =>
        ["Nháp", "Đã gửi"].includes(q.status));
      const quotePending = pendingQ.reduce((s: number, q: QuoteRow) => s + quoteTotal(q.id), 0);

      // Signed contracts this month
      const signedContracts = (contracts.data ?? []).filter((c: ContractRow) =>
        c.status === "Đã ký" && new Date(c.date) >= monthStart && new Date(c.date) < monthEnd);
      const contractSigned = signedContracts.reduce((s: number, c: ContractRow) => s + contractTotal(c.id), 0);

      // Payments this month
      const monthPayments = payRows.filter((p) => new Date(p.date) >= monthStart && new Date(p.date) < monthEnd);
      const collected = monthPayments.reduce((s, p) => s + p.amount, 0);

      // Outstanding across all signed contracts
      const allSigned = (contracts.data ?? []).filter((c: ContractRow) =>
        ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status));
      const outstanding = allSigned.reduce((s: number, c: ContractRow) => {
        const total = contractTotal(c.id);
        const paid = payRows.filter((p) => p.contract_id === c.id).reduce((x, p) => x + p.amount, 0);
        return s + Math.max(0, total - paid);
      }, 0);

      // Expected profit from signed contracts this month
      const expectedProfit = signedContracts.reduce((s: number, c: ContractRow) => {
        const items = cItems.filter((i) => i.contract_id === c.id);
        const profit = items.reduce((x, i) => {
          const p = productRows.find((pr) => pr.id === i.product_id);
          const cost = p ? p.cost : 0;
          return x + (i.price - cost) * i.qty;
        }, 0);
        return s + profit;
      }, 0);

      // Low stock
      const lowStockProducts = productRows.filter((p) => p.stock <= p.min_stock);
      const expiring = (quotes.data ?? []).filter((q: QuoteRow) => {
        if (!q.valid_until) return false;
        const days = (new Date(q.valid_until).getTime() - now.getTime()) / 86400000;
        return days >= 0 && days <= 7 && ["Nháp", "Đã gửi"].includes(q.status);
      });

      // Monthly chart data (last 6 months)
      const months: { month: string; signed: number; collected: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const label = `T${ms.getMonth() + 1}`;
        const sContracts = (contracts.data ?? []).filter((c: ContractRow) =>
          new Date(c.date) >= ms && new Date(c.date) < me &&
          ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status));
        const signed = sContracts.reduce((s: number, c: ContractRow) => s + contractTotal(c.id), 0);
        const collected = payRows.filter((p) => new Date(p.date) >= ms && new Date(p.date) < me).reduce((x, p) => x + p.amount, 0);
        months.push({ month: label, signed, collected });
      }

      setKpis({
        quotePending,
        contractSigned,
        collected,
        outstanding,
        expectedProfit,
        pendingCount: pendingQ.length,
        activeContracts: (contracts.data ?? []).filter((c: ContractRow) => c.status === "Đang thực hiện").length,
        lowStockCount: lowStockProducts.length,
      });
      setMonthlyData(months);
      setExpiringQuotes(expiring);
      setLowStock(lowStockProducts);
      setLoading(false);
    })();
  }, []);

  const chartConfig = {
    signed: { label: "Hợp đồng đã ký", color: "var(--chart-1)" },
    collected: { label: "Đã thu", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Báo giá đang chờ</CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatVNDShort(kpis.quotePending)}</div>
            <p className="text-xs text-muted-foreground">{kpis.pendingCount} báo giá</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HĐ đã ký (tháng này)</CardTitle>
            <FileSignature className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatVNDShort(kpis.contractSigned)}</div>
            <p className="text-xs text-muted-foreground">{kpis.activeContracts} đang thực hiện</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Đã thu (tháng này)</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{formatVNDShort(kpis.collected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Công nợ</CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatVNDShort(kpis.outstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lợi nhuận dự kiến</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-1">{formatVNDShort(kpis.expectedProfit)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="secondary" className="gap-1.5 py-1.5">
          <FileText className="size-3.5" /> {kpis.pendingCount} báo giá đang chờ
        </Badge>
        <Badge variant="secondary" className="gap-1.5 py-1.5">
          <FileSignature className="size-3.5" /> {kpis.activeContracts} hợp đồng đang thực hiện
        </Badge>
        <Badge variant="secondary" className="gap-1.5 py-1.5">
          <AlertTriangle className="size-3.5" /> {kpis.lowStockCount} sản phẩm sắp hết hàng
        </Badge>
      </div>

      {/* Chart + alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Doanh thu 6 tháng gần nhất</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
              <BarChart data={monthlyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => formatVNDShort(v)} tickLine={false} axisLine={false} width={70} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatVND(Number(v))} />} />
                <Bar dataKey="signed" fill="var(--color-signed)" radius={4} />
                <Bar dataKey="collected" fill="var(--color-collected)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Expiring quotes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Báo giá sắp hết hạn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {expiringQuotes.length === 0 && (
                <p className="text-sm text-muted-foreground">Không có báo giá sắp hết hạn</p>
              )}
              {expiringQuotes.slice(0, 5).map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm">
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => navigate("quotes", { id: q.id })}
                  >
                    {q.id}
                  </button>
                  <span className="text-muted-foreground">{formatDate(q.valid_until)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Low stock */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sản phẩm tồn kho thấp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lowStock.length === 0 && (
                <p className="text-sm text-muted-foreground">Tất cả sản phẩm đủ tồn kho</p>
              )}
              {lowStock.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <button
                    className="font-medium text-primary hover:underline"
                    onClick={() => navigate("products", { id: p.id })}
                  >
                    {p.name}
                  </button>
                  <Badge variant="destructive" className="gap-1">
                    <ArrowDownRight className="size-3" />
                    Còn {p.stock}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
