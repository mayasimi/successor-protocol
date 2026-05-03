import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Successor | Autonomous Will on 0G Chain",
  description:
    "Secure your digital legacy with on-chain heartbeats and attestations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <Web3Provider>
          {children}
          <Toaster richColors position="bottom-right" />
        </Web3Provider>
      </body>
    </html>
  );
}
