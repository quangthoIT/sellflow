"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { User, Lock, Eye, EyeOff, Loader2, KeyRound, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("admin@sellflow.vn");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // Forgot Password Dialog States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [otpCode, setOtpCode] = useState("");
  const [serverOtp, setServerOtp] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // On mount: Load remembered credentials if exists
  useEffect(() => {
    const savedEmail = localStorage.getItem("sellflow_remember_email");
    const savedRemember = localStorage.getItem("sellflow_remember_me");
    if (savedEmail) {
      setEmail(savedEmail);
    }
    if (savedRemember !== null) {
      setRememberMe(savedRemember === "true");
    }
  }, []);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Persist or clear remembered credentials
    if (rememberMe) {
      localStorage.setItem("sellflow_remember_email", email);
      localStorage.setItem("sellflow_remember_me", "true");
    } else {
      localStorage.removeItem("sellflow_remember_email");
      localStorage.setItem("sellflow_remember_me", "false");
    }

    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Đăng nhập thất bại: " + error);
    }
  };

  const generateAndSendOtp = async (targetEmail: string) => {
    // Sinh mã OTP ngẫu nhiên 6 chữ số
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setServerOtp(generated);
    setOtpExpiresAt(Date.now() + 5 * 60 * 1000); // Hết hạn trong 5 phút
    setCooldown(60);

    try {
      let smtpOptions: any = undefined;
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("sellflow_email_settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.sender_email && parsed.smtp_password) {
            smtpOptions = {
              host: parsed.smtp_host || "smtp.gmail.com",
              port: Number(parsed.smtp_port) || 587,
              user: parsed.sender_email,
              pass: parsed.smtp_password,
              senderName: parsed.sender_name || "SellFlow Support",
            };
          }
        }
      }

      await fetch("http://localhost:4000/api/emails/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          otp: generated,
          smtpOptions,
        }),
      });
    } catch (err) {
      console.error("Lỗi khi gửi email OTP:", err);
    }

    // Thông báo hướng dẫn người dùng mở email
    toast.success(`Đã gửi mã OTP đến ${targetEmail}`, {
      duration: 8000,
      description: "Vui lòng kiểm tra hộp thư đến (hoặc thư rác/spam) của bạn để lấy mã xác thực.",
    });

    return generated;
  };

  // Open Forgot Password Modal
  const handleOpenForgot = () => {
    setResetEmail(email || "admin@sellflow.vn");
    setResetStep("request");
    setOtpCode("");
    setServerOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setShowForgotModal(true);
  };

  // Request Reset OTP Link
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }
    setResetLoading(true);

    try {
      await generateAndSendOtp(resetEmail);
      setResetStep("verify");
    } finally {
      setResetLoading(false);
    }
  };

  // Submit New Password Reset
  const handleConfirmReset = (e: React.FormEvent) => {
    e.preventDefault();

    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error("Vui lòng nhập đủ mã OTP 6 chữ số");
      return;
    }

    if (Date.now() > otpExpiresAt) {
      toast.error("Mã OTP đã hết hạn! Vui lòng nhấn 'Gửi lại mã' để nhận mã mới.");
      return;
    }

    if (otpCode.trim() !== serverOtp) {
      toast.error("Mã OTP xác thực không chính xác! Vui lòng kiểm tra lại.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không trùng khớp");
      return;
    }

    setResetLoading(true);
    setTimeout(() => {
      setResetLoading(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("sellflow_admin_password", newPassword);
      }
      setPassword(newPassword);
      setEmail(resetEmail);
      setShowForgotModal(false);
      toast.success("Đặt lại mật khẩu thành công! Mật khẩu mới đã được cập nhật.");
    }, 600);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 md:p-10">
      {/* Outer Banner Card Container with bg.png */}
      <div
        className="w-full max-w-6xl rounded-[32px] sm:rounded-[40px] overflow-hidden shadow-2xl shadow-blue-500/25 bg-cover bg-center p-6 sm:p-12 md:p-16 lg:p-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center relative"
        style={{ backgroundImage: "url('/assets/images/bg.png')" }}
      >
        {/* Left Side: Welcome Text Banner */}
        <div className="lg:col-span-6 text-white space-y-4 sm:space-y-6 pr-0 lg:pr-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            CHÀO MỪNG
          </h1>
          <h2 className="text-base sm:text-lg md:text-xl font-semibold tracking-wider opacity-95">
            ĐẾN VỚI HỆ THỐNG CỦA CHÚNG TÔI
          </h2>
          <p className="text-xs sm:text-base md:text-lg opacity-85 leading-relaxed max-w-lg">
            Đăng nhập để truy cập và quản lý hệ thống một cách nhanh chóng, an toàn và hiệu quả.
          </p>
        </div>

        {/* Right Side: Expanded White Login Form Card */}
        <div className="lg:col-span-6 w-full">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[32px] p-8 sm:p-10 md:p-12 shadow-2xl text-slate-800 dark:text-slate-100 border border-white/20">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#083874] dark:text-blue-400 mb-2 tracking-tight">
              Đăng nhập
            </h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-8 font-normal">
              Vui lòng nhập thông tin tài khoản để tiếp tục
            </p>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              {/* Username / Email Field */}
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <Input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tên đăng nhập hoặc Email"
                  className="pl-12 pr-4 h-12 sm:h-14 text-sm sm:text-base rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-slate-900 dark:text-white"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu"
                  className="pl-12 pr-12 h-12 sm:h-14 text-sm sm:text-base rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all text-slate-900 dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>

              {/* Checkbox & Forgot Password */}
              <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-600 dark:text-slate-400 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-4 sm:size-5 cursor-pointer"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <button
                  type="button"
                  onClick={handleOpenForgot}
                  className="font-semibold text-[#0062cc] hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-14 bg-[#0062cc] hover:bg-[#0051ab] text-white font-bold text-base sm:text-lg rounded-2xl transition-all shadow-md hover:shadow-xl active:scale-[0.99] flex items-center justify-center gap-2 mt-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-6 animate-spin" /> Đang đăng nhập...
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Tài khoản dùng thử: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">admin@sellflow.vn</span> / <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">admin123</span>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Interactive Modal */}
      <Dialog open={showForgotModal} onOpenChange={setShowForgotModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="size-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <KeyRound className="size-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Khôi phục mật khẩu</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              {resetStep === "request"
                ? "Nhập địa chỉ email tài khoản của bạn để nhận mã xác thực đặt lại mật khẩu."
                : `Mã OTP xác thực đã được gửi đến ${resetEmail}. Nhập mã và mật khẩu mới bên dưới.`}
            </DialogDescription>
          </DialogHeader>

          {resetStep === "request" ? (
            <form onSubmit={handleSendResetCode} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email đăng ký *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="email@company.com"
                    className="pl-10 h-10 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="h-9 text-xs" onClick={() => setShowForgotModal(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={resetLoading} className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  {resetLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  <span>Gửi mã xác thực</span>
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleConfirmReset} className="space-y-3.5 pt-1">
              {/* Thông báo hướng dẫn kiểm tra hòm thư email */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-900 text-xs flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
                <Mail className="size-4.5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-blue-950 dark:text-blue-100">Kiểm tra hộp thư email của bạn</p>
                  <p className="text-[11px] text-blue-700/90 dark:text-blue-300 leading-relaxed">
                    Hệ thống đã gửi mã OTP 6 chữ số đến <strong className="font-mono text-blue-950 dark:text-blue-100">{resetEmail}</strong>. Vui lòng mở hộp thư đến (hoặc thư rác/spam) để lấy mã và nhập vào ô bên dưới.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nhập mã OTP (6 chữ số) *
                  </label>
                  {cooldown > 0 ? (
                    <span className="text-[11px] text-muted-foreground font-mono">Gửi lại sau {cooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => generateAndSendOtp(resetEmail)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Gửi lại mã
                    </button>
                  )}
                </div>
                <Input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ví dụ: 123456"
                  className="h-10 text-xs font-mono tracking-widest text-center rounded-xl font-bold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mật khẩu mới (tối thiểu 6 ký tự) *
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Xác nhận mật khẩu mới *
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" className="h-9 text-xs" onClick={() => setResetStep("request")}>
                  Quay lại
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-semibold"
                >
                  {resetLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  <span>Xác nhận đổi mật khẩu</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
