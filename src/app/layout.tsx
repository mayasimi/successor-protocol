import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastContainer } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Successor Protocol",
  description: "Decentralized digital inheritance protocol",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <ThemeProvider>
            {children}
            <ToastContainer />
          </ThemeProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
