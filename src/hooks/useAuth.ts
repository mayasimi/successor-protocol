import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: { email: string; name: string; wallet?: string } | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setWallet: (address: string) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email, password) => {
        // In production, replace with API call
        if (email && password.length >= 6) {
          set({
            user: { email, name: email.split("@")[0] },
            isAuthenticated: true,
          });
          return true;
        }
        return false;
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      setWallet: (wallet) =>
        set((state) => ({
          user: state.user ? { ...state.user, wallet } : null,
        })),
    }),
    { name: "successor-auth" }
  )
);
