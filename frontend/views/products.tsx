"use client";
import { useEffect, useState, useCallback } from "react";
import { db, type Product, type InventoryTx, loadSettings } from "@/lib/db";
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
import { Plus, Pencil, PackagePlus, History, AlertTriangle, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";

import { ActionTooltip } from "@/components/action-tooltip";

import { fetchReservedStockMap } from "@/lib/inventory";

export function ProductsPage() {
  const { params } = useNav();
  const [products, setProducts] = useState<Product[]>([]);
  const [reservedStockMap, setReservedStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showInventory, setShowInventory] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [txs, setTxs] = useState<InventoryTx[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, rMap] = await Promise.all([
      db.from("products").select("*").order("name"),
      fetchReservedStockMap(),
    ]);
    setProducts((pRes.data ?? []) as Product[]);
    setReservedStockMap(rMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = Array.from(
    new Set(
      products.map((p) => p.category).filter(Boolean)
    )
  ).sort();

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()));

  const colFilters = [
    { key: (p: Product) => p.id, value: filters.id ?? "" },
    { key: (p: Product) => p.name, value: filters.name ?? "" },
    { key: (p: Product) => p.category, value: filters.category ?? "" },
    { key: (p: Product) => String(p.cost), value: filters.cost ?? "" },
    { key: (p: Product) => String(p.price), value: filters.price ?? "" },
    { key: (p: Product) => String(p.stock), value: filters.stock ?? "" },
    { key: (p: Product) => String(reservedStockMap[p.id] || 0), value: filters.quoted ?? "" },
    { key: (p: Product) => String(Math.max(0, p.stock - (reservedStockMap[p.id] || 0))), value: filters.available ?? "" },
    { key: (p: Product) => p.status, value: filters.status ?? "" },
  ];

  const result = sortData(filterData(filtered, colFilters), (sortKey as any) ?? "name", sortDir);
  const totalItems = result.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedResult = result.slice((page - 1) * pageSize, page * pageSize);

  const openHistory = async (productId: string) => {
    const { data } = await db
      .from("inventory_transactions")
      .select("*")
      .eq("product_id", productId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setTxs((data ?? []) as InventoryTx[]);
    setShowHistory(productId);
  };

  const handleSave = async (p: Partial<Product>) => {
    if (!p.id?.trim()) {
      toast.error("Mã sản phẩm không được để trống!");
      return;
    }
    if (!p.name?.trim()) {
      toast.error("Tên sản phẩm không được để trống!");
      return;
    }

    if (editing) {
      const { error } = await db.from("products").update(p).eq("id", editing.id);
      if (error) { toast.error("Lỗi cập nhật sản phẩm"); return; }
      toast.success("Đã cập nhật sản phẩm");
    } else {
      const isDuplicate = products.some(
        (existing) => existing.id.trim().toLowerCase() === p.id!.trim().toLowerCase()
      );
      if (isDuplicate) {
        toast.error(`Mã sản phẩm "${p.id}" đã tồn tại trên hệ thống! Vui lòng dùng mã khác.`);
        return;
      }

      const { error } = await db.from("products").insert(p);
      if (error) {
        if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("exists")) {
          toast.error(`Mã sản phẩm "${p.id}" đã tồn tại!`);
        } else {
          toast.error("Lỗi tạo sản phẩm");
        }
        return;
      }
      toast.success("Đã tạo sản phẩm mới");
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) { toast.error("Không thể xóa sản phẩm (có thể đang được sử dụng)"); return; }
    toast.success("Đã xóa sản phẩm");
    load();
  };

  const handleStockIn = async (productId: string, qty: number, note: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const s = await loadSettings();
    const txId = genId(s.inventory_prefix, s.id_format);
    const { error: txErr } = await db.from("inventory_transactions").insert({
      id: txId, product_id: productId, type: "Nhập kho", qty, ref: txId, note,
    });
    if (txErr) { toast.error("Lỗi ghi giao dịch kho"); return; }
    // Backend inventory route already handles stock increment atomically
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCategoryManager(true)}>
            <Tag className="size-4 text-muted-foreground" /> Quản lý danh mục
          </Button>
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
                categories={categories}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditing(null); }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <CategoryManagerDialog
        open={showCategoryManager}
        onOpenChange={setShowCategoryManager}
        categories={categories}
        products={products}
        onCategoryUpdated={load}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mã" sortDir={sortKey === "id" ? sortDir : null} onSort={(d) => { setSortKey("id"); setSortDir(d); }} filter={{ type: "text", value: filters.id ?? "", placeholder: "Lọc mã..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, id: v }))} />
                <SortableHead label="Tên sản phẩm" sortDir={sortKey === "name" ? sortDir : null} onSort={(d) => { setSortKey("name"); setSortDir(d); }} filter={{ type: "text", value: filters.name ?? "", placeholder: "Lọc tên..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, name: v }))} />
                <SortableHead label="Danh mục" sortDir={sortKey === "category" ? sortDir : null} onSort={(d) => { setSortKey("category"); setSortDir(d); }} filter={{ type: "select", value: filters.category ?? "", options: categories.map((c) => ({ label: c, value: c })) }} onFilterChange={(v) => setFilters((f) => ({ ...f, category: v }))} />
                <SortableHead label="Giá vốn" align="right" sortDir={sortKey === "cost" ? sortDir : null} onSort={(d) => { setSortKey("cost"); setSortDir(d); }} filter={{ type: "text", value: filters.cost ?? "", placeholder: "Lọc giá vốn..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, cost: v }))} />
                <SortableHead label="Giá bán" align="right" sortDir={sortKey === "price" ? sortDir : null} onSort={(d) => { setSortKey("price"); setSortDir(d); }} filter={{ type: "text", value: filters.price ?? "", placeholder: "Lọc giá bán..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, price: v }))} />
                <SortableHead label="Tồn kho" align="center" sortDir={sortKey === "stock" ? sortDir : null} onSort={(d) => { setSortKey("stock"); setSortDir(d); }} filter={{ type: "text", value: filters.stock ?? "", placeholder: "Lọc tồn..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, stock: v }))} />
                <SortableHead label="Đang báo giá" align="center" sortDir={sortKey === "quoted" ? sortDir : null} onSort={(d) => { setSortKey("quoted"); setSortDir(d); }} filter={{ type: "text", value: filters.quoted ?? "", placeholder: "Lọc đang báo..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, quoted: v }))} />
                <SortableHead label="Khả dụng" align="center" sortDir={sortKey === "available" ? sortDir : null} onSort={(d) => { setSortKey("available"); setSortDir(d); }} filter={{ type: "text", value: filters.available ?? "", placeholder: "Lọc khả dụng..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, available: v }))} />
                <SortableHead label="Trạng thái" sortDir={sortKey === "status" ? sortDir : null} onSort={(d) => { setSortKey("status"); setSortDir(d); }} filter={{ type: "select", value: filters.status ?? "", options: [{ label: "Đang bán", value: "Đang bán" }, { label: "Ngừng bán", value: "Ngừng bán" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton rows={5} columns={10} />}
              {!loading && result.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <EmptyState
                      title="Chưa có sản phẩm"
                      description="Thêm sản phẩm mới vào danh mục của bạn để bắt đầu."
                    />
                  </TableCell>
                </TableRow>
              )}
              {paginatedResult.map((p) => {
                const quotedQty = reservedStockMap[p.id] || 0;
                const availableStock = Math.max(0, p.stock - quotedQty);
                return (
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
                    <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">
                      {quotedQty > 0 ? quotedQty : "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={availableStock <= p.min_stock ? "font-bold text-destructive" : "font-semibold text-emerald-600 dark:text-emerald-400"}>
                        {availableStock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === "Đang bán" ? "default" : "secondary"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionTooltip label="Chỉnh sửa sản phẩm">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setShowForm(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Nhập / Xuất kho">
                        <Button size="sm" variant="ghost" onClick={() => setShowInventory(p.id)}>
                          <PackagePlus className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Lịch sử biến động kho">
                        <Button size="sm" variant="ghost" onClick={() => openHistory(p.id)}>
                          <History className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Xóa sản phẩm">
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </CardContent>
        {totalItems > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </Card>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Xác nhận xóa sản phẩm"
        description="Bạn có chắc chắn muốn xóa sản phẩm này? Hành động này không thể hoàn tác."
        confirmText="Xóa sản phẩm"
        onConfirm={async () => {
          if (deleteId) {
            await handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
      />

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

function ProductForm({ product, categories, onSave, onCancel }: {
  product: Product | null;
  categories: string[];
  onSave: (p: Partial<Product>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: product?.id ?? "",
    name: product?.name ?? "",
    category: product?.category ?? (categories[0] || ""),
    unit: product?.unit ?? "cái",
    cost: product?.cost ?? 0,
    price: product?.price ?? 0,
    stock: product?.stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    description: product?.description ?? "",
    status: product?.status ?? "Đang bán",
  });

  useEffect(() => {
    if (!product) {
      (async () => {
        const s = await loadSettings();
        const { count } = await db.from("products").select("*", { count: "exact", head: true });
        const generatedId = genId(s.product_prefix, s.id_format.includes("{NUM}") ? s.id_format : "{PREFIX}-{NUM}", (count ?? 0) + 1);
        setForm((prev) => prev.id ? prev : { ...prev, id: generatedId });
      })();
    } else {
      setForm({
        id: product.id,
        name: product.name ?? "",
        category: product.category ?? (categories[0] || ""),
        unit: product.unit ?? "cái",
        cost: product.cost ?? 0,
        price: product.price ?? 0,
        stock: product.stock ?? 0,
        min_stock: product.min_stock ?? 0,
        description: product.description ?? "",
        status: product.status ?? "Đang bán",
      });
    }
  }, [product, categories]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mã sản phẩm <span className="text-destructive">*</span></Label>
          <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!product} />
        </div>
        <div className="space-y-1.5">
          <Label>Tên sản phẩm <span className="text-destructive">*</span></Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Danh mục <span className="text-destructive">*</span></Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Đơn vị tính <span className="text-destructive">*</span></Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Giá vốn (đ) <span className="text-destructive">*</span></Label>
          <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Giá bán (đ) <span className="text-destructive">*</span></Label>
          <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Tồn kho <span className="text-destructive">*</span></Label>
          <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} disabled={!!product} />
        </div>
        <div className="space-y-1.5">
          <Label>Tồn tối thiểu <span className="text-destructive">*</span></Label>
          <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: +e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Trạng thái <span className="text-destructive">*</span></Label>
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
        <Button onClick={() => {
          if (!form.id.trim()) { toast.error("Vui lòng nhập Mã sản phẩm"); return; }
          if (!form.name.trim()) { toast.error("Vui lòng nhập Tên sản phẩm"); return; }
          if (!form.category.trim()) { toast.error("Vui lòng chọn Danh mục"); return; }
          if (!form.unit.trim()) { toast.error("Vui lòng nhập Đơn vị tính"); return; }
          if (!form.status.trim()) { toast.error("Vui lòng chọn Trạng thái"); return; }
          onSave(form);
        }} disabled={!form.id || !form.name || !form.category || !form.unit || !form.status}>
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

function CategoryManagerDialog({
  open,
  onOpenChange,
  categories,
  products,
  onCategoryUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  products: Product[];
  onCategoryUpdated: () => void;
}) {
  const [newCategory, setNewCategory] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleAdd = async () => {
    const name = newCategory.trim();
    if (!name) return;
    if (categories.includes(name)) {
      toast.error("Danh mục này đã tồn tại!");
      return;
    }
    toast.success(`Đã thêm danh mục "${name}"`);
    setNewCategory("");
    onCategoryUpdated();
  };

  const handleRename = async (oldName: string) => {
    const newName = editName.trim();
    if (!newName || newName === oldName) {
      setEditingCat(null);
      return;
    }
    const { error } = await db
      .from("products")
      .update({ category: newName })
      .eq("category", oldName);

    if (error) {
      toast.error("Lỗi đổi tên danh mục");
      return;
    }
    toast.success(`Đã đổi tên danh mục "${oldName}" thành "${newName}"`);
    setEditingCat(null);
    onCategoryUpdated();
  };

  const handleDelete = async (catName: string) => {
    const count = products.filter((p) => p.category === catName).length;
    const confirmMsg = count > 0
      ? `Có ${count} sản phẩm thuộc danh mục "${catName}". Bạn có chắc chắn muốn xóa danh mục này khỏi tất cả sản phẩm?`
      : `Bạn có chắc chắn muốn xóa danh mục "${catName}"?`;

    if (!window.confirm(confirmMsg)) return;

    if (count > 0) {
      await db.from("products").update({ category: "" }).eq("category", catName);
    }
    toast.success(`Đã xóa danh mục "${catName}"`);
    onCategoryUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="size-4.5 text-primary" />
            Quản lý danh mục sản phẩm
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nhập tên danh mục mới..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="h-9 text-xs"
            />
            <Button size="sm" className="h-9 px-3 gap-1" onClick={handleAdd} disabled={!newCategory.trim()}>
              <Plus className="size-4" /> Thêm
            </Button>
          </div>

          <div className="rounded-lg border divide-y max-h-[350px] overflow-y-auto">
            {categories.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Chưa có danh mục nào</div>
            ) : (
              categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                const isEditing = editingCat === cat;
                return (
                  <div key={cat} className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1 mr-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleRename(cat);
                            }
                          }}
                          className="h-8 text-xs font-medium"
                          autoFocus
                        />
                        <Button size="sm" className="h-8 px-2.5 text-xs" onClick={() => handleRename(cat)}>
                          Lưu
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingCat(null)}>
                          Hủy
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{cat}</span>
                          <Badge variant="secondary" className="text-[10px] font-mono font-normal">
                            {count} sản phẩm
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingCat(cat);
                              setEditName(cat);
                            }}
                            title="Đổi tên danh mục"
                          >
                            <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(cat)}
                            title="Xóa danh mục"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
