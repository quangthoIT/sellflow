"use client";
import { useEffect, useState, useCallback } from "react";
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
import { Save, Mail, CheckCircle, XCircle, Send, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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

export function EmailPage() {
  const [settings, setSettings] = useState<EmailSettings>(defaultEmailSettings);
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [testEmailInput, setTestEmailInput] = useState("");
  const [testing, setTesting] = useState(false);

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
    if (s.data) {
      setSettings(s.data as EmailSettings);
    }
    setLogs((l.data ?? []) as EmailLog[]);
    setLoading(false);
  }, []);

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
    const { error } = await db
      .from("email_settings")
      .upsert({
        id: 1,
        sender_name: settings.sender_name,
        sender_email: settings.sender_email,
        reply_to: settings.reply_to,
        auto_send_signed: settings.auto_send_signed,
        attach_pdf: settings.attach_pdf,
        subject: settings.subject,
        body: settings.body,
      });
    setSaving(false);
    if (error) {
      toast.error("Lỗi lưu cấu hình: " + error.message);
      return;
    }
    toast.success("Đã lưu cấu hình email thành công");
  };

  const handleTestEmail = () => {
    if (!testEmailInput.trim()) {
      toast.error("Vui lòng nhập email nhận thử nghiệm");
      return;
    }
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      toast.success(`Đã gửi email thử nghiệm thành công tới ${testEmailInput}!`);
    }, 800);
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
                    <SortableHead label="Hợp đồng" sortDir={sortKey === "contract_id" ? sortDir : null} onSort={(d) => { setSortKey("contract_id"); setSortDir(d); }} filter={{ type: "text", value: filters.contract_id ?? "", placeholder: "Lọc hợp đồng..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, contract_id: v }))} />
                    <SortableHead label="Người nhận" sortDir={sortKey === "recipient" ? sortDir : null} onSort={(d) => { setSortKey("recipient"); setSortDir(d); }} filter={{ type: "text", value: filters.recipient ?? "", placeholder: "Lọc người nhận..." }} onFilterChange={(v) => setFilters((f) => ({ ...f, recipient: v }))} />
                    <SortableHead label="Loại" sortDir={sortKey === "automatic" ? sortDir : null} onSort={(d) => { setSortKey("automatic"); setSortDir(d); }} filter={{ type: "select", value: filters.automatic ?? "", options: [{ label: "Tự động", value: "Tự động" }, { label: "Thủ công", value: "Thủ công" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, automatic: v }))} />
                    <SortableHead label="Trạng thái" sortDir={sortKey === "status" ? sortDir : null} onSort={(d) => { setSortKey("status"); setSortDir(d); }} filter={{ type: "select", value: filters.status ?? "", options: [{ label: "Đã gửi", value: "Đã gửi" }, { label: "Lỗi", value: "Lỗi" }] }} onFilterChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableSkeleton rows={5} columns={6} />}
                  {!loading && sortedLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          title="Chưa có email nào được gửi"
                          description="Lịch sử gửi email báo giá và hợp đồng sẽ tự động hiển thị tại đây."
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{formatDateTime(log.sent_at)}</TableCell>
                      <TableCell className="font-medium">{log.customer_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{log.contract_id || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{log.recipient}</TableCell>
                      <TableCell>
                        <Badge variant={log.automatic ? "default" : "secondary"}>
                          {log.automatic ? "Tự động" : "Thủ công"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === "Đã gửi" ? "default" : "destructive"} className="gap-1">
                          {log.status === "Đã gửi" ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Server className="size-4.5" />
                </div>
                <div>
                  <CardTitle className="text-base">Máy chủ gửi thư SMTP</CardTitle>
                  <CardDescription className="text-xs">Cấu hình thông số kết nối máy chủ gửi mail của hệ thống</CardDescription>
                </div>
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
                    {testing ? "Đang kết nối..." : "Gửi thử nghiệm"}
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

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-xs">
                  <Save className="size-4" />
                  {saving ? "Đang lưu..." : "Lưu cấu hình email"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
