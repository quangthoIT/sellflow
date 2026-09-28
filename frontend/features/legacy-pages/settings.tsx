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
import { Save, Building2, Hash, Settings2, Upload, X } from "lucide-react";
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
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
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
    toast.success("Đã lưu cài đặt");
  };

  if (loading || !settings) {
    return <div className="py-20 text-center text-muted-foreground">Đang tải cài đặt...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Company info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">Thông tin doanh nghiệp</CardTitle>
              <CardDescription>Hiển thị trên báo giá, hợp đồng và email</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo doanh nghiệp</Label>
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="size-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="size-3.5" /> {uploading ? "Đang tải..." : "Tải lên"}
                </Button>
                {settings.logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update("logo_url", "")}
                  >
                    <X className="size-3.5" /> Xóa
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Hiển thị trên thanh menu thay cho icon SellFlow. Tối đa 2MB.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Tên doanh nghiệp</Label>
            <Input value={settings.company_name} onChange={(e) => update("company_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Địa chỉ</Label>
              <Input value={settings.company_address} onChange={(e) => update("company_address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input value={settings.company_phone} onChange={(e) => update("company_phone", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={settings.company_email} onChange={(e) => update("company_email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mã số thuế</Label>
              <Input value={settings.company_tax} onChange={(e) => update("company_tax", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Code prefixes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Hash className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">Mã chứng từ</CardTitle>
              <CardDescription>Tiền tố dùng khi tự động sinh mã cho các loại chứng từ</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <PrefixField label="Báo giá" value={settings.quote_prefix} onChange={(v) => update("quote_prefix", v)} placeholder="BG" />
            <PrefixField label="Hợp đồng" value={settings.contract_prefix} onChange={(v) => update("contract_prefix", v)} placeholder="HD" />
            <PrefixField label="Thanh toán" value={settings.payment_prefix} onChange={(v) => update("payment_prefix", v)} placeholder="TT" />
            <PrefixField label="Khách hàng" value={settings.customer_prefix} onChange={(v) => update("customer_prefix", v)} placeholder="KH" />
            <PrefixField label="Sản phẩm" value={settings.product_prefix} onChange={(v) => update("product_prefix", v)} placeholder="SP" />
            <PrefixField label="Nhập kho" value={settings.inventory_prefix} onChange={(v) => update("inventory_prefix", v)} placeholder="NK" />
            <PrefixField label="Email" value={settings.email_prefix} onChange={(v) => update("email_prefix", v)} placeholder="EM" />
          </div>
          <Separator />
          <div className="space-y-3">
            <div>
              <Label>Mẫu mã chứng từ</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dùng các biến bên dưới để tự xếp thứ tự. Bấm vào biến để thêm vào cuối mẫu hoặc gõ trực tiếp.
              </p>
            </div>
            <Input
              value={settings.id_format}
              onChange={(e) => update("id_format", e.target.value)}
              className="font-mono text-sm"
              placeholder="{PREFIX}-{YEAR}-{SEQ}"
            />
            <div className="flex flex-wrap gap-2">
              {ID_PATTERN_VARS.map((v) => (
                <Badge
                  key={v.token}
                  variant="secondary"
                  className="cursor-pointer font-mono text-xs hover:bg-accent"
                  title={v.desc}
                  onClick={() => update("id_format", settings.id_format + v.token)}
                >
                  {v.token} <span className="ml-1 text-muted-foreground">{v.label}</span>
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {PATTERN_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant={settings.id_format === p ? "default" : "outline"}
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => update("id_format", p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-2">Xem trước với các tiền tố:</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {([
                  ["quote_prefix", "Báo giá"],
                  ["contract_prefix", "Hợp đồng"],
                  ["payment_prefix", "Thanh toán"],
                  ["customer_prefix", "Khách hàng"],
                  ["product_prefix", "Sản phẩm"],
                  ["inventory_prefix", "Nhập kho"],
                  ["email_prefix", "Email"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-muted-foreground">{label}:</span>
                    <code className="font-mono text-xs font-bold text-primary">
                      {previewPattern(settings.id_format, settings[key] as string)}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operational defaults */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">Thiết lập mặc định</CardTitle>
              <CardDescription>Các giá trị áp dụng tự động khi tạo mới</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>VAT mặc định (%)</Label>
              <Input type="number" value={settings.vat_default} onChange={(e) => update("vat_default", +e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hiệu lực báo giá (ngày)</Label>
              <Input type="number" value={settings.quote_valid_days} onChange={(e) => update("quote_valid_days", +e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Đơn vị tiền tệ</Label>
              <Input value={settings.currency} onChange={(e) => update("currency", e.target.value)} />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Cảnh báo tồn kho thấp</Label>
              <p className="text-xs text-muted-foreground">Hiển thị sản phẩm sắp hết hàng trên Tổng quan</p>
            </div>
            <Switch checked={settings.low_stock_alert} onCheckedChange={(v) => update("low_stock_alert", v)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          <Save className="size-4" /> {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </Button>
      </div>
    </div>
  );
}

function PrefixField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 5))}
        placeholder={placeholder}
        className="font-mono uppercase"
      />
    </div>
  );
}
