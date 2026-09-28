"use client";
import { useEffect, useState, useRef } from "react";
import { supabase, loadSettings, clearSettingsCache, type AppSettings } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageLoading } from "@/components/loading";
import { Save, Building2, Hash, Settings2, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import { genId } from "@/lib/format";

const ID_PATTERN_VARS = [
  { token: "{PREFIX}", label: "Tiền tố", desc: "Mã tiền tố của từng loại chứng từ (BG, HD, TT, KH, ...)" },
  { token: "{YEAR}", label: "Năm", desc: "Năm hiện tại (vd: 2026)" },
  { token: "{DATE}", label: "Năm tháng ngày", desc: "Ngày hiện tại (vd: 20260924)" },
  { token: "{SEQ}", label: "Mã ngẫu nhiên", desc: "Chuỗi ngẫu nhiên 5 ký tự (vd: ABC12)" },
  { token: "{NUM}", label: "Số thứ tự", desc: "Số thứ tự tự tăng, 3 chữ số (vd: 001, 002, ...)" },
  { token: "{MKH}", label: "Mã khách hàng", desc: "Mã khách hàng được chọn khi tạo chứng từ (vd: KH001)" },
];

const PATTERN_PRESETS = [
  "{PREFIX}-{YEAR}-{SEQ}",
  "{PREFIX}-{DATE}-{SEQ}",
  "{PREFIX}-{SEQ}-{DATE}",
  "{PREFIX}-{SEQ}",
  "{PREFIX}{NUM}",
  "{PREFIX}-{YEAR}-{SEQ}-{MKH}",
];

function previewPattern(pattern: string, prefix: string): string {
  return genId(prefix, pattern || "{PREFIX}-{YEAR}-{SEQ}", 1, "KH001");
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [original, setOriginal] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = settings ? JSON.stringify(settings) !== original : false;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File quá lớn. Tối đa 2MB.");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (upErr) {
      toast.error("Lỗi tải lên logo");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    update("logo_url", urlData.publicUrl);
    setUploading(false);
    toast.success("Đã tải lên logo");
  };

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      setOriginal(JSON.stringify(s));
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      quote_prefix: settings.quote_prefix,
      contract_prefix: settings.contract_prefix,
      payment_prefix: settings.payment_prefix,
      customer_prefix: settings.customer_prefix,
      product_prefix: settings.product_prefix,
      inventory_prefix: settings.inventory_prefix,
      email_prefix: settings.email_prefix,
      company_name: settings.company_name,
      company_address: settings.company_address,
      company_phone: settings.company_phone,
      company_email: settings.company_email,
      company_tax: settings.company_tax,
      logo_url: settings.logo_url,
      currency: settings.currency,
      vat_default: settings.vat_default,
      quote_valid_days: settings.quote_valid_days,
      low_stock_alert: settings.low_stock_alert,
      id_format: settings.id_format,
    });
    setSaving(false);
    if (error) {
      toast.error("Lỗi lưu cài đặt: " + error.message);
      return;
    }
    clearSettingsCache();
    await loadSettings();
    window.dispatchEvent(new Event("app-settings-updated"));
    setOriginal(JSON.stringify(settings));
    toast.success("Đã lưu cài đặt thành công");
  };

  if (loading || !settings) {
    return <PageLoading text="Đang tải dữ liệu cài đặt..." />;
  }

  return (
    <div className="w-full space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Cài đặt hệ thống</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý thông tin doanh nghiệp, cấu hình tiền tố chứng từ và tham số mặc định.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="size-3.5" />
              Có thay đổi chưa lưu
            </span>
          )}
          <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2 shadow-xs">
            <Save className="size-4" />
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      {/* Grid Layout 2 Cột Cân Đối */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột Trái (6 Cột): Thông tin doanh nghiệp & Thiết lập mặc định */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Thông tin doanh nghiệp */}
          <Card className="shadow-2xs">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">Thông tin doanh nghiệp</CardTitle>
                  <CardDescription className="text-xs">Hiển thị trên báo giá, hợp đồng và hóa đơn</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 p-3 rounded-xl border bg-muted/30">
                <Label className="text-xs font-semibold">Logo doanh nghiệp</Label>
                <div className="flex items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background shadow-2xs">
                    {settings.logo_url ? (
                      <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Building2 className="size-6 text-muted-foreground opacity-50" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Upload className="size-3.5" /> {uploading ? "Đang tải..." : "Tải logo lên"}
                      </Button>
                      {settings.logo_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => update("logo_url", "")}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <X className="size-3.5" /> Xóa
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Hiển thị trên Sidebar và chứng từ. Tối đa 2MB.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tên doanh nghiệp / Công ty</Label>
                <Input
                  value={settings.company_name}
                  onChange={(e) => update("company_name", e.target.value)}
                  placeholder="Nhập tên doanh nghiệp"
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Địa chỉ trụ sở</Label>
                  <Input
                    value={settings.company_address}
                    onChange={(e) => update("company_address", e.target.value)}
                    placeholder="Địa chỉ công ty"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Số điện thoại liên hệ</Label>
                  <Input
                    value={settings.company_phone}
                    onChange={(e) => update("company_phone", e.target.value)}
                    placeholder="0901234567"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email liên hệ</Label>
                  <Input
                    type="email"
                    value={settings.company_email}
                    onChange={(e) => update("company_email", e.target.value)}
                    placeholder="contact@company.com"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Mã số thuế (MST)</Label>
                  <Input
                    value={settings.company_tax}
                    onChange={(e) => update("company_tax", e.target.value)}
                    placeholder="0101234567"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Thiết lập mặc định */}
          <Card className="shadow-2xs">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Settings2 className="size-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">Thiết lập tham số mặc định</CardTitle>
                  <CardDescription className="text-xs">Các giá trị áp dụng khi tạo mới chứng từ và kho</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">VAT mặc định (%)</Label>
                  <Input
                    type="number"
                    value={settings.vat_default}
                    onChange={(e) => update("vat_default", +e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Hiệu lực BG (ngày)</Label>
                  <Input
                    type="number"
                    value={settings.quote_valid_days}
                    onChange={(e) => update("quote_valid_days", +e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Đơn vị tiền tệ</Label>
                  <Input
                    value={settings.currency}
                    onChange={(e) => update("currency", e.target.value)}
                    placeholder="VND"
                    className="h-9 text-sm font-semibold"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold cursor-pointer">Cảnh báo tồn kho thấp</Label>
                  <p className="text-[11px] text-muted-foreground">Tự động thông báo khi tồn kho sản phẩm chạm mức tối thiểu</p>
                </div>
                <Switch
                  checked={settings.low_stock_alert}
                  onCheckedChange={(v) => update("low_stock_alert", v)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cột Phải (6 Cột): Single Gộp Card (Mã chứng từ & Quy tắc sinh mã) */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="shadow-2xs">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Hash className="size-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">Mã chứng từ & Quy tắc sinh mã</CardTitle>
                  <CardDescription className="text-xs">Cấu hình tiền tố và quy tắc định dạng chuỗi sinh mã tự động</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tiền tố các loại chứng từ (7 items trong 4 cols grid) */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Tiền tố các loại chứng từ</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <PrefixField label="Báo giá" value={settings.quote_prefix} onChange={(v) => update("quote_prefix", v)} placeholder="BG" />
                  <PrefixField label="Hợp đồng" value={settings.contract_prefix} onChange={(v) => update("contract_prefix", v)} placeholder="HD" />
                  <PrefixField label="Thanh toán" value={settings.payment_prefix} onChange={(v) => update("payment_prefix", v)} placeholder="TT" />
                  <PrefixField label="Khách hàng" value={settings.customer_prefix} onChange={(v) => update("customer_prefix", v)} placeholder="KH" />
                  <PrefixField label="Sản phẩm" value={settings.product_prefix} onChange={(v) => update("product_prefix", v)} placeholder="SP" />
                  <PrefixField label="Nhập kho" value={settings.inventory_prefix} onChange={(v) => update("inventory_prefix", v)} placeholder="NK" />
                  <PrefixField label="Email" value={settings.email_prefix} onChange={(v) => update("email_prefix", v)} placeholder="EM" />
                </div>
              </div>

              <Separator />

              {/* Định dạng pattern & Badges */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Cấu trúc định dạng mẫu mã</Label>
                    <span className="text-[11px] text-muted-foreground font-mono">{settings.id_format}</span>
                  </div>
                  <Input
                    value={settings.id_format}
                    onChange={(e) => update("id_format", e.target.value)}
                    className="font-mono text-sm font-semibold h-9 tracking-wide bg-background"
                    placeholder="{PREFIX}-{DATE}-{SEQ}"
                  />
                </div>

                {/* Badges biến tự động (đã xóa {YEAR}) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Thêm nhanh biến tự động:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ID_PATTERN_VARS.map((v) => (
                      <Badge
                        key={v.token}
                        variant="secondary"
                        className="cursor-pointer font-mono text-[11px] px-2 py-0.5 hover:bg-primary/20 hover:text-primary transition-colors"
                        title={v.desc}
                        onClick={() => update("id_format", settings.id_format + v.token)}
                      >
                        + {v.token} <span className="ml-1 text-muted-foreground font-normal">({v.label})</span>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Mẫu phổ biến */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Mẫu phổ biến gợi ý:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PATTERN_PRESETS.map((p) => (
                      <Button
                        key={p}
                        type="button"
                        variant={settings.id_format === p ? "default" : "outline"}
                        size="sm"
                        className="font-mono text-[11px] h-6 px-2"
                        onClick={() => update("id_format", p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Box xem trước mẫu thực tế */}
                <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Mẫu mã thực tế sẽ sinh ra:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    {([
                      ["quote_prefix", "Báo giá"],
                      ["contract_prefix", "Hợp đồng"],
                      ["payment_prefix", "Thanh toán"],
                      ["customer_prefix", "Khách hàng"],
                      ["product_prefix", "Sản phẩm"],
                      ["inventory_prefix", "Nhập kho"],
                      ["email_prefix", "Email"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1 text-xs">
                        <span className="text-muted-foreground text-[11px] font-medium">{label}:</span>
                        <code className="font-mono font-bold text-primary text-xs">
                          {previewPattern(settings.id_format, settings[key] as string)}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PrefixField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 5))}
        placeholder={placeholder}
        className="font-mono uppercase h-8.5 text-xs font-bold text-foreground"
      />
    </div>
  );
}
