"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: "fa-cube" },
  { name: "Heartbeat", href: "/heartbeat", icon: "fa-heartbeat" },
  { name: "My Will", href: "/my-will", icon: "fa-file-contract" },
  { name: "Next of Kin", href: "/next-of-kin", icon: "fa-users" },
  { name: "Attestations", href: "/attestations", icon: "fa-check-double" },
  { name: "Settings", href: "/settings", icon: "fa-sliders-h" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Font Awesome */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
      />
      <aside
        style={{
          width: "280px",
          background: "rgba(17,17,21,0.95)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid #1E1E24",
          padding: "2rem 1.5rem",
          position: "fixed",
          height: "100vh",
          top: 0,
          left: 0,
          zIndex: 40,
          overflowY: "auto",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "2rem",
            paddingBottom: "1.5rem",
            borderBottom: "1px solid #1E1E24",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg,#7A8B5E,#D4AF37)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fas fa-hourglass-half" style={{ color: "#fff" }} />
          </div>
          <span
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              background: "linear-gradient(135deg,#fff,#D4AF37)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            successor
          </span>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  color: active ? "#fff" : "#A0A0A0",
                  background: active
                    ? "linear-gradient(135deg,#7A8B5E,#5A6B3E)"
                    : "transparent",
                  textDecoration: "none",
                  fontWeight: active ? 600 : 400,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(122,139,94,0.15)";
                    (e.currentTarget as HTMLElement).style.color = "#fff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color = "#A0A0A0";
                  }
                }}
              >
                <i className={`fas ${item.icon}`} style={{ width: "16px" }} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
