"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/ui/Sidebar";
import { Header } from "@/components/ui/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) return null;

  return (
    <div className="flex min-h-screen" style={{ background: "#0A0A0F", color: "#fff" }}>
      <Sidebar />
      <div className="flex-1" style={{ marginLeft: "280px" }}>
        <Header />
        <main style={{ padding: "2rem", maxWidth: "1400px", margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
