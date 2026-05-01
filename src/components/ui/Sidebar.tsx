"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "Heartbeat", href: "/heartbeat", icon: "❤️" },
  { name: "My Will", href: "/my-will", icon: "📄" },
  { name: "Next of Kin", href: "/next-of-kin", icon: "👥" },
  { name: "Attestations", href: "/attestations", icon: "🔗" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-cardBg border-r border-borderColor hidden lg:block">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-borderColor p-6">
          <span className="text-2xl">⌛</span>
          <span className="bg-gradient-to-r from-white to-accent bg-clip-text text-xl font-bold text-transparent">
            successor
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                pathname === item.href
                  ? "bg-primary/20 text-primary"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
