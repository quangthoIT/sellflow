import { useEffect, useState, useCallback } from "react";
import { supabase, type EmailSettings, type EmailLog } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Mail, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export function EmailPage() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, l] = await Promise.all([
      supabase.from("email_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("email_logs").select("*").order("sent_at", { ascending: false }),
    ]);
    setSettings(s.data as EmailSettings | null);
    setLogs((l.data ?? []) as EmailLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from("email_settings").update({
      sender_name: settings.sender_name,
      sender_email: settings.sender_email,
      reply_to: settings.reply_to,
      auto_send_signed: settings.auto_send_signed,
      attach_pdf: settings.attach_pdf,
      subject: settings.subject,
      body: settings.body,
    }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error("Lỗi lưu cấu hình"); return; }
    toast.success("Đã lưu cấu hình email");
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs" className="gap-2"><Mail className="size-4" /> Lịch sử gửi</TabsTrigger>
          <TabsTrigger value="settings">Cấu hình email</TabsTrigger>
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
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead>Hợp đồng</TableHead>
                    <TableHead>Người nhận</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chưa có email nào được gửi</TableCell></TableRow>
                  )}
                  {logs.map((log) => (
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
        <TabsContent value="settings">
          {settings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cấu hình email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tên người gửi</Label>
                    <Input value={settings.sender_name} onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email người gửi</Label>
                    <Input type="email" value={settings.sender_email} onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reply-To</Label>
                    <Input type="email" value={settings.reply_to} onChange={(e) => setSettings({ ...settings, reply_to: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Tiêu đề email</Label>
                  <Input value={settings.subject} onChange={(e) => setSettings({ ...settings, subject: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Hỗ trợ biến: {`{{SO_HOP_DONG}}, {{TEN_KHACH_HANG}}, {{TONG_TIEN}}, {{DA_THANH_TOAN}}, {{CON_PHAI_THU}}`}</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Nội dung email</Label>
                  <Textarea value={settings.body} onChange={(e) => setSettings({ ...settings, body: e.target.value })} rows={8} />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.auto_send_signed}
                      onCheckedChange={(v) => setSettings({ ...settings, auto_send_signed: v })}
                    />
                    <Label>Tự động gửi khi hợp đồng được ký</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={settings.attach_pdf}
                      onCheckedChange={(v) => setSettings({ ...settings, attach_pdf: v })}
                    />
                    <Label>Đính kèm PDF</Label>
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  <Save className="size-4" /> {saving ? "Đang lưu..." : "Lưu cấu hình"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
