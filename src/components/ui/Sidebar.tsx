"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "⊞" },
  { label: "Heartbeat", href: "/heartbeat", icon: "♥" },
  { label: "My Will", href: "/my-will", icon: "📄" },
  { label: "Next of Kin", href: "/next-of-kin", icon: "👥" },
  { label: "Attestations", href: "/attestations", icon: "✓" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <span className="text-white font-bold text-lg">Successor</span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
              pathname === item.href
                ? "bg-primary text-white"
                : "text-muted hover:text-white hover:bg-background"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
