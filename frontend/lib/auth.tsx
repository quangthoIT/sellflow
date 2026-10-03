"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { db, type Session } from "@/lib/db";

type AuthState = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  signIn: async () => ({ error: "not initialized" }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Check active local storage session
      const localSess = typeof window !== "undefined" ? localStorage.getItem("sellflow_session") : null;
      if (localSess) {
        try {
          const parsed = JSON.parse(localSess);
          if (parsed && parsed.user && parsed.user.email) {
            setSession(parsed);
          } else {
            localStorage.removeItem("sellflow_session");
            localStorage.removeItem("sellflow_logged_in");
            setSession(null);
          }
        } catch {
          localStorage.removeItem("sellflow_session");
          localStorage.removeItem("sellflow_logged_in");
          setSession(null);
        }
      } else {
        setSession(null);
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const inputEmail = (email || "").trim().toLowerCase();
    const cleanPassword = password || "";
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").trim().replace(/\/+$/, "");

    if (!inputEmail || !cleanPassword) {
      return { error: "Vui lòng nhập đầy đủ Email và Mật khẩu" };
    }

    // Authenticate exclusively with Backend PostgreSQL Database API
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inputEmail, password: cleanPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success && data.user) {
        const sessionData: Session = {
          access_token: data.token || "token-" + Date.now(),
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            user_metadata: { name: data.user.name },
          },
        };
        setSession(sessionData);
        if (typeof window !== "undefined") {
          localStorage.setItem("sellflow_session", JSON.stringify(sessionData));
          localStorage.setItem("sellflow_logged_in", "true");
        }
        window.location.href = "/dashboard";
        return { error: null };
      }

      return {
        error: String(data.message || "Tài khoản hoặc mật khẩu không chính xác. Nếu vừa xóa/cài mới hệ thống, vui lòng bấm Đăng ký tài khoản mới.")
      };
    } catch (apiErr) {
      console.error("[Auth] Backend login error:", apiErr);
      return { error: "Không thể kết nối đến máy chủ Backend. Vui lòng kiểm tra lại dịch vụ Backend!" };
    }
  };

  const signOut = async () => {
    try {
      await db.auth.signOut();
    } catch {
      // Ignore error
    }
    localStorage.removeItem("sellflow_session");
    localStorage.removeItem("sellflow_logged_in");
    setSession(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
