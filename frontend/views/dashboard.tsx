"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/db";
import { formatVND, formatVNDShort, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Wallet,
  FileText,
  FileSignature,
  AlertTriangle,
  BarChart3,
  Clock,
  Package,
  ChevronRight,
  Calendar,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useNav } from "@/lib/nav";
import { PageLoading } from "@/components/loading";
import { EmptyState } from "@/components/empty-state";

type QuoteRow = { id: string; date: string; status: string; customer_id: string; valid_until: string | null };
type ContractRow = { id: string; date: string; status: string; customer_id: string };
type ProductRow = { id: string; name: string; stock: number; min_stock: number; price: number; cost: number };

type QuoteItemRow = { quote_id: string; qty: number; price: number; discount: number };
type ContractItemRow = { contract_id: string; product_id: string | null; qty: number; price: number };
type PaymentRow = { contract_id: string; amount: number; date: string };

export function DashboardPage() {
  const { navigate } = useNav();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("6_months");

  const [rawQuotes, setRawQuotes] = useState<QuoteRow[]>([]);
  const [rawContracts, setRawContracts] = useState<ContractRow[]>([]);
  const [rawProducts, setRawProducts] = useState<ProductRow[]>([]);
  const [rawQuoteItems, setRawQuoteItems] = useState<QuoteItemRow[]>([]);
  const [rawContractItems, setRawContractItems] = useState<ContractItemRow[]>([]);
  const [rawPayments, setRawPayments] = useState<PaymentRow[]>([]);

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

  // Initial Data Fetch
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [quotes, contracts, products, quoteItems, contractItems, payments] = await Promise.all([
        db.from("quotes").select("*").order("date", { ascending: false }),
        db.from("contracts").select("*").order("date", { ascending: false }),
        db.from("products").select("*").order("name"),
        db.from("quote_items").select("quote_id, qty, price, discount"),
        db.from("contract_items").select("contract_id, product_id, qty, price"),
        db.from("payments").select("contract_id, amount, date"),
      ]);

      setRawQuotes((quotes.data ?? []) as QuoteRow[]);
      setRawContracts((contracts.data ?? []) as ContractRow[]);
      setRawProducts((products.data ?? []) as ProductRow[]);
      setRawQuoteItems((quoteItems.data ?? []) as QuoteItemRow[]);
      setRawContractItems((contractItems.data ?? []) as ContractItemRow[]);
      setRawPayments((payments.data ?? []) as PaymentRow[]);

      setLoading(false);
    })();
  }, []);

  // Compute stats and chart when raw data or timeRange changes
  const computeDashboard = useCallback(() => {
    if (loading) return;

    const now = new Date();

    // Determine range start date
    let rangeMonthsCount = 6;
    let rangeStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    if (timeRange === "3_months") {
      rangeMonthsCount = 3;
      rangeStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (timeRange === "this_year") {
      rangeMonthsCount = now.getMonth() + 1;
      rangeStartDate = new Date(now.getFullYear(), 0, 1);
    }

    const rangeEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const quoteTotal = (id: string) =>
      rawQuoteItems.filter((i) => i.quote_id === id).reduce((s, i) => s + i.qty * i.price - (i.discount || 0), 0);
    const contractTotal = (id: string) =>
      rawContractItems.filter((i) => i.contract_id === id).reduce((s, i) => s + i.qty * i.price, 0);

    // Quote pending (Nháp, Đã gửi)
    const pendingQ = rawQuotes.filter((q) => ["Nháp", "Đã gửi"].includes(q.status));
    const quotePending = pendingQ.reduce((s, q) => s + quoteTotal(q.id), 0);

    // Signed contracts in selected range
    const signedContractsRange = rawContracts.filter(
      (c) =>
        c.status === "Đã ký" && new Date(c.date) >= rangeStartDate && new Date(c.date) < rangeEndDate
    );
    const contractSigned = signedContractsRange.reduce((s, c) => s + contractTotal(c.id), 0);

    // Payments in selected range
    const paymentsRange = rawPayments.filter(
      (p) => new Date(p.date) >= rangeStartDate && new Date(p.date) < rangeEndDate
    );
    const collected = paymentsRange.reduce((s, p) => s + p.amount, 0);

    // Outstanding across all active signed contracts
    const allSigned = rawContracts.filter((c) =>
      ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status)
    );
    const outstanding = allSigned.reduce((s, c) => {
      const total = contractTotal(c.id);
      const paid = rawPayments.filter((p) => p.contract_id === c.id).reduce((x, p) => x + p.amount, 0);
      return s + Math.max(0, total - paid);
    }, 0);

    // Expected profit in selected range
    const expectedProfit = signedContractsRange.reduce((s, c) => {
      const items = rawContractItems.filter((i) => i.contract_id === c.id);
      const profit = items.reduce((x, i) => {
        const p = rawProducts.find((pr) => pr.id === i.product_id);
        const cost = p ? p.cost : 0;
        return x + (i.price - cost) * i.qty;
      }, 0);
      return s + profit;
    }, 0);

    // Low stock
    const lowStockProducts = rawProducts.filter((p) => p.stock <= p.min_stock);

    // Expiring quotes
    const expiring = rawQuotes.filter((q) => {
      if (!q.valid_until) return false;
      const days = (new Date(q.valid_until).getTime() - now.getTime()) / 86400000;
      return days >= 0 && days <= 7 && ["Nháp", "Đã gửi"].includes(q.status);
    });

    // Generate monthly chart data for selected range
    const months: { month: string; signed: number; collected: number }[] = [];
    for (let i = rangeMonthsCount - 1; i >= 0; i--) {
      const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = `T${ms.getMonth() + 1}`;
      const sContracts = rawContracts.filter(
        (c) =>
          new Date(c.date) >= ms &&
          new Date(c.date) < me &&
          ["Đã ký", "Đang thực hiện", "Hoàn thành"].includes(c.status)
      );
      const signed = sContracts.reduce((s, c) => s + contractTotal(c.id), 0);
      const coll = rawPayments
        .filter((p) => new Date(p.date) >= ms && new Date(p.date) < me)
        .reduce((x, p) => x + p.amount, 0);
      months.push({ month: label, signed, collected: coll });
    }

    setKpis({
      quotePending,
      contractSigned,
      collected,
      outstanding,
      expectedProfit,
      pendingCount: pendingQ.length,
      activeContracts: rawContracts.filter((c) => c.status === "Đang thực hiện").length,
      lowStockCount: lowStockProducts.length,
    });

    setMonthlyData(months);
    setExpiringQuotes(expiring);
    setLowStock(lowStockProducts);
  }, [loading, timeRange, rawQuotes, rawContracts, rawProducts, rawQuoteItems, rawContractItems, rawPayments]);

  useEffect(() => {
    computeDashboard();
  }, [computeDashboard]);

  const getRangeTitle = () => {
    if (timeRange === "3_months") return "Doanh thu 3 tháng gần nhất";
    if (timeRange === "this_year") return "Doanh thu năm nay";
    return "Doanh thu 6 tháng gần nhất";
  };

  const getRangeBadgeLabel = () => {
    if (timeRange === "3_months") return "3 tháng";
    if (timeRange === "this_year") return "năm nay";
    return "tháng này";
  };

  const chartConfig = {
    signed: { label: "Hợp đồng đã ký", color: "var(--chart-1)" },
    collected: { label: "Đã thu", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  if (loading) {
    return <PageLoading text="Đang tải dữ liệu tổng quan..." />;
  }

  const hasChartData = monthlyData.some((m) => m.signed > 0 || m.collected > 0);

  return (
    <div className="space-y-4">
      {/* 1. TOP METRIC CARDS (5 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Báo giá đang chờ */}
        <div
          onClick={() => navigate("quotes")}
          className="group relative flex flex-col justify-between p-4 rounded-xl border bg-card shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20">
                <FileText className="size-4.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Báo giá đang chờ</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">{formatVND(kpis.quotePending)}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{kpis.pendingCount} báo giá</span>
              <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>

        {/* Card 2: HĐ đã ký */}
        <div
          onClick={() => navigate("contracts")}
          className="group relative flex flex-col justify-between p-4 rounded-xl border bg-card shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20">
                <FileSignature className="size-4.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">HĐ đã ký ({getRangeBadgeLabel()})</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">{formatVND(kpis.contractSigned)}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{kpis.activeContracts} đang thực hiện</span>
              <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>

        {/* Card 3: Đã thu */}
        <div
          onClick={() => navigate("payments")}
          className="group relative flex flex-col justify-between p-4 rounded-xl border bg-card shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20">
                <Wallet className="size-4.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Đã thu ({getRangeBadgeLabel()})</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{formatVND(kpis.collected)}</div>
            <div className="mt-1 flex items-center justify-end">
              <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>

        {/* Card 4: Công nợ */}
        <div
          onClick={() => navigate("payments")}
          className="group relative flex flex-col justify-between p-4 rounded-xl border bg-card shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:bg-rose-500/20">
                <AlertTriangle className="size-4.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Công nợ</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{formatVND(kpis.outstanding)}</div>
            <div className="mt-1 flex items-center justify-end">
              <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>

        {/* Card 5: Lợi nhuận dự kiến */}
        <div
          className="group relative flex flex-col justify-between p-4 rounded-xl border bg-card shadow-2xs transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20">
                <TrendingUp className="size-4.5" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Lợi nhuận dự kiến</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">{formatVND(kpis.expectedProfit)}</div>
            <div className="mt-1 flex items-center justify-end">
              <ChevronRight className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </div>
      </div>



      {/* 3. MAIN CONTENT: 2 COLUMNS */}
      <div className="grid gap-4 lg:grid-cols-3 items-stretch">
        {/* Left Column: Biểu đồ doanh thu */}
        <Card className="lg:col-span-2 shadow-2xs flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                <BarChart3 className="size-4.5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{getRangeTitle()}</CardTitle>
                <CardDescription className="text-xs">Biểu đồ thể hiện tổng doanh thu theo tháng</CardDescription>
              </div>
            </div>

            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-8.5 text-xs w-44 gap-1.5 bg-background">
                <Calendar className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Chọn khoảng thời gian" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="6_months">6 tháng gần nhất</SelectItem>
                <SelectItem value="3_months">3 tháng gần nhất</SelectItem>
                <SelectItem value="this_year">Năm nay</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>

          <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-center">
            {hasChartData ? (
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <BarChart data={monthlyData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => formatVNDShort(v)} tickLine={false} axisLine={false} width={70} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatVND(Number(v))} />} />
                  <Bar dataKey="signed" fill="var(--color-signed)" radius={4} />
                  <Bar dataKey="collected" fill="var(--color-collected)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="Chưa có dữ liệu doanh thu"
                description="Dữ liệu sẽ được hiển thị khi có báo giá hoặc hợp đồng."
                className="min-h-[240px] py-6"
              />
            )}
          </CardContent>
        </Card>

        {/* Right Column: 2 Stacked Widgets */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Widget 1: Báo giá sắp hết hạn */}
          <Card className="shadow-2xs flex-1 flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-foreground/80" />
                <CardTitle className="text-sm font-semibold">Báo giá sắp hết hạn</CardTitle>
              </div>
              <Button
                variant="link"
                className="text-xs text-primary p-0 h-auto font-medium"
                onClick={() => navigate("quotes")}
              >
                Xem tất cả
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-center">
              {expiringQuotes.length === 0 ? (
                <div className="py-4 flex flex-col items-center justify-center text-center">
                  <div className="size-11 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                    <FileText className="size-5.5 text-muted-foreground/50" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">Không có báo giá sắp hết hạn</h4>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                    Các báo giá sắp hết hạn sẽ được hiển thị tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expiringQuotes.slice(0, 4).map((q) => (
                    <div
                      key={q.id}
                      onClick={() => navigate("quotes", { id: q.id })}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-mono font-medium text-primary">{q.id}</span>
                        <div className="text-[11px] text-muted-foreground">Hạn: {formatDate(q.valid_until)}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {q.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Widget 2: Sản phẩm tồn kho thấp */}
          <Card className="shadow-2xs flex-1 flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-foreground/80" />
                <CardTitle className="text-sm font-semibold">Sản phẩm tồn kho thấp</CardTitle>
              </div>
              <Button
                variant="link"
                className="text-xs text-primary p-0 h-auto font-medium"
                onClick={() => navigate("products")}
              >
                Xem tất cả
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-center">
              {lowStock.length === 0 ? (
                <div className="py-4 flex flex-col items-center justify-center text-center">
                  <div className="size-11 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                    <Package className="size-5.5 text-muted-foreground/50" />
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">Tất cả sản phẩm đều đủ tồn kho</h4>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                    Các sản phẩm có số lượng thấp sẽ được hiển thị tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowStock.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate("products", { id: p.id })}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-xs"
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <span className="font-medium text-foreground truncate block">{p.name}</span>
                        <div className="text-[11px] text-muted-foreground font-mono">{p.id}</div>
                      </div>
                      <Badge variant="destructive" className="gap-1 shrink-0 text-[10px]">
                        Còn {p.stock}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
