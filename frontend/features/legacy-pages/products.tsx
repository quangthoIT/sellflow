import { useEffect, useState, useCallback } from "react";
import { supabase, type Product, type InventoryTx, loadSettings } from "@/lib/supabase";
import { formatVND, formatDate, genId } from "@/lib/format";
import { useNav } from "@/lib/nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, PackagePlus, History, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";

export function ProductsPage() {
  const { params } = useNav();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showInventory, setShowInventory] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [txs, setTxs] = useState<InventoryTx[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Product | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("name");
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()));

  const colFilters = [
    { key: "id" as keyof Product, value: filters.id ?? "" },
    { key: "name" as keyof Product, value: filters.name ?? "" },
    { key: "category" as keyof Product, value: filters.category ?? "" },
    { key: "cost" as keyof Product, value: filters.cost ?? "" },
    { key: "price" as keyof Product, value: filters.price ?? "" },
    { key: "stock" as keyof Product, value: filters.stock ?? "" },
    { key: "status" as keyof Product, value: filters.status ?? "" },
  ];

  const result = sortData(filterData(filtered, colFilters), (sortKey as any) ?? "name", sortDir);

  const openHistory = async (productId: string) => {
    const { data } = await supabase
      .from("inventory_transactions")
      .select("*")
      .eq("product_id", productId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setTxs((data ?? []) as InventoryTx[]);
    setShowHistory(productId);
  };

  const handleSave = async (p: Partial<Product>) => {
    if (editing) {
      const { error } = await supabase.from("products").update(p).eq("id", editing.id);
      if (error) { toast.error("Lỗi cập nhật sản phẩm"); return; }
      toast.success("Đã cập nhật sản phẩm");
    } else {
      const { error } = await supabase.from("products").insert(p);
      if (error) { toast.error("Lỗi tạo sản phẩm"); return; }
      toast.success("Đã tạo sản phẩm mới");
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Không thể xóa sản phẩm (có thể đang được sử dụng)"); return; }
    toast.success("Đã xóa sản phẩm");
    load();
  };

  const handleStockIn = async (productId: string, qty: number, note: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const s = await loadSettings();
    const txId = genId(s.inventory_prefix, s.id_format);
    const { error: txErr } = await supabase.from("inventory_transactions").insert({
      id: txId, product_id: productId, type: "Nhập kho", qty, ref: txId, note,
    });
    if (txErr) { toast.error("Lỗi ghi giao dịch kho"); return; }
    const { error: pErr } = await supabase
      .from("products").update({ stock: product.stock + qty }).eq("id", productId);
    if (pErr) { toast.error("Lỗi cập nhật tồn kho"); return; }
    toast.success(`Đã nhập ${qty} vào kho`);
    setShowInventory(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Tìm sản phẩm theo tên, mã, danh mục..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4" /> Thêm sản phẩm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}</DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editing}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mã" sortDir={sortKey === "id" ? sortDir : null} onSort={(d) => { setSortKey("id"); setSortDir(d); }} filter={{ type: "text", value: filters.id ?? "", placeholder: "Lọc mã..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, id: v }))} />
                <SortableHead label="Tên sản phẩm" sortDir={sortKey === "name" ? sortDir : null} onSort={(d) => { setSortKey("name"); setSortDir(d); }} filter={{ type: "text", value: filters.name ?? "", placeholder: "Lọc tên..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, name: v }))} />
                <SortableHead label="Danh mục" sortDir={sortKey === "category" ? sortDir : null} onSort={(d) => { setSortKey("category"); setSortDir(d); }} filter={{ type: "text", value: filters.category ?? "", placeholder: "Lọc danh mục..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, category: v }))} />
                <SortableHead label="Giá vốn" align="right" sortDir={sortKey === "cost" ? sortDir : null} onSort={(d) => { setSortKey("cost"); setSortDir(d); }} filter={{ type: "text", value: filters.cost ?? "", placeholder: "Lọc giá vốn..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, cost: v }))} />
                <SortableHead label="Giá bán" align="right" sortDir={sortKey === "price" ? sortDir : null} onSort={(d) => { setSortKey("price"); setSortDir(d); }} filter={{ type: "text", value: filters.price ?? "", placeholder: "Lọc giá bán..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, price: v }))} />
                <SortableHead label="Tồn kho" align="center" sortDir={sortKey === "stock" ? sortDir : null} onSort={(d) => { setSortKey("stock"); setSortDir(d); }} filter={{ type: "text", value: filters.stock ?? "", placeholder: "Lọc tồn kho..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, stock: v }))} />
                <SortableHead label="Trạng thái" sortDir={sortKey === "status" ? sortDir : null} onSort={(d) => { setSortKey("status"); setSortDir(d); }} filter={{ type: "select", value: filters.status ?? "", options: [{ label: "Đang bán", value: "Đang bán" }, { label: "Ngừng bán", value: "Ngừng bán" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              )}
              {!loading && result.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Chưa có sản phẩm</TableCell></TableRow>
              )}
              {result.map((p) => (
                <TableRow key={p.id} data-highlighted={params.id === p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category || "—"}</TableCell>
                  <TableCell className="text-right">{formatVND(p.cost)}</TableCell>
                  <TableCell className="text-right font-medium">{formatVND(p.price)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={p.stock <= p.min_stock ? "font-bold text-destructive" : ""}>{p.stock}</span>
                      {p.stock <= p.min_stock && (
                        <AlertTriangle className="size-3.5 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "Đang bán" ? "default" : "secondary"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setShowForm(true); }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowInventory(p.id)}>
                        <PackagePlus className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openHistory(p.id)}>
                        <History className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Stock-in dialog */}
      <Dialog open={!!showInventory} onOpenChange={(o) => !o && setShowInventory(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nhập kho</DialogTitle>
          </DialogHeader>
          <StockInForm
            product={products.find((p) => p.id === showInventory)}
            onSubmit={handleStockIn}
            onCancel={() => setShowInventory(null)}
          />
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!showHistory} onOpenChange={(o) => !o && setShowHistory(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lịch sử biến động kho — {products.find((p) => p.id === showHistory)?.name}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead>Tham chiếu</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có giao dịch</TableCell></TableRow>
              )}
              {txs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDate(t.date)}</TableCell>
                  <TableCell>
                    <Badge variant={t.qty > 0 ? "default" : "secondary"}>{t.type}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono ${t.qty > 0 ? "text-chart-2" : "text-destructive"}`}>
                    {t.qty > 0 ? "+" : ""}{t.qty}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                  <TableCell className="text-muted-foreground">{t.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ product, onSave, onCancel }: {
  product: Product | null;
  onSave: (p: Partial<Product>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: product?.id ?? "",
    name: product?.name ?? "",
    category: product?.category ?? "",
    unit: product?.unit ?? "cái",
    cost: product?.cost ?? 0,
    price: product?.price ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    description: product?.description ?? "",
    status: product?.status ?? "Đang bán",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mã sản phẩm</Label>
          <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!product} />
        </div>
        <div className="space-y-1.5">
          <Label>Tên sản phẩm</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Danh mục</Label>
          <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Đơn vị tính</Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Giá vốn (đ)</Label>
          <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Giá bán (đ)</Label>
          <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Tồn kho</Label>
          <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} disabled={!!product} />
        </div>
        <div className="space-y-1.5">
          <Label>Tồn tối thiểu</Label>
          <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: +e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Trạng thái</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Đang bán">Đang bán</SelectItem>
              <SelectItem value="Ngừng bán">Ngừng bán</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Mô tả</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button onClick={() => onSave(form)} disabled={!form.id || !form.name}>
          {product ? "Cập nhật" : "Tạo sản phẩm"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function StockInForm({ product, onSubmit, onCancel }: {
  product: Product | undefined;
  onSubmit: (id: string, qty: number, note: string) => void;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState(10);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Tồn hiện tại: <strong className="text-foreground">{product?.stock ?? 0}</strong>
        {" → "}
        <strong className="text-chart-2">{(product?.stock ?? 0) + qty}</strong>
      </div>
      <div className="space-y-1.5">
        <Label>Số lượng nhập</Label>
        <Input type="number" value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} />
      </div>
      <div className="space-y-1.5">
        <Label>Ghi chú</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Nhập từ NCC" />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button onClick={() => onSubmit(product!.id, qty, note)}>Nhập kho</Button>
      </DialogFooter>
    </div>
  );
}
