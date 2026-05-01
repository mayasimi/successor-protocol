"use client";

import { useState } from "react";
import { getItem, setItem, removeItem } from "@/lib/storage";

interface User {
  id: string;
  name: string;
  email: string;
}

const AUTH_KEY = "successor_user";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => getItem<User>(AUTH_KEY));

  const login = (userData: User) => {
    setItem(AUTH_KEY, userData);
    setUser(userData);
  };

  const logout = () => {
    removeItem(AUTH_KEY);
    setUser(null);
  };

  return { user, login, logout, isAuthenticated: !!user };
}
