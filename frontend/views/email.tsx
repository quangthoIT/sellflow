"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { db, type EmailSettings, type EmailLog } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Mail, CheckCircle, XCircle, Send, Server, ShieldCheck, HelpCircle, ExternalLink, KeyRound, BookOpen, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading";
import { SortableHead, sortData, filterData, type SortDir } from "@/components/sortable-head";

const defaultEmailSettings: EmailSettings = {
  id: 1,
  sender_name: "SellFlow Admin",
  sender_email: "admin@sellflow.com",
  reply_to: "support@sellflow.com",
  auto_send_signed: false,
  attach_pdf: true,
  subject: "Thông báo hợp đồng số {{SO_HOP_DONG}} - {{TEN_KHACH_HANG}}",
  body: `Kính gửi {{TEN_KHACH_HANG}},

Chúng tôi xin gửi thông tin chi tiết hợp đồng dịch vụ số {{SO_HOP_DONG}}.
- Tổng giá trị: {{TONG_TIEN}}
- Đã thanh toán: {{DA_THANH_TOAN}}
- Còn phải thanh toán: {{CON_PHAI_THU}}

Chi tiết điều khoản và chứng từ đã được đính kèm trong tệp PDF đi kèm.
Nếu có bất kỳ thắc mắc nào, xin vui lòng phản hồi lại email này.

Trân trọng,
Đội ngũ SellFlow`,
  created_at: new Date().toISOString(),
};

interface FormState {
  sender_name: string;
  sender_email: string;
  reply_to: string;
  auto_send_signed: boolean;
  attach_pdf: boolean;
  subject: string;
  body: string;
  smtp_host: string;
  smtp_port: string;
  smtp_password: string;
}

