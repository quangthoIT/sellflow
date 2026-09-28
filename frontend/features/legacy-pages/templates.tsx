import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, type Template } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Lock, Unlock, Eye, Star, X, Upload, AlignJustify, FileType } from "lucide-react";
import { toast } from "sonner";
import mammoth from "mammoth";

const ALLOWED_TAGS = new Set([
  "P", "DIV", "SPAN", "BR", "STRONG", "B", "EM", "I", "U", "S", "STRIKE", "DEL", "INS", "SUB", "SUP",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "CAPTION", "COLGROUP", "COL",
  "IMG", "A", "BLOCKQUOTE", "HR", "PRE", "CODE", "MARK", "SMALL", "FONT", "CENTER",
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
  "SO_TAI_LIEU", "NGAY", "TEN_KHACH_HANG", "DIA_CHI_KHACH_HANG", "MST_KHACH_HANG",
  "BANG_SAN_PHAM", "TAM_TINH", "VAT", "TONG_TIEN", "DA_THANH_TOAN", "CON_PHAI_THU",
  "SO_HOP_DONG", "SO_BAO_GIA", "DIEU_KHOAN_THANH_TOAN",
];

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("templates").select("*").order("type").order("name");
    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (t: Partial<Template>) => {
    if (editing) {
      if (editing.locked) { toast.error("Mẫu đã khóa, không thể sửa"); return; }
      if (t.is_default) {
        await supabase.from("templates").update({ is_default: false }).eq("type", editing.type);
      }
      const { error } = await supabase.from("templates").update(t).eq("id", editing.id);
      if (error) { toast.error("Lỗi cập nhật"); return; }
      toast.success("Đã cập nhật mẫu");
    } else {
      if (t.is_default) {
        await supabase.from("templates").update({ is_default: false }).eq("type", t.type);
      }
      const { error } = await supabase.from("templates").insert(t);
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
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) { toast.error("Lỗi xóa"); return; }
    toast.success("Đã xóa mẫu");
    load();
  };

  const toggleLock = async (t: Template) => {
    const { error } = await supabase.from("templates").update({ locked: !t.locked }).eq("id", t.id);
    if (error) { toast.error("Lỗi"); return; }
    toast.success(t.locked ? "Đã mở khóa mẫu" : "Đã khóa mẫu");
    load();
  };

  const setDefault = async (t: Template) => {
    await supabase.from("templates").update({ is_default: false }).eq("type", t.type);
    const { error } = await supabase.from("templates").update({ is_default: true }).eq("id", t.id);
    if (error) { toast.error("Lỗi"); return; }
    toast.success("Đã đặt làm mẫu mặc định");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} mẫu tài liệu</p>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="size-4" /> Thêm mẫu
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên mẫu</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Mặc định</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              )}
              {templates.map((t) => (
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
                      <Button size="sm" variant="ghost" onClick={() => setDefault(t)} title="Đặt mặc định">
                        <Star className="size-3.5 text-muted-foreground" />
                      </Button>
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
                      <Button size="sm" variant="ghost" onClick={() => setPreview(t)} title="Xem trước"><Eye className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setShowForm(true); }} title="Sửa" disabled={t.locked}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleLock(t)} title={t.locked ? "Mở khóa" : "Khóa mẫu"}>
                        {t.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} title="Xóa" disabled={t.locked}>
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

      {/* Editor */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Sửa mẫu: ${editing.name}` : "Tạo mẫu mới"}</DialogTitle>
          </DialogHeader>
          <TemplateForm template={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Xem trước: {preview?.name}</span>
              <Button variant="ghost" size="icon" onClick={() => setPreview(null)}><X className="size-4" /></Button>
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="rounded-lg border bg-white p-8 text-black">
              <div dangerouslySetInnerHTML={{ __html: preview.content }} />
            </div>
          )}
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
  const [form, setForm] = useState({
    id: template?.id ?? "",
    type: template?.type ?? "quote",
    name: template?.name ?? "",
    is_default: template?.is_default ?? false,
    paper: template?.paper ?? "A4",
    locked: false,
    content: template?.content ?? "",
  });

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    const el = document.getElementById("tpl-editor") as HTMLDivElement;
    if (el) setForm({ ...form, content: el.innerHTML });
  };

  const insertVariable = (v: string) => {
    document.execCommand("insertText", false, `{{${v}}}`);
    const el = document.getElementById("tpl-editor") as HTMLDivElement;
    if (el) setForm({ ...form, content: el.innerHTML });
  };

  const onInput = () => {
    const el = document.getElementById("tpl-editor") as HTMLDivElement;
    if (el) setForm({ ...form, content: el.innerHTML });
  };

  const applyImportedHtml = (html: string, filename: string) => {
    const clean = sanitizeHtml(html);
    setForm({ ...form, content: clean });
    const el = document.getElementById("tpl-editor") as HTMLDivElement;
    if (el) el.innerHTML = clean;
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Mã mẫu</Label>
          <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!template} />
        </div>
        <div className="space-y-1.5">
          <Label>Tên mẫu</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Loại mẫu</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-2 rounded-lg border bg-muted/50 p-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => execCmd("bold")} className="h-8 w-8 justify-center font-bold">B</Button>
          <Button size="sm" variant="ghost" onClick={() => execCmd("italic")} className="h-8 w-8 justify-center italic">I</Button>
          <Button size="sm" variant="ghost" onClick={() => execCmd("underline")} className="h-8 w-8 justify-center underline">U</Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant="ghost" onClick={() => execCmd("justifyLeft")} className="h-8">Trái</Button>
          <Button size="sm" variant="ghost" onClick={() => execCmd("justifyCenter")} className="h-8">Giữa</Button>
          <Button size="sm" variant="ghost" onClick={() => execCmd("justifyRight")} className="h-8">Phải</Button>
          <Button size="sm" variant="ghost" onClick={() => execCmd("justifyFull")} className="h-8 gap-1.5">
            <AlignJustify className="size-3.5" /> Đều
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant="ghost" onClick={() => execCmd("insertUnorderedList")} className="h-8">Danh sách</Button>
          <Button size="sm" variant="ghost" onClick={() => execCmd("insertOrderedList")} className="h-8">Số</Button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Select onValueChange={(v) => execCmd("fontSize", v)}>
            <SelectTrigger className="h-8 w-24"><SelectValue placeholder="Cỡ chữ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">12px</SelectItem>
              <SelectItem value="3">14px</SelectItem>
              <SelectItem value="4">16px</SelectItem>
              <SelectItem value="5">18px</SelectItem>
              <SelectItem value="6">24px</SelectItem>
              <SelectItem value="7">32px</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => execCmd("fontName", v)}>
            <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Font" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Arial">Arial</SelectItem>
              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
              <SelectItem value="Calibri">Calibri</SelectItem>
              <SelectItem value="Courier New">Courier New</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-px h-6 bg-border mx-1" />
          <Select onValueChange={insertVariable}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Chèn biến" /></SelectTrigger>
            <SelectContent>
              {VARIABLES.map((v) => <SelectItem key={v} value={v}>{`{{${v}}}`}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} className="h-8 gap-1.5">
            <Upload className="size-3.5" /> Nhập HTML
          </Button>
          <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleImportHtml} className="hidden" />
          <Button size="sm" variant="ghost" onClick={() => docxInputRef.current?.click()} className="h-8 gap-1.5">
            <FileType className="size-3.5" /> Nhập Word
          </Button>
          <input ref={docxInputRef} type="file" accept=".docx" onChange={handleImportDocx} className="hidden" />
        </div>
      </div>

      {/* Editor area */}
      <div className="space-y-1.5">
        <Label>Nội dung mẫu (A4)</Label>
        <div className="overflow-auto rounded-lg border bg-white p-4" style={{ maxHeight: "400px" }}>
          <div
            id="tpl-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={onInput}
            className="mx-auto min-h-[300px] text-black outline-none"
            style={{ width: "100%", maxWidth: "210mm", minHeight: "297mm", padding: "20mm" }}
            dangerouslySetInnerHTML={{ __html: form.content }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_default"
          checked={form.is_default}
          onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
        />
        <Label htmlFor="is_default" className="cursor-pointer">Đặt làm mẫu mặc định</Label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Hủy</Button>
        <Button onClick={() => onSave(form)} disabled={!form.id || !form.name}>
          {template ? "Cập nhật" : "Tạo mẫu"}
        </Button>
      </DialogFooter>
    </div>
  );
}
