"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface UserProfile {
  userid: string;
  nama: string;
  role: string;
  kantor: string;
  tipe?: string;
  loginshift?: boolean;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  permissions: Record<string, any>;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setAuth: (token: string, user: UserProfile, permissions?: Record<string, any>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      permissions: {},
      isAuthenticated: false,
      isLoading: false,

      setAuth: (token, user, permissions = {}) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("ipos4_auth_token", token);
        }
        set({
          token,
          user,
          permissions,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("ipos4_auth_token");
        }
        set({
          token: null,
          user: null,
          permissions: {},
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: "ipos_auth_storage",
    }
  )
);