export function EmailPage() {
  const [settings, setSettings] = useState<EmailSettings>(defaultEmailSettings);
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testEmailInput, setTestEmailInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [initialState, setInitialState] = useState<FormState | null>(null);

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [s, l] = await Promise.all([
      db.from("email_settings").select("*").eq("id", 1).maybeSingle(),
      db.from("email_logs").select("*").order("sent_at", { ascending: false }),
    ]);

    let localSettings: any = {};
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("sellflow_email_settings");
        if (raw) localSettings = JSON.parse(raw);
      } catch (e) {}
    }

    const merged = { ...defaultEmailSettings, ...(s.data || {}), ...localSettings };

    const loadedSettings: EmailSettings = {
      id: 1,
      sender_name: merged.sender_name ?? defaultEmailSettings.sender_name,
      sender_email: merged.sender_email ?? defaultEmailSettings.sender_email,
      reply_to: merged.reply_to ?? defaultEmailSettings.reply_to,
      auto_send_signed: merged.auto_send_signed ?? defaultEmailSettings.auto_send_signed,
      attach_pdf: merged.attach_pdf ?? defaultEmailSettings.attach_pdf,
      subject: merged.subject ?? defaultEmailSettings.subject,
      body: merged.body ?? defaultEmailSettings.body,
    };

    const host = merged.smtp_host || "smtp.gmail.com";
    const port = String(merged.smtp_port || "587");
    const pass = merged.smtp_password || "";

    setSettings(loadedSettings);
    setSmtpHost(host);
    setSmtpPort(port);
    setSmtpPassword(pass);

    setInitialState({
      sender_name: loadedSettings.sender_name,
      sender_email: loadedSettings.sender_email,
      reply_to: loadedSettings.reply_to,
      auto_send_signed: loadedSettings.auto_send_signed,
      attach_pdf: loadedSettings.attach_pdf,
      subject: loadedSettings.subject,
      body: loadedSettings.body,
      smtp_host: host,
      smtp_port: port,
      smtp_password: pass,
    });

    setLogs((l.data ?? []) as EmailLog[]);
    setLoading(false);
  }, []);

  const isDirty = useMemo(() => {
    if (!initialState) return false;
    return (
      settings.sender_name !== initialState.sender_name ||
      settings.sender_email !== initialState.sender_email ||
      settings.reply_to !== initialState.reply_to ||
      settings.auto_send_signed !== initialState.auto_send_signed ||
      settings.attach_pdf !== initialState.attach_pdf ||
      settings.subject !== initialState.subject ||
      settings.body !== initialState.body ||
      smtpHost !== initialState.smtp_host ||
      smtpPort !== initialState.smtp_port ||
      smtpPassword !== initialState.smtp_password
    );
  }, [settings, smtpHost, smtpPort, smtpPassword, initialState]);

  const colFilters = [
    { key: (l: EmailLog) => formatDateTime(l.sent_at), value: filters.sent_at ?? "" },
    { key: (l: EmailLog) => l.customer_name || "", value: filters.customer_name ?? "" },
    { key: (l: EmailLog) => l.contract_id || "", value: filters.contract_id ?? "" },
    { key: (l: EmailLog) => l.recipient, value: filters.recipient ?? "" },
    { key: (l: EmailLog) => (l.automatic ? "Tự động" : "Thủ công"), value: filters.automatic ?? "" },
    { key: (l: EmailLog) => l.status, value: filters.status ?? "" },
  ];

  const filteredLogs = filterData(logs, colFilters as any);

  const sortedLogs = (() => {
    if (!sortKey || !sortDir) return filteredLogs;
    const accessor: Record<string, (l: EmailLog) => string | number> = {
      sent_at: (l) => l.sent_at,
      customer_name: (l) => l.customer_name || "",
      contract_id: (l) => l.contract_id || "",
      recipient: (l) => l.recipient,
      automatic: (l) => (l.automatic ? 1 : 0),
      status: (l) => l.status,
    };
    return sortData(filteredLogs, accessor[sortKey] ?? ((l) => l.sent_at), sortDir);
  })();

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const payload = {
      id: 1,
      sender_name: settings.sender_name.trim(),
      sender_email: settings.sender_email.trim(),
      reply_to: settings.reply_to.trim(),
      auto_send_signed: settings.auto_send_signed,
      attach_pdf: settings.attach_pdf,
      subject: settings.subject,
      body: settings.body,
      smtp_host: smtpHost.trim(),
      smtp_port: smtpPort.trim(),
      smtp_password: smtpPassword.trim(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("sellflow_email_settings", JSON.stringify(payload));
    }

    const { error } = await db.from("email_settings").upsert(payload);
    setSaving(false);
    if (error) {
      toast.error("Lỗi lưu cấu hình: " + error.message);
      return;
    }

    setInitialState({
      sender_name: payload.sender_name,
      sender_email: payload.sender_email,
      reply_to: payload.reply_to,
      auto_send_signed: payload.auto_send_signed,
      attach_pdf: payload.attach_pdf,
      subject: payload.subject,
      body: payload.body,
      smtp_host: payload.smtp_host,
      smtp_port: payload.smtp_port,
      smtp_password: payload.smtp_password,
    });

    toast.success("Đã lưu cấu hình email thành công");
  };

  const handleTestEmail = async () => {
    const targetEmail = testEmailInput.trim();
    if (!targetEmail) {
      toast.error("Vui lòng nhập email nhận thử nghiệm");
      return;
    }
    if (!settings.sender_email.trim() || settings.sender_email === "admin@sellflow.com") {
      toast.error("Vui lòng nhập Email người gửi (địa chỉ Gmail của bạn) ở phần bên dưới");
      return;
    }
    if (!smtpPassword.trim()) {
      toast.error("Vui lòng nhập Mật khẩu ứng dụng (16 ký tự do Google cấp)");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("http://localhost:4000/api/emails/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          otp: Math.floor(100000 + Math.random() * 900000).toString(),
          smtpOptions: {
            host: smtpHost.trim() || "smtp.gmail.com",
            port: Number(smtpPort.trim() || 587),
            user: settings.sender_email.trim(),
            pass: smtpPassword.trim().replace(/\s+/g, ""),
            senderName: settings.sender_name.trim() || "SellFlow Support",
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Đã gửi email thử nghiệm thành công tới ${targetEmail}!`);
        load();
      } else {
        toast.error(data.message || "Lỗi gửi email thử nghiệm. Vui lòng kiểm tra lại Email người gửi và Mật khẩu ứng dụng.");
      }
    } catch (err: any) {
      toast.error("Không thể kết nối đến máy chủ gửi email: " + (err.message || "Lỗi mạng"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs" className="gap-2">
            <Mail className="size-4" /> Lịch sử gửi
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Server className="size-4" /> Cấu hình email
            {isDirty && <span className="size-2 rounded-full bg-amber-500 animate-pulse" />}
          </TabsTrigger>
        </TabsList>

        {/* Email Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lịch sử gửi email ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Thời gian" sortDir={sortKey === "sent_at" ? sortDir : null} onSort={(d) => { setSortKey("sent_at"); setSortDir(d); }} filter={{ type: "text", value: filters.sent_at ?? "", placeholder: "Lọc thời gian..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, sent_at: v }))} />
                    <SortableHead label="Khách hàng" sortDir={sortKey === "customer_name" ? sortDir : null} onSort={(d) => { setSortKey("customer_name"); setSortDir(d); }} filter={{ type: "text", value: filters.customer_name ?? "", placeholder: "Lọc khách hàng..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, customer_name: v }))} />
                    <SortableHead label="Số hợp đồng" sortDir={sortKey === "contract_id" ? sortDir : null} onSort={(d) => { setSortKey("contract_id"); setSortDir(d); }} filter={{ type: "text", value: filters.contract_id ?? "", placeholder: "Lọc HĐ..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, contract_id: v }))} />
                    <SortableHead label="Người nhận" sortDir={sortKey === "recipient" ? sortDir : null} onSort={(d) => { setSortKey("recipient"); setSortDir(d); }} filter={{ type: "text", value: filters.recipient ?? "", placeholder: "Lọc người nhận..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, recipient: v }))} />
                    <SortableHead label="Loại" sortDir={sortKey === "automatic" ? sortDir : null} onSort={(d) => { setSortKey("automatic"); setSortDir(d); }} filter={{ type: "select", value: filters.automatic ?? "", options: [{ label: "Tất cả", value: "" }, { label: "Tự động", value: "Tự động" }, { label: "Thủ công", value: "Thủ công" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, automatic: v }))} />
                    <SortableHead label="Trạng thái" sortDir={sortKey === "status" ? sortDir : null} onSort={(d) => { setSortKey("status"); setSortDir(d); }} filter={{ type: "select", value: filters.status ?? "", options: [{ label: "Tất cả", value: "" }, { label: "Thành công", value: "sent" }, { label: "Thất bại", value: "failed" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton rows={5} columns={6} />
                  ) : sortedLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          icon={Mail}
                          title="Chưa có email nào được gửi"
                          description="Lịch sử gửi email báo giá và hợp đồng sẽ tự động hiển thị tại đây."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.sent_at)}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {log.customer_name || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {log.contract_id || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.recipient}</TableCell>
                        <TableCell>
                          <Badge variant={log.automatic ? "default" : "secondary"} className="text-xs">
                            {log.automatic ? "Tự động" : "Thủ công"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.status === "sent" ? (
                            <Badge variant="outline" className="gap-1 text-xs border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30">
                              <CheckCircle className="size-3" /> Đã gửi
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-xs border-red-300 text-red-700 bg-red-50 dark:bg-red-950/30">
                              <XCircle className="size-3" /> Thất bại
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="settings" className="space-y-6 pt-2">
          {/* Section 1: Server SMTP Settings */}
          <Card className="shadow-2xs">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Server className="size-4.5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Máy chủ gửi thư SMTP</CardTitle>
                    <CardDescription className="text-xs">Cấu hình thông số kết nối máy chủ gửi mail của hệ thống</CardDescription>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGuide(true)}
                  className="h-8 text-xs gap-1.5 border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 font-medium w-full sm:w-auto"
                >
                  <HelpCircle className="size-3.5 text-blue-600 dark:text-blue-400" />
                  Hướng dẫn lấy thông tin
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">SMTP Server Host</Label>
                  <Input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">SMTP Port</Label>
                  <Input
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="h-9 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Mật khẩu ứng dụng (App Password)</Label>
                  <Input
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Test Email Connection Box */}
              <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Gửi email thử nghiệm kết nối (Test Connection)
                </Label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <Input
                    type="email"
                    value={testEmailInput}
                    onChange={(e) => setTestEmailInput(e.target.value)}
                    placeholder="Nhập email nhận thử nghiệm (ví dụ: test@gmail.com)"
                    className="h-9 text-sm bg-background flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestEmail}
                    disabled={testing}
                    className="gap-2 h-9 text-xs w-full sm:w-auto shrink-0"
                  >
                    <Send className="size-3.5" />
                    {testing ? "Đang gửi..." : "Gửi thử nghiệm"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Sender Info & Templates */}
          <Card className="shadow-2xs">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Mail className="size-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">Mẫu Email & Tự động hóa</CardTitle>
                  <CardDescription className="text-xs">Thiết lập tiêu đề, nội dung mẫu và quy tắc tự động gửi</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tên người gửi</Label>
                  <Input
                    value={settings.sender_name}
                    onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email người gửi</Label>
                  <Input
                    type="email"
                    value={settings.sender_email}
                    onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email phản hồi (Reply-To)</Label>
                  <Input
                    type="email"
                    value={settings.reply_to}
                    onChange={(e) => setSettings({ ...settings, reply_to: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Tiêu đề email mẫu</Label>
                </div>
                <Input
                  value={settings.subject}
                  onChange={(e) => setSettings({ ...settings, subject: e.target.value })}
                  className="h-9 text-sm font-medium"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Gợi ý biến số:</span>
                  {["{{SO_HOP_DONG}}", "{{TEN_KHACH_HANG}}", "{{TONG_TIEN}}", "{{DA_THANH_TOAN}}", "{{CON_PHAI_THU}}"].map((b) => (
                    <Badge
                      key={b}
                      variant="secondary"
                      className="cursor-pointer font-mono text-[11px] hover:bg-primary/20 hover:text-primary transition-colors"
                      onClick={() => setSettings({ ...settings, subject: settings.subject + " " + b })}
                    >
                      + {b}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nội dung email mẫu</Label>
                <Textarea
                  value={settings.body}
                  onChange={(e) => setSettings({ ...settings, body: e.target.value })}
                  rows={7}
                  className="font-sans text-sm leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border bg-muted/20 gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    id="auto-send"
                    checked={settings.auto_send_signed}
                    onCheckedChange={(v) => setSettings({ ...settings, auto_send_signed: v })}
                  />
                  <Label htmlFor="auto-send" className="text-xs font-medium cursor-pointer">
                    Tự động gửi email khi hợp đồng được xác nhận ký
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="attach-pdf"
                    checked={settings.attach_pdf}
                    onCheckedChange={(v) => setSettings({ ...settings, attach_pdf: v })}
                  />
                  <Label htmlFor="attach-pdf" className="text-xs font-medium cursor-pointer">
                    Đính kèm tệp PDF chứng từ
                  </Label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t mt-4">
                <div className="text-xs text-muted-foreground">
                  {isDirty ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500 animate-ping inline-block" />
                      Có thay đổi chưa lưu
                    </span>
                  ) : (
                    <span>Cấu hình hiện tại đã được lưu</span>
                  )}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="gap-2 shadow-xs transition-all"
                >
                  <Save className="size-4" />
                  {saving ? "Đang lưu..." : isDirty ? "Lưu cấu hình email" : "Đã lưu"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Step-by-Step Configuration Guide Dialog */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-xl max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <BookOpen className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Hướng dẫn cấu hình gửi Email qua Gmail</DialogTitle>
                <DialogDescription className="text-xs">Dành cho người mới - Chỉ cần thực hiện 1 lần duy nhất trong 2 phút</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Step 1 */}
            <div className="flex gap-3 p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-900">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs">
                1
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="font-semibold text-sm text-foreground">Bật Xác minh 2 bước trên Google Account</div>
                <p className="text-muted-foreground leading-relaxed">
                  Để bảo vệ tài khoản, Google yêu cầu tài khoản Gmail gửi thư phải bật <strong>Xác minh 2 bước (2-Step Verification)</strong> trước khi cho phép tạo mật khẩu ứng dụng.
                </p>
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium hover:underline pt-0.5"
                >
                  <ExternalLink className="size-3" /> Mở trang Bảo mật Google Account
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900/60">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs">
                2
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="font-semibold text-sm text-foreground">Tạo Mật khẩu ứng dụng (App Password)</div>
                <p className="text-muted-foreground leading-relaxed">
                  Truy cập trang tạo mật khẩu ứng dụng chuyên dụng của Google:
                </p>
                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-md border font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                  <div>1. Đặt tên ứng dụng: <strong>SellFlow</strong></div>
                  <div>2. Nhấn nút <strong>Tạo (Create)</strong></div>
                  <div>3. Google sẽ cấp cho bạn một chuỗi <strong>16 ký tự màu vàng</strong> (ví dụ: <code className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1 py-0.5 rounded font-bold">abcd efgh ijkl mnop</code>). Hãy sao chép chuỗi này.</div>
                </div>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold hover:underline pt-1"
                >
                  <KeyRound className="size-3.5" /> Mở trang tạo Google App Password
                </a>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3 p-3.5 rounded-xl border bg-slate-50 dark:bg-slate-900">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs">
                3
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="font-semibold text-sm text-foreground">Điền thông tin vào SellFlow & Lưu</div>
                <p className="text-muted-foreground leading-relaxed">
                  Quay lại tab <strong>Cấu hình email</strong> và điền các trường:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li><strong>SMTP Host:</strong> <code className="text-foreground font-mono">smtp.gmail.com</code> (đã điền sẵn)</li>
                  <li><strong>SMTP Port:</strong> <code className="text-foreground font-mono">587</code> (đã điền sẵn)</li>
                  <li><strong>Email người gửi:</strong> Nhập địa chỉ Gmail của bạn</li>
                  <li><strong>Mật khẩu ứng dụng:</strong> Dán 16 ký tự vừa sao chép ở Bước 2</li>
                </ul>
                <p className="text-muted-foreground pt-1">
                  Sau đó bấm <strong>Lưu cấu hình email</strong>. Bạn có thể nhập email vào ô thử nghiệm bên dưới để kiểm tra gửi ngay.
                </p>
              </div>
            </div>

            {/* Security Note */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 flex items-start gap-2.5 text-[11px] text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý quan trọng:</strong> Mật khẩu ứng dụng là mật khẩu bảo mật riêng biệt Google cấp cho phần mềm. Tuyệt đối <strong>KHÔNG</strong> dùng mật khẩu đăng nhập chính của tài khoản Gmail.
              </span>
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button className="w-full sm:w-auto text-xs" onClick={() => setShowGuide(false)}>
              Đã hiểu, đóng hướng dẫn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
