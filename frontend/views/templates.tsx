"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { db, type Template, type AppSettings, loadSettings } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Lock, Unlock, Eye, Star, X, Upload, AlignJustify, FileType, Undo, Redo, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Table as TableIcon, Minus, Sparkles, Rows3, Columns3, Combine, Split, Layers, Baseline, Image as ImageIcon, Eraser, Scissors, Palette, PanelTop, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadPdf, downloadWord } from "@/lib/download";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";
import { ActionTooltip } from "@/components/action-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import mammoth from "mammoth";

const ALLOWED_TAGS = new Set([
  "P", "DIV", "SPAN", "BR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "DEL", "INS", "SUB", "SUP",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "CAPTION", "COLGROUP", "COL",
  "IMG", "A", "BLOCKQUOTE", "HR", "PRE", "CODE", "MARK", "SMALL", "FONT", "CENTER",
  "HEADER", "FOOTER",
]);

function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  const walk = (el: Element) => {
    for (let i = el.children.length - 1; i >= 0; i--) {
      walk(el.children[i]);
    }
    if (!ALLOWED_TAGS.has(el.tagName)) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      return;
    }
    [...el.attributes].forEach((attr) => {
      if (
        attr.name.startsWith("on") ||
        (attr.name === "href" && /^\s*javascript:/i.test(attr.value)) ||
        (attr.name === "style" && /javascript:|expression\(/i.test(attr.value))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  };
  for (let i = body.children.length - 1; i >= 0; i--) {
    walk(body.children[i]);
  }
  body.querySelectorAll("script,style,link,meta,iframe,object,embed").forEach((el) => el.remove());
  return body.innerHTML;
}

const TEMPLATE_TYPES = [
  { value: "quote", label: "Mẫu báo giá" },
  { value: "contract", label: "Mẫu hợp đồng" },
];

const VARIABLES = [
  "SO_TAI_LIEU", "NGAY", "TEN_CONG_TY", "DIA_CHI_CONG_TY", "SDT_CONG_TY", "EMAIL_CONG_TY", "MST_CONG_TY", "LOGO_CONG_TY",
  "TEN_KHACH_HANG", "DIA_CHI_KHACH_HANG", "MST_KHACH_HANG",
  "BANG_SAN_PHAM", "TAM_TINH", "VAT", "TONG_TIEN", "DA_THANH_TOAN", "CON_PHAI_THU",
  "SO_HOP_DONG", "SO_BAO_GIA", "DIEU_KHOAN_THANH_TOAN", "GHI_CHU", "CHU_KY_BEN_BAN", "CHU_KY_KHAC_HANG", "CON_DAU",
];

function renderTemplatePreview(template: Template, settings: AppSettings | null): string {
  if (!template?.content) return "<p>Mẫu trống</p>";

  const sampleTable = `<table style="width:100%;border-collapse:collapse;margin:8px 0;">
    <thead><tr style="background:#f1f5f9;">
      <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">STT</th>
      <th style="border:1px solid #cbd5e1;padding:6px;text-align:left;">Tên sản phẩm / Dịch vụ</th>
      <th style="border:1px solid #cbd5e1;padding:6px;text-align:right;">Số lượng</th>
      <th style="border:1px solid #cbd5e1;padding:6px;text-align:right;">Đơn giá (đ)</th>
      <th style="border:1px solid #cbd5e1;padding:6px;text-align:right;">Thành tiền (đ)</th>
    </tr></thead>
    <tbody>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px;">1</td>
        <td style="border:1px solid #cbd5e1;padding:6px;">Thiết bị & Giải pháp phần mềm trọn gói</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">1</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">25,000,000</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">25,000,000</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:6px;">2</td>
        <td style="border:1px solid #cbd5e1;padding:6px;">Dịch vụ triển khai & Đào tạo hướng dẫn</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">1</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">5,000,000</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">5,000,000</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="font-weight:bold;background:#f8fafc;">
        <td colspan="4" style="border:1px solid #cbd5e1;padding:6px;text-align:right;">Tổng tiền hàng:</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">30,000,000 đ</td>
      </tr>
      <tr style="font-weight:bold;background:#f8fafc;">
        <td colspan="4" style="border:1px solid #cbd5e1;padding:6px;text-align:right;">Thuế GTGT (10%):</td>
        <td style="border:1px solid #cbd5e1;padding:6px;text-align:right;">3,000,000 đ</td>
      </tr>
      <tr style="font-weight:bold;background:#f1f5f9;color:#0f172a;">
        <td colspan="4" style="border:1px solid #cbd5e1;padding:7px;text-align:right;font-size:11pt;">TỔNG CỘNG THANH TOÁN:</td>
        <td style="border:1px solid #cbd5e1;padding:7px;text-align:right;font-size:11pt;color:#b91c1c;">33,000,000 đ</td>
      </tr>
    </tfoot>
  </table>`;

  const samplePaymentTerms = `<div style="margin-top:8px;">
    <p style="margin-bottom:4px;">- Đợt 1: Tạm ứng 50% ngay sau khi ký hợp đồng / xác nhận đơn hàng (<strong>16,500,000 đ</strong>).</p>
    <p style="margin-bottom:4px;">- Đợt 2: Thanh toán 50% còn lại sau khi bàn giao & nghiệm thu đầy đủ (<strong>16,500,000 đ</strong>).</p>
  </div>`;

  const companyName = settings?.company_name || "CÔNG TY BÁN HÀNG";
  const replacements: Record<string, string> = {
    SO_TAI_LIEU: template.type === "quote" ? "BG-2026-001" : "HD-2026-001",
    SO_BAO_GIA: "BG-2026-001",
    SO_HOP_DONG: "HD-2026-001",
    NGAY: new Date().toLocaleDateString("vi-VN"),
    TEN_CONG_TY: companyName,
    DIA_CHI_CONG_TY: settings?.company_address || "Tầng 5, Tòa nhà Landmark, TP. Hồ Chí Minh",
    SDT_CONG_TY: settings?.company_phone || "0901 234 567",
    EMAIL_CONG_TY: settings?.company_email || "contact@doanhnghiep.vn",
    MST_CONG_TY: settings?.company_tax || "0101234567",
    LOGO_CONG_TY: settings?.logo_url ? `<img src="${settings.logo_url}" alt="Logo" style="height:48px;max-width:150px;object-fit:contain;" />` : `<div style="font-weight:bold;color:#0f172a;font-size:16px;">${companyName}</div>`,
    TEN_KHACH_HANG: "Công ty Cổ phần Thương mại Khách Hàng",
    DIA_CHI_KHACH_HANG: "Số 88 Đường Nguyễn Trãi, Quận Thanh Xuân, Hà Nội",
    MST_KHACH_HANG: "0309876543",
    BANG_SAN_PHAM: sampleTable,
    TAM_TINH: "30,000,000 đ",
    VAT: "3,000,000 đ",
    TONG_TIEN: "33,000,000 đ",
    DA_THANH_TOAN: "16,500,000 đ",
    CON_PHAI_THU: "16,500,000 đ",
    DIEU_KHOAN_THANH_TOAN: samplePaymentTerms,
    GHI_CHU: "Báo giá/Hợp đồng đã bao gồm chi phí vận chuyển và bảo hành 12 tháng tại nơi sử dụng.",
    PAGE: "1",
    TOTAL_PAGES: "1",
    CHU_KY_BEN_BAN: `<div style="text-align:center; padding:12px; margin-top:20px;"><strong>ĐẠI DIỆN BÊN BÁN</strong><br/><em style="font-size:12px;color:#666;">(Ký, ghi rõ họ tên & đóng dấu)</em><br/><br/><br/><br/><strong>${companyName}</strong></div>`,
    CHU_KY_KHAC_HANG: `<div style="text-align:center; padding:12px; margin-top:20px;"><strong>ĐẠI DIỆN KHÁCH HÀNG</strong><br/><em style="font-size:12px;color:#666;">(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><strong>NGUYỄN VĂN A</strong></div>`,
    CHU_KY_KHACH_HANG: `<div style="text-align:center; padding:12px; margin-top:20px;"><strong>ĐẠI DIỆN KHÁCH HÀNG</strong><br/><em style="font-size:12px;color:#666;">(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><strong>NGUYỄN VĂN A</strong></div>`,
    CHU_KY_BEN_MUA: `<div style="text-align:center; padding:12px; margin-top:20px;"><strong>ĐẠI DIỆN BÊN MUA</strong><br/><em style="font-size:12px;color:#666;">(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><strong>NGUYỄN VĂN A</strong></div>`,
    CON_DAU: `<div style="display:inline-block; border:2px dashed #ef4444; border-radius:50%; padding:10px 16px; color:#ef4444; font-weight:bold; font-size:12px; transform:rotate(-12deg);">ĐÃ XÁC NHẬN</div>`,
  };

  let html = template.content;
  for (const [k, v] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v);
  }
  return html;
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, s] = await Promise.all([
      db.from("templates").select("*").order("type").order("name"),
      loadSettings(),
    ]);
    setTemplates((tRes.data ?? []) as Template[]);
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const colFilters = [
    { key: (t: Template) => t.id, value: filters.id ?? "" },
    { key: (t: Template) => t.name, value: filters.name ?? "" },
    { key: (t: Template) => (t.type === "quote" ? "Báo giá" : "Hợp đồng"), value: filters.type ?? "" },
    { key: (t: Template) => (t.is_default ? "Mặc định" : ""), value: filters.is_default ?? "" },
    { key: (t: Template) => (t.locked ? "Đã khóa" : "Nháp"), value: filters.locked ?? "" },
  ];

  const filteredTemplates = filterData(
    templates.filter((t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.type.toLowerCase().includes(search.toLowerCase())
    ),
    colFilters as any
  );

  const sortedTemplates = (() => {
    if (!sortKey || !sortDir) return filteredTemplates;
    const accessor: Record<string, (t: Template) => string | number> = {
      id: (t) => t.id,
      name: (t) => t.name,
      type: (t) => t.type,
      is_default: (t) => (t.is_default ? 1 : 0),
      locked: (t) => (t.locked ? 1 : 0),
    };
    return sortData(filteredTemplates, accessor[sortKey] ?? ((t) => t.id), sortDir);
  })();

  const handleSave = async (t: Partial<Template>) => {
    if (editing) {
      if (editing.locked) { toast.error("Mẫu đã khóa, không thể sửa"); return; }
      if (t.is_default) {
        await db.from("templates").update({ is_default: false }).eq("type", editing.type);
      }
      const { error } = await db.from("templates").update(t).eq("id", editing.id);
      if (error) { toast.error("Lỗi cập nhật"); return; }
      toast.success("Đã cập nhật mẫu");
    } else {
      if (t.is_default) {
        await db.from("templates").update({ is_default: false }).eq("type", t.type);
      }
      const { error } = await db.from("templates").insert(t);
      if (error) { toast.error("Lỗi tạo mẫu"); return; }
      toast.success("Đã tạo mẫu mới");
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (t?.locked) { toast.error("Mẫu đã khóa, không thể xóa"); return; }
    const { error } = await db.from("templates").delete().eq("id", id);
    if (error) { toast.error("Lỗi xóa"); return; }
    toast.success("Đã xóa mẫu");
    load();
  };

  const toggleLock = async (t: Template) => {
    const { error } = await db.from("templates").update({ locked: !t.locked }).eq("id", t.id);
    if (error) { toast.error("Lỗi"); return; }
    toast.success(t.locked ? "Đã mở khóa mẫu" : "Đã khóa mẫu");
    load();
  };

  const setDefault = async (t: Template) => {
    await db.from("templates").update({ is_default: false }).eq("type", t.type);
    const { error } = await db.from("templates").update({ is_default: true }).eq("id", t.id);
    if (error) { toast.error("Lỗi"); return; }
    toast.success("Đã đặt làm mẫu mặc định");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Tìm mẫu tài liệu theo tên, mã..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="size-4" /> Thêm mẫu
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Mã" sortDir={sortKey === "id" ? sortDir : null} onSort={(d) => { setSortKey("id"); setSortDir(d); }} filter={{ type: "text", value: filters.id ?? "", placeholder: "Lọc mã..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, id: v }))} />
                <SortableHead label="Tên mẫu" sortDir={sortKey === "name" ? sortDir : null} onSort={(d) => { setSortKey("name"); setSortDir(d); }} filter={{ type: "text", value: filters.name ?? "", placeholder: "Lọc tên..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, name: v }))} />
                <SortableHead label="Loại" sortDir={sortKey === "type" ? sortDir : null} onSort={(d) => { setSortKey("type"); setSortDir(d); }} filter={{ type: "select", value: filters.type ?? "", options: [{ label: "Báo giá", value: "Báo giá" }, { label: "Hợp đồng", value: "Hợp đồng" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, type: v }))} />
                <SortableHead label="Mặc định" sortDir={sortKey === "is_default" ? sortDir : null} onSort={(d) => { setSortKey("is_default"); setSortDir(d); }} />
                <SortableHead label="Trạng thái" sortDir={sortKey === "locked" ? sortDir : null} onSort={(d) => { setSortKey("locked"); setSortDir(d); }} filter={{ type: "select", value: filters.locked ?? "", options: [{ label: "Đã khóa", value: "Đã khóa" }, { label: "Nháp", value: "Nháp" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, locked: v }))} />
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeleton rows={5} columns={6} />}
              {!loading && sortedTemplates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="Chưa có mẫu tài liệu"
                      description="Tạo mẫu báo giá hoặc hợp đồng chuẩn để xuất tài liệu nhanh chóng."
                    />
                  </TableCell>
                </TableRow>
              )}
              {sortedTemplates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.type === "quote" ? "Báo giá" : "Hợp đồng"}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.is_default ? (
                      <Badge className="gap-1"><Star className="size-3" /> Mặc định</Badge>
                    ) : (
                      <ActionTooltip label="Đặt làm mẫu mặc định">
                        <Button size="sm" variant="ghost" onClick={() => setDefault(t)}>
                          <Star className="size-3.5 text-muted-foreground" />
                        </Button>
                      </ActionTooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.locked ? (
                      <Badge variant="secondary" className="gap-1"><Lock className="size-3" /> Đã khóa</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1"><Unlock className="size-3" /> Nháp</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ActionTooltip label="Xem trước mẫu">
                        <Button size="sm" variant="ghost" onClick={() => setPreview(t)}><Eye className="size-3.5" /></Button>
                      </ActionTooltip>
                      <ActionTooltip label="Tải PDF mẫu (A4)">
                        <Button size="sm" variant="ghost" onClick={() => downloadPdf(`Mau-${t.type === "quote" ? "Bao-gia" : "Hop-dong"}-${t.id}`, renderTemplatePreview(t, settings))}>
                          <Download className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Tải Word mẫu (.doc)">
                        <Button size="sm" variant="ghost" onClick={() => downloadWord(`Mau-${t.type === "quote" ? "Bao-gia" : "Hop-dong"}-${t.id}`, renderTemplatePreview(t, settings))}>
                          <FileType className="size-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label={t.locked ? "Khóa mẫu (Không thể sửa)" : "Chỉnh sửa mẫu"}>
                        <span>
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setShowForm(true); }} disabled={t.locked}>
                            <Pencil className="size-3.5" />
                          </Button>
                        </span>
                      </ActionTooltip>
                      <ActionTooltip label={t.locked ? "Mở khóa mẫu" : "Khóa mẫu"}>
                        <Button size="sm" variant="ghost" onClick={() => toggleLock(t)}>
                          {t.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Xóa mẫu">
                        <span>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onClick={() => setDeleteId(t.id)} disabled={t.locked}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </span>
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
        title="Xác nhận xóa mẫu tài liệu"
        description="Bạn có chắc chắn muốn xóa mẫu tài liệu này? Thao tác này không thể hoàn tác."
        confirmText="Xóa mẫu"
        onConfirm={async () => {
          if (deleteId) {
            await handleDelete(deleteId);
            setDeleteId(null);
          }
        }}
      />

      {/* Editor */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-6xl max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Sửa mẫu: ${editing.name}` : "Tạo mẫu mới"}</DialogTitle>
          </DialogHeader>
          <TemplateForm template={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-5xl max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Xem trước: {preview?.name}
            </DialogTitle>
          </DialogHeader>
          {preview && (() => {
            const previewHtml = renderTemplatePreview(preview, settings);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 print:hidden">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{preview.type === "quote" ? "Mẫu Báo giá" : "Mẫu Hợp đồng"}</Badge>
                    {preview.is_default && <Badge className="gap-1"><Star className="size-3" /> Mặc định</Badge>}
                    <span className="text-sm text-muted-foreground">Khổ giấy: {preview.paper || "A4"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadPdf(`Mau-${preview.type === "quote" ? "Bao-gia" : "Hop-dong"}-${preview.id}`, previewHtml)}>
                      <Download className="size-3.5" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadWord(`Mau-${preview.type === "quote" ? "Bao-gia" : "Hop-dong"}-${preview.id}`, previewHtml)}>
                      <FileType className="size-3.5" /> Word
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border bg-white p-8 text-black" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({ template, onSave, onCancel }: {
  template: Template | null;
  onSave: (t: Partial<Template>) => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [form, setForm] = useState({
    id: template?.id ?? "",
    type: template?.type ?? "quote",
    name: template?.name ?? "",
    is_default: template?.is_default ?? false,
    paper: template?.paper ?? "A4",
    locked: false,
    content: template?.content ?? "",
  });

  const [textColor, setTextColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [cellBgColor, setCellBgColorState] = useState("#f1f5f9");
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    loadSettings().then((s) => setAppSettings(s));
  }, []);

  // Populate initial editor HTML content ONCE without controlled re-rendering
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = template?.content || "<p>Nhập nội dung mẫu tài liệu ở đây...</p>";
    }
  }, [template]);

  // Selection persistence functions
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    if (!savedRangeRef.current) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  const execCmd = (cmd: string, val?: string) => {
    if (editorRef.current) editorRef.current.focus();
    restoreSelection();
    document.execCommand(cmd, false, val);
    saveSelection();
  };

  const clearFormatting = () => {
    execCmd("removeFormat");
    toast.success("Đã xóa định dạng vùng chọn");
  };

  const insertVariable = (varName: string) => {
    insertTextAtCursor(`{{${varName}}}`);
  };

  const insertTextAtCursor = (text: string) => {
    if (editorRef.current) editorRef.current.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      document.execCommand("insertText", false, text);
    }
    saveSelection();
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin: 12px 0;">
        <thead>
          <tr style="background-color:#f1f5f9;">
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">STT</th>
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Tên mục / Sản phẩm</th>
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:right;">Số lượng</th>
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:right;">Đơn giá (đ)</th>
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:right;">Thành tiền (đ)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:8px;">1</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">Sản phẩm mẫu A</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">1</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">100,000</td>
            <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">100,000</td>
          </tr>
        </tbody>
      </table><p><br/></p>
    `;
    execCmd("insertHTML", tableHtml);
  };

  const insertPageBreak = () => {
    const pageBreakHtml = `
      <div data-page-break="true" style="page-break-before: always; margin: 28px -18mm; padding: 10px 18mm; background: #f1f5f9; border-top: 2px dashed #94a3b8; border-bottom: 2px dashed #94a3b8; text-align: center; font-size: 11px; font-weight: 600; color: #475569; user-select: none;">
        ✂ --- NGẮT TRANG A4 (SANG TRANG MỚI) ---
      </div><p><br/></p>
    `;
    execCmd("insertHTML", pageBreakHtml);
    toast.success("Đã chèn ngắt trang A4");
  };

  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const imgHtml = `<img src="${dataUrl}" alt="Logo/Ảnh" style="max-width: 180px; height: auto; display: inline-block; margin: 4px;" /><p><br/></p>`;
      execCmd("insertHTML", imgHtml);
      toast.success("Đã chèn ảnh/logo vào văn bản");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Table manipulation helpers (Rows, Columns, Merge, Cell Bg)
  const getTableCell = (): HTMLTableCellElement | null => {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && (node.nodeName === "TD" || node.nodeName === "TH")) {
        return node as HTMLTableCellElement;
      }
      node = node.parentNode;
    }
    return null;
  };

  const setCellBgColor = (color: string) => {
    const cell = getTableCell();
    if (cell) {
      cell.style.backgroundColor = color;
      saveSelection();
      toast.success("Đã đổi màu nền ô");
    } else {
      toast.error("Vui lòng đặt con trỏ chuột vào 1 ô của bảng");
    }
  };

  const handleTableAction = (action: "row-above" | "row-below" | "col-left" | "col-right" | "del-row" | "del-col" | "merge-right" | "split-cell") => {
    const cell = getTableCell();
    if (!cell) {
      toast.error("Vui lòng đặt con trỏ chuột vào trong 1 ô của bảng");
      return;
    }
    const tr = cell.parentElement as HTMLTableRowElement;
    const table = tr?.parentElement?.parentElement as HTMLTableElement || tr?.parentElement as HTMLTableElement;
    if (!tr || !table) return;

    const colIdx = Array.from(tr.children).indexOf(cell);

    if (action === "row-above" || action === "row-below") {
      const newTr = tr.cloneNode(true) as HTMLTableRowElement;
      Array.from(newTr.children).forEach((td) => { (td as HTMLElement).innerHTML = "&nbsp;"; });
      if (action === "row-above") tr.parentNode?.insertBefore(newTr, tr);
      else tr.parentNode?.insertBefore(newTr, tr.nextSibling);
      toast.success("Đã thêm hàng mới");
    } else if (action === "col-left" || action === "col-right") {
      const rows = Array.from(table.querySelectorAll("tr"));
      rows.forEach((row) => {
        const target = row.children[colIdx] || row.children[row.children.length - 1];
        if (target) {
          const newCell = document.createElement(target.tagName.toLowerCase());
          newCell.innerHTML = "&nbsp;";
          newCell.setAttribute("style", (target as HTMLElement).getAttribute("style") || "border:1px solid #cbd5e1; padding:8px;");
          if (action === "col-left") row.insertBefore(newCell, target);
          else row.insertBefore(newCell, target.nextSibling);
        }
      });
      toast.success("Đã thêm cột mới");
    } else if (action === "del-row") {
      tr.remove();
      toast.success("Đã xóa hàng");
    } else if (action === "del-col") {
      const rows = Array.from(table.querySelectorAll("tr"));
      rows.forEach((row) => {
        if (row.children[colIdx]) row.children[colIdx].remove();
      });
      toast.success("Đã xóa cột");
    } else if (action === "merge-right") {
      const nextCell = cell.nextElementSibling as HTMLTableCellElement;
      if (nextCell) {
        const currentColspan = parseInt(cell.getAttribute("colspan") || "1", 10);
        const nextColspan = parseInt(nextCell.getAttribute("colspan") || "1", 10);
        cell.setAttribute("colspan", String(currentColspan + nextColspan));
        cell.innerHTML = (cell.innerHTML + " " + nextCell.innerHTML).trim();
        nextCell.remove();
        toast.success("Đã gộp ô sang phải");
      } else {
        toast.error("Không có ô bên phải để gộp");
      }
    } else if (action === "split-cell") {
      const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
      if (colspan > 1) {
        cell.setAttribute("colspan", "1");
        for (let i = 1; i < colspan; i++) {
          const newCell = document.createElement(cell.tagName.toLowerCase());
          newCell.innerHTML = "&nbsp;";
          newCell.setAttribute("style", cell.getAttribute("style") || "border:1px solid #cbd5e1; padding:8px;");
          cell.parentNode?.insertBefore(newCell, cell.nextSibling);
        }
        toast.success("Đã tách ô thành công");
      } else {
        toast.error("Ô chưa gộp nên không thể tách");
      }
    }

    saveSelection();
  };

  // Line Height & Spacing helpers
  const setLineHeight = (val: string) => {
    if (editorRef.current) editorRef.current.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && ["P", "DIV", "H1", "H2", "H3", "LI", "TD"].includes((node as Element).tagName)) {
          (node as HTMLElement).style.lineHeight = val;
          break;
        }
        node = node.parentNode;
      }
    }
    saveSelection();
  };

  const setParagraphSpacing = (type: "before" | "after" | "reset") => {
    if (editorRef.current) editorRef.current.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE && ["P", "DIV", "H1", "H2", "H3"].includes((node as Element).tagName)) {
          const el = node as HTMLElement;
          if (type === "before") el.style.marginTop = "14px";
          else if (type === "after") el.style.marginBottom = "14px";
          else {
            el.style.marginTop = "0px";
            el.style.marginBottom = "0px";
          }
          break;
        }
        node = node.parentNode;
      }
    }
    saveSelection();
  };

  const applyImportedHtml = (html: string, filename: string) => {
    const clean = sanitizeHtml(html);
    if (editorRef.current) editorRef.current.innerHTML = clean;
    toast.success(`Đã nhập nội dung từ ${filename}`);
  };

  const handleImportHtml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const html = ev.target?.result as string;
      applyImportedHtml(html, file.name);
    };
    reader.onerror = () => toast.error("Không thể đọc file");
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportDocx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Normal'] => p:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Title'] => h1.title:fresh",
            "p[style-name='Subtitle'] => h2.subtitle:fresh",
            "p[style-name='Quote'] => blockquote:fresh",
            "p[style-name='Intense Quote'] => blockquote.intense:fresh",
            "p[style-name='List Paragraph'] => p:fresh",
            "r[style-name='Strong'] => strong:fresh",
            "r[style-name='Emphasis'] => em:fresh",
            "r[style-name='Intense Emphasis'] => em.intense:fresh",
            "r[style-name='Subtle Reference'] => a.subtle:fresh",
            "p => p[style-align]:fresh",
            "r => span[style-font]:fresh",
          ],
        },
      );
      applyImportedHtml(result.value, file.name);
    } catch {
      toast.error("Không thể đọc file Word. Vui lòng đảm bảo file là định dạng .docx hợp lệ.");
    }
    e.target.value = "";
  };

  const handleFinalSave = () => {
    const finalContent = editorRef.current?.innerHTML || "";
    onSave({
      ...form,
      content: finalContent,
    });
  };

  const handleExportTestPdf = () => {
    const finalContent = editorRef.current?.innerHTML || "";
    const html = renderTemplatePreview({ ...form, content: finalContent } as Template, appSettings);
    downloadPdf(`Mau-${form.type === "quote" ? "Bao-gia" : "Hop-dong"}-${form.id || "sample"}`, html);
  };

  const handleExportTestWord = () => {
    const finalContent = editorRef.current?.innerHTML || "";
    const html = renderTemplatePreview({ ...form, content: finalContent } as Template, appSettings);
    downloadWord(`Mau-${form.type === "quote" ? "Bao-gia" : "Hop-dong"}-${form.id || "sample"}`, html);
  };

  const insertHeaderFooter = async () => {
    if (editorRef.current) editorRef.current.focus();
    restoreSelection();

    const s = appSettings || (await loadSettings());
    const companyName = s?.company_name || "TÊN DOANH NGHIỆP";
    const address = s?.company_address ? `Địa chỉ: ${s.company_address}` : "";
    const phone = s?.company_phone ? `Hotline: ${s.company_phone}` : "";
    const email = s?.company_email ? `Email: ${s.company_email}` : "";
    const tax = s?.company_tax ? `MST: ${s.company_tax}` : "";
    const contactParts = [phone, email, tax].filter(Boolean).join(" | ");

    const logoHtml = s?.logo_url
      ? `<img src="${s.logo_url}" alt="Logo" style="height: 48px; max-width: 150px; object-fit: contain; margin-right: 14px;" />`
      : "";

    const headerFooterHtml = `
      <header style="border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #475569;">
        <div style="display: flex; align-items: center;">
          ${logoHtml}
          <div>
            <strong style="color: #1e3a8a; font-size: 13px; text-transform: uppercase;">${companyName}</strong><br/>
            ${address ? `<span>${address}</span><br/>` : ""}
            ${contactParts ? `<span>${contactParts}</span>` : ""}
          </div>
        </div>
        <div style="text-align: right; shrink-0;">
          <span style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 4px; font-weight: 600; font-size: 11px;">MÃ TÀI LIỆU: {{SO_TAI_LIEU}}</span>
        </div>
      </header>
      <p><br/></p>
      <footer style="border-top: 1px solid #cbd5e1; margin-top: 35px; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b;">
        <div>${companyName}${contactParts ? ` (${phone || email})` : ""} — Tài liệu báo giá chính thức</div>
        <div style="font-weight: 600; color: #1e293b;">Trang {{PAGE}} / {{TOTAL_PAGES}}</div>
      </footer>
    `;
    document.execCommand("insertHTML", false, headerFooterHtml);
    saveSelection();
    toast.success("Đã chèn Header & Footer theo Thông tin doanh nghiệp trong Cài đặt");
  };

  const variableBadges = [
    { key: "SO_TAI_LIEU", label: "Mã tài liệu" },
    { key: "NGAY", label: "Ngày tạo" },
    { key: "TEN_CONG_TY", label: "Tên công ty" },
    { key: "DIA_CHI_CONG_TY", label: "Địa chỉ Cty" },
    { key: "SDT_CONG_TY", label: "SĐT Cty" },
    { key: "EMAIL_CONG_TY", label: "Email Cty" },
    { key: "MST_CONG_TY", label: "MST Cty" },
    { key: "TEN_KHACH_HANG", label: "Tên khách hàng" },
    { key: "DIA_CHI_KHACH_HANG", label: "Địa chỉ KH" },
    { key: "MST_KHACH_HANG", label: "Mã số thuế KH" },
    { key: "BANG_SAN_PHAM", label: "Bảng sản phẩm" },
    { key: "DIEU_KHOAN_THANH_TOAN", label: "Đ/K thanh toán" },
    { key: "TAM_TINH", label: "Tạm tính" },
    { key: "VAT", label: "Thuế VAT" },
    { key: "TONG_TIEN", label: "Tổng tiền" },
    { key: "DA_THANH_TOAN", label: "Đã thanh toán" },
    { key: "CON_PHAI_THU", label: "Còn phải thu" },
    { key: "PAGE", label: "Số trang (PAGE)" },
    { key: "TOTAL_PAGES", label: "Tổng số trang" },
    { key: "CHU_KY_BEN_BAN", label: "Chữ ký Bên bán" },
    { key: "CHU_KY_KHAC_HANG", label: "Chữ ký KH" },
    { key: "CON_DAU", label: "Con dấu" },
    { key: "GHI_CHU", label: "Ghi chú" },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Header Metadata Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Mã mẫu *</Label>
          <Input className="h-9 text-xs" placeholder="Ví dụ: MAU_BAO_GIA_01" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!template} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Tên mẫu *</Label>
          <Input className="h-9 text-xs" placeholder="Ví dụ: Mẫu báo giá tiêu chuẩn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Loại mẫu *</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2. Word-like Rich Text Toolbar */}
      <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-2.5 space-y-2 shadow-2xs">
        {/* Row 1: Formatting Tools */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Hoàn tác (Ctrl+Z)" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("undo")}>
              <Undo className="size-4 text-muted-foreground" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Làm lại (Ctrl+Y)" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("redo")}>
              <Redo className="size-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Clear Formatting */}
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs gap-1 border-r mr-1 pr-2" title="Xóa định dạng vùng chọn" onMouseDown={(e) => e.preventDefault()} onClick={clearFormatting}>
            <Eraser className="size-3.5 text-slate-500" />
            <span className="text-[11px]">Xóa định dạng</span>
          </Button>

          {/* Style / Heading */}
          <Select onValueChange={(v) => execCmd("formatBlock", v)}>
            <SelectTrigger className="h-8 w-28 text-xs bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()}><SelectValue placeholder="Kiểu chữ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="p">Đoạn văn (Normal)</SelectItem>
              <SelectItem value="h1">Tiêu đề 1 (H1)</SelectItem>
              <SelectItem value="h2">Tiêu đề 2 (H2)</SelectItem>
              <SelectItem value="h3">Tiêu đề 3 (H3)</SelectItem>
              <SelectItem value="blockquote">Trích dẫn</SelectItem>
            </SelectContent>
          </Select>

          {/* Font Family */}
          <Select onValueChange={(v) => execCmd("fontName", v)}>
            <SelectTrigger className="h-8 w-32 text-xs bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()}><SelectValue placeholder="Font chữ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Arial">Arial</SelectItem>
              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
              <SelectItem value="Calibri">Calibri</SelectItem>
              <SelectItem value="Segoe UI">Segoe UI</SelectItem>
              <SelectItem value="Roboto">Roboto</SelectItem>
              <SelectItem value="Inter">Inter</SelectItem>
              <SelectItem value="Georgia">Georgia</SelectItem>
              <SelectItem value="Courier New">Courier New</SelectItem>
            </SelectContent>
          </Select>

          {/* Font Size */}
          <Select onValueChange={(v) => execCmd("fontSize", v)}>
            <SelectTrigger className="h-8 w-20 text-xs bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()}><SelectValue placeholder="Cỡ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">10px</SelectItem>
              <SelectItem value="2">12px</SelectItem>
              <SelectItem value="3">14px</SelectItem>
              <SelectItem value="4">16px</SelectItem>
              <SelectItem value="5">18px</SelectItem>
              <SelectItem value="6">24px</SelectItem>
              <SelectItem value="7">32px</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-px h-5 bg-border mx-1" />

          {/* B I U S */}
          <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 font-bold text-xs" title="In đậm" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("bold")}>B</Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 italic text-xs" title="In nghiêng" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("italic")}>I</Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 underline text-xs" title="Gạch chân" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("underline")}>U</Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 line-through text-xs" title="Gạch ngang" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("strikeThrough")}>S</Button>
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1.5 border-r pr-1.5 mr-1">
            <label className="flex items-center gap-1 cursor-pointer text-xs" title="Màu chữ" onMouseDown={(e) => e.preventDefault()}>
              <span className="font-bold text-blue-600">A</span>
              <input
                type="color"
                className="w-5 h-5 rounded cursor-pointer border p-0 bg-transparent"
                value={textColor}
                onChange={(e) => { setTextColor(e.target.value); execCmd("foreColor", e.target.value); }}
              />
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-xs" title="Màu nền highlight" onMouseDown={(e) => e.preventDefault()}>
              <span className="bg-yellow-200 px-1 rounded font-medium text-black">A</span>
              <input
                type="color"
                className="w-5 h-5 rounded cursor-pointer border p-0 bg-transparent"
                value={bgColor}
                onChange={(e) => { setBgColor(e.target.value); execCmd("hiliteColor", e.target.value); }}
              />
            </label>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Căn trái" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("justifyLeft")}>
              <AlignLeft className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Căn giữa" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("justifyCenter")}>
              <AlignCenter className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Căn phải" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("justifyRight")}>
              <AlignRight className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Căn đều 2 bên" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("justifyFull")}>
              <AlignJustify className="size-4" />
            </Button>
          </div>

          {/* Line Height & Spacing */}
          <div className="flex items-center gap-1 border-r pr-1.5 mr-1">
            <Select onValueChange={setLineHeight}>
              <SelectTrigger className="h-8 w-28 text-xs bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()}><SelectValue placeholder="Giãn dòng" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">1.0 (Chặt)</SelectItem>
                <SelectItem value="1.15">1.15 (Standard)</SelectItem>
                <SelectItem value="1.5">1.5 (Vừa)</SelectItem>
                <SelectItem value="2.0">2.0 (Gấp đôi)</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={(v) => setParagraphSpacing(v as any)}>
              <SelectTrigger className="h-8 w-28 text-xs bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()}><SelectValue placeholder="Cách đoạn" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reset">Mặc định (0px)</SelectItem>
                <SelectItem value="before">Cách trên (14px)</SelectItem>
                <SelectItem value="after">Cách dưới (14px)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Danh sách chấm" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("insertUnorderedList")}>
              <List className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Danh sách số" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("insertOrderedList")}>
              <ListOrdered className="size-4" />
            </Button>
          </div>

          {/* Insert Table, HR, Image, PageBreak */}
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" className="h-8 px-2 text-xs gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={insertHeaderFooter} title="Chèn Đầu trang & Chân trang (Đánh số trang)">
              <PanelTop className="size-3.5 text-blue-600" />
              <span>Header & Footer</span>
            </Button>

            <Button size="sm" variant="outline" className="h-8 px-2 text-xs gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={insertTable} title="Chèn bảng mẫu">
              <TableIcon className="size-3.5 text-blue-600" />
              <span>Chèn bảng</span>
            </Button>

            <Button size="sm" variant="outline" className="h-8 px-2 text-xs gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => imageInputRef.current?.click()} title="Chèn logo hoặc ảnh">
              <ImageIcon className="size-3.5 text-purple-600" />
              <span>Chèn ảnh/Logo</span>
            </Button>
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleInsertImage} className="hidden" />

            <Button size="sm" variant="outline" className="h-8 px-2 text-xs gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={insertPageBreak} title="Chèn điểm ngắt trang A4">
              <Scissors className="size-3.5 text-amber-600" />
              <span>Ngắt trang</span>
            </Button>

            <Button size="sm" variant="outline" className="h-8 px-2 text-xs gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => execCmd("insertHorizontalRule")} title="Chèn đường kẻ ngang">
              <Minus className="size-3.5" />
              <span>Đường kẻ</span>
            </Button>
          </div>
        </div>

        {/* Row 2: Advanced Table Manipulation Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <TableIcon className="size-3.5 text-blue-600" />
            <span>Thao tác Bảng:</span>
          </span>

          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("row-above")}>
            <Rows3 className="size-3 text-blue-600" /> + Hàng trên
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("row-below")}>
            <Rows3 className="size-3 text-blue-600" /> + Hàng dưới
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("col-left")}>
            <Columns3 className="size-3 text-indigo-600" /> + Cột trái
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("col-right")}>
            <Columns3 className="size-3 text-indigo-600" /> + Cột phải
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("merge-right")} title="Gộp ô hiện tại với ô liền kề bên phải">
            <Combine className="size-3 text-emerald-600" /> Gộp ô
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 bg-white dark:bg-slate-950" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("split-cell")} title="Tách ô đã gộp trở lại">
            <Split className="size-3 text-emerald-600" /> Tách ô
          </Button>

          <div className="w-px h-4 bg-border mx-0.5" />

          <label className="flex items-center gap-1 cursor-pointer text-[11px] bg-white dark:bg-slate-950 border rounded px-2 h-7 font-medium" title="Đổi màu nền cho ô đang chọn" onMouseDown={(e) => e.preventDefault()}>
            <Palette className="size-3 text-amber-600" />
            <span>Màu ô</span>
            <input
              type="color"
              className="w-4 h-4 rounded cursor-pointer border p-0 bg-transparent"
              value={cellBgColor}
              onChange={(e) => { setCellBgColorState(e.target.value); setCellBgColor(e.target.value); }}
            />
          </label>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("del-row")}>
            <Trash2 className="size-3 text-destructive" /> Xóa hàng
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/40" onMouseDown={(e) => e.preventDefault()} onClick={() => handleTableAction("del-col")}>
            <Trash2 className="size-3 text-destructive" /> Xóa cột
          </Button>
        </div>

        {/* Row 3: Variable Quick Insert Chips & File Import */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Chèn biến nhanh:</span>
            </span>
            {variableBadges.map((b) => (
              <button
                key={b.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertVariable(b.key)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900 cursor-pointer"
                title={`Click để chèn {{${b.key}}}`}
              >
                <span>+</span>
                <span>{b.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()} className="h-7 text-[11px] gap-1 bg-white dark:bg-slate-950">
              <Upload className="size-3 text-slate-600" /> Nhập HTML
            </Button>
            <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleImportHtml} className="hidden" />

            <Button size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={() => docxInputRef.current?.click()} className="h-7 text-[11px] gap-1 bg-white dark:bg-slate-950">
              <FileType className="size-3 text-blue-600" /> Nhập Word (.docx)
            </Button>
            <input ref={docxInputRef} type="file" accept=".docx" onChange={handleImportDocx} className="hidden" />
          </div>
        </div>
      </div>

      {/* 3. Word A4 Paper Editor Canvas Workbench */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">Khung soạn thảo văn bản (Khổ giấy A4)</Label>
          <span className="text-[11px] text-muted-foreground">Kích thước chuẩn: 210mm x 297mm (Tự động mở rộng trang)</span>
        </div>

        <div className="overflow-y-auto rounded-lg border bg-slate-200/80 dark:bg-slate-950 p-6 md:p-8 max-h-[620px] min-h-[480px] flex flex-col items-center shadow-inner">
          <style>{`
            .tpl-a4-canvas {
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06) !important;
            }
            .tpl-a4-canvas ul {
              list-style-type: disc !important;
              padding-left: 1.75rem !important;
              margin-top: 0.5rem !important;
              margin-bottom: 0.5rem !important;
            }
            .tpl-a4-canvas ol {
              list-style-type: decimal !important;
              padding-left: 1.75rem !important;
              margin-top: 0.5rem !important;
              margin-bottom: 0.5rem !important;
            }
            .tpl-a4-canvas li {
              margin-bottom: 0.25rem !important;
            }
            .tpl-a4-canvas [data-page-break="true"],
            .tpl-a4-canvas [style*="page-break-before"] {
              display: block !important;
              page-break-before: always !important;
              margin: 32px -18mm 32px -18mm !important;
              padding: 10px 18mm !important;
              background: #f1f5f9 !important;
              border-top: 2px dashed #94a3b8 !important;
              border-bottom: 2px dashed #94a3b8 !important;
              text-align: center !important;
              font-size: 11px !important;
              font-weight: 600 !important;
              color: #475569 !important;
              user-select: none !important;
            }
          `}</style>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onSelect={saveSelection}
            onBlur={saveSelection}
            className="tpl-a4-canvas bg-white text-black outline-none border border-slate-300 rounded-sm shrink-0 transition-shadow focus:ring-2 focus:ring-blue-500/30"
            style={{
              width: "210mm",
              minHeight: "297mm",
              height: "auto",
              padding: "20mm 18mm",
              boxSizing: "border-box",
              fontFamily: "Arial, sans-serif",
              fontSize: "14px",
              lineHeight: "1.6",
              margin: "0 auto 24px auto",
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="is_default"
          checked={form.is_default}
          onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <Label htmlFor="is_default" className="text-xs font-medium cursor-pointer">Đặt làm mẫu mặc định cho loại tài liệu này</Label>
      </div>

      <DialogFooter className="pt-2 border-t flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button type="button" size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={handleExportTestPdf}>
            <Download className="size-3.5 text-red-600" /> Xuất thử PDF
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={handleExportTestWord}>
            <FileType className="size-3.5 text-blue-600" /> Xuất thử Word
          </Button>
        </div>
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          <Button variant="outline" className="h-9 text-xs" onClick={onCancel}>Hủy</Button>
          <Button className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-5" onClick={handleFinalSave} disabled={!form.id || !form.name}>
            {template ? "Cập nhật mẫu" : "Tạo mẫu mới"}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}
