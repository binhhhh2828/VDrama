"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, onSessionExpired } from "@/lib/api/client";
import type { User } from "@/lib/api/types";

// Trạng thái đăng nhập dùng chung phía trình duyệt. Đọc `/me` một lần khi tải trang; đăng nhập,
// đăng xuất hoặc phiên hết hạn thì cập nhật tại chỗ. Server không biết ai đang xem (HTML cache được).

export type SessionState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "user"; user: User };

type SessionContextValue = SessionState & {
  /** Đặt user sau khi đăng nhập/đăng ký (API đã trả User). */
  setUser: (user: User | null) => void;
  /** Đọc lại `/me` (ví dụ sau khi mua VIP). */
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading", user: null });

  const setUser = useCallback((user: User | null) => {
    setState(user ? { status: "user", user } : { status: "guest", user: null });
  }, []);

  const reload = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      // Lỗi mạng/server: coi như khách để giao diện không kẹt ở trạng thái chờ.
      setUser(null);
    }
  }, [setUser]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    let active = true;
    api.me().then(
      (user) => active && setUser(user),
      () => active && setUser(null), // lỗi mạng/server: coi như khách, không kẹt ở trạng thái chờ
    );
    const unsubscribe = onSessionExpired(() => setUser(null));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [setUser]);

  const value = useMemo(
    () => ({ ...state, setUser, reload, signOut }),
    [state, setUser, reload, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
