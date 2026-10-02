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
      try {
        const { data } = await db.auth.getSession();
        if (data?.session) {
          setSession(data.session);
          setLoading(false);
          return;
        }
      } catch {
        // Ignore auth error
      }

      // Check local storage session fallback
      const localSess = localStorage.getItem("sellflow_session");
      if (localSess) {
        try {
          setSession(JSON.parse(localSess));
        } catch {
          setSession(null);
        }
      } else {
        const isLogged = localStorage.getItem("sellflow_logged_in");
        if (isLogged === "true") {
          const mockSess = {
            access_token: "mock-token-admin",
            user: { id: "admin", email: "admin@sellflow.vn" },
          } as unknown as Session;
          setSession(mockSess);
        } else {
          setSession(null);
        }
      }
      setLoading(false);
    })();

    const { data: listener } = db.auth.onAuthStateChange((_event: any, sess: Session | null) => {
      if (sess) setSession(sess);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const defaultEnvPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
    const defaultEnvEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@sellflow.vn";

    const validPassword =
      typeof window !== "undefined"
        ? localStorage.getItem("sellflow_admin_password") || defaultEnvPassword
        : defaultEnvPassword;

    if (password !== validPassword) {
      return { error: "Mật khẩu không chính xác. Vui lòng kiểm tra lại!" };
    }

    const savedName =
      typeof window !== "undefined"
        ? localStorage.getItem("sellflow_admin_name") || "Quản trị viên"
        : "Quản trị viên";

    const sessionData: Session = {
      access_token: "token-" + Date.now(),
      user: {
        id: "admin-1",
        email: email || defaultEnvEmail,
        name: savedName,
        user_metadata: { name: savedName },
      },
    };

    setSession(sessionData);
    if (typeof window !== "undefined") {
      localStorage.setItem("sellflow_session", JSON.stringify(sessionData));
      localStorage.setItem("sellflow_logged_in", "true");
    }
    window.location.href = "/dashboard";
    return { error: null };
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
