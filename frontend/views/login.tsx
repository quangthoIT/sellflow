"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Mail,
  CheckCircle2,
  ArrowRight,
  UserPlus,
  Building2,
  Phone,
  MapPin,
  FileText,
  Image as ImageIcon,
  Check,
  ArrowLeft,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

type ViewMode = "login" | "register_step1" | "register_step2";

export function LoginPage() {
  const { signIn } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("login");

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  // Step 1: Account Registration States
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Step 2: Company Setup States
  const [companyName, setCompanyName] = useState("");
  const [companyTax, setCompanyTax] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Calculate password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "bg-slate-200", text: "" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: "Yếu", color: "bg-red-500", text: "text-red-500" };
    if (score <= 3) return { score: 2, label: "Trung bình", color: "bg-amber-500", text: "text-amber-500" };
    return { score: 4, label: "Mạnh", color: "bg-emerald-500", text: "text-emerald-500" };
  };

  const strength = getPasswordStrength(regPassword);

  // Handle Logo Upload via FileReader
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp hình ảnh (JPG, PNG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Kích thước ảnh tối đa là 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
      toast.success("Đã tải lên logo công ty");
    };
    reader.readAsDataURL(file);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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

  // Step 1: Validate Account info before advancing to Step 2
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!regEmail || !regEmail.includes("@")) {
      toast.error("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }

    if (regPassword.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (regPassword !== regConfirmPassword) {
      toast.error("Mật khẩu xác nhận không trùng khớp");
      return;
    }

    setViewMode("register_step2");
  };

  // Step 2: Complete Company Onboarding
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error("Vui lòng nhập Tên công ty");
      return;
    }

    setRegLoading(true);

    try {
      // 1. Call Backend API to register user and company settings
      const payload = {
        email: regEmail.trim(),
        password: regPassword,
        companyName: companyName.trim(),
        logoUrl: logoUrl.trim(),
        companyTax: companyTax.trim(),
        companyPhone: companyPhone.trim(),
        companyAddress: companyAddress.trim(),
      };

      try {
        await fetch("http://localhost:4000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (backendErr) {
        console.warn("[Onboarding] Backend sync error, continuing local fallback:", backendErr);
      }

      // 2. Persist to LocalStorage for instant access
      if (typeof window !== "undefined") {
        localStorage.setItem("sellflow_admin_password", regPassword);
        localStorage.setItem("sellflow_admin_name", `Quản trị viên - ${companyName.trim()}`);

        const currentSettings = localStorage.getItem("sellflow_app_settings");
        const parsedSettings = currentSettings ? JSON.parse(currentSettings) : {};
        const updatedSettings = {
          ...parsedSettings,
          company_name: companyName.trim(),
          company_email: regEmail.trim(),
          company_tax: companyTax.trim(),
          company_phone: companyPhone.trim(),
          company_address: companyAddress.trim(),
          logo_url: logoUrl.trim(),
        };
        localStorage.setItem("sellflow_app_settings", JSON.stringify(updatedSettings));
      }

      // 3. Automatically sign in as admin and redirect
      await signIn(regEmail.trim(), regPassword);
      toast.success("Thiết lập workspace công ty thành công!", {
        description: `Chào mừng bạn đến với SellFlow - ${companyName.trim()}`,
      });
    } catch (err: any) {
      toast.error("Lỗi khi hoàn tất thiết lập: " + (err.message || "Vui lòng thử lại"));
    } finally {
      setRegLoading(false);
    }
  };

  const generateAndSendOtp = async (targetEmail: string) => {
    const generated = Math.floor(100000 + Math.random() * 900000).toString();
    setServerOtp(generated);
    setOtpExpiresAt(Date.now() + 5 * 60 * 1000);
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

    toast.success(`Đã gửi mã OTP đến ${targetEmail}`, {
      duration: 8000,
      description: "Vui lòng kiểm tra hộp thư đến (hoặc thư rác/spam) của bạn để lấy mã xác thực.",
    });

    return generated;
  };

  const handleOpenForgot = () => {
    setResetEmail(email || "");
    setResetStep("request");
    setOtpCode("");
    setServerOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setShowForgotModal(true);
  };

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

  // Left Banner Dynamic Content Configuration
  const bannerContent = {
    login: {
      tag: "HỆ THỐNG QUẢN LÝ BÁN HÀNG",
      title: "CHÀO MỪNG",
      subtitle: "ĐẾN VỚI HỆ THỐNG CỦA CHÚNG TÔI",
      desc: "Hệ thống quản trị bán hàng, báo giá, hợp đồng & tài chính tối ưu cho doanh nghiệp SMEs.",
    },
    register_step1: {
      tag: "BƯỚC 1 / 2 — TẠO TÀI KHOẢN",
      title: "BƯỚC 1",
      subtitle: "KHỞI TẠO QUẢN TRỊ VIÊN",
      desc: "Tạo tài khoản quản trị tối cao để bắt đầu thiết lập và vận hành doanh nghiệp trên hệ thống.",
    },
    register_step2: {
      tag: "BƯỚC 2 / 2 — THÔNG TIN CÔNG TY",
      title: "BƯỚC 2",
      subtitle: "THIẾT LẬP DOANH NGHIỆP",
      desc: "Cập nhật thông tin công ty & logo để tự động đồng bộ lên các mẫu báo giá, hợp đồng và hóa đơn.",
    },
  }[viewMode];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950 p-3 sm:p-5 md:p-8">
      {/* Outer Banner Card Container */}
      <div
        className="w-full max-w-5xl rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-2xl shadow-blue-500/20 bg-cover bg-center p-5 sm:p-8 md:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center relative transition-all"
        style={{ backgroundImage: "url('/assets/images/bg.png')" }}
      >
        {/* Left Side: Dynamic Informational Banner */}
        <div className="lg:col-span-5 text-white space-y-3 pr-0 lg:pr-2 transition-all">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white/90 text-[11px] font-semibold tracking-wider uppercase border border-white/20">
            <Sparkles className="size-3 text-blue-200" />
            {bannerContent.tag}
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight uppercase drop-shadow-sm">
            {bannerContent.title}
          </h1>

          <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-wide text-blue-100 opacity-95 uppercase">
            {bannerContent.subtitle}
          </h2>

          <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-sm font-normal">
            {bannerContent.desc}
          </p>
        </div>

        {/* Right Side: Interactive White Card */}
        <div className="lg:col-span-7 w-full">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 md:p-8 shadow-2xl text-slate-800 dark:text-slate-100 border border-white/20 transition-all">
            
            {/* SCREEN 1: ĐĂNG NHẬP */}
            {viewMode === "login" && (
              <div>
                <div className="mb-4">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#083874] dark:text-blue-400 tracking-tight">
                    Đăng nhập tài khoản
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                    Nhập thông tin đăng nhập để tiếp tục làm việc
                  </p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                  {/* Email Field */}
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <Input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email hoặc Tên đăng nhập"
                      className="pl-10 pr-3 h-10.5 text-sm rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  {/* Password Field */}
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mật khẩu"
                      className="pl-10 pr-10 h-10.5 text-sm rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 text-slate-900 dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                    </button>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 font-medium select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-3.5 cursor-pointer"
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
                    className="w-full h-10.5 bg-[#0062cc] hover:bg-[#0051ab] text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 mt-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4.5 animate-spin" /> Đang đăng nhập...
                      </>
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>
                </form>

                {/* Divider: Chưa có tài khoản? */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500">
                      Chưa có tài khoản?
                    </span>
                  </div>
                </div>

                {/* Create New Account Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewMode("register_step1")}
                  className="w-full h-10 border-blue-200 hover:border-blue-400 dark:border-slate-700 text-[#0062cc] dark:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm rounded-xl gap-2 transition-all shadow-2xs"
                >
                  <UserPlus className="size-4" />
                  Tạo tài khoản mới
                </Button>
              </div>
            )}

            {/* SCREEN 2: BƯỚC 1 - TẠO TÀI KHOẢN */}
            {viewMode === "register_step1" && (
              <div>
                {/* Stepper Header */}
                <div className="flex items-center justify-between max-w-[260px] mx-auto mb-4 relative">
                  <div className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="size-6.5 rounded-full bg-[#0062cc] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                        1
                      </div>
                      <span className="text-[11px] font-bold text-[#0062cc] dark:text-blue-400">
                        Tài khoản
                      </span>
                    </div>

                    <div className="flex-1 h-[2px] mx-2 -mt-3.5 bg-slate-200 dark:bg-slate-800" />

                    <div className="flex flex-col items-center gap-1">
                      <div className="size-6.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs font-bold">
                        2
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">
                        Công ty
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleStep1Submit} className="space-y-3">
                  {/* Email Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Email đăng ký <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      <Input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="admin@sellflow.vn"
                        className="pl-10 h-10 text-xs rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      <Input
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="pl-10 pr-10 h-10 text-xs rounded-xl"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                        tabIndex={-1}
                      >
                        {showRegPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>

                    {/* Password Strength Bar */}
                    {regPassword && (
                      <div className="pt-0.5 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1 flex-1 max-w-[160px]">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className={`h-1 flex-1 rounded-full transition-all ${
                                  step <= strength.score ? strength.color : "bg-slate-200 dark:bg-slate-800"
                                }`}
                              />
                            ))}
                          </div>
                          <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Xác nhận mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      <Input
                        type={showRegConfirmPassword ? "text" : "password"}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="pl-10 pr-10 h-10 text-xs rounded-xl"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                        tabIndex={-1}
                      >
                        {showRegConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <Button
                    type="submit"
                    className="w-full h-10.5 bg-[#0062cc] hover:bg-[#0051ab] text-white font-bold text-sm rounded-xl transition-all shadow-md mt-1 flex items-center justify-center gap-1.5"
                  >
                    <span>Tiếp tục</span>
                    <ArrowRight className="size-4" />
                  </Button>

                  {/* Back to Login Link */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("login")}
                      className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center gap-1 transition-colors"
                    >
                      <ArrowLeft className="size-3.5" /> Quay lại đăng nhập
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SCREEN 3: BƯỚC 2 - THÔNG TIN CÔNG TY */}
            {viewMode === "register_step2" && (
              <div>
                {/* Stepper Header */}
                <div className="flex items-center justify-between max-w-[260px] mx-auto mb-3.5 relative">
                  <div className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="size-6.5 rounded-full bg-[#0062cc] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                        <Check className="size-3.5 stroke-[3]" />
                      </div>
                      <span className="text-[11px] font-semibold text-[#0062cc] dark:text-blue-400">
                        Tài khoản
                      </span>
                    </div>

                    <div className="flex-1 h-[2px] mx-2 -mt-3.5 bg-[#0062cc]" />

                    <div className="flex flex-col items-center gap-1">
                      <div className="size-6.5 rounded-full bg-[#0062cc] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                        2
                      </div>
                      <span className="text-[11px] font-bold text-[#0062cc] dark:text-blue-400">
                        Công ty
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCompleteOnboarding} className="space-y-2.5">
                  {/* Company Name Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      Tên công ty <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      <Input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Công ty TNHH SellFlow"
                        className="pl-10 h-9.5 text-xs rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  {/* Company Logo Field (Inline Compact) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Logo công ty (không bắt buộc)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                    />

                    {logoUrl ? (
                      <div className="flex items-center gap-2.5 p-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="size-7 object-contain rounded border bg-white"
                        />
                        <div className="flex-1 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          Đã chọn logo công ty
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogoUrl("")}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl px-3 py-1.5 text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <ImageIcon className="size-4 text-slate-400" />
                          <span className="text-[11px]">Tải ảnh logo (JPG, PNG &lt; 2MB)</span>
                        </div>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded text-[11px]">
                          Chọn tệp
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tax Code & Phone Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Mã số thuế
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <Input
                          type="text"
                          value={companyTax}
                          onChange={(e) => setCompanyTax(e.target.value)}
                          placeholder="Mã số thuế"
                          className="pl-8.5 h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Số điện thoại
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <Input
                          type="text"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          placeholder="Số hotline"
                          className="pl-8.5 h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Company Address Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Địa chỉ công ty
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                      <Input
                        type="text"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="Địa chỉ trụ sở chính"
                        className="pl-8.5 h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={regLoading}
                    className="w-full h-10.5 bg-[#0062cc] hover:bg-[#0051ab] text-white font-bold text-sm rounded-xl transition-all shadow-md mt-1 flex items-center justify-center gap-2"
                  >
                    {regLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Đang thiết lập...
                      </>
                    ) : (
                      "Hoàn tất thiết lập"
                    )}
                  </Button>

                  {/* Back to Step 1 */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("register_step1")}
                      className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 inline-flex items-center gap-1 transition-colors"
                    >
                      <ArrowLeft className="size-3.5" /> Quay lại bước 1
                    </button>
                  </div>
                </form>
              </div>
            )}

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
